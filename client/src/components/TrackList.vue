<script setup>
import { useRouter } from 'vue-router';
import { mdiPlay, mdiShuffle } from '@mdi/js';
import Icon from './Icon.vue';
import { usePlayer } from '../composables/usePlayer.js';
import CoverArt from './CoverArt.vue';

const router = useRouter();

const props = defineProps({
  tracks: { type: Array, required: true },
  showCover: { type: Boolean, default: false },
  showArtist: { type: Boolean, default: false },
  showAlbum: { type: Boolean, default: false },
  showPlays: { type: Boolean, default: false },
  showLastPlayed: { type: Boolean, default: false },
  startIndex: { type: Number, default: 0 },
  getAllTracks: { type: Function, default: null }, // () => Promise<Track[]> for full library play/shuffle
});

const { state, playAlbum, playFromQueue, queueMatches } = usePlayer();

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function playTrack(index) {
  if (queueMatches(props.tracks)) {
    const queueIdx = state.shuffle
      ? state.queue.findIndex(t => t._id === props.tracks[index]._id)
      : index;
    playFromQueue(queueIdx);
  } else {
    playAlbum(props.tracks, index);
  }
}

function playAll() {
  // Start playback synchronously so iOS autoplay policy is satisfied.
  // If getAllTracks is provided, extend the queue after the fetch.
  if (!props.tracks.length) return;
  playAlbum(props.tracks, 0);

  if (props.getAllTracks) {
    props.getAllTracks().then(allTracks => {
      if (allTracks.length > props.tracks.length) {
        const currentId = state.currentTrack?._id;
        const idx = allTracks.findIndex(t => t._id === currentId);
        state.queue = allTracks;
        state.originalQueue = [...allTracks];
        state.queueIndex = idx >= 0 ? idx : 0;
      }
    });
  }
}

function playShuffle() {
  if (!props.tracks.length) return;
  const randomIndex = Math.floor(Math.random() * props.tracks.length);
  state.shuffle = true;
  playAlbum(props.tracks, randomIndex);

  if (props.getAllTracks) {
    props.getAllTracks().then(allTracks => {
      if (allTracks.length > props.tracks.length) {
        const current = state.currentTrack;
        const rest = allTracks.filter(t => t._id !== current?._id);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        state.queue = current ? [current, ...rest] : rest;
        state.originalQueue = [...allTracks];
        state.queueIndex = 0;
      }
    });
  }
}

function isCurrentTrack(track) {
  return state.currentTrack?._id === track._id;
}
</script>

<template>
  <div class="w-full">
    <!-- Play all / Shuffle buttons -->
    <div class="flex items-center gap-2 mb-3 justify-end">
      <button
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
        @click="playAll"
      >
        <Icon :path="mdiPlay" class="w-3.5 h-3.5" />
        Play All
      </button>
      <button
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
        @click="playShuffle"
      >
        <Icon :path="mdiShuffle" class="w-3.5 h-3.5" />
        Shuffle
      </button>
    </div>

    <table class="w-full table-fixed text-sm border-separate border-spacing-0">
      <thead>
        <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800">
          <th class="text-center py-2 px-1 w-8">#</th>
          <th class="text-left py-2 px-3">Title</th>
          <th v-if="showArtist" class="text-left py-2 px-3 w-1/4 hidden sm:table-cell">Artist</th>
          <th v-if="showAlbum" class="text-left py-2 px-3 w-1/4 hidden md:table-cell">Album</th>
          <th v-if="showPlays" class="text-right py-2 px-3 w-16 hidden sm:table-cell">Plays</th>
          <th v-if="showLastPlayed" class="text-right py-2 px-3 w-24 hidden sm:table-cell">Played</th>
          <th class="text-right py-2 px-3 w-16">Time</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(track, i) in tracks"
          :key="track._id"
          class="cursor-pointer [&:hover>td]:bg-zinc-800/50 [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
          :class="{ 'text-emerald-400': isCurrentTrack(track) }"
          @click="playTrack(i)"
        >
          <td class="py-2 px-1 text-zinc-500 text-center">
            <span v-if="isCurrentTrack(track) && state.isPlaying" class="text-emerald-400 flex items-center justify-center">
              <Icon :path="mdiPlay" class="w-3 h-3" />
            </span>
            <span v-else>{{ startIndex + i + 1 }}</span>
          </td>
          <td class="py-2 px-3 font-medium overflow-hidden">
            <div class="flex items-center gap-2 min-w-0">
              <CoverArt v-if="showCover" :cover="track.cover" size="w-8 h-8 shrink-0" />
              <span class="truncate">{{ track.title }}</span>
            </div>
          </td>
          <td v-if="showArtist" class="py-2 px-3 text-zinc-400 hidden sm:table-cell overflow-hidden">
            <div class="truncate">
              <template v-for="(artist, ai) in track.artists" :key="ai">
                <span v-if="ai > 0">, </span>
                <router-link
                  :to="{ name: 'artist', params: { name: artist } }"
                  class="hover:text-zinc-100 hover:underline"
                  @click.stop
                >{{ artist }}</router-link>
              </template>
            </div>
          </td>
          <td v-if="showAlbum" class="py-2 px-3 text-zinc-400 hidden md:table-cell overflow-hidden">
            <router-link
              :to="{ name: 'album', params: { artist: track.artists[0], album: track.album } }"
              class="hover:text-zinc-100 hover:underline truncate block"
              @click.stop
            >{{ track.album }}</router-link>
          </td>
          <td v-if="showPlays" class="py-2 px-3 text-right text-zinc-500 hidden sm:table-cell">{{ track.playCount || 0 }}</td>
          <td v-if="showLastPlayed" class="py-2 px-3 text-right text-zinc-500 hidden sm:table-cell">{{ track.lastPlayedAt ? timeAgo(track.lastPlayedAt) : '' }}</td>
          <td class="py-2 px-3 text-right text-zinc-500">{{ formatDuration(track.duration) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
