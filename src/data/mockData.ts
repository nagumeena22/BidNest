import type { Listing } from '../types';

// Dynamic future timestamps
const now = Date.now();
const minutesFromNow = (mins: number) => new Date(now + mins * 60 * 1000).toISOString();
const hoursFromNow = (hrs: number) => new Date(now + hrs * 3600 * 1000).toISOString();

export const SEED_LISTINGS: Listing[] = [
  {
    id: 'item-cycle-1',
    title: 'Hercules Roadeo Hardliner (21-Speed Geared Mountain Cycle)',
    category: 'cycle',
    description: 'Used for 2 semesters to commute between Hostel Block D and Mech Dept. Front disc brake working well, rear brake wire newly replaced. Includes heavy duty number lock and mudguards.',
    condition: 'Gently Used',
    photos: [
      'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80'
    ],
    startingPrice: 1500,
    minIncrement: 100,
    currentBid: 1900,
    leadingBidderId: 'user-buyer-1',
    leadingBidderName: 'Rahul Verma',
    sellerId: 'user-seller-1',
    sellerName: 'Priya Sharma',
    sellerDepartment: 'Computer Science (Senior)',
    sellerHostel: 'Block D (Kalpana Chawla)',
    closingTime: minutesFromNow(18), // Closes in 18 minutes (Closing soon!)
    originalClosingTime: minutesFromNow(18),
    createdAt: new Date(now - 86400000).toISOString(),
    status: 'ACTIVE',
    totalBids: 5,
    isExtended: false,
    bids: [
      {
        id: 'bid-1',
        listingId: 'item-cycle-1',
        bidderId: 'user-buyer-2',
        bidderName: 'Sneha Roy',
        bidderHostel: 'Block A',
        amount: 1500,
        timestamp: new Date(now - 7200000).toISOString()
      },
      {
        id: 'bid-2',
        listingId: 'item-cycle-1',
        bidderId: 'user-buyer-1',
        bidderName: 'Rahul Verma',
        bidderHostel: 'Block C',
        amount: 1600,
        timestamp: new Date(now - 5400000).toISOString()
      },
      {
        id: 'bid-3',
        listingId: 'item-cycle-1',
        bidderId: 'user-buyer-3',
        bidderName: 'Vikram Joshi',
        bidderHostel: 'Block B',
        amount: 1700,
        timestamp: new Date(now - 3600000).toISOString()
      },
      {
        id: 'bid-4',
        listingId: 'item-cycle-1',
        bidderId: 'user-buyer-2',
        bidderName: 'Sneha Roy',
        bidderHostel: 'Block A',
        amount: 1800,
        timestamp: new Date(now - 1800000).toISOString()
      },
      {
        id: 'bid-5',
        listingId: 'item-cycle-1',
        bidderId: 'user-buyer-1',
        bidderName: 'Rahul Verma',
        bidderHostel: 'Block C',
        amount: 1900,
        timestamp: new Date(now - 600000).toISOString()
      }
    ]
  },
  {
    id: 'item-calc-2',
    title: 'Casio fx-991EX ClassWiz Scientific Calculator (552 Functions)',
    category: 'calculator',
    description: 'Essential for Engineering Maths, Circuit Analysis, and Thermodynamics. High-res natural textbook display, solar + battery. No faded keys, original hard slide cover included.',
    condition: 'Like New',
    photos: [
      'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=600&auto=format&fit=crop&q=80'
    ],
    startingPrice: 400,
    minIncrement: 50,
    currentBid: 650,
    leadingBidderId: 'user-buyer-2',
    leadingBidderName: 'Sneha Roy',
    sellerId: 'user-seller-2',
    sellerName: 'Arjun Mehta',
    sellerDepartment: 'Electrical Eng (Senior)',
    sellerHostel: 'Block B (Vishweshwarya)',
    closingTime: hoursFromNow(2.5),
    originalClosingTime: hoursFromNow(2.5),
    createdAt: new Date(now - 43200000).toISOString(),
    status: 'ACTIVE',
    totalBids: 4,
    bids: [
      {
        id: 'bid-c1',
        listingId: 'item-calc-2',
        bidderId: 'user-buyer-1',
        bidderName: 'Rahul Verma',
        bidderHostel: 'Block C',
        amount: 400,
        timestamp: new Date(now - 14400000).toISOString()
      },
      {
        id: 'bid-c2',
        listingId: 'item-calc-2',
        bidderId: 'user-buyer-2',
        bidderName: 'Sneha Roy',
        bidderHostel: 'Block A',
        amount: 650,
        timestamp: new Date(now - 7200000).toISOString(),
        isProxy: true
      }
    ]
  },
  {
    id: 'item-book-3',
    title: 'Higher Engineering Mathematics - B.S. Grewal (44th Edition)',
    category: 'books',
    description: 'The definitive textbook for 1st & 2nd year engineering. Hardbound copy, formulas highlighted in pencil (can be erased). Clean binding with no missing pages.',
    condition: 'Functional',
    photos: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'
    ],
    startingPrice: 200,
    minIncrement: 25,
    currentBid: 275,
    leadingBidderId: 'user-buyer-1',
    leadingBidderName: 'Rahul Verma',
    sellerId: 'user-seller-1',
    sellerName: 'Priya Sharma',
    sellerDepartment: 'Computer Science (Senior)',
    sellerHostel: 'Block D (Kalpana Chawla)',
    closingTime: hoursFromNow(5),
    originalClosingTime: hoursFromNow(5),
    createdAt: new Date(now - 50000000).toISOString(),
    status: 'ACTIVE',
    totalBids: 3,
    bids: [
      {
        id: 'bid-b1',
        listingId: 'item-book-3',
        bidderId: 'user-buyer-3',
        bidderName: 'Karan Singh',
        bidderHostel: 'Block C',
        amount: 200,
        timestamp: new Date(now - 18000000).toISOString()
      },
      {
        id: 'bid-b2',
        listingId: 'item-book-3',
        bidderId: 'user-buyer-1',
        bidderName: 'Rahul Verma',
        bidderHostel: 'Block C',
        amount: 275,
        timestamp: new Date(now - 9000000).toISOString()
      }
    ]
  },
  {
    id: 'item-monitor-4',
    title: 'Dell 24" IPS FHD Monitor (75Hz, HDMI + VGA, Eye Comfort)',
    category: 'electronics',
    description: 'Ideal for coding, dual-screen setups, or gaming. Crisp IPS colors, no dead pixels. Comes with HDMI cable and power brick. Can be picked up from Block D room 401.',
    condition: 'Like New',
    photos: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80'
    ],
    startingPrice: 3200,
    minIncrement: 200,
    currentBid: 3800,
    leadingBidderId: 'user-buyer-4',
    leadingBidderName: 'Devansh Roy',
    sellerId: 'user-seller-1',
    sellerName: 'Priya Sharma',
    sellerDepartment: 'Computer Science (Senior)',
    sellerHostel: 'Block D (Kalpana Chawla)',
    closingTime: hoursFromNow(12),
    originalClosingTime: hoursFromNow(12),
    createdAt: new Date(now - 70000000).toISOString(),
    status: 'ACTIVE',
    totalBids: 4,
    bids: []
  }
];
