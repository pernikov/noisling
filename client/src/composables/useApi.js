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
    getArtist: (name) => request(`/artists/${encodeURIComponent(name)}`),
    getArtistTracks: (name) => request(`/artists/${encodeURIComponent(name)}/tracks`),
    getAlbums: () => request('/albums'),
    getAlbum: (artist, album) =>
      request(`/albums/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`),
    getTracks: (page = 1, limit = 50, search = '') => {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      return request(`/tracks?${params}`);
    },
    getAllTracks: (search = '') => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const qs = params.toString();
      return request(`/tracks/all${qs ? `?${qs}` : ''}`);
    },
    getRecentTracks: (limit = 20) => request(`/tracks/recent?limit=${limit}`),
    getTrack: (id) => request(`/tracks/${id}`),
    scanLibrary: () => request('/scan', { method: 'POST' }),
    deleteLibrary: () => request('/library', { method: 'DELETE' }),
    reportPlay: (id) => request(`/tracks/${id}/play`, { method: 'POST' }),
    streamUrl: (id) => `${BASE}/stream/${id}`,
    coverUrl: (filename) => filename ? `${BASE}/covers/${filename}` : '/placeholder.svg',
  };
}
