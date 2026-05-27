function normalizeText(value) {
  return String(value ?? '').trim();
}

export function getExplicitAlbumArtist(track = {}) {
  return normalizeText(track.albumArtist);
}

export function getAlbumArtist(track = {}) {
  const albumArtist = getExplicitAlbumArtist(track);
  if (albumArtist) return albumArtist;
  return normalizeText(track.artists?.[0]);
}

export function getAlbumArtistNorm(track = {}) {
  const albumArtist = getAlbumArtist(track);
  if (albumArtist) return albumArtist.toLowerCase();
  return normalizeText(track.artistsNorm?.[0]).toLowerCase();
}

export function getAlbumSummaryArtists(track = {}) {
  const albumArtist = getExplicitAlbumArtist(track);
  if (albumArtist) return [albumArtist];
  return Array.isArray(track.artists) ? track.artists : [];
}

export function getAlbumSummaryArtistsNorm(track = {}) {
  const albumArtist = getExplicitAlbumArtist(track);
  if (albumArtist) return [albumArtist.toLowerCase()];
  return Array.isArray(track.artistsNorm) ? track.artistsNorm : [];
}

export function buildAlbumSummaryKey(track = {}) {
  return `${getAlbumArtistNorm(track)}__${track.album ?? ''}`;
}

export function buildAlbumArtistFields() {
  return {
    effectiveAlbumArtistName: {
      $trim: { input: { $ifNull: ['$effectiveAlbumArtist', ''] } },
    },
    effectiveAlbumArtistNorm: {
      $let: {
        vars: {
          albumArtistName: { $trim: { input: { $ifNull: ['$effectiveAlbumArtist', ''] } } },
        },
        in: {
          $cond: [
            { $ne: ['$$albumArtistName', ''] },
            { $toLower: '$$albumArtistName' },
            { $arrayElemAt: ['$effectiveArtistsNorm', 0] },
          ],
        },
      },
    },
  };
}

export function buildReleaseArtistFields() {
  return {
    effectiveReleaseArtists: {
      $cond: [
        { $ne: ['$effectiveAlbumArtistName', ''] },
        ['$effectiveAlbumArtistName'],
        '$effectiveArtists',
      ],
    },
    effectiveReleaseArtistsNorm: {
      $cond: [
        { $ne: ['$effectiveAlbumArtistName', ''] },
        ['$effectiveAlbumArtistNorm'],
        '$effectiveArtistsNorm',
      ],
    },
  };
}

export function buildAlbumSummaries(tracks) {
  const albumMap = new Map();

  for (const track of tracks) {
    const key = buildAlbumSummaryKey(track);

    if (!albumMap.has(key)) {
      albumMap.set(key, {
        name: track.album,
        artists: getAlbumSummaryArtists(track),
        artistsNorm: getAlbumSummaryArtistsNorm(track),
        albumArtist: getExplicitAlbumArtist(track),
        albumArtistNorm: getAlbumArtistNorm(track),
        releaseType: track.releaseType || '',
        year: track.year,
        trackCount: 0,
        cover: track.cover,
        hasCustomCover: false,
        duration: 0,
        addedAt: track.scannedAt,
      });
    }

    const summary = albumMap.get(key);
    summary.trackCount += 1;
    summary.duration += track.duration || 0;
    if (!summary.cover && track.cover) summary.cover = track.cover;
    if (!summary.releaseType && track.releaseType) summary.releaseType = track.releaseType;
    if (!summary.year && track.year) summary.year = track.year;
    if (track.overrides?.cover) summary.hasCustomCover = true;
    if (!summary.addedAt || new Date(track.scannedAt) > new Date(summary.addedAt)) {
      summary.addedAt = track.scannedAt;
    }
  }

  return Array.from(albumMap.values());
}
