import { reactive } from 'vue';

/**
 * Global reactive state for toasts to ensure they persist across route changes
 * and can be triggered from any component or composable.
 */
const state = reactive({
  messages: [], // Each message: { id: number, text: string, type: 'success'|'error'|'info' }
});

let counter = 0;

/**
 * useToast composable provides a simple interface to trigger global notifications.
 * It manages auto-dismissal logic to keep the UI clean and prevent memory leaks.
 */
export function useToast() {
  /**
   * Shows a toast message that auto-dismisses after a duration.
   * @param {string} text - The message to display
   * @param {'success'|'error'|'info'} type - The visual style of the toast
   * @param {number} duration - Time in ms before auto-removal
   */
  const showToast = (text, type = 'success', duration = 3000) => {
    const id = ++counter;
    state.messages.push({ id, text, type });

    // Handle auto-dismissal using the unique ID
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  /**
   * Manually removes a toast by its ID.
   * Useful for manual dismissal on click.
   */
  const removeToast = (id) => {
    const index = state.messages.findIndex((m) => m.id === id);
    if (index !== -1) {
      state.messages.splice(index, 1);
    }
  };

  return {
    state,
    showToast,
    removeToast,
  };
}
