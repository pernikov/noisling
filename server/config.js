import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, '..', '.env') });

export default {
  port: parseInt(process.env.PORT, 10) || 1994,
  databasePath: process.env.DATABASE_PATH || resolve(__dirname, 'data', 'noisling.sqlite'),
  musicDir: process.env.MUSIC_DIR || '',
  coversDir: resolve(__dirname, 'covers'),
};
