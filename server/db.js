import mongoose from 'mongoose';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('db', 'blue');

export async function connectDB() {
  await mongoose.connect(config.mongoUri);
  log.success('Connected to MongoDB');
}
