import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'buyer' | 'seller';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  rollNumber: string; // Used as primary Username
  department: string;
  hostel: string;
  roomNumber: string;
  role: UserRole;
  avatar: string;
  graduatingYear: number;
  reputationScore: number;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Campus email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    rollNumber: {
      type: String,
      required: [true, 'Student Roll / ID number is required (used as username)'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      required: [true, 'Academic Department is required'],
      trim: true,
    },
    hostel: {
      type: String,
      required: [true, 'Campus Hostel block is required'],
      trim: true,
    },
    roomNumber: {
      type: String,
      default: '101',
      trim: true,
    },
    role: {
      type: String,
      enum: ['buyer', 'seller'],
      required: [true, 'Role (buyer or seller) is required'],
      default: 'buyer',
    },
    avatar: {
      type: String,
      default: '',
    },
    graduatingYear: {
      type: Number,
      default: 2028,
    },
    reputationScore: {
      type: Number,
      default: 100,
    },
    phone: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
