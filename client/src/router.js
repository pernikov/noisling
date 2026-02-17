import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/artists' },
  { path: '/artists', name: 'artists', component: () => import('./views/ArtistsView.vue') },
  { path: '/artists/:name', name: 'artist', component: () => import('./views/ArtistView.vue') },
  { path: '/albums/:artist/:album', name: 'album', component: () => import('./views/AlbumView.vue') },
  { path: '/songs', name: 'songs', component: () => import('./views/SongsView.vue') },
  { path: '/recent', name: 'recent', component: () => import('./views/RecentView.vue') },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
