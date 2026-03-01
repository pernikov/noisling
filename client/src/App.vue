<script setup>
import { computed, ref, watch } from "vue";
import { mdiCog, mdiHelpCircleOutline, mdiAlertCircleOutline } from "@mdi/js";
import { useToast } from "./composables/useToast.js";
import Icon from "./components/Icon.vue";
import { useRoute, useRouter } from "vue-router";
import PlayerBar from "./components/PlayerBar.vue";
import NowPlayingModal from "./components/NowPlayingModal.vue";
import ShortcutsModal from "./components/ShortcutsModal.vue";
import SpectrogramVisualizer from "./components/SpectrogramVisualizer.vue";
import { usePlayer } from "./composables/usePlayer.js";
import { useKeyboardShortcuts } from "./composables/useKeyboardShortcuts.js";
import { useAccentColor } from "./composables/useAccentColor.js";
import { useTheme } from "./composables/useTheme.js";
import { useUpdateCheck } from "./composables/useUpdateCheck.js";
import GlobalSearch from "./components/GlobalSearch.vue";
import UpdateModal from "./components/UpdateModal.vue";

const { loadTheme, showArtistsNav } = useTheme();
loadTheme();

const { loadPlayerPrefs, restoreQueue } = usePlayer();
loadPlayerPrefs();
restoreQueue();

const route = useRoute();
const router = useRouter();
const { state: playerState, toggleShortcuts } = usePlayer();

// Redirect away from /artists* if the nav link is hidden
watch(showArtistsNav, (visible) => {
  if (!visible && route.path.startsWith("/artists")) {
    router.replace("/");
  }
});

watch(
  () => route.path,
  () => {
    playerState.showVisualizer = false;
    playerState.showNowPlaying = false;
  },
);

const { accentColor } = useAccentColor();

const navStyle = computed(() => {
  if (!accentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${accentColor.value}, 0.25), rgba(${accentColor.value}, 0.1) 60%, transparent)`,
  };
});
useKeyboardShortcuts();

const { items: toastItems } = useToast();

const { hasUpdate, latestVersion } = useUpdateCheck();
const showUpdateModal = ref(false);

watch(
  () => playerState.currentTrack,
  (track) => {
    document.title = track
      ? `${track.title} · ${track.artists?.join(", ")} — Noisling`
      : "Noisling";
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="flex flex-col"
    :class="
      playerState.showVisualizer
        ? 'h-screen overflow-hidden'
        : { 'min-h-screen': true, 'pb-24': playerState.currentTrack }
    "
  >
    <!-- Spacer to offset fixed nav -->
    <div class="h-14 shrink-0" />

    <!-- Top nav -->
    <nav
      class="fixed top-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 z-40"
      :style="navStyle"
    >
      <div
        class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14"
      >
        <div class="flex items-center gap-6">
          <router-link
            to="/"
            class="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <img
              src="@/assets/img/logo.png"
              alt="Noisling"
              class="h-7 w-7 rounded"
            />
            Noisling
          </router-link>
          <div class="flex gap-4 text-sm">
            <router-link
              to="/songs"
              class="text-zinc-400 hover:text-zinc-100 transition-colors"
              active-class="!text-zinc-100"
            >
              Songs
            </router-link>
            <router-link
              v-if="showArtistsNav"
              to="/artists"
              class="text-zinc-400 hover:text-zinc-100 transition-colors"
              active-class="!text-zinc-100"
            >
              Artists
            </router-link>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="hasUpdate"
            class="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            :title="`Update available: v${latestVersion}`"
            @click="showUpdateModal = true"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
            />
            Update available
          </button>
          <GlobalSearch />
          <button
            class="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded hover:bg-zinc-800"
            :class="{ '!text-zinc-100': playerState.showShortcuts }"
            @click="toggleShortcuts"
            aria-label="Keyboard shortcuts"
          >
            <Icon :path="mdiHelpCircleOutline" class="w-5 h-5" />
          </button>
          <router-link
            to="/settings"
            class="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded hover:bg-zinc-800"
            active-class="!text-zinc-100"
          >
            <Icon :path="mdiCog" class="w-5 h-5" />
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Main content / Spectrogram visualizer -->
    <Transition name="vis-fade" mode="out-in">
      <main
        v-if="!playerState.showVisualizer"
        key="main"
        class="w-full max-w-6xl mx-auto px-4 py-6"
      >
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
      <SpectrogramVisualizer v-else key="vis" class="flex-1" />
    </Transition>

    <!-- Player bar -->
    <PlayerBar />

    <!-- Now Playing full-screen modal -->
    <NowPlayingModal />

    <!-- Keyboard shortcuts modal (manages its own v-if + transitions internally) -->
    <ShortcutsModal />

    <!-- Update modal -->
    <UpdateModal
      v-if="showUpdateModal"
      :latest-version="latestVersion"
      @close="showUpdateModal = false"
    />

    <!-- Global error toasts -->
    <Teleport to="body">
      <div
        class="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        <TransitionGroup name="toast-slide">
          <div
            v-for="item in toastItems"
            :key="item.id"
            class="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900/95 backdrop-blur-xl border border-red-900/60 rounded-lg shadow-xl text-sm max-w-xs"
          >
            <Icon
              :path="mdiAlertCircleOutline"
              class="w-4 h-4 text-red-400 shrink-0"
            />
            <span class="text-zinc-200">{{ item.message }}</span>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Route page transitions */
.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  /* transform: translateY(6px); */
}
.page-leave-to {
  opacity: 0;
  /* transform: translateY(-6px); */
}

/* Visualizer toggle */
.vis-fade-enter-active,
.vis-fade-leave-active {
  transition: opacity 0.25s ease;
}
.vis-fade-enter-from,
.vis-fade-leave-to {
  opacity: 0;
}

/* Error toasts */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
