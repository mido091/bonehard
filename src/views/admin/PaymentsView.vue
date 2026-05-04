<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from '../../composables/useToast';
import { API_BASE_URL, api } from '../../services/api';

const { showToast } = useToast();

const rows = ref([]);
const meta = ref(null);
const loading = ref(true);
const actionLoading = ref(null);
const error = ref('');
const filters = reactive({ status: '', search: '' });
const reviewNotes = reactive({});
const preview = ref({ open: false, row: null, url: '', loading: false, error: '' });

const totalLabel = computed(() => `${meta.value?.total || rows.value.length} submissions`);
const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';
}

function formatMoney(value) {
  return `EGP ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

function proofUrl(row) {
  return `${API_BASE_URL}/api/admin/chat-payment-submissions/${row.id}/proof`;
}

function isImageProof(row) {
  return String(row?.proofMimeType || '').startsWith('image/');
}

function isPdfProof(row) {
  return String(row?.proofMimeType || '').toLowerCase() === 'application/pdf';
}

async function openProofPreview(row) {
  if (preview.value.url) URL.revokeObjectURL(preview.value.url);
  preview.value = { open: true, row, url: '', loading: true, error: '' };

  try {
    const response = await fetch(proofUrl(row), { credentials: 'include' });
    if (!response.ok) throw new Error('Unable to load payment proof preview');
    const blob = await response.blob();
    preview.value = { open: true, row, url: URL.createObjectURL(blob), loading: false, error: '' };
  } catch (err) {
    preview.value = { open: true, row, url: '', loading: false, error: err.message || 'Unable to load payment proof preview' };
  }
}

function closeProofPreview() {
  if (preview.value.url) URL.revokeObjectURL(preview.value.url);
  preview.value = { open: false, row: null, url: '', loading: false, error: '' };
}

async function setStatusFilter(status) {
  if (filters.status === status) return;
  filters.status = status;
  await loadPayments();
}

async function loadPayments() {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      page: '1',
      perPage: '50',
      status: filters.status,
      search: filters.search,
    });
    const response = await api.get(`/api/admin/chat-payment-submissions?${query}`);
    rows.value = response.data || [];
    meta.value = response.meta;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function review(row, action) {
  actionLoading.value = `${action}-${row.id}`;
  try {
    await api.patch(`/api/admin/chat-payment-submissions/${row.id}/${action}`, {
      reviewNote: reviewNotes[row.id] || '',
    });
    showToast(action === 'approve' ? 'Payment approved' : 'Payment rejected', 'success');
    await loadPayments();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    actionLoading.value = null;
  }
}

onMounted(loadPayments);
</script>

<template>
  <section class="admin-page-stack payments-page">
    <div class="admin-panel">
      <header class="admin-panel-header">
        <div>
          <p class="admin-kicker">Payment Review</p>
          <h2>Chat Plan Payments</h2>
          <span class="admin-muted">{{ totalLabel }}</span>
        </div>
      </header>

      <form class="admin-toolbar payments-toolbar" @submit.prevent="loadPayments">
        <input v-model="filters.search" class="admin-compact-input" type="search" placeholder="Search user, email, or phone" />
        <div class="payments-status-filter" role="group" aria-label="Payment status filter">
          <button
            v-for="item in statusFilters"
            :key="item.value || 'all'"
            type="button"
            :class="{ 'payments-status-filter__button--active': filters.status === item.value }"
            class="payments-status-filter__button"
            @click="setStatusFilter(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <button class="admin-link-button" type="submit">Search</button>
      </form>

      <p v-if="loading" class="admin-loading">Loading payments...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="payments-list">
        <article v-for="row in rows" :key="row.id" class="payment-card">
          <div class="payment-card__main">
            <div class="payment-user">
              <p class="admin-kicker">User</p>
              <h3>{{ row.userName }}</h3>
              <div class="payment-user__meta">
                <span>{{ row.userEmail }}</span>
                <span>{{ row.userPhone || 'No account phone' }}</span>
              </div>
            </div>
            <span class="payment-status" :class="`payment-status--${row.status}`">{{ row.status }}</span>
          </div>

          <div class="payment-grid">
            <div>
              <span>Transfer phone / account</span>
              <strong>{{ row.transferPhone }}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{{ formatMoney(row.amount) }}</strong>
            </div>
            <div>
              <span>Submitted</span>
              <strong>{{ formatDate(row.createdAt) }}</strong>
            </div>
            <div>
              <span>Reviewed by</span>
              <strong>{{ row.reviewedByName || '-' }}</strong>
            </div>
          </div>

          <div class="payment-card__footer">
            <div class="payment-proof">
              <button class="admin-link-button" type="button" @click="openProofPreview(row)">
                View Payment Proof
              </button>
              <span class="admin-muted">{{ row.proofFileName }}</span>
            </div>

            <div v-if="row.status === 'pending'" class="payment-review">
              <textarea
                v-model="reviewNotes[row.id]"
                class="admin-compact-input payment-note"
                rows="2"
                placeholder="Review note"
              ></textarea>

              <div class="admin-actions payment-actions">
                <button
                  class="admin-primary-button"
                  type="button"
                  :disabled="actionLoading"
                  @click="review(row, 'approve')"
                >
                  {{ actionLoading === `approve-${row.id}` ? 'Approving...' : 'Approve' }}
                </button>
                <button
                  class="admin-danger-button"
                  type="button"
                  :disabled="actionLoading"
                  @click="review(row, 'reject')"
                >
                  {{ actionLoading === `reject-${row.id}` ? 'Rejecting...' : 'Reject' }}
                </button>
              </div>
            </div>

            <p v-else-if="row.reviewNote" class="payment-review-note">
              <span>Review note</span>
              {{ row.reviewNote }}
            </p>
          </div>

          <!--
            Review controls are intentionally hidden after approval/rejection so completed submissions
            stay compact while keeping the backend review workflow unchanged.
          -->
        </article>

        <p v-if="!rows.length" class="admin-muted admin-empty-state">No payment submissions found.</p>
      </div>
    </div>

    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="preview.open" class="payment-proof-preview" @click.self="closeProofPreview">
          <section class="payment-proof-preview__dialog" role="dialog" aria-modal="true" aria-label="Payment proof preview">
            <header class="payment-proof-preview__header">
              <div>
                <p class="admin-kicker">Payment proof</p>
                <h3>{{ preview.row?.proofFileName || 'Payment proof' }}</h3>
              </div>
              <button type="button" class="users-modal__close" aria-label="Close preview" @click="closeProofPreview">×</button>
            </header>

            <div class="payment-proof-preview__body">
              <p v-if="preview.loading" class="admin-loading">Loading payment proof...</p>
              <p v-else-if="preview.error" class="admin-error">{{ preview.error }}</p>
              <img
                v-else-if="isImageProof(preview.row)"
                :src="preview.url"
                :alt="preview.row?.proofFileName || 'Payment proof'"
              />
              <iframe
                v-else-if="isPdfProof(preview.row)"
                :src="preview.url"
                title="Payment proof PDF preview"
              ></iframe>
              <div v-else class="payment-proof-preview__fallback">
                <p>This file type cannot be previewed safely in the browser.</p>
                <a class="admin-link-button" :href="proofUrl(preview.row)" target="_blank" rel="noopener">Open File</a>
              </div>
            </div>
          </section>
        </div>
      </transition>
    </Teleport>
  </section>
</template>

<style scoped>
.payments-toolbar {
  margin-bottom: 1rem;
}

.payments-status-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-background), 0.24);
}

.payments-status-filter__button {
  min-height: 2.2rem;
  padding: 0.45rem 0.75rem;
  border: 0;
  border-radius: 0.4rem;
  color: rgba(var(--rgb-foreground), 0.62);
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.payments-status-filter__button:hover {
  color: var(--color-text-strong);
  background: rgba(var(--rgb-foreground), 0.06);
}

.payments-status-filter__button--active {
  color: #111;
  background: #f8d9aa;
}

.payments-list {
  display: grid;
  gap: 0.75rem;
}

.payment-card {
  display: grid;
  gap: 0.85rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.75rem;
  background: rgba(var(--rgb-foreground), 0.035);
}

.payment-card__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.payment-user {
  min-width: 0;
}

.payment-card h3 {
  margin: 0.15rem 0 0;
  color: var(--color-text-strong);
}

.payment-user__meta,
.payment-proof,
.payment-card__footer,
.payment-review,
.payment-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.payment-user__meta {
  flex-wrap: wrap;
  margin-top: 0.2rem;
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.9rem;
  font-weight: 700;
}

.payment-user__meta span,
.payment-proof span {
  overflow-wrap: anywhere;
}

.payment-status {
  flex: 0 0 auto;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 900;
  text-transform: uppercase;
}

.payment-status--pending { background: rgba(248, 217, 170, 0.14); color: #f8d9aa; }
.payment-status--approved { background: rgba(52, 211, 153, 0.12); color: #34d399; }
.payment-status--rejected { background: rgba(248, 113, 113, 0.12); color: #f87171; }

.payment-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(9.5rem, 1fr));
  gap: 0.55rem;
}

.payment-grid div {
  display: grid;
  gap: 0.15rem;
  min-height: 4rem;
  padding: 0.62rem 0.7rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.06);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-background), 0.2);
}

.payment-grid span {
  color: rgba(var(--rgb-foreground), 0.55);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.payment-grid strong,
.payment-proof span {
  overflow-wrap: anywhere;
}

.payment-card__footer {
  justify-content: space-between;
  align-items: stretch;
}

.payment-proof {
  min-width: 0;
  flex-wrap: wrap;
}

.payment-review {
  flex: 1;
  justify-content: flex-end;
}

.payment-note {
  width: min(100%, 28rem);
  min-height: 3rem;
  resize: vertical;
}

.payment-actions {
  flex: 0 0 auto;
}

.payment-review-note {
  max-width: 34rem;
  margin: 0;
  padding: 0.62rem 0.75rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-background), 0.18);
  color: rgba(var(--rgb-foreground), 0.72);
  font-weight: 700;
}

.payment-review-note span {
  display: block;
  margin-bottom: 0.15rem;
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
}

.payment-proof-preview {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(var(--rgb-background), 0.78);
  backdrop-filter: blur(10px);
}

.payment-proof-preview__dialog {
  width: min(100%, 64rem);
  max-height: calc(100dvh - 2rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(var(--rgb-foreground), 0.14);
  border-radius: 0.85rem;
  background: #111;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
}

.payment-proof-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.1);
}

.payment-proof-preview__header h3 {
  max-width: 48rem;
  margin: 0;
  color: var(--color-text-strong);
  overflow-wrap: anywhere;
}

.payment-proof-preview__body {
  min-height: 22rem;
  max-height: calc(100dvh - 8rem);
  display: grid;
  place-items: center;
  overflow: auto;
  padding: 1rem;
  background: rgba(var(--rgb-background), 0.35);
}

.payment-proof-preview__body img {
  max-width: 100%;
  max-height: calc(100dvh - 10rem);
  object-fit: contain;
  border-radius: 0.45rem;
}

.payment-proof-preview__body iframe {
  width: 100%;
  min-height: calc(100dvh - 10rem);
  border: 0;
  border-radius: 0.45rem;
  background: #fff;
}

.payment-proof-preview__fallback {
  display: grid;
  justify-items: center;
  gap: 1rem;
  text-align: center;
  color: rgba(var(--rgb-foreground), 0.72);
}

@media (max-width: 900px) {
  .payment-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-card__footer,
  .payment-review {
    flex-direction: column;
    align-items: stretch;
  }

  .payment-note {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .payments-toolbar,
  .payment-card__main,
  .payment-proof,
  .payment-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .payments-status-filter {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-grid {
    grid-template-columns: 1fr;
  }

  .payment-proof-preview__dialog {
    width: 100%;
  }

  .payment-proof-preview__body {
    min-height: 18rem;
  }
}

:global([data-theme="light"]) .payment-proof-preview {
  background: rgba(15, 23, 42, 0.38);
}

:global([data-theme="light"]) .payment-proof-preview__dialog {
  border-color: #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

:global([data-theme="light"]) .payment-proof-preview__header {
  border-bottom-color: #e2e8f0;
}

:global([data-theme="light"]) .payment-proof-preview__body {
  background: #f8fafc;
}
</style>
