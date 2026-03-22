import { basename, extname } from 'path';

export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.ogg', '.m4a', '.aac',
  '.wav', '.aiff', '.wma', '.opus',
]);

export const COVER_FILENAMES = [
  'cover', 'folder', 'front', 'album', 'art', 'artwork', 'thumb', 'thumbnail',
];

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif'];
export const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);

export function isAudioFile(filePath) {
  const name = basename(filePath);
  if (name.startsWith('._')) return false;
  return AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function isImageFile(filePath) {
  const name = basename(filePath);
  if (name.startsWith('.')) return false;
  return IMAGE_EXTENSION_SET.has(extname(filePath).toLowerCase());
}

export function pickFolderCover(entries) {
  const lookup = new Map(entries.map((entry) => [entry.toLowerCase(), entry]));

  for (const name of COVER_FILENAMES) {
    for (const ext of IMAGE_EXTENSIONS) {
      const match = lookup.get(`${name}${ext}`);
      if (match) return match;
    }
  }

  for (const entry of entries) {
    if (IMAGE_EXTENSIONS.includes(extname(entry).toLowerCase())) {
      return entry;
    }
  }

  return null;
}

export function normalizeArtists(common = {}) {
  const rawArtists = common.artists?.length
    ? common.artists
    : common.artist
      ? [common.artist]
      : ['Unknown Artist'];

  const artists = rawArtists
    .flatMap((artist) => artist.split(';').map((part) => part.trim()))
    .filter(Boolean);

  return artists.length ? artists : ['Unknown Artist'];
}

export function normalizeReleaseType(value) {
  const rawValues = Array.isArray(value) ? value : [value];
  const tokens = rawValues
    .flatMap((entry) => String(entry ?? '').split(/[;,/]/))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!tokens.length) return '';

  const normalized = tokens.map((token) => token.toLowerCase());
  if (normalized.some((token) => token === 'ep' || token === 'e.p.')) return 'EP';
  if (normalized.some((token) => token === 'single')) return 'Single';
  if (normalized.some((token) => token === 'album' || token === 'lp')) return 'Album';

  const first = tokens[0].replace(/\s+/g, ' ').trim();
  if (!first) return '';
  if (first.toLowerCase() === 'ep' || first.toLowerCase() === 'e.p.') return 'EP';

  return first
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '')
    .join(' ');
}

export function buildTrackData({ filePath, metadata, fileStat, cover, hasEmbeddedCover }) {
  const { common, format } = metadata;
  const artists = normalizeArtists(common);
  const releaseType = normalizeReleaseType(
    common.releaseType
    ?? common.releasetype
    ?? common.releasegroup?.type
    ?? common.releasegroup?.primaryType,
  );

  return {
    path: filePath,
    title: common.title || basename(filePath, extname(filePath)),
    artists,
    artistsNorm: artists.map((artist) => artist.toLowerCase()),
    albumArtist: common.albumartist || artists[0] || '',
    album: common.album || 'Unknown Album',
    releaseType,
    trackNumber: common.track?.no || 0,
    disc: common.disk?.no || 1,
    duration: format.duration || 0,
    format: extname(filePath).slice(1).toLowerCase(),
    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : 0,
    genre: common.genre?.[0] || '',
    year: common.year || 0,
    cover,
    hasEmbeddedCover,
    fileSize: fileStat.size,
    fileMtime: fileStat.mtimeMs,
    scannedAt: new Date(),
  };
}
