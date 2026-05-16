<script setup>
/**
 * ClientTalkArchiveView.vue
 * Admin-only archive for Client Talk sessions.
 *
 * The page is intentionally optimized for review work: fast scanning on the left,
 * transcript detail on the right, and destructive delete hidden behind confirmation.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { api } from '../../services/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Sessions' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'ended', label: 'Ended' },
];

const ROW_OPTIONS = [
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 20, label: '20' },
];

const searchDraft = ref('');
const search = ref('');
const statusFilter = ref('all');
const page = ref(1);
const perPage = ref(12);

const sessions = ref([]);
const meta = ref({ total: 0, statusCounts: { pending: 0, active: 0, ended: 0 } });
const loading = ref(false);
const deleting = ref(false);
const error = ref('');

const selected = ref(null);
const detailLoading = ref(false);
const confirmDelete = ref(null);

const totalPages = computed(() => Math.max(1, Math.ceil((meta.value.total || 0) / perPage.value)));
const statusCounts = computed(() => meta.value.statusCounts || { pending: 0, active: 0, ended: 0 });
const activeTotal = computed(() => Number(statusCounts.value.active || 0));
const pendingTotal = computed(() => Number(statusCounts.value.pending || 0));
const endedTotal = computed(() => Number(statusCounts.value.ended || 0));

function statusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status || 'Unknown';
}

function statusTone(status) {
  return {
    pending: 'is-pending',
    active: 'is-active',
    ended: 'is-ended',
  }[status] || 'is-muted';
}

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function initials(name) {
  return (name || 'C')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';
}

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

async function loadSessions() {
  loading.value = true;
  error.value = '';

  try {
    const params = new URLSearchParams({
      page: String(page.value),
      perPage: String(perPage.value),
      status: statusFilter.value,
    });

    if (search.value.trim()) {
      params.set('search', search.value.trim());
    }

    const response = await api.get(`/api/admin/client-talk/archive?${params}`);
    sessions.value = response.data || [];
    meta.value = response.meta || { total: 0, statusCounts: { pending: 0, active: 0, ended: 0 } };

    if (selected.value && !sessions.value.some((session) => Number(session.id) === Number(selected.value.id))) {
      selected.value = null;
    }
  } catch (err) {
    error.value = err.message || 'Failed to load Client Talk archive';
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  search.value = searchDraft.value.trim();
  page.value = 1;
  loadSessions();
}

function clearSearch() {
  searchDraft.value = '';
  search.value = '';
  page.value = 1;
  loadSessions();
}

async function selectSession(session) {
  if (selected.value?.id === session.id) return;

  detailLoading.value = true;
  error.value = '';

  try {
    const response = await api.get(`/api/admin/client-talk/archive/${session.id}`);
    selected.value = response.data;
  } catch (err) {
    error.value = err.message || 'Failed to load conversation';
  } finally {
    detailLoading.value = false;
  }
}

function openDelete(session) {
  confirmDelete.value = session;
}

async function deleteSession() {
  if (!confirmDelete.value?.id) return;

  deleting.value = true;
  error.value = '';

  try {
    await api.delete(`/api/admin/client-talk/archive/${confirmDelete.value.id}`);
    if (selected.value?.id === confirmDelete.value.id) {
      selected.value = null;
    }
    confirmDelete.value = null;
    await loadSessions();
  } catch (err) {
    error.value = err.message || 'Failed to delete conversation';
  } finally {
    deleting.value = false;
  }
}

function changePage(nextPage) {
  page.value = Math.min(Math.max(1, nextPage), totalPages.value);
  loadSessions();
}

watch(statusFilter, () => {
  page.value = 1;
  loadSessions();
});

watch(perPage, () => {
  page.value = 1;
  loadSessions();
});

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lightboxSrc = ref('');
const lightboxVisible = ref(false);

function openLightbox(url) {
  lightboxSrc.value = url;
  lightboxVisible.value = true;
}

function closeLightbox() {
  lightboxVisible.value = false;
  lightboxSrc.value = '';
}

onMounted(loadSessions);
</script>

<template>
  <section class="client-talk-page">
    <header class="client-talk-hero">
      <div>
        <p class="client-talk-kicker">Client Talk Archive</p>
        <h2>Conversations</h2>
        <span>Review every order-linked Client Talk session, transcript, owner, and status.</span>
      </div>
      <button class="client-talk-button client-talk-button--soft" type="button" :disabled="loading" @click="loadSessions">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a9 9 0 0 1-15.6 6" />
          <path d="M3 12a9 9 0 0 1 15.6-6" />
          <path d="M3 3v6h6" />
          <path d="M21 21v-6h-6" />
        </svg>
        Refresh
      </button>
    </header>

    <div class="client-talk-stats" aria-label="Client Talk summary">
      <article class="client-talk-stat">
        <span>Total</span>
        <strong>{{ meta.total || 0 }}</strong>
      </article>
      <article class="client-talk-stat">
        <span>Active</span>
        <strong>{{ activeTotal }}</strong>
      </article>
      <article class="client-talk-stat">
        <span>Pending</span>
        <strong>{{ pendingTotal }}</strong>
      </article>
      <article class="client-talk-stat">
        <span>Ended</span>
        <strong>{{ endedTotal }}</strong>
      </article>
    </div>

    <section class="client-talk-shell">
      <div class="client-talk-toolbar">
        <form class="client-talk-search" @submit.prevent="applySearch">
          <label for="client-talk-search">Search</label>
          <div class="client-talk-search__field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="client-talk-search"
              v-model="searchDraft"
              type="search"
              placeholder="Search by client or order..."
            />
            <button v-if="searchDraft" type="button" aria-label="Clear search" @click="clearSearch">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </form>

        <div class="client-talk-toolbar__actions">
          <label class="client-talk-select">
            <span>Status</span>
            <AdminSelect
              v-model="statusFilter"
              :options="STATUS_OPTIONS"
              required
              teleport
              placeholder="All Sessions"
            />
          </label>
          <label class="client-talk-select client-talk-select--compact">
            <span>Rows</span>
            <AdminSelect
              v-model="perPage"
              :options="ROW_OPTIONS"
              required
              teleport
              placeholder="Rows"
            />
          </label>
          <button class="client-talk-button" type="button" :disabled="loading" @click="applySearch">Search</button>
        </div>
      </div>

      <p v-if="error" class="client-talk-alert">{{ error }}</p>

      <div class="client-talk-grid">
        <section class="client-talk-list" aria-label="Conversation sessions">
          <div class="client-talk-list__head">
            <div>
              <p>Sessions</p>
              <span>{{ meta.total || 0 }} matching conversations</span>
            </div>
          </div>

          <div v-if="loading" class="client-talk-state">
            <span class="client-talk-spinner"></span>
            Loading conversations...
          </div>

          <div v-else-if="!sessions.length" class="client-talk-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <strong>No conversations found</strong>
            <span>Try changing the search or status filter.</span>
          </div>

          <div v-else class="client-talk-cards">
            <article
              v-for="session in sessions"
              :key="session.id"
              class="client-talk-card"
              :class="{ 'client-talk-card--selected': selected?.id === session.id }"
              role="button"
              tabindex="0"
              @click="selectSession(session)"
              @keydown.enter.prevent="selectSession(session)"
              @keydown.space.prevent="selectSession(session)"
            >
              <div class="client-talk-card__top">
                <span class="client-talk-avatar">{{ initials(session.userName) }}</span>
                <div>
                  <h3>{{ session.userName || 'Client' }}</h3>
                  <p>{{ session.userEmail || 'No email available' }}</p>
                </div>
                <span :class="['client-talk-badge', statusTone(session.status)]">{{ statusLabel(session.status) }}</span>
              </div>

              <div class="client-talk-card__order">
                <span>Order</span>
                <strong>{{ session.orderName || `Order #${session.orderId}` }}</strong>
              </div>

              <dl class="client-talk-card__meta">
                <div>
                  <dt>Assigned</dt>
                  <dd>{{ session.assignedName || 'Unassigned' }}</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>{{ formatDate(session.requestedAt) }}</dd>
                </div>
              </dl>

              <div class="client-talk-card__actions">
                <button type="button" @click.stop="selectSession(session)">View Transcript</button>
                <button class="is-danger" type="button" @click.stop="openDelete(session)">Delete</button>
              </div>
            </article>
          </div>

          <footer v-if="sessions.length" class="client-talk-pagination">
            <button type="button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Prev</button>
            <span>Page {{ page }} of {{ totalPages }}</span>
            <button type="button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">Next</button>
          </footer>
        </section>

      </div>
    </section>

    <Teleport to="body">
      <Transition name="client-talk-modal">
        <div
          v-if="detailLoading || selected"
          class="client-talk-transcript-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Conversation transcript"
          @click.self="!detailLoading && (selected = null)"
        >
          <aside class="client-talk-detail" aria-label="Conversation transcript">
            <div v-if="detailLoading" class="client-talk-state client-talk-state--detail">
              <span class="client-talk-spinner"></span>
              Opening transcript...
            </div>

            <template v-else-if="selected">
              <header class="client-talk-detail__header">
                <div>
                  <p class="client-talk-kicker">Session #{{ selected.id }}</p>
                  <h3>{{ selected.userName || 'Client' }}</h3>
                  <RouterLink :to="`/admin/user-orders/${selected.orderId}`">
                    {{ selected.orderName || `Order #${selected.orderId}` }}
                  </RouterLink>
                </div>
                <div class="client-talk-detail__actions">
                  <button class="client-talk-icon-button is-danger" type="button" title="Delete conversation" @click="openDelete(selected)">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="m19 6-1 15H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                  <button class="client-talk-icon-button" type="button" title="Close transcript" @click="selected = null">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </header>

              <div class="client-talk-detail__meta">
                <article>
                  <span>Status</span>
                  <strong :class="['client-talk-badge', statusTone(selected.status)]">{{ statusLabel(selected.status) }}</strong>
                </article>
                <article>
                  <span>Assigned To</span>
                  <strong>{{ selected.assignedName || 'Unassigned' }}</strong>
                </article>
                <article>
                  <span>Requested</span>
                  <strong>{{ formatDate(selected.requestedAt) }}</strong>
                </article>
                <article>
                  <span>Last Message</span>
                  <strong>{{ formatDate(selected.lastMessageAt || selected.acceptedAt || selected.requestedAt) }}</strong>
                </article>
              </div>

              <div class="client-talk-transcript">
                <div v-if="!selected.messages?.length" class="client-talk-empty client-talk-empty--small">
                  <strong>No messages yet</strong>
                  <span>This session has no transcript.</span>
                </div>

                <article
                  v-for="message in selected.messages"
                  :key="message.id"
                  class="client-talk-message"
                  :class="{ 'client-talk-message--client': Number(message.senderId) === Number(selected.userId) }"
                >
                  <div class="client-talk-message__bubble">
                    <div class="client-talk-message__meta">
                      <strong>{{ message.senderName || 'Team' }}</strong>
                      <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
                    </div>

                    <!-- Image message -->
                    <template v-if="message.messageType === 'image' && message.attachmentUrl">
                      <button
                        class="archive-msg-image-btn"
                        type="button"
                        :title="message.attachmentName || 'View image'"
                        @click="openLightbox(message.attachmentUrl)"
                      >
                        <img
                          :src="message.attachmentUrl"
                          :alt="message.attachmentName || 'Chat image'"
                          class="archive-msg-image-thumb"
                          loading="lazy"
                        />
                        <span class="archive-msg-image-zoom" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
                        </span>
                      </button>
                      <p v-if="message.body" class="archive-msg-caption">{{ message.body }}</p>
                    </template>

                    <!-- Text message -->
                    <p v-else>
                      <template v-for="(segment, index) in linkifySegments(message.body)" :key="index">
                        <a
                          v-if="segment.type === 'link'"
                          :href="segment.value"
                          target="_blank"
                          rel="noopener noreferrer"
                        >{{ segment.value }}</a>
                        <span v-else>{{ segment.value }}</span>
                      </template>
                    </p>
                  </div>
                </article>
              </div>
            </template>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="client-talk-modal">
        <div v-if="confirmDelete" class="client-talk-confirm" role="dialog" aria-modal="true" aria-label="Delete conversation">
          <div class="client-talk-confirm__panel">
            <span class="client-talk-confirm__icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 15H6L5 6" />
              </svg>
            </span>
            <div>
              <p class="client-talk-kicker">Permanent Action</p>
              <h3>Delete conversation?</h3>
              <span>
                This will remove the archived transcript for
                <strong>{{ confirmDelete.userName || 'this client' }}</strong>.
              </span>
            </div>
            <footer>
              <button class="client-talk-button client-talk-button--soft" type="button" :disabled="deleting" @click="confirmDelete = null">
                Cancel
              </button>
              <button class="client-talk-button client-talk-button--danger" type="button" :disabled="deleting" @click="deleteSession">
                {{ deleting ? 'Deleting...' : 'Delete Conversation' }}
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Image Lightbox ── -->
    <Teleport to="body">
      <Transition name="client-talk-modal">
        <div
          v-if="lightboxVisible"
          class="archive-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          @click.self="closeLightbox"
          @keydown.escape="closeLightbox"
        >
          <button class="archive-lightbox__close" type="button" aria-label="Close" @click="closeLightbox">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img :src="lightboxSrc" alt="Full size image" class="archive-lightbox__img" />
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style>
.client-talk-page {
  width: min(100%, 1760px);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 1.75rem);
  display: grid;
  gap: 1rem;
  color: var(--color-text);
}

.client-talk-page *,
.client-talk-page *::before,
.client-talk-page *::after {
  box-sizing: border-box;
}

.client-talk-hero,
.client-talk-shell,
.client-talk-stat,
.client-talk-card,
.client-talk-detail,
.client-talk-confirm__panel {
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  background:
    radial-gradient(circle at top right, rgba(248, 217, 170, 0.08), transparent 34%),
    rgba(var(--rgb-foreground), 0.035);
  box-shadow: 0 18px 50px rgba(var(--rgb-background), 0.22);
}

.client-talk-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  border-radius: 8px;
}

.client-talk-kicker {
  margin: 0;
  color: rgba(var(--rgb-foreground), 0.55);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.client-talk-hero h2,
.client-talk-detail__header h3,
.client-talk-confirm__panel h3 {
  margin: 0.22rem 0;
  color: var(--color-text-strong);
  font-size: clamp(1.65rem, 3vw, 2.35rem);
  line-height: 1;
}

.client-talk-hero span,
.client-talk-confirm__panel span {
  color: rgba(var(--rgb-foreground), 0.62);
  font-size: 0.95rem;
}

.client-talk-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.client-talk-stat {
  min-height: 105px;
  border-radius: 8px;
  padding: 1rem;
  display: grid;
  align-content: space-between;
}

.client-talk-stat span {
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.client-talk-stat strong {
  color: var(--color-text-strong);
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
}

.client-talk-shell {
  border-radius: 8px;
  overflow: hidden;
}

.client-talk-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-search {
  display: grid;
  gap: 0.45rem;
}

.client-talk-search label,
.client-talk-select span {
  color: rgba(var(--rgb-foreground), 0.56);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.client-talk-search__field {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 0.65rem;
  min-height: 56px;
  padding: 0 0.9rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.14);
  border-radius: 8px;
  background: rgba(var(--rgb-background), 0.52);
}

.client-talk-search__field svg,
.client-talk-button svg,
.client-talk-icon-button svg,
.client-talk-empty svg,
.client-talk-confirm__icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.client-talk-search__field input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-text-strong);
  font: inherit;
  font-size: 1rem;
  font-weight: 750;
  outline: none;
}

.client-talk-search__field input::placeholder {
  color: rgba(var(--rgb-foreground), 0.42);
}

.client-talk-search__field button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.08);
  color: rgba(var(--rgb-foreground), 0.62);
  cursor: pointer;
}

.client-talk-toolbar__actions {
  display: flex;
  align-items: end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.client-talk-select {
  display: grid;
  gap: 0.45rem;
  min-width: 170px;
}

.client-talk-select--compact {
  min-width: 96px;
}

.client-talk-select .admin-select-wrapper {
  width: 100%;
}

.client-talk-select .admin-select-display {
  min-height: 56px;
  border-color: rgba(var(--rgb-foreground), 0.14);
  background: rgba(var(--rgb-background), 0.52);
  color: var(--color-text-strong);
}

.client-talk-select .admin-select-text {
  font-size: 1rem;
  font-weight: 900;
}

.client-talk-button,
.client-talk-icon-button {
  border: 1px solid rgba(248, 217, 170, 0.28);
  border-radius: 8px;
  background: #f8d9aa;
  color: #17110a;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.client-talk-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 56px;
  padding: 0 1.25rem;
  white-space: nowrap;
}

.client-talk-button:hover:not(:disabled),
.client-talk-icon-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #ffe5bc;
}

.client-talk-button:disabled,
.client-talk-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.client-talk-button--soft {
  background: rgba(var(--rgb-foreground), 0.055);
  border-color: rgba(var(--rgb-foreground), 0.12);
  color: var(--color-text-strong);
}

.client-talk-button--danger {
  background: #ef4444;
  border-color: rgba(239, 68, 68, 0.5);
  color: #fff;
}

.client-talk-button--danger:hover:not(:disabled) {
  background: #dc2626;
}

.client-talk-alert {
  margin: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
  font-weight: 800;
}

.client-talk-grid {
  display: block;
  min-height: 520px;
}

.client-talk-list {
  min-width: 0;
}

.client-talk-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-list__head p {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 1rem;
  font-weight: 900;
}

.client-talk-list__head span {
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.82rem;
  font-weight: 750;
}

.client-talk-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem;
}

.client-talk-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.client-talk-card:hover,
.client-talk-card:focus-visible,
.client-talk-card--selected {
  border-color: rgba(248, 217, 170, 0.42);
  background:
    radial-gradient(circle at top right, rgba(248, 217, 170, 0.12), transparent 34%),
    rgba(248, 217, 170, 0.045);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  transform: translateY(-2px);
  outline: none;
}

.client-talk-card__top {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
}

.client-talk-avatar {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
  font-weight: 950;
}

.client-talk-card h3 {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 1rem;
}

.client-talk-card p,
.client-talk-card__order span,
.client-talk-card__meta dt {
  margin: 0;
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.78rem;
  font-weight: 800;
}

.client-talk-card__order {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 8px;
  background: rgba(var(--rgb-background), 0.32);
}

.client-talk-card__order strong,
.client-talk-card__meta dd {
  margin: 0;
  color: var(--color-text-strong);
  font-weight: 900;
}

.client-talk-card__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0;
}

.client-talk-card__meta div {
  min-width: 0;
}

.client-talk-card__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-card__actions button {
  border: 0;
  background: transparent;
  color: #f8d9aa;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;
}

.client-talk-card__actions .is-danger {
  color: #fca5a5;
}

.client-talk-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 0.65rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.client-talk-badge.is-pending {
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

.client-talk-badge.is-active {
  border-color: rgba(16, 185, 129, 0.28);
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.client-talk-badge.is-ended {
  border-color: rgba(var(--rgb-foreground), 0.12);
  background: rgba(var(--rgb-foreground), 0.07);
  color: rgba(var(--rgb-foreground), 0.64);
}

.client-talk-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-pagination span {
  color: rgba(var(--rgb-foreground), 0.58);
  font-weight: 800;
}

.client-talk-pagination button {
  min-width: 86px;
  min-height: 40px;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.045);
  color: var(--color-text-strong);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.client-talk-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.client-talk-transcript-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(12px);
}

.client-talk-detail {
  display: flex;
  width: min(1040px, calc(100vw - 2rem));
  max-height: min(860px, calc(100vh - 2rem));
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
}

.client-talk-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-detail__header h3 {
  font-size: 1.45rem;
}

.client-talk-detail__header a {
  color: #f8d9aa;
  font-weight: 900;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.client-talk-detail__actions {
  display: inline-flex;
  gap: 0.55rem;
}

.client-talk-icon-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  padding: 0;
  background: rgba(var(--rgb-foreground), 0.05);
  color: var(--color-text-strong);
}

.client-talk-icon-button.is-danger {
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
}

.client-talk-detail__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.client-talk-detail__meta article {
  display: grid;
  gap: 0.35rem;
  min-height: 76px;
  align-content: center;
  padding: 0.75rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.035);
}

.client-talk-detail__meta span {
  color: rgba(var(--rgb-foreground), 0.48);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.client-talk-detail__meta strong {
  color: var(--color-text-strong);
  font-size: 0.88rem;
}

.client-talk-transcript {
  display: flex;
  flex: 1;
  min-height: 360px;
  max-height: 58vh;
  flex-direction: column;
  gap: 0.8rem;
  overflow-y: auto;
  padding: 1rem;
}

.client-talk-message {
  display: flex;
  justify-content: flex-start;
}

.client-talk-message--client {
  justify-content: flex-end;
}

.client-talk-message__bubble {
  width: min(86%, 560px);
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  background: rgba(var(--rgb-foreground), 0.06);
}

.client-talk-message--client .client-talk-message__bubble {
  border-bottom-right-radius: 4px;
  border-bottom-left-radius: 16px;
  border-color: rgba(248, 217, 170, 0.18);
  background: rgba(248, 217, 170, 0.105);
}

.client-talk-message__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.client-talk-message__meta strong {
  color: var(--color-text-strong);
  font-size: 0.82rem;
}

.client-talk-message__meta time {
  color: rgba(var(--rgb-foreground), 0.42);
  font-size: 0.7rem;
  font-weight: 800;
}

.client-talk-message p {
  margin: 0;
  color: rgba(var(--rgb-foreground), 0.82);
  font-size: 0.93rem;
  line-height: 1.58;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.client-talk-message a {
  color: #93c5fd;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.client-talk-empty,
.client-talk-state,
.client-talk-detail__empty {
  display: grid;
  place-items: center;
  gap: 0.55rem;
  padding: 3rem 1rem;
  color: rgba(var(--rgb-foreground), 0.55);
  text-align: center;
}

.client-talk-detail__empty {
  min-height: 520px;
  align-content: center;
}

.client-talk-empty--small {
  padding: 2rem 1rem;
}

.client-talk-empty svg,
.client-talk-detail__empty svg {
  width: 48px;
  height: 48px;
  color: rgba(var(--rgb-foreground), 0.28);
}

.client-talk-empty strong,
.client-talk-detail__empty strong {
  color: var(--color-text-strong);
  font-size: 1rem;
}

.client-talk-empty span,
.client-talk-detail__empty span {
  max-width: 34ch;
  color: rgba(var(--rgb-foreground), 0.52);
}

.client-talk-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(248, 217, 170, 0.18);
  border-top-color: #f8d9aa;
  border-radius: 999px;
  animation: client-talk-spin 0.8s linear infinite;
}

@keyframes client-talk-spin {
  to { transform: rotate(360deg); }
}

.client-talk-confirm {
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(5px);
}

.client-talk-confirm__panel {
  width: min(480px, calc(100vw - 2rem));
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 8px;
}

.client-talk-confirm__icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

.client-talk-confirm__panel h3 {
  font-size: 1.45rem;
}

.client-talk-confirm__panel footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.client-talk-modal-enter-active,
.client-talk-modal-leave-active {
  transition: opacity 0.24s ease;
}

.client-talk-modal-enter-from,
.client-talk-modal-leave-to {
  opacity: 0;
}

.client-talk-modal-enter-active .client-talk-detail,
.client-talk-modal-leave-active .client-talk-detail,
.client-talk-modal-enter-active .client-talk-confirm__panel,
.client-talk-modal-leave-active .client-talk-confirm__panel {
  transition:
    transform 0.24s cubic-bezier(0.2, 0.9, 0.2, 1),
    opacity 0.24s ease;
}

.client-talk-modal-enter-from .client-talk-detail,
.client-talk-modal-leave-to .client-talk-detail,
.client-talk-modal-enter-from .client-talk-confirm__panel,
.client-talk-modal-leave-to .client-talk-confirm__panel {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}

[data-theme="light"] .client-talk-hero,
[data-theme="light"] .client-talk-shell,
[data-theme="light"] .client-talk-stat,
[data-theme="light"] .client-talk-card,
[data-theme="light"] .client-talk-detail,
[data-theme="light"] .client-talk-confirm__panel {
  background:
    radial-gradient(circle at top right, rgba(194, 116, 42, 0.09), transparent 34%),
    #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

[data-theme="light"] .client-talk-search__field,
[data-theme="light"] .client-talk-select select,
[data-theme="light"] .client-talk-card__order,
[data-theme="light"] .client-talk-detail__meta article,
[data-theme="light"] .client-talk-message__bubble {
  background: #f8fafc;
  border-color: #e2e8f0;
}

[data-theme="light"] .client-talk-card:hover,
[data-theme="light"] .client-talk-card--selected,
[data-theme="light"] .client-talk-message--client .client-talk-message__bubble {
  background: #fff7ed;
  border-color: #fed7aa;
}

[data-theme="light"] .client-talk-button--soft,
[data-theme="light"] .client-talk-icon-button,
[data-theme="light"] .client-talk-select .admin-select-display {
  background: #ffffff;
  border-color: #e2e8f0;
}

[data-theme="light"] .client-talk-badge.is-ended {
  background: #f1f5f9;
  color: #475569;
}

@media (max-width: 1180px) {
  .client-talk-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .client-talk-detail {
    width: min(920px, calc(100vw - 2rem));
  }

  .client-talk-transcript {
    max-height: 60vh;
  }
}

@media (max-width: 900px) {
  .client-talk-transcript {
    max-height: 56vh;
  }
}

@media (max-width: 780px) {
  .client-talk-hero,
  .client-talk-toolbar {
    grid-template-columns: 1fr;
  }

  .client-talk-hero {
    display: grid;
  }

  .client-talk-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .client-talk-toolbar__actions {
    display: grid;
    grid-template-columns: 1fr 0.55fr;
  }

  .client-talk-toolbar__actions .client-talk-button {
    grid-column: 1 / -1;
  }

  .client-talk-select,
  .client-talk-select--compact {
    min-width: 0;
  }

  .client-talk-detail__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .client-talk-cards {
    grid-template-columns: 1fr;
  }

  .client-talk-transcript-modal {
    align-items: end;
    padding: 0;
  }

  .client-talk-detail {
    width: 100%;
    max-height: 92vh;
    border-radius: 12px 12px 0 0;
  }
}

@media (max-width: 560px) {
  .client-talk-stats,
  .client-talk-toolbar__actions,
  .client-talk-detail__meta,
  .client-talk-card__meta {
    grid-template-columns: 1fr;
  }

  .client-talk-card__top {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .client-talk-card__top .client-talk-badge {
    grid-column: 1 / -1;
  }

  .client-talk-message__bubble {
    width: 100%;
  }
}

/* ── Archive Image Messages ─────────────────────────────────────────────── */
.archive-msg-image-btn {
  position: relative;
  display: block;
  padding: 0;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  cursor: zoom-in;
  background: rgba(var(--rgb-foreground), 0.04);
  max-width: 260px;
  width: 100%;
}

.archive-msg-image-thumb {
  display: block;
  width: 100%;
  max-width: 260px;
  max-height: 200px;
  object-fit: cover;
  border-radius: 10px;
  transition: filter 0.2s ease;
}

.archive-msg-image-btn:hover .archive-msg-image-thumb {
  filter: brightness(0.75);
}

.archive-msg-image-zoom {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.25);
}

.archive-msg-image-btn:hover .archive-msg-image-zoom {
  opacity: 1;
}

.archive-msg-caption {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  color: rgba(var(--rgb-foreground), 0.75);
  font-style: italic;
  word-break: break-word;
}

/* ── Lightbox ──────────────────────────────────────────────────────────── */
.archive-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 2rem;
  cursor: zoom-out;
}

.archive-lightbox__img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.7);
  object-fit: contain;
  cursor: default;
}

.archive-lightbox__close {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s ease;
  z-index: 100000;
}

.archive-lightbox__close:hover {
  background: rgba(255, 255, 255, 0.22);
}
</style>
