<script setup>
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { onMounted, onUnmounted } from 'vue';

const { state, confirm, cancel } = useConfirmDialog();

const handleKeydown = (e) => {
  if (!state.isOpen) return;
  if (e.key === 'Escape') cancel();
  if (e.key === 'Enter') confirm();
};

onMounted(() => document.addEventListener('keydown', handleKeydown));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="state.isOpen" class="custom-modal-overlay" @mousedown.self="cancel">
      <div class="custom-modal-content glass-panel" :class="state.type">
        
        <div class="modal-icon-wrapper">
          <svg v-if="state.type === 'alert' || state.actionType === 'danger'" class="modal-icon text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else class="modal-icon text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div class="modal-body">
          <h3 class="modal-title">{{ state.title }}</h3>
          <p class="modal-message">{{ state.message }}</p>
        </div>

        <div class="modal-actions">
          <button v-if="state.type === 'confirm'" @click="cancel" class="btn-cancel">Cancel</button>
          <button @click="confirm" class="btn-confirm" :class="{ 'btn-danger': state.actionType === 'danger' }">{{ state.confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.custom-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(var(--rgb-background), 0.6);
  backdrop-filter: blur(8px);
  padding: 1.5rem;
}

.custom-modal-content {
  width: 100%;
  max-width: 420px;
  background: rgba(var(--rgb-background), 0.6);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  box-shadow: 0 8px 32px rgba(var(--rgb-background), 0.3);
  text-align: center;
  transform: translateY(0);
}

.modal-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(var(--rgb-foreground), 0.05);
  margin-bottom: 1.5rem;
}

.modal-icon {
  width: 32px;
  height: 32px;
}

.text-warning { color: #fbbf24; }
.text-danger { color: #f87171; }

.modal-title {
  color: var(--color-text-strong);
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
}

.modal-message {
  color: rgba(var(--rgb-foreground), 0.7);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0 0 2rem 0;
  word-break: break-word;
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.8rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-cancel {
  background: rgba(var(--rgb-foreground), 0.05);
  color: var(--color-text-strong);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
}

.btn-cancel:hover { background: rgba(var(--rgb-foreground), 0.1); }

.btn-confirm {
  background: #fee7cb;
  color: #1a1a1a;
  box-shadow: none;
}

.btn-confirm:hover {
  transform: translateY(-1px);
  background: #fff;
}

.alert .btn-confirm {
  background: #34d399;
  color: #1a1a1a;
}

.alert .btn-confirm:hover { background: #10b981; }

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: #ef4444;
  color: var(--color-text-strong);
}

:global([data-theme="light"]) .custom-modal-overlay {
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(10px);
}

:global([data-theme="light"]) .custom-modal-content {
  border-color: rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global([data-theme="light"]) .modal-icon-wrapper {
  background: #f1f5f9;
}

:global([data-theme="light"]) .modal-title {
  color: #0f172a;
}

:global([data-theme="light"]) .modal-message {
  color: #475569;
}

:global([data-theme="light"]) .text-primary {
  color: #b45309;
}

:global([data-theme="light"]) .text-danger {
  color: #dc2626;
}

:global([data-theme="light"]) .btn-cancel {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #334155;
}

:global([data-theme="light"]) .btn-cancel:hover {
  background: #f1f5f9;
  color: #0f172a;
}

:global([data-theme="light"]) .btn-confirm {
  background: #b45309;
  color: #ffffff;
}

:global([data-theme="light"]) .btn-confirm:hover {
  background: #92400e;
}

:global([data-theme="light"]) .alert .btn-confirm {
  background: #15803d;
  color: #ffffff;
}

:global([data-theme="light"]) .alert .btn-confirm:hover {
  background: #166534;
}

:global([data-theme="light"]) .btn-danger {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

:global([data-theme="light"]) .btn-danger:hover {
  background: #fee2e2;
  color: #991b1b;
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .custom-modal-content { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-fade-leave-active .custom-modal-content { transition: all 0.2s ease-in; }
.modal-fade-enter-from .custom-modal-content { opacity: 0; transform: translateY(20px) scale(0.95); }
.modal-fade-leave-to .custom-modal-content { opacity: 0; transform: translateY(-20px) scale(0.95); }
</style>
