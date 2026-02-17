import { onMounted, onUnmounted } from 'vue';
import { usePlayer } from './usePlayer.js';

export function useKeyboardShortcuts() {
  const { state, toggle, next, prev, seek, setVolume, toggleShuffle, toggleMute, cycleRepeat } = usePlayer();

  function isTyping(e) {
    const tag = e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  }

  function onKeyDown(e) {
    if (isTyping(e)) return;
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
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
}
