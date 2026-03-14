<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import { useTheme } from '../composables/useTheme.js';
import { usePlayer } from '../composables/usePlayer.js';
import CoverArt from '../components/CoverArt.vue';
import TrackList from '../components/TrackList.vue';
import NotFoundPage from '../components/NotFoundPage.vue';
import Spinner from '../components/Spinner.vue';
import BaseModal from '../components/BaseModal.vue';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';
import EditAlbumCoverModal from '../components/EditAlbumCoverModal.vue';
import { mdiMagnifyPlus, mdiPlay, mdiShuffle, mdiImage } from '@mdi/js';

const api = useApi();
const { wideLayout } = useTheme();
const { playAlbum, playShuffled } = usePlayer();
const route = useRoute();
const router = useRouter();
const coverSize = computed(() =>
  wideLayout.value
    ? 'w-full aspect-square sm:w-72 sm:h-72 sm:aspect-auto'
    : 'w-full aspect-square sm:w-48 sm:h-48 sm:aspect-auto'
);
const albumInfo = ref(null);
const tracks = ref([]);
const loading = ref(true);
const notFound = ref(false);
const albumName = ref('');
const coverModalOpen = ref(false);
const coverModalLoaded = ref(false);
const editCoverOpen = ref(false);

function syncAlbumInfoFromTracks() {
  if (!tracks.value.length) return;

  const firstTrack = tracks.value[0];
  albumInfo.value = {
    name: firstTrack.album,
    artists: firstTrack.artists,
    year: firstTrack.year,
    cover: firstTrack.cover,
    hasCustomCover: tracks.value.some((track) => !!track.overrides?.cover),
    trackCount: tracks.value.length,
    duration: tracks.value.reduce((sum, track) => sum + (track.duration || 0), 0),
  };
}

async function syncRouteFromTracks() {
  if (!tracks.value.length) return;

  const firstTrack = tracks.value[0];
  const nextArtist = firstTrack.artists?.[0];
  const nextAlbum = firstTrack.album;
  const currentArtist = decodeURIComponent(route.params.artist);
  const currentAlbum = decodeURIComponent(route.params.album);

  if (!nextArtist || !nextAlbum) return;
  if (nextArtist === currentArtist && nextAlbum === currentAlbum) return;

  await router.replace({
    name: 'album',
    params: {
      artist: nextArtist,
      album: nextAlbum,
    },
  });
}

function openCoverModal() {
  coverModalLoaded.value = false;
  coverModalOpen.value = true;
}

function openEditCover() {
  editCoverOpen.value = true;
}

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const artist = decodeURIComponent(route.params.artist);
    const album = decodeURIComponent(route.params.album);
    albumName.value = album;
    const data = await api.getAlbum(artist, album);
    tracks.value = data.tracks;
    albumInfo.value = data.album;
    syncAlbumInfoFromTracks();
  } catch (err) {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => [route.params.artist, route.params.album], load);
useLibraryEvents(load);

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

function playAll() {
  if (tracks.value.length) playAlbum(tracks.value, 0);
}

function playShuffle() {
  if (!tracks.value.length) return;
  playShuffled(tracks.value);
}

async function onCoverSaved() {
  await load();
}

async function onTrackUpdated() {
  syncAlbumInfoFromTracks();
  await syncRouteFromTracks();
}
</script>

<template>
  <div>
    <NotFoundPage v-if="!loading && notFound" type="album" :name="albumName" />

    <template v-else>
    <button class="text-zinc-500 hover:text-zinc-300 mb-4 text-sm" @click="router.back()">
      &larr; Back
    </button>

    <div v-if="loading" class="animate-pulse">
      <!-- Album header -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 mb-8">
        <div :class="[coverSize, 'bg-zinc-800 rounded-lg shrink-0']"></div>
        <div class="flex-1 space-y-3 py-1">
          <div class="h-2.5 bg-zinc-800/60 rounded w-10"></div>
          <div class="h-8 bg-zinc-800 rounded w-3/4"></div>
          <div class="h-3 bg-zinc-800/60 rounded w-1/3"></div>
        </div>
      </div>
      <!-- Track list -->
      <div class="space-y-1">
        <div v-for="i in 10" :key="i" class="flex items-center gap-3 px-1 py-2">
          <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
          <div class="flex-1 min-w-0">
            <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (i * 13) % 30}%` }"></div>
          </div>
          <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
        </div>
      </div>
    </div>

    <template v-else-if="albumInfo">
      <!-- Album header -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 mb-8">
        <button
          v-if="albumInfo.cover"
          :class="coverSize"
          class="cursor-zoom-in shrink-0 rounded overflow-hidden relative group/cover"
          @click="openCoverModal"
        >
          <CoverArt :cover="albumInfo.cover" :size="'w-full h-full'" />
          <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
            <Icon :path="mdiMagnifyPlus" class="w-8 h-8 text-white" />
          </div>
        </button>
        <CoverArt v-else :cover="''" :size="coverSize" />
        <div class="min-w-0 flex-1">
          <div class="text-xs uppercase text-zinc-500 mb-1">Album</div>
          <h1 class="text-2xl sm:text-3xl font-bold font-display mb-2">{{ albumInfo.name }}</h1>
          <div class="text-zinc-400 mb-4">
            <template v-for="(artist, ai) in albumInfo.artists" :key="ai">
              <span v-if="ai > 0">, </span>
              <router-link
                :to="{ name: 'artist', params: { name: artist } }"
                class="hover:text-zinc-100 hover:underline"
              >{{ artist }}</router-link>
            </template>
            <span v-if="albumInfo.year" class="text-zinc-500"> &middot; {{ albumInfo.year }}</span>
            <span class="text-zinc-500">
              &middot; {{ albumInfo.trackCount }} track{{ albumInfo.trackCount !== 1 ? 's' : '' }} &middot; {{ formatDuration(albumInfo.duration) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <IconButton :icon="mdiPlay" label="Play all" :disabled="!tracks.length" @click="playAll" />
            <IconButton :icon="mdiShuffle" label="Shuffle" :disabled="!tracks.length" @click="playShuffle" />
            <IconButton :icon="mdiImage" :label="albumInfo.hasCustomCover ? 'Change artwork' : 'Set artwork'" @click="openEditCover" />
          </div>
        </div>
      </div>

      <TrackList :tracks="tracks" :use-track-number="true" hide-controls @track-updated="onTrackUpdated" />
    </template>
    </template>

  <!-- Cover art modal -->
  <BaseModal :show="coverModalOpen" @close="coverModalOpen = false">
    <Spinner v-if="!coverModalLoaded" class="w-6 h-6 text-white/60 absolute" />
    <img
      :src="api.coverUrl(albumInfo.cover)"
      class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain transition-opacity duration-300"
      :class="coverModalLoaded ? 'opacity-100' : 'opacity-0'"
      alt="Cover"
      @load="coverModalLoaded = true"
    />
  </BaseModal>

  <EditAlbumCoverModal
    v-if="editCoverOpen && albumInfo"
    :artist="albumInfo.artists?.[0] || ''"
    :album="albumInfo.name"
    :cover="albumInfo.cover"
    :has-custom-cover="albumInfo.hasCustomCover"
    @close="editCoverOpen = false"
    @saved="onCoverSaved"
  />
  </div>
</template>
