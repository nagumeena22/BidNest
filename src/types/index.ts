export type UserRole = 'buyer' | 'seller';

export interface User {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  hostel: string;
  roomNumber: string;
  role: UserRole;
  avatar: string;
  graduatingYear: number;
  reputationScore: number;
  phone?: string;
  token?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  rollNumber: string;
  department: string;
  hostel: string;
  roomNumber?: string;
  phone?: string;
  graduatingYear?: number;
}

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
  | 'PROVISIONALLY_CLOSED' 
  | 'SOLD' 
  | 'UNSOLD' 
  | 'CANCELLED';

export type HandoverStatus = 
  | 'AWAITING_SELLER_APPROVAL' 
  | 'APPROVED_RESERVED' 
  | 'REJECTED' 
  | 'HANDOVER_COMPLETED' 
  | 'FAILED_PICKUP' 
  | 'CANCELLED_MUTUAL'
  | 'SELLER_CANCELLED';

export interface Bid {
  id: string;
  listingId: string;
  bidderId: string;
  bidderName: string;
  bidderHostel?: string;
  bidderRoll?: string;
  amount: number;
  timestamp: string; // ISO string
  isProxy?: boolean;
}

export interface ProxyBidSetting {
  id: string;
  listingId: string;
  bidderId: string;
  bidderName?: string;
  bidderRoll?: string;
  maxAmount: number;
  createdAt: string;
  active: boolean;
}

export interface QAItem {
  id: string;
  listingId: string;
  question: string;
  askedBy?: string;
  askedByName: string;
  askedAt: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
}

export interface WantedMatch {
  listingId: string;
  listingTitle: string;
  category: ListingCategory;
  currentBid: number;
  matchedAt: string;
  seen: boolean;
}

export interface Listing {
  id: string;
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
  sellerRoll?: string;
  sellerDepartment: string;
  sellerHostel: string;
  sellerRoom?: string;
  closingTime: string; // ISO string
  originalClosingTime: string; // To track anti-sniping extensions
  createdAt: string;
  status: ListingStatus;
  handoverStatus?: HandoverStatus;
  totalBids: number;
  bids: Bid[];
  isExtended?: boolean;
  handoverNotes?: string;
  proxyBids?: { maxAmount: number; active: boolean; createdAt: string }[];
  myProxyBid?: ProxyBidSetting | null;
  questions?: QAItem[];
}

export interface WantedAlert {
  id: string;
  userId: string;
  keyword: string;
  category?: ListingCategory;
  maxPrice?: number;
  createdAt: string;
  active: boolean;
  matches?: WantedMatch[];
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 
    | 'OUTBID' 
    | 'CLOSING_SOON' 
    | 'AUCTION_WON' 
    | 'AUCTION_SOLD' 
    | 'QA_ANSWERED' 
    | 'EXTENSION_ALERT' 
    | 'WANTED_MATCH' 
    | 'HANDOVER_UPDATE';
  title: string;
  message: string;
  listingId?: string;
  timestamp: string;
  read: boolean;
}
