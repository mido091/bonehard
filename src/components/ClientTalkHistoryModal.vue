<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  sessions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  deletingId: { type: [Number, String, null], default: null },
  title: { type: String, default: 'Conversations' },
});

const emit = defineEmits(['close', 'select', 'delete']);

const sortedSessions = computed(() => props.sessions || []);

function formatDate(value) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status) {
  return String(status || 'active').replace(/^\w/, (char) => char.toUpperCase());
}

function cardDate(session) {
  return session.endedAt || session.lastMessageAt || session.acceptedAt || session.requestedAt;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="client-talk-history">
      <div v-if="visible" class="ct-history-overlay" @click.self="emit('close')">
        <section class="ct-history-modal" role="dialog" aria-modal="true" :aria-label="title">
          <header class="ct-history-modal__header">
            <div>
              <p class="ct-history-kicker">Client Talk</p>
              <h2>{{ title }}</h2>
            </div>
            <button class="ct-history-icon" type="button" aria-label="Close" @click="emit('close')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <div class="ct-history-modal__body">
            <div v-if="loading" class="ct-history-state">
              <span class="ct-history-spinner"></span>
              <p>Loading conversations...</p>
            </div>

            <div v-else-if="!sortedSessions.length" class="ct-history-empty">
              <strong>No conversations yet</strong>
              <span>Client Talk history for this record will appear here.</span>
            </div>

            <div v-else class="ct-history-grid">
              <article
                v-for="session in sortedSessions"
                :key="session.id"
                class="ct-history-card"
                role="button"
                tabindex="0"
                @click="emit('select', session)"
                @keyup.enter.prevent="emit('select', session)"
              >
                <div class="ct-history-card__top">
                  <span class="ct-history-avatar">{{ (session.userName || 'C').slice(0, 1).toUpperCase() }}</span>
                  <div>
                    <strong>{{ session.userName || 'Client' }}</strong>
                    <span>{{ session.orderName || `Order #${session.orderId}` }}</span>
                  </div>
                  <span :class="['ct-history-badge', `is-${session.status || 'active'}`]">{{ statusLabel(session.status) }}</span>
                </div>

                <dl class="ct-history-meta">
                  <div>
                    <dt>Assigned</dt>
                    <dd>{{ session.assignedName || 'Unassigned' }}</dd>
                  </div>
                  <div>
                    <dt>{{ session.endedAt ? 'Ended' : 'Latest' }}</dt>
                    <dd>{{ formatDate(cardDate(session)) }}</dd>
                  </div>
                </dl>

                <footer class="ct-history-card__footer">
                  <span>{{ session.status === 'ended' ? 'View transcript' : 'Open live chat' }}</span>
                  <button
                    v-if="canDelete && session.status === 'ended'"
                    class="ct-history-delete"
                    type="button"
                    :disabled="Number(deletingId) === Number(session.id)"
                    @click.stop="emit('delete', session)"
                  >
                    {{ Number(deletingId) === Number(session.id) ? 'Deleting...' : 'Delete' }}
                  </button>
                </footer>
              </article>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ct-history-overlay {
  position: fixed;
  inset: 0;
  z-index: 7000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(10px);
}

.ct-history-modal {
  width: min(860px, calc(100vw - 1.5rem));
  max-height: min(760px, calc(100vh - 1.5rem));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(248, 217, 170, 0.18);
  border-radius: 18px;
  background: #0d0d0d;
  color: #f8fafc;
  box-shadow: 0 34px 100px rgba(0, 0, 0, 0.55);
}

.ct-history-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.35rem 1.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.ct-history-kicker {
  margin: 0 0 0.2rem;
  color: rgba(248, 217, 170, 0.72);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ct-history-modal h2 {
  margin: 0;
  font-size: clamp(1.35rem, 2vw, 1.8rem);
}

.ct-history-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
}

.ct-history-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.ct-history-modal__body {
  overflow: auto;
  padding: 1.35rem;
}

.ct-history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.ct-history-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.ct-history-card:hover,
.ct-history-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(248, 217, 170, 0.4);
  outline: none;
}

.ct-history-card__top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
}

.ct-history-avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: rgba(96, 165, 250, 0.14);
  color: #60a5fa;
  font-weight: 900;
}

.ct-history-card strong,
.ct-history-card span,
.ct-history-card dd {
  overflow-wrap: anywhere;
}

.ct-history-card__top strong {
  display: block;
  font-size: 1rem;
}

.ct-history-card__top span:not(.ct-history-avatar):not(.ct-history-badge) {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.82rem;
}

.ct-history-badge {
  justify-self: end;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.ct-history-badge.is-ended { background: rgba(148, 163, 184, 0.14); color: #cbd5e1; }
.ct-history-badge.is-active { background: rgba(16, 185, 129, 0.14); color: #34d399; }
.ct-history-badge.is-pending { background: rgba(245, 158, 11, 0.14); color: #fbbf24; }

.ct-history-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0;
}

.ct-history-meta div {
  padding: 0.75rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
}

.ct-history-meta dt {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
}

.ct-history-meta dd {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.ct-history-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #f8d9aa;
  font-weight: 900;
}

.ct-history-delete {
  border: 0;
  background: transparent;
  color: #fca5a5;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;
}

.ct-history-state,
.ct-history-empty {
  display: grid;
  min-height: 16rem;
  place-items: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
}

.ct-history-empty {
  gap: 0.35rem;
}

.ct-history-empty strong {
  color: #fff;
  font-size: 1.1rem;
}

.ct-history-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(248, 217, 170, 0.2);
  border-top-color: #f8d9aa;
  border-radius: 999px;
  animation: ctHistorySpin 0.8s linear infinite;
}

@keyframes ctHistorySpin { to { transform: rotate(360deg); } }

.client-talk-history-enter-active,
.client-talk-history-leave-active {
  transition: opacity 0.18s ease;
}

.client-talk-history-enter-active .ct-history-modal,
.client-talk-history-leave-active .ct-history-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.client-talk-history-enter-from,
.client-talk-history-leave-to {
  opacity: 0;
}

.client-talk-history-enter-from .ct-history-modal,
.client-talk-history-leave-to .ct-history-modal {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

[data-theme="light"] .ct-history-overlay {
  background: rgba(15, 23, 42, 0.42);
}

[data-theme="light"] .ct-history-modal {
  background: #ffffff;
  color: #0f172a;
  border-color: #e2e8f0;
  box-shadow: 0 34px 100px rgba(15, 23, 42, 0.24);
}

[data-theme="light"] .ct-history-modal__header {
  border-bottom-color: #e2e8f0;
}

[data-theme="light"] .ct-history-kicker,
[data-theme="light"] .ct-history-card__footer {
  color: #b45309;
}

[data-theme="light"] .ct-history-icon,
[data-theme="light"] .ct-history-card {
  background: #f8fafc;
  border-color: #e2e8f0;
}

[data-theme="light"] .ct-history-card__top span:not(.ct-history-avatar):not(.ct-history-badge),
[data-theme="light"] .ct-history-state,
[data-theme="light"] .ct-history-meta dt {
  color: #64748b;
}

[data-theme="light"] .ct-history-meta div {
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

[data-theme="light"] .ct-history-card__footer {
  border-top-color: #e2e8f0;
}

@media (max-width: 640px) {
  .ct-history-overlay {
    align-items: end;
    padding: 0;
  }

  .ct-history-modal {
    width: 100%;
    max-height: calc(100vh - 1rem);
    border-radius: 18px 18px 0 0;
  }

  .ct-history-grid,
  .ct-history-meta {
    grid-template-columns: 1fr;
  }
}
</style>
