import mongoose, { Schema, Document } from 'mongoose';

export interface IBidConfirmation extends Document {
  nonce: string;
  userId: string;
  listingId: string;
  amount: number;
  maxBudget?: number;
  currentBid: number;
  minIncrement: number;
  closingTime: Date;
  expiresAt: Date;
  consumed: boolean;
  createdAt: Date;
}

const BidConfirmationSchema: Schema = new Schema(
  {
    nonce: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    listingId: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    maxBudget: { type: Number, min: 1 },
    currentBid: { type: Number, required: true },
    minIncrement: { type: Number, required: true },
    closingTime: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumed: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BidConfirmationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BidConfirmation = mongoose.model<IBidConfirmation>('BidConfirmation', BidConfirmationSchema);
