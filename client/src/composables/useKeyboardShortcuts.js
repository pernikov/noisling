import { onMounted, onUnmounted } from 'vue';
import { usePlayer } from './usePlayer.js';

export function useKeyboardShortcuts() {
  const { state, toggle, next, prev, seek, setVolume, toggleShuffle, toggleMute, cycleRepeat, toggleVisualizer, toggleQueue, toggleShortcuts, toggleLove, openAddToPlaylist } = usePlayer();

  function isTyping(e) {
    const tag = e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  }

  function onKeyDown(e) {
    if (isTyping(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Escape') {
      if (state.showShortcuts) { toggleShortcuts(); return; }
      if (state.showVisualizer) { toggleVisualizer(); return; }
      if (state.showQueue) { toggleQueue(); return; }
    }

    if (e.key === '?') { toggleShortcuts(); return; }

    if (!state.currentTrack) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        toggle();
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(Math.min(state.currentTime + 5, state.duration));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(Math.max(state.currentTime - 5, 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(state.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(state.volume - 0.05);
        break;
      case 'KeyN':
        next();
        break;
      case 'KeyP':
        prev();
        break;
      case 'KeyS':
        toggleShuffle();
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'KeyR':
        cycleRepeat();
        break;
      case 'KeyV':
        toggleVisualizer();
        break;
      case 'KeyQ':
        toggleQueue();
        break;
      case 'KeyL':
        toggleLove();
        break;
      case 'KeyA':
        openAddToPlaylist();
        break;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
}
