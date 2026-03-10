import { reactive } from 'vue';

// Module-level singleton so any component can push toasts
const state = reactive({ errors: [], toasts: [] });
let uid = 0;

export function useToast() {
  function error(message) {
    const id = ++uid;
    state.errors.push({ id, message });
    setTimeout(() => {
      const i = state.errors.findIndex(t => t.id === id);
      if (i !== -1) state.errors.splice(i, 1);
    }, 4000);
  }

  function show(message) {
    const id = ++uid;
    state.toasts.push({ id, message });
    setTimeout(() => {
      const i = state.toasts.findIndex(t => t.id === id);
      if (i !== -1) state.toasts.splice(i, 1);
    }, 2000);
  }

  return { errors: state.errors, toasts: state.toasts, items: state.errors, error, show };
}
