<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import { api } from '../../services/api';

const route = useRoute();

const order = ref(null);
const notes = ref([]);
const noteDraft = ref('');
const loading = ref(false);
const savingNote = ref(false);
const exporting = ref(false);
const error = ref('');

const customFieldRows = computed(() => Object.entries(order.value?.customFieldValues || {})
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => ({ key, value })));

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

function formatFileSize(size) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadOrder() {
  loading.value = true;
  error.value = '';

  try {
    const [orderResponse, notesResponse] = await Promise.all([
      api.get(`/api/admin/user-orders/${route.params.id}`),
      api.get(`/api/admin/user-orders/${route.params.id}/team-notes?perPage=50`),
    ]);
    order.value = orderResponse.data;
    notes.value = notesResponse.data || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function saveTeamNote() {
  const content = noteDraft.value.trim();
  if (!content) return;

  savingNote.value = true;
  error.value = '';

  try {
    const response = await api.post(`/api/admin/user-orders/${route.params.id}/team-notes`, {
      title: 'Team Notes',
      content,
    });
    notes.value = response.data || [];
    noteDraft.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    savingNote.value = false;
  }
}

async function exportPackage() {
  if (!order.value) return;
  exporting.value = true;
  error.value = '';

  try {
    const { blob, fileName } = await api.download(`/api/admin/user-orders/${route.params.id}/export-package`, `${order.value.name || 'order'}.zip`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err.message;
  } finally {
    exporting.value = false;
  }
}

onMounted(loadOrder);
</script>

<template>
  <section class="premium-case-profile admin-order-detail-page">
    <div v-if="loading" class="premium-loading-state">
      <div class="spinner"></div>
      <p>Loading order details...</p>
    </div>
    
    <div v-else-if="error" class="premium-error-state">
      <p>{{ error }}</p>
      <button class="premium-btn-secondary" @click="loadOrder">Try Again</button>
    </div>

    <div v-else-if="order" class="profile-container">
      <!-- HERO HEADER -->
      <header class="profile-hero glass-panel">
        <div class="hero-content">
          <div class="meta-kicker">
            <span class="status-badge" :class="`badge-new`">
              User Order
            </span>
            <span class="case-id">ORDER #{{ order.id }}</span>
          </div>
          <h1 class="case-title">{{ order.name }}</h1>
        </div>
        <div class="hero-actions">
          <button class="premium-btn-secondary" type="button" :disabled="exporting" @click="exportPackage">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {{ exporting ? 'Preparing...' : 'Export as PDF' }}
          </button>
          <RouterLink class="premium-btn-secondary" to="/admin/user-orders">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Orders
          </RouterLink>
        </div>
      </header>

      <!-- MAIN CONTENT LAYOUT -->
      <div class="content-layout">
        <!-- LEFT COLUMN: Details & Notes -->
        <div class="main-column">
          <section class="info-section glass-panel">
            <h3 class="section-title">Order Details</h3>
            <div class="details-grid">
              <div class="detail-item">
                <span class="d-label">User</span>
                <span class="d-value link-text">{{ order.createdByName || order.targetName || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Target Time</span>
                <span class="d-value">{{ order.targetTime || 'Not provided' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Submitted Date</span>
                <span class="d-value">{{ formatDate(order.startDate || order.createdAt) }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Phone</span>
                <span class="d-value">{{ order.contactPhone || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Email</span>
                <span class="d-value">{{ order.contactEmail || '-' }}</span>
              </div>
            </div>
          </section>

          <section v-if="order.clientDescription" class="info-section glass-panel">
            <h3 class="section-title">Project Notes</h3>
            <div class="rich-text-container" v-html="order.clientDescription"></div>
          </section>

          <section v-if="customFieldRows.length" class="info-section glass-panel">
            <h3 class="section-title">Custom Fields</h3>
            <div class="custom-fields-grid">
              <div v-for="field in customFieldRows" :key="field.key" class="cf-item">
                <span class="cf-label">{{ field.key }}</span>
                <span class="cf-value">{{ field.value }}</span>
              </div>
            </div>
          </section>

          <!-- TEAM NOTES SECTION -->
          <section class="info-section glass-panel">
            <h3 class="section-title">Team Notes</h3>
            <div class="team-notes-list">
              <article v-for="note in notes" :key="note.id" class="team-note-card">
                <header class="note-header">
                  <strong>{{ note.createdByName || 'Team member' }}</strong>
                  <span class="note-meta">{{ note.createdByEmail || '-' }} • {{ note.createdByRole || '-' }} • {{ formatDate(note.createdAt) }}</span>
                </header>
                <div class="rich-text-container note-content" v-html="note.content"></div>
              </article>
              <p v-if="!notes.length" class="empty-state" style="margin-bottom: 1.5rem;">No team notes yet.</p>
            </div>
            
            <form @submit.prevent="saveTeamNote" class="team-note-form">
              <label class="admin-field admin-field--wide">
                <span style="color: var(--color-text-strong); font-weight: 600; margin-bottom: 0.5rem; display: block;">Add New Note</span>
                <RichTextEditor v-model="noteDraft" />
              </label>
              <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                <button type="submit" class="premium-btn-primary" :disabled="savingNote || !noteDraft.trim()">
                  {{ savingNote ? 'Saving...' : 'Save Note' }}
                </button>
              </div>
            </form>
          </section>
        </div>

        <!-- RIGHT COLUMN: Sidebar (Files) -->
        <aside class="sidebar-column">
          <section class="info-section glass-panel">
            <h3 class="section-title">Attached Files</h3>
            <div v-if="order.files?.length" class="files-list">
              <a v-for="file in order.files" :key="file.id" :href="`/api/admin/user-orders/${route.params.id}/files/${file.id}/download`" target="_blank" class="file-card" download>
                <div class="file-icon" :class="{'is-pdf': file.mimeType?.includes('pdf')}">
                  {{ file.mimeType?.includes('pdf') ? 'PDF' : 'FILE' }}
                </div>
                <div class="file-info">
                  <strong>{{ file.fileName }}</strong>
                  <span>{{ formatFileSize(file.fileSize) }} • {{ formatDate(file.createdAt) }}</span>
                </div>
              </a>
            </div>
            <p v-else class="empty-state">No files uploaded.</p>
          </section>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Premium Container */
.premium-case-profile {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 80vh;
}

.glass-panel {
  background: rgba(var(--rgb-foreground), 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(var(--rgb-background), 0.2);
}

/* States */
.premium-loading-state,
.premium-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(var(--rgb-foreground), 0.1);
  border-top-color: #a89bf9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Buttons */
.premium-btn-primary, .premium-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  font-size: 0.9rem; font-weight: 700;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}
.premium-btn-primary { background: #fee7cb; color: #1a1a1a; }
.premium-btn-primary:hover:not(:disabled) { background: #fff; transform: translateY(-1px); }
.premium-btn-secondary { background: rgba(var(--rgb-foreground), 0.05); color: var(--color-text-strong); border: 1px solid rgba(var(--rgb-foreground), 0.1); }
.premium-btn-secondary:hover:not(:disabled) { background: rgba(var(--rgb-foreground), 0.1); }
.premium-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Hero */
.profile-hero {
  display: flex; justify-content: space-between; align-items: flex-end;
  padding: 2.5rem; margin-bottom: 2rem;
  background: linear-gradient(145deg, rgba(30, 30, 35, 0.8), rgba(20, 20, 25, 0.9));
}
.meta-kicker { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
.status-badge {
  font-size: 0.75rem; font-weight: 800; text-transform: uppercase;
  padding: 0.35rem 0.85rem; border-radius: 999px;
  background: rgba(168, 155, 249, 0.15); color: #a89bf9;
  border: 1px solid rgba(168, 155, 249, 0.3);
}
.case-id { font-size: 0.85rem; font-weight: 700; color: rgba(var(--rgb-foreground), 0.4); letter-spacing: 0.05em; }
.case-title { font-size: 2.5rem; font-weight: 800; color: var(--color-text-strong); margin: 0; line-height: 1.1; letter-spacing: -0.02em; }
.hero-actions { display: flex; gap: 0.75rem; }

/* Layout */
.content-layout { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: start; }
@media (max-width: 1024px) { .content-layout { grid-template-columns: 1fr; } }
.main-column { display: flex; flex-direction: column; gap: 1.5rem; }
.sidebar-column { display: flex; flex-direction: column; gap: 1.5rem; }

/* Sections */
.info-section { padding: 2rem; }
.section-title { font-size: 1.1rem; font-weight: 700; color: var(--color-text-strong); margin: 0 0 1.5rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
.empty-state { color: rgba(var(--rgb-foreground), 0.4); font-size: 0.95rem; font-style: italic; }

/* Details Grid */
.details-grid, .custom-fields-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.detail-item, .cf-item { display: flex; flex-direction: column; gap: 0.4rem; }
.d-label, .cf-label { font-size: 0.75rem; font-weight: 700; color: rgba(var(--rgb-foreground), 0.4); text-transform: uppercase; letter-spacing: 0.05em; }
.d-value, .cf-value { font-size: 0.95rem; font-weight: 600; color: var(--color-text-strong); line-height: 1.4; }
.link-text { color: #a89bf9; cursor: pointer; }
.link-text:hover { text-decoration: underline; }

/* Rich Text */
.rich-text-container { color: rgba(var(--rgb-foreground), 0.85); line-height: 1.6; font-size: 0.95rem; }
.rich-text-container :deep(p) { margin: 0 0 1rem 0; }
.rich-text-container :deep(p:last-child) { margin-bottom: 0; }

/* Files List */
.files-list { display: flex; flex-direction: column; gap: 1rem; }
.file-card {
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem; border-radius: 12px;
  background: rgba(var(--rgb-foreground), 0.03);
  border: 1px solid rgba(var(--rgb-foreground), 0.05);
  text-decoration: none; color: inherit;
  transition: all 0.2s ease;
}
.file-card:hover { background: rgba(var(--rgb-foreground), 0.06); transform: translateY(-2px); }
.file-icon {
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 800; color: var(--color-text-strong); background: rgba(var(--rgb-foreground), 0.1);
}
.file-icon.is-pdf { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.file-info { display: flex; flex-direction: column; gap: 0.25rem; }
.file-info strong { font-size: 0.9rem; font-weight: 600; color: var(--color-text-strong); }
.file-info span { font-size: 0.75rem; color: rgba(var(--rgb-foreground), 0.4); }

/* Team Notes */
.team-notes-list { display: flex; flex-direction: column; gap: 1rem; }
.team-note-card {
  background: rgba(var(--rgb-foreground), 0.03);
  padding: 1.25rem; border-radius: 12px;
  border: 1px solid rgba(var(--rgb-foreground), 0.05);
}
.note-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.75rem; padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.05);
}
.note-header strong { color: var(--color-text-strong); font-size: 0.95rem; }
.note-meta { font-size: 0.8rem; color: rgba(var(--rgb-foreground), 0.4); }
.note-content { font-size: 0.95rem; line-height: 1.6; color: rgba(var(--rgb-foreground), 0.85); }
.team-note-form {
  padding-top: 1.5rem; margin-top: 1.5rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}
</style>
