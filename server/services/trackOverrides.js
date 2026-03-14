function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeOverrideArtists(value) {
  const artists = Array.isArray(value) ? value : String(value ?? '').split(',');
  return artists
    .flatMap((artist) => String(artist).split(';'))
    .map((artist) => normalizeText(artist))
    .filter(Boolean);
}

export function buildTrackOverrides(payload = {}) {
  const overrides = {};

  if (Object.hasOwn(payload, 'title')) {
    const title = normalizeText(payload.title);
    if (!title) throw new Error('Title is required.');
    overrides.title = title;
  }

  if (Object.hasOwn(payload, 'artists')) {
    const artists = normalizeOverrideArtists(payload.artists);
    if (!artists.length) throw new Error('At least one artist is required.');
    overrides.artists = artists;
    overrides.artistsNorm = artists.map((artist) => artist.toLowerCase());
  }

  if (Object.hasOwn(payload, 'album')) {
    const album = normalizeText(payload.album);
    if (!album) throw new Error('Album is required.');
    overrides.album = album;
  }

  if (Object.hasOwn(payload, 'albumArtist')) {
    overrides.albumArtist = normalizeText(payload.albumArtist);
  }

  if (Object.hasOwn(payload, 'trackNumber')) {
    const trackNumber = Number(payload.trackNumber);
    if (!Number.isInteger(trackNumber) || trackNumber < 0) {
      throw new Error('Track number must be a whole number.');
    }
    overrides.trackNumber = trackNumber;
  }

  if (Object.hasOwn(payload, 'year')) {
    const year = Number(payload.year);
    if (!Number.isInteger(year) || year < 0) {
      throw new Error('Year must be a whole number.');
    }
    overrides.year = year;
  }

  return overrides;
}

export function mergeTrackOverrides(track) {
  if (!track) return track;

  const overrides = track.overrides ?? {};
  const overrideFields = [
    'title',
    'artists',
    'artistsNorm',
    'albumArtist',
    'album',
    'trackNumber',
    'year',
    'cover',
  ].filter((field) => overrides[field] !== undefined && overrides[field] !== null);

  if (!overrideFields.length) {
    return {
      ...track,
      hasOverrides: false,
      overrideFields: [],
    };
  }

  return {
    ...track,
    title: overrides.title ?? track.title,
    artists: overrides.artists ?? track.artists,
    artistsNorm: overrides.artistsNorm ?? track.artistsNorm,
    albumArtist: overrides.albumArtist ?? track.albumArtist,
    album: overrides.album ?? track.album,
    trackNumber: overrides.trackNumber ?? track.trackNumber,
    year: overrides.year ?? track.year,
    cover: overrides.cover ?? track.cover,
    hasOverrides: true,
    overrideFields,
  };
}
