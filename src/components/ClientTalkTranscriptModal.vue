<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  session: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  deleting: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'delete']);

const messages = computed(() => props.session?.messages || []);

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function messageParts(text = '') {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return parts.filter(Boolean).map((part) => ({
    text: part,
    isLink: /^https?:\/\//i.test(part),
  }));
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ct-transcript">
      <div v-if="visible" class="ct-transcript-overlay" @click.self="emit('close')">
        <section class="ct-transcript-modal" role="dialog" aria-modal="true" aria-label="Client Talk transcript">
          <header class="ct-transcript-header">
            <div>
              <p class="ct-transcript-kicker">Transcript</p>
              <h2>{{ session?.orderName || 'Client Talk' }}</h2>
              <span v-if="session">Client: {{ session.userName || 'Client' }} · Staff: {{ session.assignedName || 'Unassigned' }}</span>
            </div>
            <div class="ct-transcript-actions">
              <button
                v-if="canDelete && session?.status === 'ended'"
                class="ct-transcript-delete"
                type="button"
                :disabled="deleting"
                @click="emit('delete', session)"
              >
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
              <button class="ct-transcript-close" type="button" aria-label="Close" @click="emit('close')">
                <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </header>

          <div class="ct-transcript-body">
            <div v-if="loading" class="ct-transcript-state">
              <span class="ct-transcript-spinner"></span>
              <p>Loading transcript...</p>
            </div>

            <div v-else-if="!messages.length" class="ct-transcript-state">
              <strong>No messages saved</strong>
            </div>

            <div v-else class="ct-transcript-messages">
              <article
                v-for="message in messages"
                :key="message.id"
                class="ct-transcript-message"
                :class="{ 'is-client': Number(message.senderId) === Number(session?.userId) }"
              >
                <div class="ct-transcript-bubble">
                  <header>
                    <strong>{{ message.senderName || 'Participant' }}</strong>
                    <time :datetime="message.createdAt">{{ formatDate(message.createdAt) }}</time>
                  </header>
                  <img
                    v-if="message.messageType === 'image' && message.attachmentUrl"
                    class="ct-transcript-image"
                    :src="message.attachmentUrl"
                    :alt="message.attachmentName || 'Chat image'"
                  />
                  <p v-if="message.body">
                    <template v-for="(part, index) in messageParts(message.body)" :key="`${message.id}-${index}`">
                      <a v-if="part.isLink" :href="part.text" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ct-transcript-overlay {
  position: fixed;
  inset: 0;
  z-index: 7100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(10px);
}

.ct-transcript-modal {
  width: min(880px, calc(100vw - 1.5rem));
  height: min(760px, calc(100vh - 1.5rem));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(248, 217, 170, 0.18);
  border-radius: 18px;
  background: #0d0d0d;
  color: #f8fafc;
  box-shadow: 0 34px 100px rgba(0, 0, 0, 0.58);
}

.ct-transcript-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.ct-transcript-kicker {
  margin: 0 0 0.2rem;
  color: rgba(248, 217, 170, 0.72);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ct-transcript-header h2 {
  margin: 0;
  font-size: clamp(1.3rem, 2vw, 1.8rem);
}

.ct-transcript-header span {
  display: block;
  margin-top: 0.25rem;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.86rem;
}

.ct-transcript-actions {
  display: flex;
  align-items: start;
  gap: 0.6rem;
}

.ct-transcript-delete,
.ct-transcript-close {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.ct-transcript-delete {
  padding: 0.7rem 0.95rem;
  color: #fca5a5;
}

.ct-transcript-close {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
}

.ct-transcript-close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.ct-transcript-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}

.ct-transcript-messages {
  display: grid;
  gap: 0.85rem;
}

.ct-transcript-message {
  display: flex;
  justify-content: flex-start;
}

.ct-transcript-message.is-client {
  justify-content: flex-end;
}

.ct-transcript-bubble {
  width: min(620px, 88%);
  padding: 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.ct-transcript-message.is-client .ct-transcript-bubble {
  background: rgba(248, 217, 170, 0.12);
  border-color: rgba(248, 217, 170, 0.18);
}

.ct-transcript-bubble header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.78rem;
}

.ct-transcript-bubble strong {
  color: #fff;
}

.ct-transcript-bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.55;
}

.ct-transcript-bubble a {
  color: #93c5fd;
  text-decoration: underline;
}

.ct-transcript-image {
  display: block;
  max-width: min(420px, 100%);
  max-height: 340px;
  object-fit: contain;
  border-radius: 12px;
  margin-bottom: 0.65rem;
}

.ct-transcript-state {
  min-height: 18rem;
  display: grid;
  place-items: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
}

.ct-transcript-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(248, 217, 170, 0.2);
  border-top-color: #f8d9aa;
  border-radius: 999px;
  animation: ctTranscriptSpin 0.8s linear infinite;
}

@keyframes ctTranscriptSpin { to { transform: rotate(360deg); } }

.ct-transcript-enter-active,
.ct-transcript-leave-active {
  transition: opacity 0.18s ease;
}

.ct-transcript-enter-active .ct-transcript-modal,
.ct-transcript-leave-active .ct-transcript-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.ct-transcript-enter-from,
.ct-transcript-leave-to {
  opacity: 0;
}

.ct-transcript-enter-from .ct-transcript-modal,
.ct-transcript-leave-to .ct-transcript-modal {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

[data-theme="light"] .ct-transcript-overlay {
  background: rgba(15, 23, 42, 0.42);
}

[data-theme="light"] .ct-transcript-modal {
  background: #ffffff;
  color: #0f172a;
  border-color: #e2e8f0;
  box-shadow: 0 34px 100px rgba(15, 23, 42, 0.24);
}

[data-theme="light"] .ct-transcript-header {
  border-bottom-color: #e2e8f0;
}

[data-theme="light"] .ct-transcript-kicker {
  color: #b45309;
}

[data-theme="light"] .ct-transcript-header span,
[data-theme="light"] .ct-transcript-state,
[data-theme="light"] .ct-transcript-bubble header {
  color: #64748b;
}

[data-theme="light"] .ct-transcript-close,
[data-theme="light"] .ct-transcript-delete,
[data-theme="light"] .ct-transcript-bubble {
  background: #f8fafc;
  border-color: #e2e8f0;
}

[data-theme="light"] .ct-transcript-bubble strong {
  color: #0f172a;
}

[data-theme="light"] .ct-transcript-message.is-client .ct-transcript-bubble {
  background: #fff7ed;
  border-color: #fed7aa;
}

@media (max-width: 640px) {
  .ct-transcript-overlay {
    align-items: end;
    padding: 0;
  }

  .ct-transcript-modal {
    width: 100%;
    height: calc(100vh - 1rem);
    border-radius: 18px 18px 0 0;
  }

  .ct-transcript-header {
    align-items: flex-start;
  }

  .ct-transcript-bubble {
    width: 94%;
  }
}
</style>
