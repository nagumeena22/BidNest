import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_SRV_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in server environment variables.');
    return;
  }

  try {
    console.log('Connecting to MongoDB Atlas Cluster (cluster0.rmqonk5.mongodb.net)...');
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Atlas Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database Name: ${conn.connection.name}`);
    console.log(`   State: Ready for Buyer & Seller authentications`);
  } catch (error: any) {
    console.error('❌ MongoDB Connection Error:', error.message);
    // If standard URI failed, try fallback
    const fallback = process.env.MONGODB_SRV_URI;
    if (fallback && fallback !== uri) {
      try {
        console.log('Retrying with SRV connection...');
        const conn = await mongoose.connect(fallback);
        console.log(`✅ Fallback Connected: ${conn.connection.host}`);
      } catch (fbErr: any) {
        console.error('❌ Fallback Connection failed:', fbErr.message);
      }
    }
  }
};
