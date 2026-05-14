<script setup>
/**
 * ClientTalkModal.vue
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-lifecycle modal for the user-facing Client Talk feature.
 *
 * States:
 *   loading   → Initial fetch in progress
 *   active    → Live conversation, even before the other participant opens it
 *   active    → Live conversation
 *   ended     → Conversation closed
 *   error     → Something went wrong
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useClientTalk } from '../composables/useClientTalk';
import { authState } from '../stores/authStore';

const props = defineProps({
  orderId:        { type: [Number, String], required: true },
  orderName:      { type: String, default: '' },
  // Optional: pre-populated session (used by admin after accepting — avoids user-only endpoint)
  initialSession: { type: Object, default: null },
  initialMinimized: { type: Boolean, default: false },
  initialUnread: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'ended', 'opened']);

const messageInput = ref('');
const messagesEl   = ref(null);
const inputEl      = ref(null);
const hasUnread    = ref(Boolean(props.initialUnread));
const unreadTrackingReady = ref(false);

const {
  session, messages, status, loading, sending, ending, error,
  fetchSession, requestTalk, sendMessage, endSession,
  subscribeToSession, fetchMessages,
} = useClientTalk(props.orderId);

const chatStatus = computed(() => (status.value === 'pending' ? 'active' : status.value));

// ── Linkify: convert plain-text URLs to safe anchor tags ──────────────────
function linkifySegments(text) {
  if (!text) return [{ type: 'text', value: '' }];
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return parts;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// Auto-scroll to bottom when messages change
async function scrollToBottom() {
  await nextTick();
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

watch(messages, (next, previous) => {
  const latest = next[next.length - 1];
  const previousLength = previous?.length || 0;

  if (
    latest
    && next.length > previousLength
    && unreadTrackingReady.value
    && minimized.value
    && Number(latest.senderId) !== Number(currentUserId.value)
  ) {
    hasUnread.value = true;
  }

  scrollToBottom();
}, { deep: true });

// Submit handler
async function handleSend() {
  const text = messageInput.value.trim();
  if (!text || sending.value) return;
  messageInput.value = '';
  await sendMessage(text);
  inputEl.value?.focus();
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

// Prevent body scroll while modal is open
onMounted(async () => {
  document.body.style.overflow = minimized.value ? '' : 'hidden';

  if (props.initialSession) {
    // Admin path: session already accepted, skip user-only fetchSession
    session.value = props.initialSession;
    await subscribeToSession(props.initialSession.id);
    if (['pending', 'active', 'ended'].includes(props.initialSession.status)) {
      await fetchMessages();
      await scrollToBottom();
    }
    unreadTrackingReady.value = true;
    return;
  }

  // User path: fetch or create session
  await fetchSession();
  if (!session.value) {
    await requestTalk();
    if (['pending', 'active'].includes(session.value?.status)) {
      await scrollToBottom();
      inputEl.value?.focus();
    }
  } else if (['pending', 'active'].includes(session.value.status)) {
    await scrollToBottom();
  }
  unreadTrackingReady.value = true;
});

onUnmounted(() => {
  document.body.style.overflow = '';
});

// Minimized state to allow hiding chat window without disconnecting
const minimized = ref(Boolean(props.initialMinimized));

watch(() => props.initialUnread, (value) => {
  if (value && minimized.value) hasUnread.value = true;
});

watch(minimized, (val) => {
  document.body.style.overflow = val ? '' : 'hidden';
  if (!val) {
    hasUnread.value = false;
    emit('opened', session.value);
  }
});

// Minimize on Escape key instead of closing
function handleEscape(e) {
  if (e.key === 'Escape') minimized.value = true;
}
onMounted(() => document.addEventListener('keydown', handleEscape));
onUnmounted(() => document.removeEventListener('keydown', handleEscape));

const canSend = computed(() =>
  chatStatus.value === 'active' && messageInput.value.trim().length > 0 && !sending.value
);
const currentUserId = computed(() => authState.user?.id || null);

// Automatically close the modal when the session ends
watch(status, (newStatus) => {
  if (newStatus === 'ended') {
    emit('ended', session.value);
    emit('close');
  }
});
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="ct-fade">
      <div v-show="!minimized" class="ct-backdrop" role="dialog" aria-modal="true" aria-label="Client Talk">
        <!-- Modal shell -->
        <div class="ct-modal">

        <!-- ── Header ─────────────────────────────────────────────────── -->
        <header class="ct-header">
          <div class="ct-header__info">
            <div class="ct-header__avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <p class="ct-header__title">Client Talk</p>
              <p class="ct-header__sub">{{ orderName || `Order #${orderId}` }}</p>
            </div>
          </div>
          <div class="ct-header__actions">
            <!-- End button — only when active -->
            <button
              v-if="chatStatus === 'active'"
              class="ct-btn ct-btn--danger"
              :disabled="ending"
              title="End conversation"
              @click="endSession"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>{{ ending ? 'Ending…' : 'End Chat' }}</span>
            </button>
            <button class="ct-close-btn" type="button" aria-label="Minimize" title="Minimize chat" @click="minimized = true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </header>

        <!-- ── Body ──────────────────────────────────────────────────── -->
        <div class="ct-body">

          <!-- Loading -->
          <div v-if="loading" class="ct-state">
            <div class="ct-spinner" aria-hidden="true"></div>
            <p>Connecting…</p>
          </div>

          <!-- Ended banner -->
          <div v-else-if="chatStatus === 'ended' && !messages.length" class="ct-state">
            <svg class="ct-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <p>Conversation ended.</p>
          </div>

          <!-- Error -->
          <div v-else-if="error && !messages.length" class="ct-state ct-state--error">
            <p>{{ error }}</p>
            <button class="ct-btn ct-btn--secondary" @click="fetchSession">Retry</button>
          </div>

          <!-- Messages -->
          <div v-else ref="messagesEl" class="ct-messages" role="log" aria-live="polite" aria-label="Conversation messages">
            <!-- Ended top banner when there are messages -->
            <div v-if="chatStatus === 'ended'" class="ct-ended-banner">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Conversation ended
            </div>

            <article
              v-for="msg in messages"
              :key="msg.id"
              class="ct-bubble"
              :class="{
                'ct-bubble--self':    msg._pending || Number(msg.senderId) === Number(currentUserId),
                'ct-bubble--pending': msg._pending,
              }"
            >
              <span class="ct-bubble__sender">{{ msg.senderName || 'Team' }}</span>
              <div class="ct-bubble__body">
                <!-- Safe linkified text — no v-html -->
                <template v-for="(seg, i) in linkifySegments(msg.body)" :key="i">
                  <a
                    v-if="seg.type === 'link'"
                    :href="seg.value"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ct-link"
                  >{{ seg.value }}</a>
                  <span v-else>{{ seg.value }}</span>
                </template>
              </div>
              <time class="ct-bubble__time" :datetime="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
            </article>
          </div>
        </div>

        <!-- ── Footer / Input ─────────────────────────────────────────── -->
        <footer v-if="chatStatus === 'active'" class="ct-footer">
          <textarea
            ref="inputEl"
            v-model="messageInput"
            class="ct-input"
            placeholder="Type a message…"
            rows="1"
            maxlength="4000"
            aria-label="Message input"
            @keydown="handleKeydown"
          ></textarea>
          <button
            class="ct-send-btn"
            type="button"
            :disabled="!canSend"
            aria-label="Send message"
            @click="handleSend"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </footer>

        <!-- Ended — read-only note -->
        <footer v-else-if="chatStatus === 'ended'" class="ct-footer ct-footer--ended">
          <p>This conversation has ended.</p>
        </footer>

      </div>
    </div>
    </Transition>

    <!-- Minimized Floating Chat Shortcut Bubble -->
    <Transition name="ct-bubble-fade">
      <button
        v-if="minimized"
        class="ct-floating-bubble"
        type="button"
        aria-label="Restore Client Talk"
        title="Restore Client Talk"
        @click="minimized = false"
      >
        <span class="ct-floating-bubble__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="ct-floating-bubble__text">Client Talk</span>
        <span
          v-if="hasUnread || status === 'active'"
          class="ct-floating-bubble__live-dot"
          :class="{ 'ct-floating-bubble__live-dot--unread': hasUnread }"
        ></span>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.ct-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  animation: ct-fade-in 0.2s ease-out;
}

@keyframes ct-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Modal ────────────────────────────────────────────────────────────────── */
.ct-modal {
  display: flex;
  flex-direction: column;
  width: min(480px, calc(100vw - 2rem));
  height: min(680px, calc(100vh - 2rem));
  border: 1px solid rgba(248, 217, 170, 0.22);
  border-radius: 20px;
  background: #0d0d0d;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  animation: ct-slide-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes ct-slide-up {
  from { opacity: 0; transform: translateY(30px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.ct-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.ct-header__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.ct-header__avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(248, 217, 170, 0.12);
  color: #f8d9aa;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ct-header__avatar svg {
  width: 20px;
  height: 20px;
}

.ct-header__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.2;
}

.ct-header__sub {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ct-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.ct-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border: none;
  border-radius: 10px;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.ct-btn--danger {
  background: rgba(239, 68, 68, 0.14);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.ct-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.24);
  border-color: rgba(239, 68, 68, 0.55);
}

.ct-btn--secondary {
  background: rgba(248, 217, 170, 0.1);
  color: #f8d9aa;
  border: 1px solid rgba(248, 217, 170, 0.25);
}

.ct-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.ct-close-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ct-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.ct-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── State screens ────────────────────────────────────────────────────────── */
.ct-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.9rem;
}

.ct-state__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #f8fafc;
}

.ct-state__sub {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.45);
  max-width: 28ch;
  line-height: 1.6;
}

.ct-state__icon {
  width: 40px;
  height: 40px;
  opacity: 0.4;
}

.ct-state--error { color: #fca5a5; }

/* ── Spinner ──────────────────────────────────────────────────────────────── */
.ct-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(248, 217, 170, 0.15);
  border-top-color: #f8d9aa;
  border-radius: 50%;
  animation: ct-spin 0.7s linear infinite;
}

@keyframes ct-spin { to { transform: rotate(360deg); } }

/* ── Waiting ring animation ───────────────────────────────────────────────── */
.ct-waiting-ring {
  width: 72px;
  height: 72px;
  border: 3px solid rgba(248, 217, 170, 0.15);
  border-top-color: #f8d9aa;
  border-radius: 50%;
  animation: ct-spin 1.2s linear infinite;
  display: grid;
  place-items: center;
}

.ct-waiting-ring__inner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(248, 217, 170, 0.08);
  border-bottom-color: rgba(248, 217, 170, 0.5);
  border-radius: 50%;
  animation: ct-spin 0.8s linear infinite reverse;
}

/* ── Messages list ────────────────────────────────────────────────────────── */
.ct-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;
}

.ct-messages::-webkit-scrollbar { width: 4px; }
.ct-messages::-webkit-scrollbar-track { background: transparent; }
.ct-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

/* ── Ended banner ─────────────────────────────────────────────────────────── */
.ct-ended-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  color: rgba(252, 165, 165, 0.8);
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

/* ── Chat bubbles ─────────────────────────────────────────────────────────── */
.ct-bubble {
  display: flex;
  flex-direction: column;
  max-width: 78%;
  gap: 0.25rem;
  align-self: flex-start;
}

.ct-bubble--self {
  align-self: flex-end;
  align-items: flex-end;
}

.ct-bubble__sender {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  padding: 0 0.35rem;
}

.ct-bubble__body {
  padding: 0.65rem 0.95rem;
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  color: #f1f5f9;
  font-size: 0.9rem;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ct-bubble--self .ct-bubble__body {
  background: rgba(248, 217, 170, 0.14);
  border-color: rgba(248, 217, 170, 0.22);
  color: #fff7ed;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
}

.ct-bubble--pending .ct-bubble__body {
  opacity: 0.6;
}

.ct-bubble__time {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.28);
  padding: 0 0.35rem;
}

/* Linkified URLs inside messages */
.ct-link {
  color: #93c5fd;
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.ct-link:hover { color: #bfdbfe; }

/* ── Footer / input ───────────────────────────────────────────────────────── */
.ct-footer {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.ct-footer--ended {
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.82rem;
}

.ct-footer--ended p { margin: 0; }

.ct-input {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  resize: none;
  padding: 0.55rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  font: inherit;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s ease;
  field-sizing: content;
}

.ct-input::placeholder { color: rgba(255,255,255,0.3); }

.ct-input:focus {
  border-color: rgba(248, 217, 170, 0.4);
  background: rgba(255, 255, 255, 0.07);
}

.ct-send-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: #f8d9aa;
  color: #1a1008;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.ct-send-btn:hover:not(:disabled) {
  background: #fde9c5;
  transform: scale(1.05);
}

.ct-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}

.ct-send-btn svg { width: 17px; height: 17px; }

/* ── Light mode ───────────────────────────────────────────────────────────── */
[data-theme="light"] .ct-modal {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 32px 80px rgba(15, 23, 42, 0.18);
}

[data-theme="light"] .ct-header {
  border-bottom-color: #e2e8f0;
}

[data-theme="light"] .ct-header__title { color: #0f172a; }
[data-theme="light"] .ct-header__sub   { color: #94a3b8; }

[data-theme="light"] .ct-header__avatar {
  background: #fff7ed;
  color: #c2742a;
}

[data-theme="light"] .ct-close-btn {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
}

[data-theme="light"] .ct-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

[data-theme="light"] .ct-state { color: #64748b; }
[data-theme="light"] .ct-state__title { color: #0f172a; }
[data-theme="light"] .ct-state__sub   { color: #94a3b8; }

[data-theme="light"] .ct-bubble__body {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #0f172a;
}

[data-theme="light"] .ct-bubble--self .ct-bubble__body {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #7c2d12;
}

[data-theme="light"] .ct-bubble__sender { color: #94a3b8; }
[data-theme="light"] .ct-bubble__time   { color: #cbd5e1; }

[data-theme="light"] .ct-footer {
  border-top-color: #e2e8f0;
}

[data-theme="light"] .ct-input {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #0f172a;
}

[data-theme="light"] .ct-input:focus {
  border-color: #fed7aa;
  background: #fff;
}

[data-theme="light"] .ct-input::placeholder { color: #94a3b8; }

[data-theme="light"] .ct-footer--ended { color: #94a3b8; }

[data-theme="light"] .ct-waiting-ring {
  border-color: rgba(194, 116, 42, 0.15);
  border-top-color: #c2742a;
}

[data-theme="light"] .ct-waiting-ring__inner {
  border-color: rgba(194, 116, 42, 0.08);
  border-bottom-color: rgba(194, 116, 42, 0.5);
}

/* ── Mobile bottom-sheet ──────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .ct-backdrop {
    align-items: flex-end;
    padding: 0;
    /* Semi-transparent so the user can still see the page behind */
    background: rgba(0, 0, 0, 0.45);
  }

  .ct-modal {
    width: 100%;
    /* Compact height — doesn't cover the full screen.
       Messages area handles its own internal scroll via overflow-y: auto */
    height: min(65svh, 520px);
    border-radius: 20px 20px 0 0;
    border-bottom: none;
    animation: ct-sheet-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes ct-sheet-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  /* Make sure messages scroll internally on this compact height */
  .ct-messages {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    /* Slightly tighter padding on small screens */
    padding: 0.85rem 1rem;
  }

  /* Slightly smaller header on mobile to save space */
  .ct-header {
    padding: 0.75rem 1rem;
  }

  /* Compact footer */
  .ct-footer {
    padding: 0.65rem 0.85rem;
  }
}

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
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: ct-pulse 2s infinite ease-in-out;
}

.ct-floating-bubble__live-dot--unread {
  width: 10px;
  height: 10px;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16), 0 0 12px rgba(239, 68, 68, 0.9);
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
.ct-fade-enter-active .ct-modal,
.ct-fade-leave-active .ct-modal {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ct-fade-enter-from,
.ct-fade-leave-to {
  opacity: 0;
}
.ct-fade-leave-to .ct-modal {
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
