import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../TW-Scheduler-backend/.env' });

const ScheduledPostSchema = new mongoose.Schema({
  mediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
  platformSpecifics: mongoose.Schema.Types.Mixed,
  status: String,
  caption: String,
  scheduledAt: Date
});

const ScheduledPost = mongoose.model('ScheduledPost', ScheduledPostSchema);

async function run() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to Mongo:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const posts = await ScheduledPost.find().sort({ createdAt: -1 }).limit(5);
  console.log(`Found ${posts.length} posts:`);
  for (const post of posts) {
    console.log('--------------------------------------------------');
    console.log('Post ID:', post._id);
    console.log('Status:', post.status);
    console.log('Caption:', post.caption);
    console.log('Scheduled At:', post.scheduledAt);
    console.log('Media IDs count:', post.mediaIds.length);
    console.log('Media IDs:', post.mediaIds);
    console.log('Platform Specifics:', JSON.stringify(post.platformSpecifics, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
