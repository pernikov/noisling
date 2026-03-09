const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function useApi() {
  return {
    getArtists: (page = 1, limit = 60, search = '') => {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      return request(`/artists?${params}`);
    },
    getRandomArtists: (limit = 12) => request(`/artists/random?limit=${limit}`),
    getArtist: (name, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page, limit });
      return request(`/artists/${encodeURIComponent(name)}?${params}`);
    },
    getArtistTracks: (name) => request(`/artists/${encodeURIComponent(name)}/tracks`),
    getRecentAlbums: (limit = 12) => request(`/albums/recent?limit=${limit}`),
    getAlbums: () => request('/albums'),
    getAlbum: (artist, album) =>
      request(`/albums/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`),
    getTracks: (page = 1, limit = 50, search = '', sort = '', order = 'asc') => {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (sort)   params.set('sort', sort);
      if (order !== 'asc') params.set('order', order);
      return request(`/tracks?${params}`);
    },
    getAllTracks: (search = '', sort = '', order = 'asc') => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sort)   params.set('sort', sort);
      if (order !== 'asc') params.set('order', order);
      const qs = params.toString();
      return request(`/tracks/all${qs ? `?${qs}` : ''}`);
    },
    getGenres: () => request('/genres'),
    getTracksByGenre: (genre) => request(`/tracks/all?${new URLSearchParams({ genre })}`),
    getRecentTracks: (limit = 20) => request(`/tracks/recent?limit=${limit}`),
    getLovedTracks: () => request('/tracks/loved'),
    toggleLove: (id) => request(`/tracks/${id}/love`, { method: 'PATCH' }),
    getTrack: (id) => request(`/tracks/${id}`),
    scanLibrary: () => request('/scan', { method: 'POST' }),
    deleteLibrary: () => request('/library', { method: 'DELETE' }),
    globalSearch: (q, limit = 5) => {
      const params = new URLSearchParams({ q, limit });
      return request(`/search?${params}`);
    },
    getStats: () => request('/stats'),
    getSettings: () => request('/settings'),
    saveSettings: (body) => request('/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getTopTracks: (limit = 50) =>
      request(`/tracks?sort=plays&order=desc&limit=${limit}&page=1`).then(d => d.tracks),
    shuffleQueue: () => request('/queue/shuffle', { method: 'PUT' }),
    getTracksByIds: (ids) => request('/tracks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
    reportPlay: (id) => request(`/tracks/${id}/play`, { method: 'POST' }),
    getPlaylists: () => request('/playlists'),
    getPlaylist: (id) => request(`/playlists/${id}`),
    createPlaylist: (body) => request('/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    updatePlaylist: (id, body) => request(`/playlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    deletePlaylist: (id) => request(`/playlists/${id}`, { method: 'DELETE' }),
    addToPlaylist: (id, trackIds) => request(`/playlists/${id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds }),
    }),
    removeFromPlaylist: (id, trackId) => request(`/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),
    streamUrl: (id, transcode = false) => `${BASE}/stream/${id}${transcode ? '?transcode=1' : ''}`,
    transcodedStreamUrl: (id) => `${BASE}/stream/${id}/transcoded`,
    warmTranscode: (id) => fetch(`${BASE}/stream/${id}/warm`).then(r => r.json()).catch(() => ({})),
    coverUrl: (filename) => filename ? `${BASE}/covers/${filename}` : '/placeholder.svg',
  };
}
