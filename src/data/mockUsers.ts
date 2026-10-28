import type { User } from '../types';

export const DEMO_USERS: User[] = [
  {
    id: 'user-buyer-1',
    name: 'Rahul Verma',
    email: 'rahul.verma@campus.edu',
    rollNumber: '24BME042',
    department: 'Mechanical Engineering',
    hostel: 'Block C (Aryabhatta)',
    roomNumber: '204',
    role: 'buyer',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    graduatingYear: 2028,
    reputationScore: 98,
    phone: '+91 98765 43210'
  },
  {
    id: 'user-buyer-2',
    name: 'Sneha Roy',
    email: 'sneha.roy@campus.edu',
    rollNumber: '24BCS118',
    department: 'Computer Science',
    hostel: 'Block A (Gargi Hall)',
    roomNumber: '102',
    role: 'buyer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    graduatingYear: 2029,
    reputationScore: 100,
    phone: '+91 98111 22334'
  },
  {
    id: 'user-seller-1',
    name: 'Priya Sharma',
    email: 'priya.sharma@campus.edu',
    rollNumber: '23BCS015',
    department: 'Computer Science & Eng',
    hostel: 'Block D (Kalpana Chawla Hall)',
    roomNumber: '401',
    role: 'seller',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    graduatingYear: 2026,
    reputationScore: 99,
    phone: '+91 98222 33445'
  },
  {
    id: 'user-seller-2',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@campus.edu',
    rollNumber: '23BEE089',
    department: 'Electrical Engineering',
    hostel: 'Block B (Vishweshwarya Hall)',
    roomNumber: '310',
    role: 'seller',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    graduatingYear: 2026,
    reputationScore: 96,
    phone: '+91 98333 44556'
  }
];
