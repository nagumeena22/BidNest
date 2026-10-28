import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Listing, ListingCategory, ListingCondition } from '../../types';
import { SellerDashboard } from './SellerDashboard';
import { BuyerAssistant } from './BuyerAssistant';
import { WantedAlerts } from './WantedAlerts';
import { ListingQuestions } from './ListingQuestions';
import { 
  ShoppingBag, 
  Tag, 
  Clock, 
  ShieldCheck, 
  Zap, 
  Bot, 
  CheckCircle2, 
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  Bell
} from 'lucide-react';

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

const BuyerPortalView: React.FC = () => {
  const { currentUser, activeRole } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [buyerBids, setBuyerBids] = useState<Listing[]>([]);
  const [buyerAlerts, setBuyerAlerts] = useState<{ id: string; message: string; timestamp: string }[]>([]);
  const [buyerActivityError, setBuyerActivityError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [listingForm, setListingForm] = useState(emptyListingForm);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingMessage, setListingMessage] = useState('');
  const [bidMessage, setBidMessage] = useState<Record<string, string>>({});
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [proxyMaxAmounts, setProxyMaxAmounts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({ keyword: '', category: 'all', condition: 'all', minPrice: '', maxPrice: '', closingSoon: false });
  const [, setTick] = useState(0);
  const previousBuyerBids = useRef<Map<string, Listing> | null>(null);

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) return;
    fetch(`${API_BASE_URL}/listings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load listings.');
        setListings((existing) => existing.length ? existing : data.listings.map((item: Listing) => ({
          ...item,
          bids: item.bids ?? [],
          originalClosingTime: item.originalClosingTime ?? item.closingTime,
          isExtended: item.isExtended ?? false,
        })));
      })
      .catch((error: Error) => setListingMessage(error.message));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token || !currentUser) return;

    let active = true;
    const refresh = async (checkActivity: boolean) => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [marketResponse, activityResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/listings`, { headers }),
          fetch(`${API_BASE_URL}/listings/mine/bids`, { headers }),
        ]);
        const [marketData, activityData] = await Promise.all([marketResponse.json(), activityResponse.json()]);
        if (!marketResponse.ok) throw new Error(marketData.message || 'Could not load listings.');
        if (!activityResponse.ok) throw new Error(activityData.message || 'Could not load your bid activity.');
        if (!active) return;

        const normalize = (items: Listing[]) => items.map((item) => ({
          ...item,
          bids: item.bids ?? [],
          originalClosingTime: item.originalClosingTime ?? item.closingTime,
          isExtended: item.isExtended ?? false,
        }));
        const nextBuyerBids = normalize(activityData.listings as Listing[]);
        const buyerBidById = new Map(nextBuyerBids.map((item) => [item.id, item]));
        const nextListings = normalize(marketData.listings as Listing[]).map((item) => ({
          ...item,
          myProxyBid: buyerBidById.get(item.id)?.myProxyBid ?? null,
        }));

        if (checkActivity && previousBuyerBids.current) {
          const newAlerts: { id: string; message: string; timestamp: string }[] = [];
          for (const item of nextBuyerBids) {
            const previous = previousBuyerBids.current.get(item.id);
            if (!previous) continue;

            const wasLeading = previous.leadingBidderId === currentUser.id;
            const isLeadingNow = item.leadingBidderId === currentUser.id;
            if (wasLeading && !isLeadingNow && item.status === 'ACTIVE') {
              newAlerts.push({ id: `${item.id}-outbid-${item.totalBids}`, message: `You were outbid on ${item.title}. The leading bid is ₹${item.currentBid.toLocaleString()}.`, timestamp: new Date().toISOString() });
            }
            if (previous.status === 'ACTIVE' && item.status !== 'ACTIVE') {
              newAlerts.push({
                id: `${item.id}-closed`,
                message: isLeadingNow
                  ? `${item.title} closed with your bid leading. The seller's decision is pending.`
                  : `${item.title} has closed. You were not the leading bidder.`,
                timestamp: new Date().toISOString(),
              });
            }
            if (previous.handoverStatus !== item.handoverStatus && item.handoverStatus) {
              const outcomeMessage: Record<string, string> = {
                APPROVED_RESERVED: `Your winning bid for ${item.title} was approved. The item is reserved for you.`,
                REJECTED: `The seller rejected the winning bid for ${item.title}.`,
                HANDOVER_COMPLETED: `The handover for ${item.title} is complete.`,
                FAILED_PICKUP: `The pickup for ${item.title} failed.`,
                SELLER_CANCELLED: `The seller cancelled the sale for ${item.title}.`,
                CANCELLED_MUTUAL: `The sale for ${item.title} was cancelled by agreement.`,
              };
              if (outcomeMessage[item.handoverStatus]) {
                newAlerts.push({ id: `${item.id}-${item.handoverStatus}`, message: outcomeMessage[item.handoverStatus], timestamp: new Date().toISOString() });
              }
            }
          }

          if (newAlerts.length) {
            setBuyerAlerts((existing) => [...newAlerts, ...existing].slice(0, 10));
            if (notificationPermission === 'granted') {
              for (const alert of newAlerts) new Notification('BidNest buyer update', { body: alert.message });
            }
          }
        }

        previousBuyerBids.current = new Map(nextBuyerBids.map((item) => [item.id, item]));
        setListings(nextListings);
        setBuyerBids(nextBuyerBids);
        setBuyerActivityError('');
      } catch (error) {
        if (active) setBuyerActivityError(error instanceof Error ? error.message : 'Could not refresh auction activity.');
      }
    };

    void refresh(false);
    const interval = window.setInterval(() => void refresh(true), 20000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUser, notificationPermission]);

  const resetListingForm = () => {
    setListingForm(emptyListingForm);
    setEditingListingId(null);
    setShowListingForm(false);
  };

  const saveListing = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) return setListingMessage('Please sign in again to manage listings.');
    const payload = {
      ...listingForm,
      photos: listingForm.photos.split(/\r?\n|,/).map((photo) => photo.trim()).filter(Boolean),
      startingPrice: Number(listingForm.startingPrice),
      minIncrement: Number(listingForm.minIncrement),
      closingTime: new Date(listingForm.closingTime).toISOString(),
    };
    try {
      const response = await fetch(`${API_BASE_URL}/listings${editingListingId ? `/${editingListingId}` : ''}`, {
        method: editingListingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save listing.');
      const savedListing: Listing = { ...data.listing, bids: [], originalClosingTime: data.listing.closingTime };
      setListings((existing) => editingListingId
        ? existing.map((item) => item.id === editingListingId ? savedListing : item)
        : [savedListing, ...existing]);
      setListingMessage(editingListingId ? 'Listing updated.' : 'Listing published.');
      resetListingForm();
    } catch (error) {
      setListingMessage(error instanceof Error ? error.message : 'Could not save listing.');
    }
  };

  const beginEditListing = (item: Listing) => {
    setListingForm({
      title: item.title,
      category: item.category,
      description: item.description,
      condition: item.condition,
      photos: item.photos.join('\n'),
      startingPrice: String(item.startingPrice),
      minIncrement: String(item.minIncrement),
      closingTime: new Date(item.closingTime).toISOString().slice(0, 16),
    });
    setEditingListingId(item.id);
    setShowListingForm(true);
    setListingMessage('');
  };

  const cancelListing = async (item: Listing) => {
    if (!window.confirm(`Cancel the listing "${item.title}"?`)) return;
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) return setListingMessage('Please sign in again to manage listings.');
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${item.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not cancel listing.');
      setListings((existing) => existing.filter((listing) => listing.id !== item.id));
      setListingMessage('Listing canceled.');
    } catch (error) {
      setListingMessage(error instanceof Error ? error.message : 'Could not cancel listing.');
    }
  };

  const submitBid = async (item: Listing) => {
    const token = localStorage.getItem('bidnest_auth_token');
    const amount = Number(bidAmounts[item.id]);
    if (!token) return setBidMessage((messages) => ({ ...messages, [item.id]: 'Please sign in again to bid.' }));
    if (!Number.isFinite(amount) || amount < (item.totalBids ? item.currentBid + item.minIncrement : item.startingPrice)) {
      return setBidMessage((messages) => ({ ...messages, [item.id]: `Minimum bid: ₹${(item.totalBids ? item.currentBid + item.minIncrement : item.startingPrice).toLocaleString()}.` }));
    }
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${item.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Bid could not be placed.');
      setListings((existing) => existing.map((listing) => listing.id === item.id
        ? { ...data.listing, myProxyBid: listing.myProxyBid, bids: data.listing.bids ?? [] }
        : listing));
      setBidAmounts((existing) => ({ ...existing, [item.id]: '' }));
      setBidMessage((messages) => ({ ...messages, [item.id]: data.message }));
    } catch (error) {
      setBidMessage((messages) => ({ ...messages, [item.id]: error instanceof Error ? error.message : 'Bid could not be placed.' }));
    }
  };

  const confirmHandover = async (item: Listing) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setBuyerActivityError('Please sign in again to confirm the handover.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${item.id}/confirm-handover`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not confirm handover.');
      setBuyerBids((existing) => existing.map((listing) => listing.id === item.id ? data.listing : listing));
      setListings((existing) => existing.filter((listing) => listing.id !== item.id));
      setBuyerActivityError('');
      setListingMessage(data.message);
    } catch (error) {
      setBuyerActivityError(error instanceof Error ? error.message : 'Could not confirm handover.');
    }
  };

  const setAutomaticBid = async (item: Listing) => {
    const maxAmount = Number(proxyMaxAmounts[item.id] ?? item.myProxyBid?.maxAmount);
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
      setBidMessage((messages) => ({ ...messages, [item.id]: 'Enter a positive maximum amount first.' }));
      return;
    }
    if (!window.confirm(`Authorize BidNest to place bids on "${item.title}" automatically, only as needed and never above ₹${maxAmount.toLocaleString()}? Automatic bidding may result in a purchase.`)) return;
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setBidMessage((messages) => ({ ...messages, [item.id]: 'Please sign in again to set an automatic bid.' }));
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${item.id}/proxy-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxAmount, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not enable automatic bidding.');
      const updatedListing: Listing = { ...data.listing, myProxyBid: data.myProxyBid, bids: data.listing.bids ?? [] };
      setListings((existing) => existing.map((listing) => listing.id === item.id ? updatedListing : listing));
      setBuyerBids((existing) => existing.map((listing) => listing.id === item.id ? updatedListing : listing));
      setBidMessage((messages) => ({ ...messages, [item.id]: data.message }));
    } catch (error) {
      setBidMessage((messages) => ({ ...messages, [item.id]: error instanceof Error ? error.message : 'Could not enable automatic bidding.' }));
    }
  };

  const stopAutomaticBid = async (item: Listing) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setBidMessage((messages) => ({ ...messages, [item.id]: 'Please sign in again to stop automatic bidding.' }));
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${item.id}/proxy-bid`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not stop automatic bidding.');
      const updatedListing: Listing = {
        ...data.listing,
        myProxyBid: item.myProxyBid ? { ...item.myProxyBid, active: false } : null,
        bids: data.listing.bids ?? [],
      };
      setListings((existing) => existing.map((listing) => listing.id === item.id ? updatedListing : listing));
      setBuyerBids((existing) => existing.map((listing) => listing.id === item.id ? updatedListing : listing));
      setBidMessage((messages) => ({ ...messages, [item.id]: data.message }));
    } catch (error) {
      setBidMessage((messages) => ({ ...messages, [item.id]: error instanceof Error ? error.message : 'Could not stop automatic bidding.' }));
    }
  };

  const requestBuyerNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(await Notification.requestPermission());
  };

  if (!currentUser) return null;

  const isBuyer = activeRole === 'buyer';

  // Helper function for countdown formatting
  const getTimeRemaining = (closingTime: string) => {
    const totalMs = new Date(closingTime).getTime() - Date.now();
    if (totalMs <= 0) return { expired: true, text: 'Auction Closed' };
    
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      expired: false,
      isUrgent: totalMs <= 30 * 60 * 1000, // Less than 30 mins
      text: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    };
  };

  const visibleListings = listings.filter((item) => {
    const keyword = filters.keyword.trim().toLowerCase();
    const matchesKeyword = !keyword || `${item.title} ${item.description}`.toLowerCase().includes(keyword);
    const matchesCategory = filters.category === 'all' || item.category === filters.category;
    const matchesCondition = filters.condition === 'all' || item.condition === filters.condition;
    const matchesMin = !filters.minPrice || item.currentBid >= Number(filters.minPrice);
    const matchesMax = !filters.maxPrice || item.currentBid <= Number(filters.maxPrice);
    const remaining = new Date(item.closingTime).getTime() - Date.now();
    const matchesClosing = !filters.closingSoon || (remaining >= 0 && remaining <= 24 * 60 * 60 * 1000);
    return matchesKeyword && matchesCategory && matchesCondition && matchesMin && matchesMax && matchesClosing;
  });
  const leadingAuctionCount = buyerBids.filter((item) => item.status === 'ACTIVE' && item.leadingBidderId === currentUser?.id).length;
  const reservedItemCount = buyerBids.filter((item) => item.handoverStatus === 'APPROVED_RESERVED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Welcome Hero Card */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl border ${
        isBuyer 
          ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 border-indigo-500/30' 
          : 'bg-gradient-to-br from-purple-950 via-slate-900 to-pink-950 border-purple-500/30'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                isBuyer 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              }`}>
                {isBuyer ? 'Junior Buyer View' : 'Senior Seller View'}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                {currentUser.hostel}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back, {currentUser.name}! 👋
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {isBuyer ? (
                <>
                  You are browsing as a junior student. Seniors are packing up and liquidating items before departure. Place bids, set automatic proxy limits, or ask questions on any item.
                </>
              ) : (
                <>
                  You are managing your senior liquidation catalog. Watch incoming bids live, approve winning buyers upon closing, and coordinate in-person campus handovers.
                </>
              )}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">
                Logged in with institutional roll: <code className="text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">{currentUser.rollNumber}</code>
              </span>
            </div>
          </div>

          {/* Quick Metrics Widget */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 sm:p-5 backdrop-blur-md min-w-[260px] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{isBuyer ? 'Buyer Activity' : 'Clearance Status'}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </h3>

            {isBuyer ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Items You're Leading:</span>
                  <span className="font-bold text-emerald-400">{leadingAuctionCount} Items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Auctions Participated:</span>
                  <span className="font-bold text-indigo-400">{buyerBids.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Items Reserved:</span>
                  <span className="font-bold text-amber-400">{reservedItemCount}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Items Listed by You:</span>
                  <span className="font-bold text-purple-400">3 Items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Current Highest Bids:</span>
                  <span className="font-bold text-emerald-400">₹5,975</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Days to Depart Campus:</span>
                  <span className="font-bold text-rose-400">5 Days</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Background ambient glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* Feature Navigation & Roadmap Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Active Auctions</div>
            <div className="text-base font-bold text-white">{listings.length} Campus Items</div>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Anti-Sniping Engine</div>
            <div className="text-base font-bold text-emerald-400">Active (30s rule)</div>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">AI Concierge</div>
            <div className="text-base font-bold text-purple-300">Smart Bidding</div>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Quad Handovers</div>
            <div className="text-base font-bold text-amber-300">Verified On-Campus</div>
          </div>
        </div>
      </div>

      {/* Live Campus Listings Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Live Campus Auctions
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time bids, transparent increments, and automated anti-sniping closing countdowns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Showing {listings.length} items from graduating seniors
            </span>
            {!isBuyer && (
              <button
                type="button"
                onClick={() => { setListingMessage(''); setShowListingForm(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            )}
          </div>
        </div>

        {listingMessage && <p role="status" className="mb-4 text-sm text-amber-300">{listingMessage}</p>}

        <form onSubmit={(event) => event.preventDefault()} className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="relative text-xs text-slate-300 lg:col-span-2">Search auctions
            <Search className="absolute left-2.5 top-8 h-4 w-4 text-slate-500" />
            <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="Title or description" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-8 pr-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Category
            <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white">
              <option value="all">All categories</option><option value="cycle">Cycle</option><option value="calculator">Calculator</option><option value="books">Books</option><option value="electronics">Electronics</option><option value="hostel_essentials">Hostel essentials</option><option value="sports">Sports</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Condition
            <select value={filters.condition} onChange={(event) => setFilters({ ...filters, condition: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white">
              <option value="all">Any condition</option><option>Like New</option><option>Gently Used</option><option>Functional</option><option>Heavily Used</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <label className="text-xs text-slate-300">Min price
              <input type="number" min="0" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">Max price
              <input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 lg:col-span-6">
            <input type="checkbox" checked={filters.closingSoon} onChange={(event) => setFilters({ ...filters, closingSoon: event.target.checked })} className="h-4 w-4 accent-emerald-500" /> Closing within 24 hours
          </label>
        </form>

        {isBuyer && <BuyerAssistant listings={listings.filter((item) => item.status === 'ACTIVE')} />}
        {isBuyer && <WantedAlerts />}

        {isBuyer && (
          <section className="mb-7 space-y-4 rounded-2xl border border-indigo-500/20 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="buyer-activity-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 id="buyer-activity-title" className="text-lg font-bold text-white">My bids and purchase status</h2>
                <p className="text-xs text-slate-400">Track auction outcomes and campus handovers for every listing you have bid on.</p>
              </div>
              <button
                type="button"
                onClick={() => void requestBuyerNotifications()}
                disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {notificationPermission === 'granted' ? 'Browser alerts enabled' : notificationPermission === 'denied' ? 'Browser alerts blocked' : notificationPermission === 'unsupported' ? 'Browser alerts unavailable' : 'Enable browser alerts'}
              </button>
            </div>
            {buyerActivityError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{buyerActivityError}</p>}
            {listingMessage && <p role="status" className="text-xs text-emerald-300">{listingMessage}</p>}
            {buyerAlerts.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">Recent alerts</h3>
                <ul className="space-y-2">
                  {buyerAlerts.map((alert) => <li key={alert.id} className="flex justify-between gap-3 text-xs text-slate-300"><span>{alert.message}</span><time className="shrink-0 text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</time></li>)}
                </ul>
              </div>
            )}
            {buyerBids.length === 0 ? (
              <p className="rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">You have not placed any bids yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {buyerBids.map((item) => {
                  const isLeadingBidder = item.leadingBidderId === currentUser.id;
                  const hasPlacedBid = item.bids.some((bid) => bid.bidderId === currentUser.id);
                  const result = item.handoverStatus === 'APPROVED_RESERVED'
                    ? 'Approved — reserved for you'
                    : item.handoverStatus === 'REJECTED'
                      ? 'Seller rejected the winning bid'
                      : item.handoverStatus === 'HANDOVER_COMPLETED'
                        ? 'Sale and handover completed'
                        : item.handoverStatus === 'FAILED_PICKUP'
                          ? 'Pickup failed'
                          : item.handoverStatus === 'SELLER_CANCELLED'
                            ? 'Seller cancelled the sale'
                            : item.handoverStatus === 'CANCELLED_MUTUAL'
                              ? 'Sale cancelled by agreement'
                              : item.status === 'ACTIVE'
                                ? isLeadingBidder ? 'You are currently leading' : hasPlacedBid ? 'You have been outbid' : item.myProxyBid?.active ? 'Automatic bid enabled · not leading yet' : 'Auction is active'
                                : item.status === 'PROVISIONALLY_CLOSED'
                                  ? isLeadingBidder ? 'Awaiting seller decision' : 'Auction closed — not the winner'
                                  : item.status === 'UNSOLD'
                                    ? 'Auction ended unsold'
                                    : item.status;
                  return (
                    <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <span className={`text-xs font-semibold ${isLeadingBidder && item.status === 'ACTIVE' ? 'text-emerald-300' : 'text-amber-200'}`}>{result}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-400">Leading bid <strong className="block text-base text-white">₹{item.currentBid.toLocaleString()}</strong></div>
                        <div className="text-slate-400">Your bids <strong className="block text-base text-white">{item.bids.filter((bid) => bid.bidderId === currentUser.id).length}</strong></div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Seller: {item.sellerName} · {item.sellerRoll ?? 'Campus seller'} · {item.sellerHostel}{item.sellerRoom ? `, Room ${item.sellerRoom}` : ''}</p>
                      {item.handoverNotes && <p className="mt-2 rounded bg-slate-900 p-2 text-xs text-slate-300">Seller note: {item.handoverNotes}</p>}
                      {item.handoverStatus === 'APPROVED_RESERVED' && isLeadingBidder && (
                        <button type="button" onClick={() => void confirmHandover(item)} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Confirm campus handover</button>
                      )}
                      <details className="mt-3 border-t border-slate-700 pt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-indigo-200">Public bid history ({item.bids.length})</summary>
                        <ol className="mt-2 max-h-36 space-y-2 overflow-auto">
                          {[...item.bids].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((bid, index) => (
                            <li key={`${bid.bidderId}-${bid.timestamp}-${index}`} className="flex flex-wrap justify-between gap-2 text-xs text-slate-300">
                              <span>{bid.bidderName} ({bid.bidderRoll ?? 'Student'})</span><strong>₹{bid.amount.toLocaleString()}</strong><time className="text-slate-500">{new Date(bid.timestamp).toLocaleString()}</time>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showListingForm && !isBuyer && (
          <form onSubmit={saveListing} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-slate-300">Title
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
            <label className="text-xs text-slate-300">Photo URLs (one per line)
              <textarea required rows={3} placeholder="https://..." value={listingForm.photos} onChange={(event) => setListingForm({ ...listingForm, photos: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">Starting price (₹)
              <input required type="number" min="1" value={listingForm.startingPrice} onChange={(event) => setListingForm({ ...listingForm, startingPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">Minimum bid increment (₹)
              <input required type="number" min="1" value={listingForm.minIncrement} onChange={(event) => setListingForm({ ...listingForm, minIncrement: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">Closing date and time
              <input required type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={listingForm.closingTime} onChange={(event) => setListingForm({ ...listingForm, closingTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><Save className="h-4 w-4" />{editingListingId ? 'Save changes' : 'Publish listing'}</button>
              <button type="button" onClick={resetListingForm} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"><X className="h-4 w-4" />Close</button>
            </div>
          </form>
        )}

        {/* Listing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleListings.map((item) => {
            const timeStatus = getTimeRemaining(item.closingTime);
            const isLeading = item.leadingBidderId === currentUser.id;
            const isOwner = item.sellerId === currentUser.id || item.sellerRoll === currentUser.rollNumber;
            const minimumBid = item.totalBids ? item.currentBid + item.minIncrement : item.startingPrice;

            return (
              <div
                key={item.id}
                id={`listing-${item.id}`}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl hover:border-slate-600 transition-all flex flex-col justify-between group"
              >
                {/* Image & Badges */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                  <img
                    src={item.photos[0]}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Category Pill */}
                  <span className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-700">
                    {item.category}
                  </span>

                  {/* Condition Pill */}
                  <span className="absolute top-2.5 right-2.5 bg-indigo-950/80 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-500/30">
                    {item.condition}
                  </span>

                  {/* Countdown Badge */}
                  <div className={`absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center justify-between text-xs font-semibold ${
                    timeStatus.isUrgent 
                      ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40 animate-pulse' 
                      : 'bg-slate-900/85 text-slate-200 border border-slate-700/80'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {timeStatus.isUrgent ? 'CLOSING SOON' : 'Time Left'}
                    </span>
                    <span className="font-mono font-bold">{timeStatus.text}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Starting price ₹{item.startingPrice.toLocaleString()} · Minimum increment ₹{item.minIncrement.toLocaleString()}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                      <span>Seller: <strong className="text-slate-300">{item.sellerName}</strong></span>
                      <span>{item.sellerHostel.split(' ')[0]}</span>
                    </div>
                    <details className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                      <summary className="cursor-pointer text-xs font-semibold text-indigo-300">Full details and bid history ({item.bids?.length ?? 0})</summary>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{item.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {item.photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={`${item.title}, photo ${index + 1}`} className="aspect-video w-full rounded-md object-cover" />)}
                      </div>
                      <ol className="mt-3 max-h-40 space-y-2 overflow-auto border-t border-slate-700 pt-2">
                        {[...(item.bids ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((bid, index) => (
                          <li key={`${bid.bidderId}-${bid.timestamp}-${index}`} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                            <span>{bid.bidderName} <span className="text-slate-500">({bid.bidderRoll ?? bid.bidderHostel ?? 'Student'})</span></span>
                            <span className="shrink-0 font-semibold text-white">₹{bid.amount.toLocaleString()}</span>
                            <time className="shrink-0 text-[10px] text-slate-500">{new Date(bid.timestamp).toLocaleString()}</time>
                          </li>
                        ))}
                        {!item.bids?.length && <li className="text-xs text-slate-500">No bids yet.</li>}
                      </ol>
                      {!!item.proxyBids?.length && (
                        <p className="mt-2 border-t border-slate-700 pt-2 text-[10px] text-slate-400">
                          Public active auto-bid ceilings (anonymous): {item.proxyBids.filter((proxyBid) => proxyBid.active).map((proxyBid) => `₹${proxyBid.maxAmount.toLocaleString()}`).join(', ') || 'None'}
                        </p>
                      )}
                      <ListingQuestions
                        listingId={item.id}
                        questions={item.questions ?? []}
                        mode="buyer"
                        canAsk={isBuyer && !isOwner && item.status === 'ACTIVE'}
                        onQuestionsUpdated={(questions) => {
                          setListings((existing) => existing.map((listing) => listing.id === item.id ? { ...listing, questions } : listing));
                          setBuyerBids((existing) => existing.map((listing) => listing.id === item.id ? { ...listing, questions } : listing));
                        }}
                      />
                    </details>
                  </div>

                  {/* Bid Information & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-700/60">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                          Current Leading Bid
                        </span>
                        <div className="text-xl font-black text-white tracking-tight">
                          ₹{item.currentBid.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">
                          {item.totalBids} bids placed
                        </span>
                        <span className="text-[11px] text-indigo-300 font-medium">
                          +₹{item.minIncrement} min incr
                        </span>
                      </div>
                    </div>

                    {/* Leading Bidder Indicator */}
                    {isLeading && (
                      <div className="mb-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        You are currently leading!
                      </div>
                    )}

                    {/* Role-Specific Action Button */}
                    {isBuyer ? (
                      <div className="space-y-2">
                        <label className="block text-[11px] text-slate-400">Your bid (minimum ₹{minimumBid.toLocaleString()})
                          <input type="number" min={minimumBid} step="1" value={bidAmounts[item.id] ?? ''} onChange={(event) => setBidAmounts({ ...bidAmounts, [item.id]: event.target.value })} disabled={timeStatus.expired} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" />
                        </label>
                        <button
                          type="button"
                          onClick={() => submitBid(item)}
                          disabled={timeStatus.expired}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                        ><Zap className="w-3.5 h-3.5 text-amber-300" />Place Bid</button>
                        {bidMessage[item.id] && <p role="status" className="text-xs text-amber-300">{bidMessage[item.id]}</p>}
                        {!isOwner && item.status === 'ACTIVE' && (
                          <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                            <label className="block text-[11px] text-slate-300">
                              Automatic bid limit
                              <input
                                type="number"
                                min={minimumBid}
                                value={proxyMaxAmounts[item.id] ?? item.myProxyBid?.maxAmount ?? ''}
                                onChange={(event) => setProxyMaxAmounts({ ...proxyMaxAmounts, [item.id]: event.target.value })}
                                disabled={timeStatus.expired}
                                placeholder={`Maximum ₹${minimumBid.toLocaleString()} or more`}
                                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                              />
                            </label>
                            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">After you confirm, BidNest may bid only as needed and never above this limit. Other buyers can see anonymous maximum amounts, not your account details.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => void setAutomaticBid(item)} disabled={timeStatus.expired} className="rounded-lg bg-purple-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                                {item.myProxyBid?.active ? 'Confirm new limit' : 'Confirm automatic bidding'}
                              </button>
                              {item.myProxyBid?.active && <button type="button" onClick={() => void stopAutomaticBid(item)} className="rounded-lg border border-slate-600 px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800">Stop auto-bidding</button>}
                            </div>
                            {item.myProxyBid?.active && <p className="mt-2 text-[10px] font-semibold text-emerald-300">Enabled up to ₹{item.myProxyBid.maxAmount.toLocaleString()}</p>}
                          </div>
                        )}
                      </div>
                    ) : isOwner ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={item.totalBids > 0}
                          onClick={() => beginEditListing(item)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                        ><Pencil className="h-4 w-4" /> Edit</button>
                        <button
                          type="button"
                          disabled={item.totalBids > 0}
                          onClick={() => cancelListing(item)}
                          className="flex items-center justify-center rounded-lg border border-rose-500/40 px-3 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Cancel ${item.title}`}
                        ><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-lg shadow-purple-600/20 flex items-center justify-center gap-1.5"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Seller listing
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
          {!visibleListings.length && <p className="text-sm text-slate-400">No auctions match these filters.</p>}
        </div>
      </div>

      {/* Trust & Mechanics Banner */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 text-xs text-slate-400 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-white block font-medium">Campus Rules of Engagement:</strong>
            All bids and maximums are public. Anti-sniping soft-close automatically extends closing by 60 seconds if a bid lands in the last 30 seconds.
          </div>
        </div>
        <div className="text-slate-500 shrink-0">
          BidNest System v1.0.0 &bull; Session Active
        </div>
      </div>

    </div>
  );
};

export const PortalView: React.FC = () => {
  const { activeRole } = useAuth();
  return activeRole === 'seller' ? <SellerDashboard /> : <BuyerPortalView />;
};
