import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import listingRoutes from './routes/listingRoutes.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);

// Health Check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'BidNest Campus Marketplace API',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get('/', (_req, res) => {
  res.send('BidNest Backend API is running. Endpoints: /api/auth and /api/listings');
});

// Start listening immediately
app.listen(PORT, () => {
  console.log(`🚀 BidNest Backend Server listening on http://localhost:${PORT}`);
  console.log(`📍 Auth endpoints active at http://localhost:${PORT}/api/auth`);
  console.log(`📦 Listing endpoints active at http://localhost:${PORT}/api/listings`);
  console.log(`❤️  Health check available at http://localhost:${PORT}/api/health`);
  // Connect to DB asynchronously
  connectDB();
});
