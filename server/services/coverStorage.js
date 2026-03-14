import { createHash } from 'crypto';
import { mkdir, readdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import Track from '../models/Track.js';
import config from '../config.js';

const MIME_TO_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/avif': '.avif',
};

export function extForImageMime(mimeType) {
  return MIME_TO_EXT[mimeType] ?? null;
}

export async function saveCoverFile(data, ext) {
  const hash = createHash('md5').update(data).digest('hex');
  const filename = `${hash}${ext}`;
  const coverPath = join(config.coversDir, filename);

  await mkdir(config.coversDir, { recursive: true });
  await writeFile(coverPath, data);

  return filename;
}

export function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl ?? '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data.');

  const [, mimeType, encoded] = match;
  const ext = extForImageMime(mimeType);
  if (!ext) throw new Error('Unsupported image type.');

  return {
    ext,
    buffer: Buffer.from(encoded, 'base64'),
  };
}

export async function saveCoverDataUrl(dataUrl) {
  const { buffer, ext } = parseImageDataUrl(dataUrl);
  return saveCoverFile(buffer, ext);
}

export async function listReferencedCovers() {
  const [scannedCovers, overrideCovers] = await Promise.all([
    Track.distinct('cover'),
    Track.distinct('overrides.cover'),
  ]);

  return new Set([...scannedCovers, ...overrideCovers].filter(Boolean));
}

export async function isCoverReferenced(filename) {
  if (!filename) return false;

  const [scannedRef, overrideRef] = await Promise.all([
    Track.exists({ cover: filename }),
    Track.exists({ 'overrides.cover': filename }),
  ]);

  return !!(scannedRef || overrideRef);
}

export async function removeCoverIfUnused(filename) {
  if (!filename) return false;
  if (await isCoverReferenced(filename)) return false;

  try {
    await unlink(join(config.coversDir, filename));
    return true;
  } catch {
    return false;
  }
}

export async function cleanupOrphanedCovers(log) {
  const referencedSet = await listReferencedCovers();

  let files;
  try {
    files = await readdir(config.coversDir);
  } catch {
    return { removed: 0, errors: 0 };
  }

  let removed = 0;
  let errors = 0;

  for (const file of files) {
    if (!referencedSet.has(file)) {
      try {
        await unlink(join(config.coversDir, file));
        removed++;
      } catch (err) {
        log?.error?.(`Error removing orphaned cover ${file}:`, err.message);
        errors++;
      }
    }
  }

  return { removed, errors };
}
