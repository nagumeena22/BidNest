import mongoose, { Schema, Document } from 'mongoose';
import type { ListingCategory } from './Listing.js';

export interface IAlertMatch {
  listingId: string;
  listingTitle: string;
  category: ListingCategory;
  currentBid: number;
  matchedAt: Date;
  seen: boolean;
}

export interface IWantedAlert extends Document {
  userId: string;
  keyword: string;
  category?: ListingCategory;
  maxPrice?: number;
  active: boolean;
  matches: IAlertMatch[];
  createdAt: Date;
  updatedAt: Date;
}

const WantedAlertSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    keyword: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      enum: ['cycle', 'calculator', 'books', 'electronics', 'hostel_essentials', 'sports', 'other'],
    },
    maxPrice: { type: Number, min: 1 },
    active: { type: Boolean, default: true },
    matches: [{
      listingId: { type: String, required: true },
      listingTitle: { type: String, required: true },
      category: { type: String, required: true },
      currentBid: { type: Number, required: true },
      matchedAt: { type: Date, default: Date.now },
      seen: { type: Boolean, default: false },
    }],
  },
  { timestamps: true },
);

WantedAlertSchema.index({ userId: 1, active: 1 });

export const WantedAlert = mongoose.model<IWantedAlert>('WantedAlert', WantedAlertSchema);
