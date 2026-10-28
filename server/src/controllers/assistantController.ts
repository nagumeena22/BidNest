import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import mongoose from 'mongoose';
import { Listing } from '../models/Listing.js';
import { BidConfirmation } from '../models/BidConfirmation.js';
import type { AuthRequest } from '../middleware/auth.js';
import {
  assistantReplyForResults,
  hasAssistantSearchFilters,
  interpretAssistantRequest,
  sanitizeConversation,
  searchAssistantListings,
} from '../services/assistantService.js';
import {
  BidServiceError,
  closeExpiredAuction,
  getMinimumBid,
  isBidConfirmationCurrent,
  isVerifiedBuyer,
  isWithinBudget,
  placeBidForUser,
} from '../services/bidService.js';

const publicListing = (listing: InstanceType<typeof Listing>, wantsBidHistory: boolean) => ({
  id: listing.id,
  title: listing.title,
  category: listing.category,
  description: listing.description,
  condition: listing.condition,
  photos: listing.photos,
  startingPrice: listing.startingPrice,
  minIncrement: listing.minIncrement,
  currentBid: listing.currentBid,
  totalBids: listing.totalBids,
  closingTime: listing.closingTime,
  status: listing.status,
  handoverStatus: listing.handoverStatus,
  bids: wantsBidHistory
    ? listing.bids.map((bid) => ({
      bidderName: bid.bidderName,
      amount: bid.amount,
      timestamp: bid.timestamp,
    }))
    : [],
});

const requireBuyer = (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user || !isVerifiedBuyer(user)) {
    res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
    return null;
  }
  return user;
};

export const chatAssistant = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = requireBuyer(req, res);
  if (!user) return;

  const messages = sanitizeConversation(req.body?.messages);
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== 'user') {
    res.status(400).json({ message: 'Send a non-empty student message to continue.' });
    return;
  }
  const selectedListingId = req.body?.selectedListingId;
  if (selectedListingId !== undefined && selectedListingId !== null &&
    (typeof selectedListingId !== 'string' || !mongoose.isValidObjectId(selectedListingId))) {
    res.status(400).json({ message: 'Selected listing is invalid.' });
    return;
  }

  try {
    const filters = await interpretAssistantRequest(messages);
    if (!selectedListingId && !hasAssistantSearchFilters(filters)) {
      res.status(200).json({
        assistantMessage: filters.wantsBidHistory
          ? 'Choose an auction from a result card first, then ask me to show its public bid history.'
          : 'Tell me the item, category, budget, or closing time you have in mind. To bid, choose an auction and prepare an exact amount for review.',
        listings: [],
        filters,
        searchPerformed: false,
      });
      return;
    }
    if (selectedListingId && !hasAssistantSearchFilters(filters)) {
      const listing = await Listing.findById(selectedListingId);
      if (!listing) {
        res.status(200).json({
          assistantMessage: 'I could not find that auction. Please choose another listing.',
          listings: [],
          filters,
          searchPerformed: true,
        });
        return;
      }
      if (listing.status === 'ACTIVE' && await closeExpiredAuction(listing)) {
        res.status(200).json({
          assistantMessage: `This auction has closed with status ${listing.status.toLowerCase()}.`,
          listings: [publicListing(listing, filters.wantsBidHistory)],
          filters,
          searchPerformed: true,
        });
        return;
      }
      const result = publicListing(listing, filters.wantsBidHistory);
      res.status(200).json({
        assistantMessage: assistantReplyForResults(filters, [result]),
        listings: [result],
        filters,
        searchPerformed: true,
      });
      return;
    }

    const listings = await searchAssistantListings(filters);
    res.status(200).json({
      assistantMessage: assistantReplyForResults(filters, listings),
      listings,
      filters,
      searchPerformed: true,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'GROQ_API_KEY is not configured.') {
      res.status(503).json({ message: 'The AI assistant is not configured yet. Set GROQ_API_KEY on the backend.' });
      return;
    }
    console.error('Assistant chat error:', error);
    res.status(502).json({ message: 'The assistant could not process that request. Please try again shortly.' });
  }
};

export const prepareAssistantBid = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = requireBuyer(req, res);
  if (!user) return;

  const { listingId, amount, maxBudget } = req.body ?? {};
  if (typeof listingId !== 'string' || !mongoose.isValidObjectId(listingId)) {
    res.status(400).json({ message: 'A valid listing is required.' });
    return;
  }
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
    res.status(400).json({ message: 'Bid amount must be a positive whole number of rupees.' });
    return;
  }
  if (maxBudget !== undefined && (typeof maxBudget !== 'number' || !Number.isSafeInteger(maxBudget) || maxBudget < 1)) {
    res.status(400).json({ message: 'Maximum budget must be a positive whole number of rupees.' });
    return;
  }
  if (!isWithinBudget(amount, maxBudget)) {
    res.status(400).json({ message: 'The proposed bid cannot exceed your stated maximum budget.' });
    return;
  }

  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    if (listing.status === 'ACTIVE' && await closeExpiredAuction(listing)) {
      res.status(409).json({ message: 'This auction has closed. No bid confirmation was created.' });
      return;
    }
    if (listing.status !== 'ACTIVE') {
      res.status(409).json({ message: `This auction is ${listing.status.toLowerCase()} and cannot accept bids.` });
      return;
    }
    if (listing.sellerId === user._id.toString()) {
      res.status(403).json({ message: 'You cannot bid on your own listing.' });
      return;
    }
    const minRequired = getMinimumBid(listing);
    if (amount < minRequired) {
      res.status(409).json({ message: `The current minimum valid bid is ₹${minRequired.toLocaleString()}. Refresh and prepare a new bid.` });
      return;
    }
    const ownProxyBid = listing.proxyBids.find((entry) => entry.bidderId === user._id.toString() && entry.active);
    if (ownProxyBid && amount > ownProxyBid.maxAmount) {
      res.status(409).json({
        message: `Your active automatic-bid limit is ₹${ownProxyBid.maxAmount.toLocaleString()}. Update or stop it before preparing this bid.`,
      });
      return;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const nonce = randomUUID();
    await BidConfirmation.create({
      nonce,
      userId: user._id.toString(),
      listingId: listing.id,
      amount,
      maxBudget,
      currentBid: listing.currentBid,
      minIncrement: listing.minIncrement,
      closingTime: listing.closingTime,
      expiresAt,
      consumed: false,
    });
    res.status(201).json({
      confirmation: { nonce, expiresAt },
      preview: {
        listingId: listing.id,
        title: listing.title,
        photo: listing.photos[0] ?? null,
        amount,
        currentBid: listing.currentBid,
        minIncrement: listing.minIncrement,
        minimumValidBid: minRequired,
        maxBudget: maxBudget ?? null,
        closingTime: listing.closingTime,
      },
    });
  } catch (error: unknown) {
    console.error('Prepare assistant bid error:', error);
    res.status(500).json({ message: 'Could not prepare this bid. Please try again.' });
  }
};

export const confirmAssistantBid = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = requireBuyer(req, res);
  if (!user) return;

  const { nonce, amount } = req.body ?? {};
  if (typeof nonce !== 'string' || nonce.length > 64 ||
    typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
    res.status(400).json({ message: 'A valid confirmation and exact bid amount are required.' });
    return;
  }

  try {
    const confirmation = await BidConfirmation.findOneAndUpdate(
      {
        nonce,
        userId: user._id.toString(),
        amount,
        consumed: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumed: true } },
      { new: true },
    );
    if (!confirmation) {
      res.status(409).json({ message: 'This bid confirmation is invalid, expired, already used, or does not match that exact amount. Prepare a fresh bid.' });
      return;
    }
    if (!isWithinBudget(amount, confirmation.maxBudget)) {
      res.status(409).json({ message: 'The proposed bid exceeds the authorized maximum budget.' });
      return;
    }

    const listing = await Listing.findById(confirmation.listingId);
    if (!listing) {
      res.status(404).json({ message: 'Listing no longer exists.' });
      return;
    }
    if (listing.status === 'ACTIVE' && await closeExpiredAuction(listing)) {
      res.status(409).json({ message: 'The auction has closed. Prepare a new bid on an active auction.' });
      return;
    }
    if (!isBidConfirmationCurrent(confirmation, listing)) {
      res.status(409).json({ message: 'Auction details changed since confirmation. Review the current price and prepare a fresh bid.' });
      return;
    }

    const result = await placeBidForUser(user, confirmation.listingId, amount);
    res.status(200).json({
      message: result.message,
      listing: result.listing.toJSON(),
      extended: result.extended,
    });
  } catch (error: unknown) {
    if (error instanceof BidServiceError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('Confirm assistant bid error:', error);
    res.status(500).json({ message: 'Could not confirm this bid. Please prepare a fresh bid and try again.' });
  }
};
