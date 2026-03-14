export function buildCoverByTrack(tracks) {
  return Object.fromEntries(
    tracks.map((track) => [String(track._id), track.cover || null]),
  );
}

export function collectPlaylistCovers(trackIds, coverByTrack, maxCovers = 100) {
  const covers = [];
  for (const id of trackIds) {
    const cover = coverByTrack[String(id)];
    if (cover && !covers.includes(cover)) covers.push(cover);
    if (covers.length === maxCovers) break;
  }
  return covers;
}

export function buildPlaylistSummary(playlist, coverByTrack, maxCovers = 100) {
  return {
    _id: playlist._id,
    name: playlist.name,
    trackCount: playlist.trackIds.length,
    covers: collectPlaylistCovers(playlist.trackIds, coverByTrack, maxCovers),
  };
}

export function orderPlaylistTracks(trackIds, tracks) {
  const trackById = Object.fromEntries(
    tracks.map((track) => [String(track._id), track]),
  );
  return trackIds.map((id) => trackById[String(id)]).filter(Boolean);
}
