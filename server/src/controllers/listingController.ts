import { Request, Response } from 'express';
import { Listing, type ListingCategory, type ListingCondition } from '../models/Listing.js';
import { AuthRequest } from '../middleware/auth.js';
import { WantedAlert, type IWantedAlert } from '../models/WantedAlert.js';

const listingCategories: ListingCategory[] = ['cycle', 'calculator', 'books', 'electronics', 'hostel_essentials', 'sports', 'other'];
const listingConditions: ListingCondition[] = ['Like New', 'Gently Used', 'Functional', 'Heavily Used'];
const isListingCategory = (value: unknown): value is ListingCategory =>
  typeof value === 'string' && listingCategories.some((category) => category === value);
const isListingCondition = (value: unknown): value is ListingCondition =>
  typeof value === 'string' && listingConditions.some((condition) => condition === value);

// 1. GET ALL LISTINGS with Keyword Search & Multi-Filters
export const getListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      keyword,
      category,
      condition,
      minPrice,
      maxPrice,
      closingSoon,
      sellerId,
      status,
    } = req.query;

    const query: Record<string, any> = {};

    // Filter by seller (for Seller's own dashboard)
    if (sellerId) {
      query.sellerId = sellerId;
    } else {
      // By default for buyers: only active listings
      query.status = status || 'ACTIVE';
    }

    // Keyword Search
    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
      const term = keyword.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    // Category Filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Condition Filter
    if (condition && condition !== 'all') {
      query.condition = condition;
    }

    // Price Filter
    if (minPrice || maxPrice) {
      query.currentBid = {};
      if (minPrice) query.currentBid.$gte = Number(minPrice);
      if (maxPrice) query.currentBid.$lte = Number(maxPrice);
    }

    // Sorting
    let sortOptions: Record<string, any> = { createdAt: -1 };
    if (closingSoon === 'true') {
      // Sort nearest closing time first
      sortOptions = { closingTime: 1 };
    }

    const expiredListings = await Listing.find({ status: 'ACTIVE', closingTime: { $lte: new Date() } });
    await closeExpiredAuctions(expiredListings);
    const listings = await Listing.find(query).sort(sortOptions);

    res.status(200).json({
      count: listings.length,
      listings: listings.map((l) => l.toJSON()),
    });
  } catch (error: any) {
    console.error('Fetch Listings Error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch listings' });
  }
};

const isVerifiedSeller = (user: NonNullable<AuthRequest['user']>) =>
  user.role === 'seller' && user.rollNumber.startsWith('23');

const closeExpiredAuction = async (listing: InstanceType<typeof Listing>): Promise<boolean> => {
  if (listing.status !== 'ACTIVE' || new Date(listing.closingTime).getTime() > Date.now()) return false;
  if (listing.bids.length === 0) {
    listing.status = 'UNSOLD';
  } else {
    listing.status = 'PROVISIONALLY_CLOSED';
    listing.handoverStatus = 'AWAITING_SELLER_APPROVAL';
  }
  await listing.save();
  return true;
};

const closeExpiredAuctions = async (listings: InstanceType<typeof Listing>[]) => {
  for (const listing of listings) await closeExpiredAuction(listing);
};

const isVerifiedBuyer = (user: NonNullable<AuthRequest['user']>) =>
  user.role === 'buyer' && user.rollNumber.startsWith('24');

const alertMatchesListing = (alert: IWantedAlert, listing: InstanceType<typeof Listing>) => {
  const searchText = `${listing.title} ${listing.description}`.toLowerCase();
  return (!alert.category || alert.category === listing.category) &&
    searchText.includes(alert.keyword.toLowerCase()) &&
    (alert.maxPrice === undefined || listing.currentBid <= alert.maxPrice);
};

const recordWantedMatches = async (listing: InstanceType<typeof Listing>) => {
  const alerts = await WantedAlert.find({ active: true });
  const matchedAt = new Date();
  for (const alert of alerts) {
    if (alertMatchesListing(alert, listing) && !alert.matches.some((match) => match.listingId === listing.id)) {
      alert.matches.push({
        listingId: listing.id,
        listingTitle: listing.title,
        category: listing.category,
        currentBid: listing.currentBid,
        matchedAt,
        seen: false,
      });
      await alert.save();
    }
  }
};

export const getWantedAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    const alerts = await WantedAlert.find({ userId: user._id.toString() }).sort({ createdAt: -1 });
    res.status(200).json({ count: alerts.length, alerts: alerts.map((alert) => ({
      id: alert.id,
      keyword: alert.keyword,
      category: alert.category,
      maxPrice: alert.maxPrice,
      active: alert.active,
      createdAt: alert.createdAt,
      matches: alert.matches,
    })) });
  } catch (error: any) {
    console.error('Fetch Wanted Alerts Error:', error);
    res.status(500).json({ message: error.message || 'Could not load wanted alerts.' });
  }
};

export const createWantedAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const keyword = typeof req.body?.keyword === 'string' ? req.body.keyword.trim().toLowerCase() : '';
    const category = req.body?.category;
    const maxPrice = req.body?.maxPrice === '' || req.body?.maxPrice === undefined ? undefined : Number(req.body.maxPrice);
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    if (keyword.length < 2 || keyword.length > 100) {
      res.status(400).json({ message: 'Search keyword must be between 2 and 100 characters.' });
      return;
    }
    if (category !== undefined && category !== '' && !isListingCategory(category)) {
      res.status(400).json({ message: 'Choose a supported listing category.' });
      return;
    }
    if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 1)) {
      res.status(400).json({ message: 'Maximum price must be at least ₹1.' });
      return;
    }

    const userId = user._id.toString();
    if (await WantedAlert.countDocuments({ userId, active: true }) >= 10) {
      res.status(409).json({ message: 'You can have up to 10 active wanted alerts.' });
      return;
    }
    const alert = new WantedAlert({
      userId,
      keyword,
      category: category || undefined,
      maxPrice,
      active: true,
      matches: [],
    });

    const activeListings = await Listing.find({ status: 'ACTIVE' });
    for (const listing of activeListings) {
      if (alertMatchesListing(alert, listing)) {
        alert.matches.push({
          listingId: listing.id,
          listingTitle: listing.title,
          category: listing.category,
          currentBid: listing.currentBid,
          matchedAt: new Date(),
          seen: false,
        });
      }
    }
    await alert.save();
    res.status(201).json({
      message: alert.matches.length ? 'Wanted alert saved and matching active listings found.' : 'Wanted alert saved. We will keep checking new listings for you.',
      alert: {
        id: alert.id,
        keyword: alert.keyword,
        category: alert.category,
        maxPrice: alert.maxPrice,
        active: alert.active,
        createdAt: alert.createdAt,
        matches: alert.matches,
      },
    });
  } catch (error: any) {
    console.error('Create Wanted Alert Error:', error);
    res.status(500).json({ message: error.message || 'Could not save wanted alert.' });
  }
};

export const deleteWantedAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    const alert = await WantedAlert.findOneAndDelete({ _id: req.params.id, userId: user._id.toString() });
    if (!alert) {
      res.status(404).json({ message: 'Wanted alert not found.' });
      return;
    }
    res.status(200).json({ message: 'Wanted alert removed.' });
  } catch (error: any) {
    console.error('Delete Wanted Alert Error:', error);
    res.status(500).json({ message: error.message || 'Could not remove wanted alert.' });
  }
};

export const askListingQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    if (question.length < 5 || question.length > 500) {
      res.status(400).json({ message: 'Question must be between 5 and 500 characters.' });
      return;
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    if (listing.status !== 'ACTIVE') {
      res.status(409).json({ message: 'Questions are closed for this auction.' });
      return;
    }
    if (listing.sellerId === user._id.toString()) {
      res.status(403).json({ message: 'Sellers cannot ask questions on their own listing.' });
      return;
    }
    const recentQuestions = listing.questions.filter((entry) =>
      entry.askedBy === user._id.toString() && entry.askedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000,
    );
    if (recentQuestions.length >= 5) {
      res.status(429).json({ message: 'You can ask up to 5 questions per auction in 24 hours.' });
      return;
    }
    const normalizedQuestion = question.toLowerCase().replace(/\s+/g, ' ');
    if (listing.questions.some((entry) =>
      entry.askedBy === user._id.toString() && entry.question.toLowerCase().replace(/\s+/g, ' ') === normalizedQuestion,
    )) {
      res.status(409).json({ message: 'You already asked this question on this listing.' });
      return;
    }
    listing.questions.push({
      askedBy: user._id.toString(),
      askedByName: user.name,
      question,
      askedAt: new Date(),
    });
    await listing.save();
    res.status(201).json({ message: 'Question posted publicly for the seller to answer.', listing: listing.toJSON() });
  } catch (error: any) {
    console.error('Ask Listing Question Error:', error);
    res.status(500).json({ message: error.message || 'Could not post your question.' });
  }
};

export const answerListingQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
    const questionId = req.params.questionId;
    if (!user || !isVerifiedSeller(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified seller account is required.' });
      return;
    }
    if (answer.length < 2 || answer.length > 1000) {
      res.status(400).json({ message: 'Answer must be between 2 and 1000 characters.' });
      return;
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    if (listing.sellerId !== user._id.toString()) {
      res.status(403).json({ message: 'Only the listing owner can answer questions.' });
      return;
    }
    const question = listing.questions.find((entry) => entry._id?.toString() === questionId);
    if (!question) {
      res.status(404).json({ message: 'Question not found.' });
      return;
    }
    if (question.answer) {
      res.status(409).json({ message: 'This question has already been answered.' });
      return;
    }
    question.answer = answer;
    question.answeredBy = user.name;
    question.answeredAt = new Date();
    await listing.save();
    res.status(200).json({ message: 'Answer posted publicly.', listing: listing.toJSON() });
  } catch (error: any) {
    console.error('Answer Listing Question Error:', error);
    res.status(500).json({ message: error.message || 'Could not post the answer.' });
  }
};

const runProxyBidding = (listing: InstanceType<typeof Listing>) => {
  const activeSettings = listing.proxyBids.filter((setting) => setting.active);
  const leadingSetting = activeSettings.find((setting) => setting.bidderId === listing.leadingBidderId);
  const candidate = activeSettings
    .filter((setting) => setting.bidderId !== listing.leadingBidderId)
    .sort((left, right) => right.maxAmount - left.maxAmount)[0];
  if (!candidate) return false;

  if (leadingSetting && leadingSetting.maxAmount >= candidate.maxAmount) return false;

  const minimumBid = listing.bids.length === 0
    ? listing.startingPrice
    : listing.currentBid + listing.minIncrement;
  if (minimumBid > candidate.maxAmount) return false;

  listing.bids.push({
    bidderId: candidate.bidderId,
    bidderName: candidate.bidderName,
    bidderRoll: candidate.bidderRoll,
    amount: minimumBid,
    timestamp: new Date(),
  });
  listing.currentBid = minimumBid;
  listing.leadingBidderId = candidate.bidderId;
  listing.leadingBidderName = candidate.bidderName;
  listing.leadingBidderRoll = candidate.bidderRoll;
  listing.totalBids = listing.bids.length;
  if (new Date(listing.closingTime).getTime() - Date.now() <= 30000) {
    listing.closingTime = new Date(Date.now() + 60000);
    listing.isExtended = true;
  }
  return true;
};

// Keep auction status transitions current when buyers browse or check their bids.
export const getBuyerBids = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }

    const userId = user._id.toString();
    const listings = await Listing.find({
      $or: [{ 'bids.bidderId': userId }, { 'proxyBids.bidderId': userId }],
    }).sort({ updatedAt: -1 });
    await closeExpiredAuctions(listings);
    res.status(200).json({
      count: listings.length,
      listings: listings.map((listing) => ({
        ...listing.toJSON(),
        myProxyBid: (() => {
          const ownProxyBid = listing.proxyBids.find((proxyBid) => proxyBid.bidderId === userId);
          return ownProxyBid ? {
            id: `${listing.id}-proxy`,
            listingId: listing.id,
            bidderId: ownProxyBid.bidderId,
            maxAmount: ownProxyBid.maxAmount,
            createdAt: ownProxyBid.createdAt,
            active: ownProxyBid.active,
          } : null;
        })(),
      })),
    });
  } catch (error: any) {
    console.error('Fetch Buyer Bids Error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch your auction activity.' });
  }
};

// Buyer confirms the campus handover after the seller approves the winning bid.
export const confirmBuyerHandover = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    if (listing.leadingBidderId !== user._id.toString()) {
      res.status(403).json({ message: 'Only the approved winning buyer can confirm this handover.' });
      return;
    }
    if (listing.handoverStatus !== 'APPROVED_RESERVED') {
      res.status(409).json({ message: 'The seller must approve the winning bid before handover confirmation.' });
      return;
    }

    listing.status = 'SOLD';
    listing.handoverStatus = 'HANDOVER_COMPLETED';
    await listing.save();
    res.status(200).json({ message: 'Campus handover confirmed. Sale completed.', listing: listing.toJSON() });
  } catch (error: any) {
    console.error('Confirm Buyer Handover Error:', error);
    res.status(500).json({ message: error.message || 'Could not confirm the handover.' });
  }
};

// Seller-only view: returns complete bid history and closes expired auctions.
export const getSellerListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !isVerifiedSeller(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified seller account is required.' });
      return;
    }

    const listings = await Listing.find({ sellerId: user._id.toString() }).sort({ createdAt: -1 });
    await closeExpiredAuctions(listings);

    res.status(200).json({ count: listings.length, listings: listings.map((listing) => listing.toJSON()) });
  } catch (error: any) {
    console.error('Fetch Seller Listings Error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch your listings.' });
  }
};

// Seller-only auction decision and handover lifecycle.
export const manageSellerListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { action, notes = '' } = req.body as { action?: string; notes?: string };

    if (!user || !isVerifiedSeller(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified seller account is required.' });
      return;
    }
    if (typeof notes !== 'string' || notes.length > 1000) {
      res.status(400).json({ message: 'Outcome notes must be 1000 characters or fewer.' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    if (listing.sellerId !== user._id.toString()) {
      res.status(403).json({ message: 'You can only manage your own listings.' });
      return;
    }

    await closeExpiredAuction(listing);

    if (action === 'approve' || action === 'reject') {
      if (listing.status !== 'PROVISIONALLY_CLOSED' || listing.bids.length === 0) {
        res.status(409).json({ message: 'Only a closed auction with bids can be approved or rejected.' });
        return;
      }
      if (listing.handoverStatus !== 'AWAITING_SELLER_APPROVAL') {
        res.status(409).json({ message: 'A decision has already been recorded for this auction.' });
        return;
      }
      listing.handoverStatus = action === 'approve' ? 'APPROVED_RESERVED' : 'REJECTED';
      listing.handoverNotes = notes.trim();
      if (action === 'reject') listing.status = 'UNSOLD';
    } else if (action === 'complete' || action === 'failed_pickup' || action === 'seller_cancelled') {
      if (listing.handoverStatus !== 'APPROVED_RESERVED') {
        res.status(409).json({ message: 'This outcome is only available after approving the winning bid.' });
        return;
      }
      if (action === 'complete') {
        listing.status = 'SOLD';
        listing.handoverStatus = 'HANDOVER_COMPLETED';
      } else if (action === 'failed_pickup') {
        listing.status = 'UNSOLD';
        listing.handoverStatus = 'FAILED_PICKUP';
      } else {
        listing.status = 'CANCELLED';
        listing.handoverStatus = 'SELLER_CANCELLED';
      }
      listing.handoverNotes = notes.trim();
    } else {
      res.status(400).json({ message: 'Choose a supported seller outcome.' });
      return;
    }

    await listing.save();
    res.status(200).json({ message: 'Auction outcome recorded.', listing: listing.toJSON() });
  } catch (error: any) {
    console.error('Manage Seller Listing Error:', error);
    res.status(500).json({ message: error.message || 'Failed to record auction outcome.' });
  }
};

// 2. GET SINGLE LISTING BY ID (With Full Bid History)
export const getListingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
      res.status(404).json({ message: 'Campus item not found' });
      return;
    }

    // Return listing with bids sorted by timestamp descending
    const listingObj = listing.toJSON();
    if (listingObj.bids && Array.isArray(listingObj.bids)) {
      listingObj.bids.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    res.status(200).json({ listing: listingObj });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error retrieving item details' });
  }
};

// 3. CREATE LISTING (Seller Only - Roll must start with 23)
export const createListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Strict Role Check: Seller only (Roll starts with 23)
    if (user.role !== 'seller' || !user.rollNumber.startsWith('23')) {
      res.status(403).json({
        message: `Forbidden: Only verified Senior Sellers (Batch 23) can list items. Your roll is "${user.rollNumber}".`,
      });
      return;
    }

    const {
      title,
      category,
      description,
      condition = 'Gently Used',
      photos = [],
      startingPrice,
      minIncrement = 50,
      closingTime,
    } = req.body;

    if (!title || !category || !description || startingPrice === undefined || !closingTime) {
      res.status(400).json({
        message: 'Please provide all required fields (title, category, description, starting price, closing time)',
      });
      return;
    }

    const parsedPrice = Number(startingPrice);
    const parsedIncrement = Number(minIncrement);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || !Number.isFinite(parsedIncrement) || parsedIncrement <= 0) {
      res.status(400).json({ message: 'Starting price and minimum increment must be positive numbers.' });
      return;
    }
    if (!isListingCategory(category) || !isListingCondition(condition)) {
      res.status(400).json({ message: 'Choose a supported item category and condition.' });
      return;
    }
    if (!Array.isArray(photos) || photos.length === 0 || photos.some((photo: unknown) => typeof photo !== 'string' || !/^https?:\/\/\S+$/i.test(photo))) {
      res.status(400).json({ message: 'Add at least one valid HTTP or HTTPS item photo URL.' });
      return;
    }

    const parsedClosing = new Date(closingTime);
    if (isNaN(parsedClosing.getTime())) {
      res.status(400).json({ message: 'Invalid closing date/time format' });
      return;
    }

    if (parsedClosing.getTime() <= Date.now()) {
      res.status(400).json({ message: 'Closing date and time must be in the future' });
      return;
    }

    const newListing = new Listing({
      title: title.trim(),
      category,
      description: description.trim(),
      condition,
      photos,
      startingPrice: parsedPrice,
      minIncrement: parsedIncrement,
      currentBid: parsedPrice,
      sellerId: user._id.toString(),
      sellerName: user.name,
      sellerRoll: user.rollNumber,
      sellerHostel: user.hostel,
      sellerRoom: user.roomNumber,
      closingTime: parsedClosing,
      status: 'ACTIVE',
      bids: [],
      totalBids: 0,
    });

    await newListing.save();
    await recordWantedMatches(newListing);

    res.status(201).json({
      message: `Auction listing for "${newListing.title}" created successfully!`,
      listing: newListing.toJSON(),
    });
  } catch (error: any) {
    console.error('Create Listing Error:', error);
    res.status(500).json({ message: error.message || 'Failed to create listing' });
  }
};

// 4. EDIT / UPDATE LISTING (Seller Only - Must be owner)
export const updateListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (user.role !== 'seller' || !user.rollNumber.startsWith('23')) {
      res.status(403).json({ message: 'Only seller accounts with a 23-prefix roll can edit listings.' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found' });
      return;
    }

    // Verify ownership
    if (listing.sellerId !== user._id.toString()) {
      res.status(403).json({ message: 'Access Denied: You can only edit your own listings' });
      return;
    }

    if (listing.status !== 'ACTIVE') {
      res.status(400).json({ message: `Cannot edit listing with status "${listing.status}"` });
      return;
    }

    if (listing.totalBids > 0 || listing.bids.length > 0) {
      res.status(409).json({ message: 'Listings with bids cannot be edited.' });
      return;
    }

    const {
      title,
      category,
      description,
      condition,
      photos,
      startingPrice,
      minIncrement,
      closingTime,
    } = req.body;

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof description !== 'string' || !description.trim() ||
      !isListingCategory(category) ||
      !isListingCondition(condition) ||
      !Array.isArray(photos) || photos.length === 0 ||
      photos.some((photo: unknown) => typeof photo !== 'string' || !/^https?:\/\/\S+$/i.test(photo)) ||
      !closingTime
    ) {
      res.status(400).json({ message: 'Provide a title, supported category and condition, description, item photo, and closing time.' });
      return;
    }

    if (title) listing.title = title.trim();
    if (category) listing.category = category;
    if (description) listing.description = description.trim();
    if (condition) listing.condition = condition;
    if (photos && Array.isArray(photos)) listing.photos = photos;
    if (startingPrice !== undefined) {
      const parsedPrice = Number(startingPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({ message: 'Starting price must be greater than zero.' });
        return;
      }
      listing.startingPrice = parsedPrice;
      listing.currentBid = parsedPrice;
    }
    if (minIncrement !== undefined) {
      const parsedIncrement = Number(minIncrement);
      if (!Number.isFinite(parsedIncrement) || parsedIncrement <= 0) {
        res.status(400).json({ message: 'Minimum bid increment must be greater than zero.' });
        return;
      }
      listing.minIncrement = parsedIncrement;
    }
    if (closingTime) {
      const parsedClosing = new Date(closingTime);
      if (isNaN(parsedClosing.getTime()) || parsedClosing.getTime() <= Date.now()) {
        res.status(400).json({ message: 'Closing date and time must be in the future.' });
        return;
      }
      listing.closingTime = parsedClosing;
    }

    await listing.save();

    res.status(200).json({
      message: 'Listing updated successfully!',
      listing: listing.toJSON(),
    });
  } catch (error: any) {
    console.error('Update Listing Error:', error);
    res.status(500).json({ message: error.message || 'Failed to update listing' });
  }
};

// A buyer explicitly authorizes automatic incremental bidding up to this ceiling.
export const setProxyBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const maxAmount = Number(req.body?.maxAmount);
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
      res.status(400).json({ message: 'Enter a positive maximum bid amount.' });
      return;
    }
    if (req.body?.consent !== true) {
      res.status(400).json({ message: 'Explicit confirmation is required to enable automatic bidding.' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    await closeExpiredAuction(listing);
    if (listing.status !== 'ACTIVE') {
      res.status(409).json({ message: 'Automatic bidding is only available while the auction is active.' });
      return;
    }
    if (listing.sellerId === user._id.toString()) {
      res.status(403).json({ message: 'Sellers cannot bid on their own listings.' });
      return;
    }

    const ownBids = listing.bids.filter((bid) => bid.bidderId === user._id.toString());
    const ownHighestBid = ownBids.reduce((highest, bid) => Math.max(highest, bid.amount), 0);
    const minimumBid = listing.bids.length === 0
      ? listing.startingPrice
      : listing.currentBid + listing.minIncrement;
    if (maxAmount < Math.max(ownHighestBid, minimumBid)) {
      res.status(400).json({ message: `Your maximum must be at least ₹${Math.max(ownHighestBid, minimumBid).toLocaleString()}.` });
      return;
    }

    const existing = listing.proxyBids.find((proxyBid) => proxyBid.bidderId === user._id.toString());
    if (existing) {
      existing.maxAmount = maxAmount;
      existing.active = true;
      existing.createdAt = new Date();
    } else {
      listing.proxyBids.push({
        bidderId: user._id.toString(),
        bidderName: user.name,
        bidderRoll: user.rollNumber,
        maxAmount,
        active: true,
        createdAt: new Date(),
      });
    }

    runProxyBidding(listing);
    await listing.save();
    const myProxyBid = listing.proxyBids.find((proxyBid) => proxyBid.bidderId === user._id.toString());
    res.status(200).json({
      message: `Automatic bidding enabled up to ₹${maxAmount.toLocaleString()}.`,
      listing: listing.toJSON(),
      myProxyBid: myProxyBid ? {
        id: `${listing.id}-proxy`,
        listingId: listing.id,
        bidderId: myProxyBid.bidderId,
        maxAmount: myProxyBid.maxAmount,
        createdAt: myProxyBid.createdAt,
        active: myProxyBid.active,
      } : null,
    });
  } catch (error: any) {
    console.error('Set Proxy Bid Error:', error);
    res.status(500).json({ message: error.message || 'Could not enable automatic bidding.' });
  }
};

export const cancelProxyBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !isVerifiedBuyer(user)) {
      res.status(user ? 403 : 401).json({ message: 'A verified buyer account is required.' });
      return;
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' });
      return;
    }
    const proxyBid = listing.proxyBids.find((entry) => entry.bidderId === user._id.toString());
    if (!proxyBid || !proxyBid.active) {
      res.status(404).json({ message: 'You do not have an active automatic bid on this auction.' });
      return;
    }
    proxyBid.active = false;
    await listing.save();
    res.status(200).json({ message: 'Automatic bidding stopped.', listing: listing.toJSON() });
  } catch (error: any) {
    console.error('Cancel Proxy Bid Error:', error);
    res.status(500).json({ message: error.message || 'Could not stop automatic bidding.' });
  }
};

// 5. CANCEL LISTING (Seller Only - Must be owner)
export const cancelListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (user.role !== 'seller' || !user.rollNumber.startsWith('23')) {
      res.status(403).json({ message: 'Only seller accounts with a 23-prefix roll can cancel listings.' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found' });
      return;
    }

    if (listing.sellerId !== user._id.toString()) {
      res.status(403).json({ message: 'Access Denied: You can only cancel your own listings' });
      return;
    }

    if (listing.status !== 'ACTIVE') {
      res.status(400).json({ message: `Cannot cancel listing with status "${listing.status}".` });
      return;
    }
    if (listing.totalBids > 0 || listing.bids.length > 0) {
      res.status(409).json({ message: 'Listings with bids cannot be canceled.' });
      return;
    }

    listing.status = 'CANCELLED';
    await listing.save();

    res.status(200).json({
      message: `Listing "${listing.title}" has been cancelled.`,
      listing: listing.toJSON(),
    });
  } catch (error: any) {
    console.error('Cancel Listing Error:', error);
    res.status(500).json({ message: error.message || 'Failed to cancel listing' });
  }
};

// 6. PLACE A BID (Buyer Only - Roll must start with 24)
export const placeBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { amount } = req.body;

    if (!user) {
      res.status(401).json({ message: 'Authentication required to place a bid' });
      return;
    }

    // Role check: Buyer only (Roll starts with 24)
    if (user.role !== 'buyer' || !user.rollNumber.startsWith('24')) {
      res.status(403).json({
        message: `Bidding is reserved for Junior Buyers (Batch 24). Seniors (Batch 23) cannot place bids.`,
      });
      return;
    }

    const bidAmount = Number(amount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      res.status(400).json({ message: 'Please enter a valid numeric bid amount' });
      return;
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Listing not found' });
      return;
    }

    // Cannot bid on cancelled or closed listing
    if (listing.status !== 'ACTIVE') {
      res.status(400).json({ message: `Auction is ${listing.status.toLowerCase()}. Bids can no longer be placed.` });
      return;
    }

    const now = Date.now();
    const closingMs = new Date(listing.closingTime).getTime();

    // Check if time has expired
    if (now >= closingMs) {
      await closeExpiredAuction(listing);
      res.status(400).json({ message: 'This auction has just closed! Bidding has stopped.' });
      return;
    }

    // Prevent seller from bidding on own item
    if (listing.sellerId === user._id.toString()) {
      res.status(400).json({ message: 'Sellers cannot bid on their own listings' });
      return;
    }
    const ownProxyBid = listing.proxyBids.find((proxyBid) => proxyBid.bidderId === user._id.toString() && proxyBid.active);
    if (ownProxyBid && bidAmount > ownProxyBid.maxAmount) {
      res.status(400).json({
        message: `Your active automatic-bid limit is ₹${ownProxyBid.maxAmount.toLocaleString()}. Raise or stop that limit before bidding higher.`,
      });
      return;
    }

    // Bid validation rule:
    // First bid: >= startingPrice
    // Subsequent bids: >= currentBid + minIncrement
    const isFirstBid = listing.bids.length === 0;
    const minRequiredBid = isFirstBid
      ? listing.startingPrice
      : listing.currentBid + listing.minIncrement;

    if (bidAmount < minRequiredBid) {
      res.status(400).json({
        message: `Your bid of ₹${bidAmount.toLocaleString()} is too low. The minimum valid bid is ₹${minRequiredBid.toLocaleString()} (Starting/Current + Min Increment ₹${listing.minIncrement}).`,
      });
      return;
    }

    // ANTI-SNIPING ENGINE:
    // If a valid bid arrives in the last 30 seconds of an auction,
    // the closing time moves to 60 seconds after that bid!
    let wasExtended = false;
    const remainingMs = closingMs - now;
    if (remainingMs <= 30000) { // <= 30 seconds
      listing.closingTime = new Date(now + 60000); // 60 seconds from now
      listing.isExtended = true;
      wasExtended = true;
      console.log(`⏱️ Anti-Sniping triggered on item ${listing.title}! Closing extended by 60s.`);
    }

    // Record bid
    const newBid = {
      bidderId: user._id.toString(),
      bidderName: user.name,
      bidderRoll: user.rollNumber,
      amount: bidAmount,
      timestamp: new Date(),
    };

    listing.bids.push(newBid);
    listing.currentBid = bidAmount;
    listing.leadingBidderId = user._id.toString();
    listing.leadingBidderName = user.name;
    listing.leadingBidderRoll = user.rollNumber;
    listing.totalBids = listing.bids.length;

    const automaticBidPlaced = runProxyBidding(listing);
    await listing.save();

    res.status(200).json({
      message: automaticBidPlaced
        ? `Your bid was accepted. An authorized automatic bid updated the leading price to ₹${listing.currentBid.toLocaleString()}.`
        : wasExtended
        ? `Bid of ₹${bidAmount.toLocaleString()} accepted! ⚡ Anti-Sniping triggered: Closing extended to 60 seconds.`
        : `Your bid of ₹${bidAmount.toLocaleString()} has been placed successfully! You are now the leading bidder.`,
      extended: wasExtended,
      newClosingTime: listing.closingTime,
      listing: listing.toJSON(),
    });
  } catch (error: any) {
    console.error('Place Bid Error:', error);
    res.status(500).json({ message: error.message || 'Failed to place bid' });
  }
};

// 7. SEED INITIAL CAMPUS LISTINGS IN MONGODB
export const seedListings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await Listing.countDocuments();
    if (count > 0) {
      const existing = await Listing.find().sort({ createdAt: -1 });
      res.status(200).json({
        message: 'Listings already seeded in MongoDB Atlas',
        count,
        listings: existing.map((l) => l.toJSON()),
      });
      return;
    }

    const now = Date.now();
    const minutesFromNow = (m: number) => new Date(now + m * 60 * 1000);
    const hoursFromNow = (h: number) => new Date(now + h * 3600 * 1000);

    const initialData = [
      {
        title: 'Hercules Roadeo Hardliner (21-Speed Geared Mountain Cycle)',
        category: 'cycle',
        description: 'Used for 2 semesters to commute between Hostel Block D and Mech Dept. Front disc brake working well, rear brake wire newly replaced. Includes heavy duty number lock and mudguards.',
        condition: 'Gently Used',
        photos: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80'],
        startingPrice: 1500,
        minIncrement: 100,
        currentBid: 1800,
        leadingBidderId: 'seed-buyer-1',
        leadingBidderName: 'Rahul Verma',
        leadingBidderRoll: '24BME042',
        sellerId: 'seed-seller-1',
        sellerName: 'Priya Sharma',
        sellerRoll: '23BCS015',
        sellerHostel: 'Block D (Kalpana Chawla Hall)',
        sellerRoom: '401',
        closingTime: minutesFromNow(25), // Closes in 25 mins (Closing Soon!)
        status: 'ACTIVE',
        totalBids: 2,
        bids: [
          {
            bidderId: 'seed-buyer-2',
            bidderName: 'Sneha Roy',
            bidderRoll: '24BCS118',
            amount: 1600,
            timestamp: new Date(now - 3600000),
          },
          {
            bidderId: 'seed-buyer-1',
            bidderName: 'Rahul Verma',
            bidderRoll: '24BME042',
            amount: 1800,
            timestamp: new Date(now - 1200000),
          },
        ],
      },
      {
        title: 'Casio fx-991EX ClassWiz Scientific Calculator (552 Functions)',
        category: 'calculator',
        description: 'Essential for Engineering Maths, Circuit Analysis, and Thermodynamics. High-res natural textbook display, solar + battery. No faded keys, original hard slide cover included.',
        condition: 'Like New',
        photos: ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=600&auto=format&fit=crop&q=80'],
        startingPrice: 400,
        minIncrement: 50,
        currentBid: 550,
        leadingBidderId: 'seed-buyer-2',
        leadingBidderName: 'Sneha Roy',
        leadingBidderRoll: '24BCS118',
        sellerId: 'seed-seller-2',
        sellerName: 'Arjun Mehta',
        sellerRoll: '23BEE089',
        sellerHostel: 'Block B (Vishweshwarya Hall)',
        sellerRoom: '310',
        closingTime: hoursFromNow(2),
        status: 'ACTIVE',
        totalBids: 2,
        bids: [
          {
            bidderId: 'seed-buyer-3',
            bidderName: 'Vikram Joshi',
            bidderRoll: '24AID050',
            amount: 450,
            timestamp: new Date(now - 7200000),
          },
          {
            bidderId: 'seed-buyer-2',
            bidderName: 'Sneha Roy',
            bidderRoll: '24BCS118',
            amount: 550,
            timestamp: new Date(now - 3600000),
          },
        ],
      },
      {
        title: 'Higher Engineering Mathematics - B.S. Grewal (44th Edition)',
        category: 'books',
        description: 'The definitive textbook for 1st & 2nd year engineering. Hardbound copy, formulas highlighted in pencil (can be erased). Clean binding with no missing pages.',
        condition: 'Functional',
        photos: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'],
        startingPrice: 200,
        minIncrement: 25,
        currentBid: 250,
        leadingBidderId: 'seed-buyer-1',
        leadingBidderName: 'Rahul Verma',
        leadingBidderRoll: '24BME042',
        sellerId: 'seed-seller-1',
        sellerName: 'Priya Sharma',
        sellerRoll: '23BCS015',
        sellerHostel: 'Block D (Kalpana Chawla Hall)',
        sellerRoom: '401',
        closingTime: hoursFromNow(5),
        status: 'ACTIVE',
        totalBids: 1,
        bids: [
          {
            bidderId: 'seed-buyer-1',
            bidderName: 'Rahul Verma',
            bidderRoll: '24BME042',
            amount: 250,
            timestamp: new Date(now - 1800000),
          },
        ],
      },
      {
        title: 'Dell 24" IPS FHD Monitor (75Hz, HDMI + VGA, Eye Comfort)',
        category: 'electronics',
        description: 'Ideal for coding, dual-screen setups, or gaming. Crisp IPS colors, no dead pixels. Comes with HDMI cable and power brick. Can be picked up from Block D room 412.',
        condition: 'Like New',
        photos: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80'],
        startingPrice: 3200,
        minIncrement: 200,
        currentBid: 3200,
        sellerId: 'seed-seller-3',
        sellerName: 'Nagumeena Udayappan',
        sellerRoll: '23AID001',
        sellerHostel: 'Block D (Kalpana Chawla Hall)',
        sellerRoom: '412',
        closingTime: hoursFromNow(18),
        status: 'ACTIVE',
        totalBids: 0,
        bids: [],
      },
    ];

    const created = await Listing.insertMany(initialData);
    res.status(201).json({
      message: 'Initial campus items seeded successfully into MongoDB Atlas!',
      count: created.length,
      listings: created.map((l) => l.toJSON()),
    });
  } catch (error: any) {
    console.error('Seed Listings Error:', error);
    res.status(500).json({ message: error.message || 'Failed to seed listings' });
  }
};
