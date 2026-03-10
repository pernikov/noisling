import { ref, onBeforeUnmount } from 'vue';

/**
 * Manages a floating context menu anchored to a trigger element.
 *
 * @param {object} options
 * @param {number} options.menuWidth  - Estimated menu width in px (for viewport clamping)
 * @param {number} options.menuHeight - Estimated menu height in px (for flip-up logic)
 * @param {'left'|'right'} options.align
 *   'right' (default) — menu right edge aligns with trigger right edge (opens to the left)
 *   'left'            — menu left edge aligns with trigger left edge (opens to the right)
 */
export function useContextMenu({ menuWidth = 160, menuHeight = 72, align = 'right' } = {}) {
  const menuTrack = ref(null);
  const menuStyle = ref({});
  let closeTimer = null;

  function openMenu(event, track) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();

    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight) top = rect.top - menuHeight - 4;
    top = Math.max(0, top);

    let left;
    if (align === 'right') {
      left = Math.max(8, rect.right - menuWidth);
    } else {
      left = Math.min(rect.left, window.innerWidth - menuWidth);
      left = Math.max(0, left);
    }

    menuTrack.value = track;
    menuStyle.value = { top: `${top}px`, left: `${left}px` };
  }

  function closeMenu() {
    clearTimeout(closeTimer);
    menuTrack.value = null;
  }

  function scheduleClose() {
    closeTimer = setTimeout(() => { menuTrack.value = null; }, 120);
  }

  function cancelClose() {
    clearTimeout(closeTimer);
  }

  onBeforeUnmount(() => clearTimeout(closeTimer));

  return { menuTrack, menuStyle, openMenu, closeMenu, scheduleClose, cancelClose };
}
