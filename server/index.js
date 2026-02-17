import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import config from './config.js';
import libraryRoutes from './routes/library.js';
import scanRoutes from './routes/scan.js';
import streamRoutes from './routes/stream.js';
import eventsRoutes from './routes/events.js';
import { startWatcher } from './services/watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', libraryRoutes);
app.use('/api', scanRoutes);
app.use('/api', streamRoutes);
app.use('/api', eventsRoutes);

// Serve built client in production
const clientDist = resolve(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

async function start() {
  await connectDB();
  startWatcher();
  app.listen(config.port, () => {
    console.log(`Noisling server running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
