export const VALID_SORT_FIELDS = ['title', 'artist', 'album', 'plays', 'lastPlayed', 'added', 'duration'];

export function buildSort(sortField, sortOrder) {
  const order = sortOrder === 'desc' ? -1 : 1;
  switch (sortField) {
    case 'title':
      return { title: order };
    case 'artist':
      return { artistsNorm: order, album: 1, disc: 1, trackNumber: 1 };
    case 'album':
      return { album: order, disc: 1, trackNumber: 1 };
    case 'plays':
      return { playCount: order };
    case 'lastPlayed':
      return { lastPlayedAt: order };
    case 'added':
      return { scannedAt: order };
    case 'duration':
      return { duration: order };
    default:
      return { artistsNorm: 1, album: 1, disc: 1, trackNumber: 1 };
  }
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchRegex(value) {
  const query = value?.trim();
  if (!query) return null;
  return new RegExp(escapeRegex(query), 'i');
}

export function buildTrackFilter({ search = '', genre = '' } = {}) {
  const filter = {};
  const regex = buildSearchRegex(search);

  if (regex) {
    filter.$or = [
      { title: regex },
      { artists: regex },
      { album: regex },
    ];
  }

  const normalizedGenre = genre?.trim();
  if (normalizedGenre) {
    filter.genre = normalizedGenre;
  }

  return filter;
}
