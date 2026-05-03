<script setup>
/**
 * ToastNotification component serves as the global container for all notifications.
 * It uses the shared state from useToast to render active messages.
 */
import { useToast } from '../../composables/useToast';

const { state, removeToast } = useToast();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast-list">
      <div
        v-for="msg in state.messages"
        :key="msg.id"
        class="toast-item glass-panel"
        :class="msg.type"
        @click="removeToast(msg.id)"
      >
        <div class="toast-icon">
          <svg v-if="msg.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <svg v-else-if="msg.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <span class="toast-text">{{ msg.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 280px;
  max-width: 420px;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  background: rgba(25, 25, 30, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  box-shadow: 0 10px 30px rgba(var(--rgb-background), 0.4);
  cursor: pointer;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.toast-item.success .toast-icon {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.toast-item.error .toast-icon {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.toast-item.info .toast-icon {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.toast-icon svg {
  width: 18px;
  height: 18px;
}

.toast-text {
  color: var(--color-text-strong);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
}

/* Animations */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.9);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

.toast-list-move {
  transition: transform 0.4s ease;
}
</style>
