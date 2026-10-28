import { Listing } from '../models/Listing.js';
import type { IUser } from '../models/User.js';

export class BidServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'BidServiceError';
  }
}

export const isVerifiedBuyer = (user: IUser) =>
  user.role === 'buyer' && user.rollNumber.startsWith('24');

export const closeExpiredAuction = async (listing: InstanceType<typeof Listing>): Promise<boolean> => {
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

export const runProxyBidding = (listing: InstanceType<typeof Listing>) => {
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

export const getMinimumBidFor = (
  startingPrice: number,
  currentBid: number,
  minIncrement: number,
  bidCount: number,
) => bidCount === 0 ? startingPrice : currentBid + minIncrement;

export const getMinimumBid = (listing: InstanceType<typeof Listing>) =>
  getMinimumBidFor(listing.startingPrice, listing.currentBid, listing.minIncrement, listing.bids.length);

export const isWithinBudget = (amount: number, maxBudget?: number) =>
  maxBudget === undefined || amount <= maxBudget;

export const isBidConfirmationCurrent = (
  confirmation: { currentBid: number; minIncrement: number; closingTime: Date },
  listing: { currentBid: number; minIncrement: number; closingTime: Date; status: string },
) => listing.status === 'ACTIVE' &&
  listing.currentBid === confirmation.currentBid &&
  listing.minIncrement === confirmation.minIncrement &&
  listing.closingTime.getTime() === confirmation.closingTime.getTime();

export const placeBidForUser = async (
  user: IUser,
  listingId: string,
  amount: number,
) => {
  if (!isVerifiedBuyer(user)) {
    throw new BidServiceError('Bidding is reserved for verified buyer accounts.', 403);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BidServiceError('Please enter a valid numeric bid amount.', 400);
  }

  const listing = await Listing.findById(listingId);
  if (!listing) throw new BidServiceError('Listing not found.', 404);
  if (listing.status !== 'ACTIVE') {
    throw new BidServiceError(`Auction is ${listing.status.toLowerCase()}. Bids can no longer be placed.`, 409);
  }
  const expectedState = {
    _id: listing._id,
    __v: listing.__v,
    status: listing.status,
    currentBid: listing.currentBid,
    totalBids: listing.totalBids,
    startingPrice: listing.startingPrice,
    minIncrement: listing.minIncrement,
    closingTime: listing.closingTime,
  };

  const now = Date.now();
  const closingMs = new Date(listing.closingTime).getTime();
  if (now >= closingMs) {
    await closeExpiredAuction(listing);
    throw new BidServiceError('This auction has just closed. Bidding has stopped.', 409);
  }

  const userId = user._id.toString();
  if (listing.sellerId === userId) {
    throw new BidServiceError('Sellers cannot bid on their own listings.', 403);
  }
  const ownProxyBid = listing.proxyBids.find((proxyBid) => proxyBid.bidderId === userId && proxyBid.active);
  if (ownProxyBid && amount > ownProxyBid.maxAmount) {
    throw new BidServiceError(
      `Your active automatic-bid limit is ₹${ownProxyBid.maxAmount.toLocaleString()}. Raise or stop that limit before bidding higher.`,
      409,
    );
  }

  const minRequiredBid = getMinimumBid(listing);
  if (amount < minRequiredBid) {
    throw new BidServiceError(
      `Your bid is too low. The minimum valid bid is ₹${minRequiredBid.toLocaleString()}.`,
      409,
    );
  }

  const remainingMs = closingMs - now;
  let wasExtended = remainingMs <= 30000;
  if (wasExtended) {
    listing.closingTime = new Date(now + 60000);
    listing.isExtended = true;
  }

  listing.bids.push({
    bidderId: userId,
    bidderName: user.name,
    bidderRoll: user.rollNumber,
    amount,
    timestamp: new Date(),
  });
  listing.currentBid = amount;
  listing.leadingBidderId = userId;
  listing.leadingBidderName = user.name;
  listing.leadingBidderRoll = user.rollNumber;
  listing.totalBids = listing.bids.length;

  const closingTimeBeforeProxy = listing.closingTime.getTime();
  const automaticBidPlaced = runProxyBidding(listing);
  if (listing.closingTime.getTime() !== closingTimeBeforeProxy) wasExtended = true;
  const updateResult = await Listing.updateOne(expectedState, {
    $set: {
      bids: listing.bids,
      proxyBids: listing.proxyBids,
      currentBid: listing.currentBid,
      leadingBidderId: listing.leadingBidderId,
      leadingBidderName: listing.leadingBidderName,
      leadingBidderRoll: listing.leadingBidderRoll,
      closingTime: listing.closingTime,
      isExtended: Boolean(listing.isExtended),
      totalBids: listing.totalBids,
    },
    $inc: { __v: 1 },
  });
  if (updateResult.matchedCount !== 1) {
    throw new BidServiceError('Auction details changed while the bid was being placed. Refresh and prepare a new bid.', 409);
  }

  return {
    message: automaticBidPlaced
      ? `Your bid was accepted. An authorized automatic bid updated the leading price to ₹${listing.currentBid.toLocaleString()}.`
      : wasExtended
        ? `Bid of ₹${amount.toLocaleString()} accepted. The auction closing time was extended.`
        : `Your bid of ₹${amount.toLocaleString()} has been placed successfully. You are now the leading bidder.`,
    extended: wasExtended,
    newClosingTime: listing.closingTime,
    listing,
  };
};
