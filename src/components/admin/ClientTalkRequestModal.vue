<script setup>
/**
 * ClientTalkRequestModal.vue
 * Admin/assistant modal to claim a Client Talk session from a notification.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useClientTalk } from '../../composables/useClientTalk';
import ClientTalkModal from '../ClientTalkModal.vue';

const props = defineProps({
  sessionId:   { type: Number, required: true },
  orderId:     { type: Number, required: true },
  orderName:   { type: String, default: '' },
  userName:    { type: String, default: 'Client' },
  requestedAt: { type: String, default: '' },
});

const emit = defineEmits(['close', 'accepted', 'ended']);
const router = useRouter();

const alreadyAccepted = ref(false);
const alreadyBy       = ref('');
const chatOpen        = ref(false);

// We pass orderId=0 here because the admin uses acceptSession directly
const { session, accepting, error, acceptSession } = useClientTalk(0);

async function handleAccept() {
  const result = await acceptSession(props.sessionId);
  if (result.success) {
    emit('accepted', result.session);
    chatOpen.value = true;
  } else if (result.alreadyAccepted) {
    alreadyAccepted.value = true;
    alreadyBy.value = result.details?.assignedName || 'another team member';
  }
}

function formatTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

const minimized = ref(false);

function handleEscape(e) {
  if (e.key === 'Escape') minimized.value = true;
}
onMounted(() => document.addEventListener('keydown', handleEscape));
onUnmounted(() => document.removeEventListener('keydown', handleEscape));
</script>

<template>
  <Teleport to="body">
    <!-- If chat accepted → switch to the full chat modal with pre-loaded session -->
    <ClientTalkModal
      v-if="chatOpen && session"
      :order-id="orderId"
      :order-name="orderName"
      :initial-session="session"
      @ended="emit('ended', $event)"
      @close="emit('close')"
    />

    <!-- Request claim modal -->
    <Transition v-else name="ct-fade">
      <div v-show="!minimized" class="ct-backdrop" role="dialog" aria-modal="true" aria-label="Client Talk Request">
        <div class="ct-req-modal">
        <header class="ct-req-header">
          <div class="ct-req-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="ct-req-header__actions">
            <button class="ct-close-btn" type="button" aria-label="Minimize" title="Minimize request window" @click="minimized = true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="ct-close-btn ct-close-btn--hard" type="button" aria-label="Close" title="Close request window" @click="emit('close')">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <div class="ct-req-body">
          <p class="ct-req-kicker">Incoming Client Talk Request</p>
          <h2 class="ct-req-title">{{ userName }} wants to chat</h2>

          <dl class="ct-req-meta">
            <div>
              <dt>Order</dt>
              <dd>
                <RouterLink :to="`/admin/user-orders/${orderId}`" class="ct-req-link" @click="emit('close')">
                  {{ orderName || `#${orderId}` }}
                </RouterLink>
              </dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{{ userName }}</dd>
            </div>
            <div>
              <dt>Requested at</dt>
              <dd>{{ formatTime(requestedAt) }}</dd>
            </div>
          </dl>

          <!-- Already accepted notice -->
          <div v-if="alreadyAccepted" class="ct-req-notice ct-req-notice--warn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Already accepted by <strong>{{ alreadyBy }}</strong>.
          </div>

          <!-- Error notice -->
          <div v-else-if="error" class="ct-req-notice ct-req-notice--error">{{ error }}</div>

          <button
            v-if="!alreadyAccepted"
            class="ct-req-cta"
            :disabled="accepting"
            @click="handleAccept"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {{ accepting ? 'Joining…' : 'Start Conversation' }}
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Minimized Floating Incoming Request Shortcut Bubble -->
    <Transition name="ct-bubble-fade">
      <button
        v-if="minimized && !chatOpen"
        class="ct-floating-bubble"
        type="button"
        aria-label="Restore Client Talk Request"
        title="Restore Client Talk Request"
        @click="minimized = false"
      >
        <span class="ct-floating-bubble__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="ct-floating-bubble__text">Talk Request: {{ userName }}</span>
        <span class="ct-floating-bubble__live-dot"></span>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ct-backdrop {
  position: fixed; inset: 0; z-index: 9000;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  animation: ct-fade-in 0.2s ease-out;
}
@keyframes ct-fade-in { from { opacity: 0; } to { opacity: 1; } }

.ct-req-modal {
  width: min(440px, calc(100vw - 2rem));
  border: 1px solid rgba(248,217,170,0.22); border-radius: 20px;
  background: #0d0d0d; box-shadow: 0 32px 80px rgba(0,0,0,0.7);
  overflow: hidden; animation: ct-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes ct-slide-up {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ct-req-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.25rem 0;
}

.ct-req-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.ct-req-badge {
  width: 48px; height: 48px; border-radius: 14px;
  background: rgba(248,217,170,0.12); color: #f8d9aa;
  display: grid; place-items: center;
}
.ct-req-badge svg { width: 24px; height: 24px; }

.ct-close-btn {
  width: 34px; height: 34px; display: grid; place-items: center;
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6);
  cursor: pointer; transition: all 0.2s ease;
}
.ct-close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

.ct-close-btn--hard {
  color: rgba(255, 255, 255, 0.72);
}

.ct-close-btn--hard:hover {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.14);
  color: #fecaca;
}

.ct-req-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

.ct-req-kicker {
  margin: 0; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: #f8d9aa; opacity: 0.7;
}

.ct-req-title {
  margin: 0; font-size: 1.35rem; font-weight: 900; color: #f8fafc; line-height: 1.2;
}

.ct-req-meta {
  display: grid; gap: 0.75rem; margin: 0;
  padding: 1rem; border-radius: 12px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
}
.ct-req-meta div { display: grid; gap: 0.2rem; }
.ct-req-meta dt {
  font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.07em; color: rgba(255,255,255,0.4);
}
.ct-req-meta dd { margin: 0; font-size: 0.9rem; font-weight: 600; color: #f1f5f9; }

.ct-req-link { color: #f8d9aa; text-decoration: underline; text-underline-offset: 2px; }
.ct-req-link:hover { color: #fde9c5; }

.ct-req-notice {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem; border-radius: 10px;
  font-size: 0.85rem; font-weight: 600;
}
.ct-req-notice--warn { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); }
.ct-req-notice--error { background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }

.ct-req-cta {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.9rem; border: none; border-radius: 14px;
  background: #f8d9aa; color: #1a1008;
  font: inherit; font-size: 0.95rem; font-weight: 800;
  cursor: pointer; transition: all 0.2s ease;
}
.ct-req-cta:hover:not(:disabled) { background: #fde9c5; transform: translateY(-1px); }
.ct-req-cta:disabled { opacity: 0.45; cursor: not-allowed; }

[data-theme="light"] .ct-req-modal {
  background: #fff; border-color: #e2e8f0; box-shadow: 0 32px 80px rgba(15,23,42,0.18);
}
[data-theme="light"] .ct-req-title { color: #0f172a; }
[data-theme="light"] .ct-req-meta { background: #f8fafc; border-color: #e2e8f0; }
[data-theme="light"] .ct-req-meta dt { color: #94a3b8; }
[data-theme="light"] .ct-req-meta dd { color: #0f172a; }
[data-theme="light"] .ct-close-btn { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
[data-theme="light"] .ct-close-btn--hard:hover { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
[data-theme="light"] .ct-req-badge { background: #fff7ed; color: #c2742a; }

/* ── Minimized Floating Bubble Shortcut ──────────────────────────────────── */
.ct-floating-bubble {
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  z-index: 9000;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  background: rgba(13, 13, 13, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(248, 217, 170, 0.3);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
  color: #f8d9aa;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  animation: ct-bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.ct-floating-bubble:hover {
  transform: translateY(-2px) scale(1.03);
  border-color: rgba(248, 217, 170, 0.6);
  background: rgba(26, 16, 8, 0.95);
}

.ct-floating-bubble__icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
}

.ct-floating-bubble__icon svg {
  width: 100%;
  height: 100%;
}

.ct-floating-bubble__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6; /* Blue dot to distinguish incoming request vs active green chat */
  box-shadow: 0 0 8px #3b82f6;
  animation: ct-pulse 2s infinite ease-in-out;
}

@keyframes ct-bubble-pop {
  from { opacity: 0; transform: scale(0.8) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes ct-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: 0.6; }
}

/* ── Transitions for Smooth Hide/Restore ─────────────────────────────────── */
.ct-fade-enter-active,
.ct-fade-leave-active {
  transition: opacity 0.25s ease;
}
.ct-fade-enter-active .ct-req-modal,
.ct-fade-leave-active .ct-req-modal {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ct-fade-enter-from,
.ct-fade-leave-to {
  opacity: 0;
}
.ct-fade-leave-to .ct-req-modal {
  transform: scale(0.92) translateY(20px);
}

.ct-bubble-fade-enter-active,
.ct-bubble-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ct-bubble-fade-enter-from,
.ct-bubble-fade-leave-to {
  opacity: 0;
  transform: scale(0.7) translateY(15px);
}
</style>
