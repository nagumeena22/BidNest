import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
// Default Avatars by role
const BUYER_AVATARS = [
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
];
const SELLER_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
];
const generateToken = (userId, role, rollNumber) => {
    const secret = process.env.JWT_SECRET;
    return jwt.sign({ userId, role, rollNumber }, secret, { expiresIn: '7d' });
};
// 1. REGISTER (Sign Up) with Roll Prefix Validation
export const register = async (req, res) => {
    try {
        const { name, email, password, rollNumber, // Primary campus username
        department, hostel, roomNumber, phone = '', graduatingYear, } = req.body;
        if (!name || !email || !password || !rollNumber || !department || !hostel) {
            res.status(400).json({
                message: 'Please fill in all required campus fields (Name, Email, Password, Roll Number, Department, Hostel)',
            });
            return;
        }
        const cleanRoll = rollNumber.trim().toUpperCase();
        const role = cleanRoll.startsWith('23')
            ? 'seller'
            : cleanRoll.startsWith('24')
                ? 'buyer'
                : null;
        if (!role) {
            res.status(400).json({
                message: 'Roll numbers must start with 23 for seller accounts or 24 for buyer accounts.',
            });
            return;
        }
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol characters.' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        // Check existing roll number
        const existingRoll = await User.findOne({ rollNumber: cleanRoll });
        if (existingRoll) {
            res.status(409).json({
                message: `Student Roll Number "${cleanRoll}" is already registered. Please sign in with your credentials.`,
            });
            return;
        }
        // Check existing email
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            res.status(409).json({
                message: `An account with email "${normalizedEmail}" is already registered. Please sign in instead.`,
            });
            return;
        }
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const avatarList = role === 'seller' ? SELLER_AVATARS : BUYER_AVATARS;
        const defaultAvatar = avatarList[Math.floor(Math.random() * avatarList.length)];
        const calculatedGradYear = graduatingYear || (role === 'seller' ? 2026 : 2028);
        const newUser = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            rollNumber: cleanRoll,
            department: department.trim(),
            hostel: hostel.trim(),
            roomNumber: roomNumber ? roomNumber.trim() : '101',
            role,
            avatar: defaultAvatar,
            graduatingYear: calculatedGradYear,
            phone: phone.trim(),
            reputationScore: 100,
        });
        await newUser.save();
        const token = generateToken(newUser._id.toString(), newUser.role, newUser.rollNumber);
        res.status(201).json({
            message: `Registration successful! Welcome ${newUser.name} to BidNest as a ${role === 'seller' ? 'Senior Seller (Batch 23)' : 'Junior Buyer (Batch 24)'}.`,
            token,
            user: newUser.toJSON(),
        });
    }
    catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({
            message: error.message || 'Server error during registration. Please try again.',
        });
    }
};
// 2. LOGIN (Sign In) with Roll Number as Username & Prefix Verification
export const login = async (req, res) => {
    try {
        const { rollNumber, username, password } = req.body;
        const identifier = (rollNumber || username || '').trim();
        if (!identifier || !password) {
            res.status(400).json({ message: 'Roll number / username and password are required' });
            return;
        }
        const cleanIdentifier = identifier.toUpperCase();
        const user = await User.findOne({ rollNumber: cleanIdentifier });
        if (!user || !user.password) {
            res.status(401).json({
                message: `Student account with roll number / email "${identifier}" not found. Please verify your credentials or sign up.`,
            });
            return;
        }
        const inferredRole = cleanIdentifier.startsWith('23')
            ? 'seller'
            : cleanIdentifier.startsWith('24')
                ? 'buyer'
                : null;
        if (!inferredRole || user.role !== inferredRole) {
            res.status(403).json({ message: 'Access denied: the roll number does not match a valid account role.' });
            return;
        }
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid password. Please try again.' });
            return;
        }
        const token = generateToken(user._id.toString(), user.role, user.rollNumber);
        res.status(200).json({
            message: `Login successful as ${user.role === 'seller' ? 'Senior Seller' : 'Junior Buyer'}!`,
            token,
            user: user.toJSON(),
        });
    }
    catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            message: error.message || 'Server error during login. Please try again.',
        });
    }
};
// 3. GET CURRENT USER PROFILE
export const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        res.status(200).json({ user: req.user.toJSON() });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Failed to fetch user' });
    }
};
// 4. SEED DEMO USERS IN MONGODB WITH 23 (SELLER) AND 24 (BUYER) PREFIXES
export const seedDemoUsers = async (_req, res) => {
    try {
        const defaultPassword = 'campus123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);
        const demoData = [
            // SELLERS (Batch 23)
            {
                name: 'Priya Sharma',
                email: 'priya.sharma@campus.edu',
                password: hashedPassword,
                rollNumber: '23BCS015',
                department: 'Computer Science & Eng',
                hostel: 'Block D (Kalpana Chawla Hall)',
                roomNumber: '401',
                role: 'seller',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2026,
                reputationScore: 99,
                phone: '+91 98222 33445',
            },
            {
                name: 'Arjun Mehta',
                email: 'arjun.mehta@campus.edu',
                password: hashedPassword,
                rollNumber: '23BEE089',
                department: 'Electrical Engineering',
                hostel: 'Block B (Vishweshwarya Hall)',
                roomNumber: '310',
                role: 'seller',
                avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2026,
                reputationScore: 96,
                phone: '+91 98333 44556',
            },
            {
                name: 'Nagumeena Udayappan',
                email: 'nagumeena.u@campus.edu',
                password: hashedPassword,
                rollNumber: '23AID001',
                department: 'AI & Data Science',
                hostel: 'Block D (Kalpana Chawla Hall)',
                roomNumber: '412',
                role: 'seller',
                avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2026,
                reputationScore: 100,
                phone: '+91 94444 55566',
            },
            // BUYERS (Batch 24)
            {
                name: 'Rahul Verma',
                email: 'rahul.verma@campus.edu',
                password: hashedPassword,
                rollNumber: '24BME042',
                department: 'Mechanical Engineering',
                hostel: 'Block C (Aryabhatta)',
                roomNumber: '204',
                role: 'buyer',
                avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2028,
                reputationScore: 98,
                phone: '+91 98765 43210',
            },
            {
                name: 'Sneha Roy',
                email: 'sneha.roy@campus.edu',
                password: hashedPassword,
                rollNumber: '24BCS118',
                department: 'Computer Science',
                hostel: 'Block A (Gargi Hall)',
                roomNumber: '102',
                role: 'buyer',
                avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2029,
                reputationScore: 100,
                phone: '+91 98111 22334',
            },
            {
                name: 'Vikram Joshi',
                email: 'vikram.joshi@campus.edu',
                password: hashedPassword,
                rollNumber: '24AID050',
                department: 'AI & Data Science',
                hostel: 'Block C (Aryabhatta)',
                roomNumber: '215',
                role: 'buyer',
                avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
                graduatingYear: 2028,
                reputationScore: 100,
                phone: '+91 97777 11223',
            },
        ];
        const results = [];
        for (const demo of demoData) {
            await User.deleteMany({ email: demo.email });
            await User.deleteMany({ rollNumber: demo.rollNumber });
            const created = await User.create(demo);
            results.push({ rollNumber: created.rollNumber, role: created.role, status: 'synced' });
        }
        res.status(200).json({
            message: 'Demo users with 23 (Seller) and 24 (Buyer) prefixes synced successfully in MongoDB!',
            results,
        });
    }
    catch (error) {
        console.error('Seed Error:', error);
        res.status(500).json({ message: error.message || 'Failed to seed demo users' });
    }
};
//# sourceMappingURL=authController.js.map