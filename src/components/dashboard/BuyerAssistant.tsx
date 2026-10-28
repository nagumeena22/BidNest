import React, { useState } from 'react';
import { Bot, Clock3, ExternalLink, LoaderCircle, Send, ShieldCheck, Zap } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

interface PublicBid {
  bidderName: string;
  amount: number;
  timestamp: string;
}

interface AssistantListing {
  id: string;
  title: string;
  category: string;
  description: string;
  condition: string;
  photos: string[];
  startingPrice: number;
  minIncrement: number;
  currentBid: number;
  totalBids: number;
  closingTime: string;
  status: string;
  bids: PublicBid[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  listings?: AssistantListing[];
  showEmptyResults?: boolean;
}

interface BidPreview {
  listingId: string;
  title: string;
  photo: string | null;
  amount: number;
  currentBid: number;
  minIncrement: number;
  minimumValidBid: number;
  maxBudget: number | null;
  closingTime: string;
}

interface BidConfirmation {
  nonce: string;
  expiresAt: string;
}

interface BuyerAssistantProps {
  onOpenListing: (listingId: string) => void;
}

const suggestions = [
  'Find me a cycle under ₹2,000.',
  'Show electronics closing soon.',
  'Compare the best calculators under ₹500.',
  'What is the current leading bid on this item?',
  'Help me place a bid.',
];

const minimumBid = (listing: AssistantListing) =>
  listing.totalBids > 0 ? listing.currentBid + listing.minIncrement : listing.startingPrice;

const fetchJson = async <T,>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const data = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(data.message || 'The assistant request failed.');
  return data;
};

export const BuyerAssistant: React.FC<BuyerAssistantProps> = ({ onOpenListing }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedListingId, setSelectedListingId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bidTarget, setBidTarget] = useState<AssistantListing>();
  const [bidAmount, setBidAmount] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [preview, setPreview] = useState<BidPreview>();
  const [confirmation, setConfirmation] = useState<BidConfirmation>();
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');

  const token = () => localStorage.getItem('bidnest_auth_token');
  const selectedListingTitle = messages
    .flatMap((message) => message.listings ?? [])
    .find((listing) => listing.id === selectedListingId)?.title;

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const authToken = token();
    if (!authToken) {
      setError('Please sign in again to use the AI assistant.');
      return;
    }

    setError('');
    setDraft('');
    setLoading(true);
    const userMessage: ChatMessage = { role: 'user', content };
    const history = [...messages, userMessage].slice(-6);
    setMessages((existing) => [...existing, userMessage]);
    try {
      const data = await fetchJson<{
        assistantMessage: string;
        listings: AssistantListing[];
        searchPerformed: boolean;
      }>(`${API_BASE_URL}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ messages: history, selectedListingId }),
      });
      setMessages((existing) => [...existing, {
        role: 'assistant',
        content: data.assistantMessage,
        listings: data.listings,
        showEmptyResults: data.searchPerformed && data.listings.length === 0,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant could not respond.');
    } finally {
      setLoading(false);
    }
  };

  const prepareBid = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bidTarget || bidLoading) return;
    const authToken = token();
    if (!authToken) {
      setBidError('Please sign in again before preparing a bid.');
      return;
    }
    const amount = Number(bidAmount);
    const budget = maxBudget.trim() ? Number(maxBudget) : undefined;
    if (!Number.isSafeInteger(amount) || amount < 1 || (budget !== undefined && (!Number.isSafeInteger(budget) || budget < 1))) {
      setBidError('Enter whole-number rupee amounts for the bid and optional budget.');
      return;
    }

    setBidLoading(true);
    setBidError('');
    setPreview(undefined);
    setConfirmation(undefined);
    try {
      const data = await fetchJson<{ preview: BidPreview; confirmation: BidConfirmation }>(
        `${API_BASE_URL}/assistant/prepare-bid`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ listingId: bidTarget.id, amount, maxBudget: budget }),
        },
      );
      setPreview(data.preview);
      setConfirmation(data.confirmation);
    } catch (requestError) {
      setBidError(requestError instanceof Error ? requestError.message : 'Could not prepare this bid.');
    } finally {
      setBidLoading(false);
    }
  };

  const confirmBid = async () => {
    if (!preview || !confirmation || bidLoading) return;
    const authToken = token();
    if (!authToken) {
      setBidError('Please sign in again before confirming a bid.');
      return;
    }
    setBidLoading(true);
    setBidError('');
    try {
      const data = await fetchJson<{ message: string }>(`${API_BASE_URL}/assistant/confirm-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ nonce: confirmation.nonce, amount: preview.amount }),
      });
      setMessages((existing) => [...existing, { role: 'assistant', content: data.message }]);
      setPreview(undefined);
      setConfirmation(undefined);
      setBidTarget(undefined);
      setBidAmount('');
      setMaxBudget('');
    } catch (requestError) {
      setBidError(requestError instanceof Error ? requestError.message : 'Could not confirm this bid.');
      setPreview(undefined);
      setConfirmation(undefined);
    } finally {
      setBidLoading(false);
    }
  };

  const startBid = (listing: AssistantListing) => {
    setSelectedListingId(listing.id);
    setBidTarget(listing);
    setBidAmount(String(minimumBid(listing)));
    setMaxBudget('');
    setPreview(undefined);
    setConfirmation(undefined);
    setBidError('');
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/70 to-slate-900" aria-labelledby="buyer-assistant-title">
      <header className="border-b border-slate-700/80 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-purple-500/15 p-2 text-purple-300"><Bot className="h-5 w-5" /></div>
          <div>
            <h2 id="buyer-assistant-title" className="font-bold text-white">BidNest AI Assistant</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Groq helps understand your request; live prices, auction status, and bid history always come from BidNest.
              Bids need a separate, exact confirmation.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-3 sm:p-5">
        {!messages.length && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <p className="text-sm font-semibold text-slate-200">What are you looking for?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} disabled={loading} className="rounded-full border border-purple-400/30 px-3 py-2 text-left text-xs text-purple-100 hover:bg-purple-500/10 disabled:opacity-50">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <ol aria-live="polite" aria-label="Assistant conversation" className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <li key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-6 sm:ml-16' : 'mr-2'}>
              <div className={`rounded-xl p-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-indigo-600/30 text-indigo-50' : 'border border-slate-700 bg-slate-950/70 text-slate-200'}`}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{message.role === 'user' ? 'You' : 'BidNest Assistant'}</p>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {!!message.listings?.length && (
                  <ul className="mt-3 grid gap-3">
                    {message.listings.map((listing) => (
                      <li key={listing.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80">
                        {listing.photos[0] && <img src={listing.photos[0]} alt={listing.title} className="h-36 w-full object-cover sm:h-44" />}
                        <div className="space-y-2 p-3">
                          <div>
                            <h3 className="font-semibold text-white">{listing.title}</h3>
                            <p className="text-xs capitalize text-slate-400">{listing.category.replaceAll('_', ' ')} · {listing.condition}</p>
                          </div>
                          <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">{listing.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <p className="text-slate-300">Leading bid <strong className="text-white">₹{listing.currentBid.toLocaleString()}</strong></p>
                            <p className="text-slate-300">Min increment <strong className="text-white">₹{listing.minIncrement.toLocaleString()}</strong></p>
                            <p className="col-span-2 flex items-center gap-1 text-slate-400"><Clock3 className="h-3.5 w-3.5" />Closes {new Date(listing.closingTime).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 border-t border-slate-700 pt-2">
                            <button type="button" onClick={() => startBid(listing)} disabled={listing.status !== 'ACTIVE'} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50">
                              <Zap className="h-3.5 w-3.5" />Prepare a bid
                            </button>
                            <button type="button" onClick={() => setSelectedListingId(listing.id)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                              Ask about this item
                            </button>
                            <a href={`#listing-${listing.id}`} onClick={() => onOpenListing(listing.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/40 px-3 py-2 text-xs text-purple-100 hover:bg-purple-500/10">
                              <ExternalLink className="h-3.5 w-3.5" />View auction
                            </a>
                          </div>
                          {!!listing.bids.length && (
                            <details className="border-t border-slate-700 pt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-300">Public bid history ({listing.bids.length})</summary>
                              <ol className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                                {listing.bids.map((bid, bidIndex) => (
                                  <li key={`${bid.timestamp}-${bidIndex}`} className="flex flex-wrap justify-between gap-x-3 text-xs text-slate-400">
                                    <span>{bid.bidderName}</span><span>₹{bid.amount.toLocaleString()}</span><time>{new Date(bid.timestamp).toLocaleString()}</time>
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {message.role === 'assistant' && message.showEmptyResults && (
                  <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-400">No listing cards to show for this request. Try a different keyword, price, category, or auction.</p>
                )}
              </div>
            </li>
          ))}
          {loading && (
            <li role="status" className="flex items-center gap-2 text-xs text-purple-200">
              <LoaderCircle className="h-4 w-4 animate-spin" />Checking current auctions…
            </li>
          )}
        </ol>

        {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
        {selectedListingId && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-purple-400/20 bg-purple-950/30 px-3 py-2 text-xs text-purple-100">
            <span className="truncate">Follow-up context: {selectedListingTitle ?? 'selected auction'}</span>
            <button type="button" onClick={() => setSelectedListingId(undefined)} className="shrink-0 rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white">Clear</button>
          </div>
        )}

        {bidTarget && (
          <form onSubmit={prepareBid} className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><ShieldCheck className="h-4 w-4" />Prepare a one-time bid</div>
            <p className="text-xs text-slate-300">{bidTarget.title} · current leading bid ₹{bidTarget.currentBid.toLocaleString()} · minimum increment ₹{bidTarget.minIncrement.toLocaleString()}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Exact bid amount (₹)
                <input required type="number" min={minimumBid(bidTarget)} step="1" value={bidAmount} onChange={(event) => { setBidAmount(event.target.value); setPreview(undefined); setConfirmation(undefined); }} disabled={bidLoading} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-300">Maximum budget (optional, ₹)
                <input type="number" min="1" step="1" value={maxBudget} onChange={(event) => { setMaxBudget(event.target.value); setPreview(undefined); setConfirmation(undefined); }} disabled={bidLoading} placeholder="Does not authorize a higher bid" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
              </label>
            </div>
            {!preview && <button type="submit" disabled={bidLoading} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50">{bidLoading ? 'Checking auction…' : 'Review exact bid'}</button>}
            {preview && confirmation && (
              <div className="space-y-2 rounded-lg border border-amber-400/30 bg-slate-950/70 p-3" aria-live="polite">
                <p className="text-xs font-bold text-amber-100">Confirm exact bid for {preview.title}</p>
                <p className="text-xs text-slate-300">Bid ₹{preview.amount.toLocaleString()} · current leading bid ₹{preview.currentBid.toLocaleString()} · increment ₹{preview.minIncrement.toLocaleString()}</p>
                {preview.maxBudget !== null && <p className="text-xs text-slate-300">Your maximum budget: ₹{preview.maxBudget.toLocaleString()}</p>}
                <p className="text-[11px] text-slate-400">This confirmation expires {new Date(confirmation.expiresAt).toLocaleTimeString()}. If the auction changes, you must review again.</p>
                <button type="button" onClick={() => void confirmBid()} disabled={bidLoading} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                  {bidLoading ? 'Submitting…' : `Confirm bid of ₹${preview.amount.toLocaleString()}`}
                </button>
              </div>
            )}
            {bidError && <p role="alert" className="text-xs text-rose-300">{bidError}</p>}
          </form>
        )}

        <form onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }} className="flex gap-2">
          <label htmlFor="buyer-assistant-message" className="sr-only">Message the BidNest assistant</label>
          <input id="buyer-assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Ask about an item, budget, or auction…" disabled={loading} className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-400 focus:outline-none" />
          <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Send</span>
          </button>
        </form>
        <p className="text-[10px] leading-relaxed text-slate-500">Your recent chat messages are sent to Groq for request interpretation; do not include passwords, account details, or other sensitive information. The assistant cannot place a bid from chat. Review and confirm the exact bid on the confirmation card. Your budget is a cap, not permission to bid that full amount.</p>
      </div>
    </section>
  );
};
