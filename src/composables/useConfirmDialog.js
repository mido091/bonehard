import { reactive } from 'vue';

const state = reactive({
  isOpen: false,
  message: '',
  title: 'Confirm Action',
  confirmText: 'Confirm',
  actionType: 'primary', // 'primary' | 'danger'
  type: 'confirm', // 'confirm' | 'alert'
  resolve: null,
});

export function useConfirmDialog() {
  const showConfirm = (options) => {
    return new Promise((resolve) => {
      if (typeof options === 'string') {
        state.message = options;
        state.title = 'Confirm Action';
        state.confirmText = 'Confirm';
        state.actionType = 'primary';
      } else {
        state.message = options.message || '';
        state.title = options.title || 'Confirm Action';
        state.confirmText = options.confirmText || 'Confirm';
        state.actionType = options.type || 'primary';
      }
      state.type = 'confirm';
      state.resolve = resolve;
      state.isOpen = true;
    });
  };

  const showAlert = (options) => {
    return new Promise((resolve) => {
      if (typeof options === 'string') {
        state.message = options;
        state.title = 'Attention';
        state.confirmText = 'OK';
        state.actionType = 'primary';
      } else {
        state.message = options.message || '';
        state.title = options.title || 'Attention';
        state.confirmText = options.confirmText || 'OK';
        state.actionType = options.type || 'primary';
      }
      state.type = 'alert';
      state.resolve = resolve;
      state.isOpen = true;
    });
  };

  const confirm = () => {
    if (state.resolve) state.resolve(true);
    close();
  };

  const cancel = () => {
    if (state.resolve) state.resolve(false);
    close();
  };

  const close = () => {
    state.isOpen = false;
    // Delay clearing message so the exit transition looks clean
    setTimeout(() => {
      state.message = '';
      state.resolve = null;
    }, 300);
  };

  return {
    state,
    showConfirm,
    showAlert,
    confirm,
    cancel,
  };
}
