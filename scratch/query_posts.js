import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '../TW-Scheduler-backend/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  await mongoose.disconnect();
}

run().catch(console.error);
