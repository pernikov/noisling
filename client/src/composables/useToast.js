import { reactive } from 'vue';

// Module-level singleton so any component can push toasts
const state = reactive({ items: [] });
let uid = 0;

export function useToast() {
  function error(message) {
    const id = ++uid;
    state.items.push({ id, message });
    setTimeout(() => {
      const i = state.items.findIndex(t => t.id === id);
      if (i !== -1) state.items.splice(i, 1);
    }, 4000);
  }

  return { items: state.items, error };
}
