import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Listing, ListingCategory, ListingCondition } from '../../types';
import { ListingQuestions } from './ListingQuestions';

const API_BASE_URL = 'http://localhost:5000/api';
const emptyListingForm = {
  title: '',
  category: 'other' as ListingCategory,
  description: '',
  condition: 'Gently Used' as ListingCondition,
  photos: '',
  startingPrice: '',
  minIncrement: '',
  closingTime: '',
};

interface SellerAlert {
  id: string;
  message: string;
  timestamp: string;
}

const statusLabel = (listing: Listing) => {
  if (listing.handoverStatus === 'APPROVED_RESERVED') return 'Reserved for winner';
  if (listing.handoverStatus === 'HANDOVER_COMPLETED') return 'Sale completed';
  if (listing.handoverStatus === 'FAILED_PICKUP') return 'Pickup failed';
  if (listing.handoverStatus === 'SELLER_CANCELLED') return 'Seller cancelled sale';
  if (listing.handoverStatus === 'REJECTED') return 'Winning bid rejected';
  if (listing.handoverStatus === 'AWAITING_SELLER_APPROVAL') return 'Awaiting your decision';
  return listing.status === 'PROVISIONALLY_CLOSED' ? 'Auction closed' : listing.status;
};

export const SellerDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingForm, setListingForm] = useState(emptyListingForm);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<SellerAlert[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [now, setNow] = useState(0);
  const previousListings = useRef<Map<string, Listing> | null>(null);

  const loadListings = useCallback(async (notify = false) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) throw new Error('Please sign in again to manage your listings.');

    const response = await fetch(`${API_BASE_URL}/listings/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not load your listings.');

    const nextListings = (data.listings as Listing[]).map((listing) => ({
      ...listing,
      bids: listing.bids ?? [],
      photos: listing.photos ?? [],
    }));

    if (notify && previousListings.current) {
      const newAlerts: SellerAlert[] = [];
      for (const listing of nextListings) {
        const previous = previousListings.current.get(listing.id);
        if (!previous) continue;

        if (listing.totalBids > previous.totalBids) {
          newAlerts.push({
            id: `${listing.id}-bid-${listing.totalBids}`,
            message: `New bid on ${listing.title}: ₹${listing.currentBid.toLocaleString()} by ${listing.leadingBidderName ?? 'a bidder'}.`,
            timestamp: new Date().toISOString(),
          });
        }
        if (previous.status === 'ACTIVE' && ['PROVISIONALLY_CLOSED', 'UNSOLD'].includes(listing.status)) {
          newAlerts.push({
            id: `${listing.id}-closed`,
            message: listing.totalBids
              ? `${listing.title} has closed. Review the winning bid of ₹${listing.currentBid.toLocaleString()}.`
              : `${listing.title} has closed with no bids and is marked unsold.`,
            timestamp: new Date().toISOString(),
          });
        }
        if (previous.handoverStatus !== listing.handoverStatus && listing.handoverStatus &&
          ['APPROVED_RESERVED', 'REJECTED', 'HANDOVER_COMPLETED', 'FAILED_PICKUP', 'SELLER_CANCELLED'].includes(listing.handoverStatus)) {
          newAlerts.push({
            id: `${listing.id}-${listing.handoverStatus}`,
            message: `${listing.title}: ${statusLabel(listing)}.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (newAlerts.length) {
        setAlerts((existing) => [...newAlerts, ...existing].slice(0, 8));
        if (notificationPermission === 'granted') {
          for (const alert of newAlerts) new Notification('BidNest seller update', { body: alert.message });
        }
      }
    }

    previousListings.current = new Map(nextListings.map((listing) => [listing.id, listing]));
    setListings(nextListings);
  }, [notificationPermission]);

  useEffect(() => {
    let active = true;
    const refresh = async (notify: boolean) => {
      try {
        await loadListings(notify);
        if (active) setError('');
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your listings.');
      }
    };

    void refresh(false);
    const interval = window.setInterval(() => void refresh(true), 20000);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearInterval(timer);
    };
  }, [loadListings]);

  if (!currentUser) return null;

  const token = () => localStorage.getItem('bidnest_auth_token');
  const resetForm = () => {
    setListingForm(emptyListingForm);
    setEditingListingId(null);
    setShowListingForm(false);
  };

  const saveListing = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const authToken = token();
    if (!authToken) {
      setError('Please sign in again to manage your listings.');
      return;
    }
    try {
      const payload = {
        ...listingForm,
        photos: listingForm.photos.split(/\r?\n|,/).map((photo) => photo.trim()).filter(Boolean),
        startingPrice: Number(listingForm.startingPrice),
        minIncrement: Number(listingForm.minIncrement),
        closingTime: new Date(listingForm.closingTime).toISOString(),
      };
      const response = await fetch(`${API_BASE_URL}/listings${editingListingId ? `/${editingListingId}` : ''}`, {
        method: editingListingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save listing.');
      await loadListings();
      setMessage(editingListingId ? 'Listing updated.' : 'Listing published.');
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save listing.');
    }
  };

  const editListing = (listing: Listing) => {
    setListingForm({
      title: listing.title,
      category: listing.category,
      description: listing.description,
      condition: listing.condition,
      photos: listing.photos.join('\n'),
      startingPrice: String(listing.startingPrice),
      minIncrement: String(listing.minIncrement),
      closingTime: new Date(listing.closingTime).toISOString().slice(0, 16),
    });
    setEditingListingId(listing.id);
    setShowListingForm(true);
    setMessage('');
    setError('');
  };

  const cancelListing = async (listing: Listing) => {
    if (!window.confirm(`Cancel "${listing.title}"? Only active listings without bids can be cancelled.`)) return;
    const authToken = token();
    if (!authToken) {
      setError('Please sign in again to manage your listings.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${listing.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not cancel listing.');
      setListings((existing) => existing.map((item) => item.id === listing.id ? data.listing : item));
      setMessage('Listing cancelled.');
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel listing.');
    }
  };

  const recordOutcome = async (listing: Listing, action: string) => {
    const authToken = token();
    if (!authToken) {
      setError('Please sign in again to manage your listings.');
      return;
    }
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${listing.id}/management`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action, notes: notes[listing.id] ?? '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not record this outcome.');
      setListings((existing) => existing.map((item) => item.id === listing.id ? data.listing : item));
      setMessage(data.message);
    } catch (outcomeError) {
      setError(outcomeError instanceof Error ? outcomeError.message : 'Could not record this outcome.');
    }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const countdown = (closingTime: string) => {
    if (!now) return 'Updating countdown…';
    const remaining = new Date(closingTime).getTime() - now;
    if (remaining <= 0) return 'Auction closed';
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const activeCount = listings.filter((listing) => listing.status === 'ACTIVE').length;
  const pendingCount = listings.filter((listing) => listing.handoverStatus === 'AWAITING_SELLER_APPROVAL').length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950 via-slate-900 to-pink-950 p-6 text-white shadow-2xl sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase text-purple-200">
              <Tag className="h-4 w-4" /> Seller workspace
            </div>
            <h1 className="text-3xl font-extrabold">Welcome, {currentUser.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Create and manage your auctions, review public bids, decide on winning offers, and track each campus handover.</p>
            <p className="mt-2 text-xs text-slate-400">{currentUser.rollNumber} · {currentUser.hostel}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400">Active auctions</div>
              <div className="mt-1 text-2xl font-bold">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400">Decisions needed</div>
              <div className="mt-1 text-2xl font-bold text-amber-300">{pendingCount}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Your auctions</h2>
          <p className="text-sm text-slate-400">Bids and bidder details are visible in each listing's public history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void requestNotifications()} disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60">
            <Bell className="h-4 w-4" />{notificationPermission === 'granted' ? 'Alerts enabled' : notificationPermission === 'denied' ? 'Alerts blocked in browser' : notificationPermission === 'unsupported' ? 'Alerts unavailable' : 'Enable browser alerts'}
          </button>
          <button type="button" onClick={() => { setShowListingForm(true); setMessage(''); setError(''); }} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500">
            <Plus className="h-4 w-4" /> Create listing
          </button>
        </div>
      </section>

      {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      {alerts.length > 0 && (
        <section aria-label="Recent seller notifications" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Bell className="h-4 w-4 text-indigo-300" />Recent activity</h3>
          <ul className="space-y-2">
            {alerts.map((alert) => <li key={alert.id} className="flex justify-between gap-3 text-sm text-slate-300"><span>{alert.message}</span><time className="shrink-0 text-xs text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</time></li>)}
          </ul>
        </section>
      )}

      {showListingForm && (
        <form onSubmit={saveListing} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <h3 className="text-lg font-semibold text-white sm:col-span-2 lg:col-span-3">{editingListingId ? 'Edit listing' : 'Create a separate auction for your item'}</h3>
          <label className="text-xs text-slate-300">Item title
            <input required maxLength={120} value={listingForm.title} onChange={(event) => setListingForm({ ...listingForm, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Category
            <select value={listingForm.category} onChange={(event) => setListingForm({ ...listingForm, category: event.target.value as ListingCategory })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white">
              <option value="cycle">Cycle</option><option value="calculator">Calculator</option><option value="books">Books</option><option value="electronics">Electronics</option><option value="hostel_essentials">Hostel essentials</option><option value="sports">Sports</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Condition
            <select value={listingForm.condition} onChange={(event) => setListingForm({ ...listingForm, condition: event.target.value as ListingCondition })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white">
              <option>Like New</option><option>Gently Used</option><option>Functional</option><option>Heavily Used</option>
            </select>
          </label>
          <label className="text-xs text-slate-300 sm:col-span-2">Description
            <textarea required maxLength={2000} rows={3} value={listingForm.description} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Item photo URLs (one per line)
            <textarea required rows={3} placeholder="https://example.com/item-photo.jpg" value={listingForm.photos} onChange={(event) => setListingForm({ ...listingForm, photos: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Starting price (₹)
            <input required type="number" min="1" value={listingForm.startingPrice} onChange={(event) => setListingForm({ ...listingForm, startingPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Minimum bid increment (₹)
            <input required type="number" min="1" value={listingForm.minIncrement} onChange={(event) => setListingForm({ ...listingForm, minIncrement: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Closing date and time
            <input required type="datetime-local" min={now ? new Date(now).toISOString().slice(0, 16) : undefined} value={listingForm.closingTime} onChange={(event) => setListingForm({ ...listingForm, closingTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><Save className="h-4 w-4" />{editingListingId ? 'Save changes' : 'Publish auction'}</button>
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"><X className="h-4 w-4" />Close</button>
          </div>
        </form>
      )}

      {listings.length === 0 && !error && <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">You have not created any listings yet.</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {listings.map((listing) => {
          const canDecide = listing.status === 'PROVISIONALLY_CLOSED' && listing.handoverStatus === 'AWAITING_SELLER_APPROVAL';
          const isReserved = listing.handoverStatus === 'APPROVED_RESERVED';
          const canEditOrCancel = listing.status === 'ACTIVE' && listing.totalBids === 0;
          const sortedBids = [...listing.bids].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return (
            <article key={listing.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/80">
              <div className="grid sm:grid-cols-[180px_1fr]">
                <div className="relative min-h-40 bg-slate-900">
                  {listing.photos[0] && <img src={listing.photos[0]} alt={listing.title} className="h-full min-h-40 w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded bg-slate-950/85 px-2 py-1 text-[10px] font-bold uppercase text-slate-200">{listing.category.replace('_', ' ')}</span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-bold text-white">{listing.title}</h3><p className="mt-1 text-xs text-slate-400">{listing.condition} · {statusLabel(listing)}</p></div>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-300"><Clock className="h-3.5 w-3.5" />{listing.status === 'ACTIVE' ? countdown(listing.closingTime) : 'Closed'}</span>
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-300">{listing.description}</p>
                  <ListingQuestions
                    listingId={listing.id}
                    questions={listing.questions ?? []}
                    mode="seller"
                    onQuestionsUpdated={(questions) => setListings((existing) => existing.map((item) => item.id === listing.id ? { ...item, questions } : item))}
                  />
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/70 p-3 text-xs">
                    <div><span className="text-slate-500">Leading bid</span><div className="mt-1 text-lg font-bold text-emerald-300">₹{listing.currentBid.toLocaleString()}</div></div>
                    <div><span className="text-slate-500">Bidder / bid count</span><div className="mt-1 font-semibold text-white">{listing.leadingBidderName ?? 'No bids'} · {listing.totalBids}</div></div>
                    <div><span className="text-slate-500">Starting price</span><div className="mt-1 text-slate-200">₹{listing.startingPrice.toLocaleString()}</div></div>
                    <div><span className="text-slate-500">Closes</span><div className="mt-1 text-slate-200">{new Date(listing.closingTime).toLocaleString()}</div></div>
                  </div>
                  {listing.handoverStatus && <p className="text-xs text-amber-200">Outcome: {statusLabel(listing)}{listing.handoverNotes ? ` — ${listing.handoverNotes}` : ''}</p>}
                  <details className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-indigo-200">Public bid history ({listing.bids.length})</summary>
                    <ol className="mt-3 max-h-52 space-y-2 overflow-auto">
                      {sortedBids.map((bid, index) => (
                        <li key={`${bid.id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-2 text-xs">
                          <span className="text-slate-200">{bid.bidderName} <span className="text-slate-500">({bid.bidderRoll ?? 'Student'})</span></span>
                          <span className="font-semibold text-white">₹{bid.amount.toLocaleString()}</span>
                          <time className="text-slate-500">{new Date(bid.timestamp).toLocaleString()}</time>
                        </li>
                      ))}
                      {!sortedBids.length && <li className="text-xs text-slate-500">No bids have been placed.</li>}
                    </ol>
                  </details>
                  {(canDecide || isReserved) && (
                    <label className="block text-xs text-slate-400">Handover / outcome notes
                      <textarea maxLength={1000} rows={2} value={notes[listing.id] ?? ''} onChange={(event) => setNotes({ ...notes, [listing.id]: event.target.value })} placeholder="Record pickup arrangements or outcome details" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
                    </label>
                  )}
                  {canDecide && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void recordOutcome(listing, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" />Approve ₹{listing.currentBid.toLocaleString()}</button>
                      <button type="button" onClick={() => void recordOutcome(listing, 'reject')} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10">Reject winning bid</button>
                    </div>
                  )}
                  {isReserved && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void recordOutcome(listing, 'complete')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Confirm handover complete</button>
                      <button type="button" onClick={() => void recordOutcome(listing, 'failed_pickup')} className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10">Record failed pickup</button>
                      <button type="button" onClick={() => void recordOutcome(listing, 'seller_cancelled')} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10">Record seller cancellation</button>
                    </div>
                  )}
                  {canEditOrCancel && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editListing(listing)} className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500"><Pencil className="h-4 w-4" />Edit</button>
                      <button type="button" onClick={() => void cancelListing(listing)} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10">Cancel listing</button>
                    </div>
                  )}
                  {listing.totalBids > 0 && listing.status === 'ACTIVE' && <p className="text-xs text-slate-500">Listings cannot be edited or cancelled after bids are placed.</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Browser pop-up alerts are optional and only activate after permission is granted. Seller updates are also listed above.</p>
    </div>
  );
};
