import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BookmarkPlus, Trash2 } from 'lucide-react';
import type { ListingCategory, WantedAlert } from '../../types';

const API_BASE_URL = 'http://localhost:5000/api';

export const WantedAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<WantedAlert[]>([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [maxPrice, setMaxPrice] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const previousMatches = useRef<Set<string> | null>(null);

  const loadAlerts = useCallback(async (notify = false) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) throw new Error('Please sign in again to manage wanted alerts.');
    const response = await fetch(`${API_BASE_URL}/wanted-alerts/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not load wanted alerts.');
    const nextAlerts = data.alerts as WantedAlert[];
    const nextMatchIds = new Set(nextAlerts.flatMap((alert) => (alert.matches ?? []).map((match) => `${alert.id}:${match.listingId}`)));
    if (notify && previousMatches.current && permission === 'granted') {
      for (const alert of nextAlerts) {
        for (const match of alert.matches ?? []) {
          if (!previousMatches.current.has(`${alert.id}:${match.listingId}`)) {
            new Notification('Wanted item match', { body: `${match.listingTitle} is listed at ₹${match.currentBid.toLocaleString()}.` });
          }
        }
      }
    }
    previousMatches.current = nextMatchIds;
    setAlerts(nextAlerts);
    setError('');
  }, [permission]);

  useEffect(() => {
    let active = true;
    const refresh = async (notify: boolean) => {
      try {
        await loadAlerts(notify);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load wanted alerts.');
      }
    };
    void refresh(false);
    const interval = window.setInterval(() => void refresh(true), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadAlerts]);

  const createAlert = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setError('Please sign in again to save a wanted alert.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/wanted-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword, category: category || undefined, maxPrice: maxPrice || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save wanted alert.');
      setMessage(data.message);
      setKeyword('');
      setCategory('');
      setMaxPrice('');
      await loadAlerts();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not save wanted alert.');
    }
  };

  const removeAlert = async (alertId: string) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setError('Please sign in again to remove a wanted alert.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/wanted-alerts/${alertId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not remove wanted alert.');
      setAlerts((existing) => existing.filter((alert) => alert.id !== alertId));
      setMessage(data.message);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove wanted alert.');
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    setPermission(await Notification.requestPermission());
  };

  return (
    <section className="mb-6 rounded-2xl border border-cyan-500/25 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="wanted-alert-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 id="wanted-alert-title" className="flex items-center gap-2 font-bold text-white"><BookmarkPlus className="h-5 w-5 text-cyan-300" />Never miss a wanted item</h2>
          <p className="mt-1 text-xs text-slate-400">Save a keyword, category, and optional budget. Matches are kept in your account for when you return.</p>
        </div>
        <button type="button" onClick={() => void enableNotifications()} disabled={permission === 'granted' || permission === 'unsupported'} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60">
          <Bell className="h-4 w-4" />{permission === 'granted' ? 'Pop-up alerts enabled' : permission === 'denied' ? 'Pop-up alerts blocked' : permission === 'unsupported' ? 'Pop-up alerts unavailable' : 'Enable pop-up alerts'}
        </button>
      </div>
      <form onSubmit={createAlert} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] text-slate-400">What are you looking for?
          <input required minLength={2} maxLength={100} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="scientific calculator" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white placeholder:text-slate-500" />
        </label>
        <label className="text-[11px] text-slate-400">Category (optional)
          <select value={category} onChange={(event) => setCategory(event.target.value as ListingCategory | '')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white">
            <option value="">Any category</option><option value="cycle">Cycle</option><option value="calculator">Calculator</option><option value="books">Books</option><option value="electronics">Electronics</option><option value="hostel_essentials">Hostel essentials</option><option value="sports">Sports</option><option value="other">Other</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">Maximum price (optional, ₹)
          <input type="number" min="1" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="400" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white placeholder:text-slate-500" />
        </label>
        <button type="submit" className="self-end rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600">Save wanted alert</button>
      </form>
      {message && <p role="status" className="mt-3 text-xs text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">“{alert.keyword}”{alert.category ? ` · ${alert.category.replace('_', ' ')}` : ''}{alert.maxPrice ? ` · up to ₹${alert.maxPrice.toLocaleString()}` : ''}</p>
              <button type="button" onClick={() => void removeAlert(alert.id)} aria-label={`Remove wanted alert for ${alert.keyword}`} className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
            </div>
            {alert.matches?.length
              ? <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">{[...alert.matches].reverse().map((match) => <li key={`${alert.id}-${match.listingId}`} className="flex flex-wrap justify-between gap-2 text-xs"><a href={`#listing-${match.listingId}`} className="text-cyan-200 hover:underline">{match.listingTitle}</a><span className="text-slate-300">₹{match.currentBid.toLocaleString()} · found {new Date(match.matchedAt).toLocaleString()}</span></li>)}</ul>
              : <p className="mt-2 text-xs text-slate-500">No matches yet. We’ll keep this alert saved.</p>}
          </article>
        ))}
      </div>
    </section>
  );
};
