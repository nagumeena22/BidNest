import React, { useState } from 'react';
import { Bot, Search } from 'lucide-react';
import type { Listing, ListingCategory } from '../../types';

interface BuyerAssistantProps {
  listings: Listing[];
}

const categoryTerms: Array<{ category: ListingCategory; terms: string[] }> = [
  { category: 'cycle', terms: ['cycle', 'cycles', 'bicycle', 'bike'] },
  { category: 'calculator', terms: ['calculator', 'calculators'] },
  { category: 'books', terms: ['book', 'books', 'textbook'] },
  { category: 'electronics', terms: ['electronics', 'electronic', 'laptop', 'monitor', 'phone'] },
  { category: 'hostel_essentials', terms: ['hostel', 'hostel essentials', 'essentials'] },
  { category: 'sports', terms: ['sports', 'sport', 'cricket', 'football'] },
];

const parseRequest = (request: string) => {
  const normalized = request.toLowerCase();
  const category = categoryTerms.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.category;
  const priceMatch = normalized.match(/₹\s*([\d,]+)|(?:under|below|less than|up to|max(?:imum)?(?:\s+price)?|<=)\s*₹?\s*([\d,]+)/i);
  const priceText = priceMatch?.[1] ?? priceMatch?.[2];
  const maxPrice = priceText ? Number(priceText.replaceAll(',', '')) : undefined;
  return { category, maxPrice };
};

const nextAllowedBid = (listing: Listing) =>
  listing.totalBids > 0 ? listing.currentBid + listing.minIncrement : listing.startingPrice;

export const BuyerAssistant: React.FC<BuyerAssistantProps> = ({ listings }) => {
  const [request, setRequest] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState('');
  const [message, setMessage] = useState('');
  const [matches, setMatches] = useState<Listing[]>([]);

  const findItems = (event: React.FormEvent) => {
    event.preventDefault();
    const text = request.trim();
    if (!text) {
      setMessage('Describe what you are looking for, for example: “Find me a cycle under ₹2,000”.');
      setMatches([]);
      return;
    }

    const { category, maxPrice } = parseRequest(text);
    if (!category && maxPrice === undefined) {
      setMessage('Try adding an item type or budget, such as “cycle under ₹2,000”.');
      setMatches([]);
      return;
    }

    const found = listings.filter((listing) =>
      (!category || listing.category === category) &&
      (maxPrice === undefined || nextAllowedBid(listing) <= maxPrice),
    );
    setSubmittedRequest(text);
    setMatches(found);
    setMessage(found.length
      ? `I found ${found.length} ${category ? `${category.replace('_', ' ')} ` : ''}auction${found.length === 1 ? '' : 's'}${maxPrice === undefined ? '' : ` within ₹${maxPrice.toLocaleString()}`}.`
      : `No active listings match${category ? ` ${category.replace('_', ' ')}` : ' your request'}${maxPrice === undefined ? '' : ` within ₹${maxPrice.toLocaleString()}`}.`);
  };

  return (
    <section className="mb-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/70 to-slate-900 p-4 sm:p-5" aria-labelledby="buyer-assistant-title">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-purple-500/15 p-2 text-purple-300"><Bot className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 id="buyer-assistant-title" className="font-bold text-white">BidNest buying assistant</h2>
          <p className="mt-1 text-xs text-slate-400">Tell me what item and budget you have in mind. Search is processed on this device and shows item details only.</p>
          <form onSubmit={findItems} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="buyer-assistant-request" className="sr-only">Describe an item and budget</label>
            <input id="buyer-assistant-request" value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Find me a cycle under ₹2,000" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"><Search className="h-4 w-4" />Find items</button>
          </form>
          {message && <p role="status" className="mt-3 text-sm text-slate-200">{message}</p>}
          {matches.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-slate-500">Matches for “{submittedRequest}” · recommended bid means the next valid bid.</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {matches.map((listing) => (
                  <li key={listing.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{listing.title}</p>
                      <p className="mt-1 text-xs text-slate-400">Leading ₹{listing.currentBid.toLocaleString()} · next bid ₹{nextAllowedBid(listing).toLocaleString()}</p>
                    </div>
                    <a href={`#listing-${listing.id}`} className="shrink-0 rounded-md border border-purple-400/40 px-2.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/10">Review</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
