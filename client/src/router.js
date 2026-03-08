import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/artists', name: 'artists', component: () => import('./views/ArtistsView.vue') },
  { path: '/artists/:name', name: 'artist', component: () => import('./views/ArtistView.vue') },
  { path: '/albums/:artist/:album', name: 'album', component: () => import('./views/AlbumView.vue') },
  { path: '/songs', name: 'songs', component: () => import('./views/SongsView.vue') },
  { path: '/recent', name: 'recent', component: () => import('./views/RecentView.vue') },
  { path: '/stats', redirect: { name: 'settings', query: { tab: 'stats' } } },
  { path: '/playlists', name: 'playlists', component: () => import('./views/PlaylistsView.vue') },
  { path: '/playlists/:id', name: 'playlist', component: () => import('./views/PlaylistView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue') },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
