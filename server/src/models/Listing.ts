import mongoose, { Schema, Document, Types } from 'mongoose';

export type ListingCategory = 
  | 'cycle' 
  | 'calculator' 
  | 'books' 
  | 'electronics' 
  | 'hostel_essentials' 
  | 'sports' 
  | 'other';

export type ListingCondition = 
  | 'Like New' 
  | 'Gently Used' 
  | 'Functional' 
  | 'Heavily Used';

export type ListingStatus = 
  | 'ACTIVE' 
  | 'CANCELLED' 
  | 'PROVISIONALLY_CLOSED' 
  | 'SOLD' 
  | 'UNSOLD';

export interface IBid {
  bidderId: string;
  bidderName: string;
  bidderRoll: string;
  amount: number;
  timestamp: Date;
}

export interface IProxyBid {
  bidderId: string;
  bidderName: string;
  bidderRoll: string;
  maxAmount: number;
  active: boolean;
  createdAt: Date;
}

export interface IListingQuestion {
  _id?: Types.ObjectId;
  askedBy: string;
  askedByName: string;
  question: string;
  askedAt: Date;
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
}

export interface IListing extends Document {
  title: string;
  category: ListingCategory;
  description: string;
  condition: ListingCondition;
  photos: string[];
  startingPrice: number;
  minIncrement: number;
  currentBid: number;
  leadingBidderId?: string;
  leadingBidderName?: string;
  leadingBidderRoll?: string;
  sellerId: string;
  sellerName: string;
  sellerRoll: string;
  sellerHostel: string;
  sellerRoom?: string;
  closingTime: Date;
  status: ListingStatus;
  handoverStatus?: 'AWAITING_SELLER_APPROVAL' | 'APPROVED_RESERVED' | 'REJECTED' | 'HANDOVER_COMPLETED' | 'FAILED_PICKUP' | 'CANCELLED_MUTUAL' | 'SELLER_CANCELLED';
  handoverNotes?: string;
  bids: IBid[];
  proxyBids: IProxyBid[];
  questions: IListingQuestion[];
  totalBids: number;
  isExtended?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BidSchema: Schema = new Schema({
  bidderId: { type: String, required: true },
  bidderName: { type: String, required: true },
  bidderRoll: { type: String, required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ProxyBidSchema: Schema = new Schema({
  bidderId: { type: String, required: true },
  bidderName: { type: String, required: true },
  bidderRoll: { type: String, required: true },
  maxAmount: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ListingQuestionSchema: Schema = new Schema({
  askedBy: { type: String, required: true },
  askedByName: { type: String, required: true },
  question: { type: String, required: true, trim: true, maxlength: 500 },
  askedAt: { type: Date, default: Date.now },
  answer: { type: String, trim: true, maxlength: 1000 },
  answeredBy: { type: String },
  answeredAt: { type: Date },
});

const ListingSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['cycle', 'calculator', 'books', 'electronics', 'hostel_essentials', 'sports', 'other'],
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
    },
    condition: {
      type: String,
      enum: ['Like New', 'Gently Used', 'Functional', 'Heavily Used'],
      required: [true, 'Condition is required'],
      default: 'Gently Used',
    },
    photos: {
      type: [String],
      default: [],
    },
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [1, 'Starting price must be at least ₹1'],
    },
    minIncrement: {
      type: Number,
      required: [true, 'Minimum bid increment is required'],
      min: [1, 'Minimum increment must be at least ₹1'],
      default: 50,
    },
    currentBid: {
      type: Number,
      required: true,
    },
    leadingBidderId: {
      type: String,
    },
    leadingBidderName: {
      type: String,
    },
    leadingBidderRoll: {
      type: String,
    },
    sellerId: {
      type: String,
      required: true,
    },
    sellerName: {
      type: String,
      required: true,
    },
    sellerRoll: {
      type: String,
      required: true,
    },
    sellerHostel: {
      type: String,
      default: 'Campus Hostel',
    },
    sellerRoom: {
      type: String,
      default: '',
    },
    closingTime: {
      type: Date,
      required: [true, 'Closing date and time is required'],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CANCELLED', 'PROVISIONALLY_CLOSED', 'SOLD', 'UNSOLD'],
      default: 'ACTIVE',
    },
    handoverStatus: {
      type: String,
      enum: ['AWAITING_SELLER_APPROVAL', 'APPROVED_RESERVED', 'REJECTED', 'HANDOVER_COMPLETED', 'FAILED_PICKUP', 'CANCELLED_MUTUAL', 'SELLER_CANCELLED'],
    },
    handoverNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    bids: {
      type: [BidSchema],
      default: [],
    },
    proxyBids: {
      type: [ProxyBidSchema],
      default: [],
    },
    questions: {
      type: [ListingQuestionSchema],
      default: [],
    },
    totalBids: {
      type: Number,
      default: 0,
    },
    isExtended: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        if (Array.isArray(ret.questions)) {
          ret.questions = ret.questions.map(({ _id, askedBy: _askedBy, askedByName, answeredBy: _answeredBy, ...question }: Record<string, any>) => ({
            ...question,
            askedByName: typeof askedByName === 'string' ? askedByName.split(/\s+/)[0] : 'Student',
            id: _id?.toString(),
          }));
        }
        if (Array.isArray(ret.proxyBids)) {
          ret.proxyBids = ret.proxyBids.map(({ bidderId: _bidderId, bidderName: _bidderName, bidderRoll: _bidderRoll, ...proxyBid }: Record<string, any>) => proxyBid);
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for fast searching and filtering
ListingSchema.index({ title: 'text', description: 'text' });
ListingSchema.index({ category: 1, condition: 1, currentBid: 1, closingTime: 1 });
ListingSchema.index({ sellerId: 1, status: 1 });

export const Listing = mongoose.model<IListing>('Listing', ListingSchema);
