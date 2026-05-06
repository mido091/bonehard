<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { API_BASE_URL, api } from '../../services/api';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';

const route = useRoute();

const item = ref(null);
const users = ref([]);
const customFields = ref([]);
const files = ref([]);
const loading = ref(true);
const error = ref('');
const exporting = ref(false);
const exportingCsv = ref(false);

// Team Notes
const teamNotes = ref([]);
const noteDraft = ref('');
const savingNote = ref(false);

const statusProgressMap = {
  New: 10,
  'In Progress': 55,
  Completed: 100,
};

const computedProgress = computed(() => {
  if (!item.value) return 0;
  const statusProgress = statusProgressMap[item.value.statusName];
  if (typeof statusProgress === 'number') return statusProgress;
  return Number(item.value.progressPercentage || 0);
});

const teamMembers = computed(() => {
  const ids = new Set((item.value?.teamMemberIds || []).map((id) => Number(id)));
  return users.value.filter((user) => ids.has(Number(user.id)));
});

const visibleCustomFields = computed(() => {
  const values = item.value?.customFieldValues || {};
  return customFields.value
    .map((field) => ({
      ...field,
      value: values[field.fieldKey],
    }))
    .filter((field) => field.value !== undefined && field.value !== null && field.value !== '');
});

function formatDate(value) {
  if (!value) return 'Not provided';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Not provided';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value));
}

function formatFileSize(size) {
  const numericSize = Number(size || 0);
  if (!numericSize) return 'Unknown size';
  if (numericSize < 1024 * 1024) return `${Math.max(1, Math.round(numericSize / 1024))} KB`;
  return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
}

function fileDownloadUrl(fileId) {
  return `${API_BASE_URL}/api/cases/${route.params.id}/files/${fileId}/download`;
}

async function exportPackage() {
  if (!item.value) return;
  exporting.value = true;
  error.value = '';

  try {
    const { blob, fileName } = await api.download(`/api/cases/${route.params.id}/export-package`, `${item.value.name || 'case'}.zip`);
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

async function exportCsvPackage() {
  if (!item.value) return;
  exportingCsv.value = true;
  error.value = '';

  try {
    const { blob, fileName } = await api.download(`/api/cases/${route.params.id}/export-csv`, `${item.value.name || 'case'}.csv`);
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
    exportingCsv.value = false;
  }
}

async function loadCaseDetails() {
  const [caseResponse, usersResponse, settingsResponse, filesResponse, notesResponse] = await Promise.all([
    api.get(`/api/cases/${route.params.id}`),
    api.get('/api/admin/users/options'),
    api.get('/api/cases/settings'),
    api.get(`/api/cases/${route.params.id}/files?page=1&perPage=100`),
    api.get(`/api/cases/${route.params.id}/general-notes?perPage=50`)
  ]);

  item.value = caseResponse.data;
  users.value = usersResponse.data || [];
  customFields.value = settingsResponse.data.customFields || [];
  files.value = filesResponse.data || [];
  teamNotes.value = notesResponse.data || [];
}

async function saveTeamNote() {
  const content = noteDraft.value.trim();
  if (!content) return;
  
  savingNote.value = true;
  try {
    await api.post(`/api/cases/${route.params.id}/general-notes`, {
      title: 'Team Notes',
      content,
    });
    noteDraft.value = '';
    const res = await api.get(`/api/cases/${route.params.id}/general-notes?perPage=50`);
    teamNotes.value = res.data || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    savingNote.value = false;
  }
}

onMounted(async () => {
  try {
    await loadCaseDetails();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="premium-case-profile">
    <div v-if="loading" class="premium-loading-state">
      <div class="spinner"></div>
      <p>Loading case data...</p>
    </div>
    <div v-else-if="error" class="premium-error-state">
      <p>{{ error }}</p>
      <button @click="loadCaseDetails" class="premium-btn">Retry</button>
    </div>

    <template v-else-if="item">
      <!-- HERO HEADER -->
      <header class="profile-hero glass-panel">
        <div class="hero-content">
          <div class="meta-kicker">
            <span class="status-badge" :class="`badge-${(item.statusName || 'new').toLowerCase().replace(/\s+/g, '-')}`">
              {{ item.statusName || 'New' }}
            </span>
            <span class="case-id">CASE #{{ item.id }}</span>
            <span v-if="item.isArchived" class="archived-badge">Archived</span>
          </div>
          <h1 class="case-title">{{ item.name }}</h1>
        </div>
        <div class="hero-actions">
          <button class="premium-btn-secondary" type="button" :disabled="exporting" @click="exportPackage">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {{ exporting ? 'Preparing...' : 'Export as PDF' }}
          </button>
          <button class="premium-btn-secondary" type="button" :disabled="exportingCsv" @click="exportCsvPackage">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {{ exportingCsv ? 'Preparing...' : 'Export as CSV' }}
          </button>
          <RouterLink class="premium-btn-secondary" to="/admin/cases">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Cases
          </RouterLink>
          <RouterLink class="premium-btn-primary" :to="`/admin/cases/${item.id}/edit`">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Edit Case
          </RouterLink>
        </div>
      </header>

      <!-- KEY METRICS -->
      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="metric-card glass-panel">
          <span class="metric-label">Current Status</span>
          <strong class="metric-value status-text">{{ item.statusName || 'New' }}</strong>
        </div>
        <div class="metric-card glass-panel">
          <span class="metric-label">Project Progress</span>
          <strong class="metric-value">{{ computedProgress }}%</strong>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${computedProgress}%` }"></div>
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT LAYOUT -->
      <div class="content-layout">
        <!-- LEFT COLUMN: Details & Notes -->
        <div class="main-column">
          <section class="info-section glass-panel">
            <h3 class="section-title">Case Details</h3>
            <div class="details-grid">
              <div class="detail-item">
                <span class="d-label">Client</span>
                <span class="d-value link-text">{{ item.targetName || 'Not assigned' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Target Time</span>
                <span class="d-value">{{ item.targetTime || 'Not provided' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Start Date</span>
                <span class="d-value">{{ formatDate(item.startDate) }}</span>
              </div>
            </div>
          </section>

          <section v-if="item.description" class="info-section glass-panel">
            <h3 class="section-title">Internal Notes</h3>
            <div class="rich-text-container" v-html="item.description"></div>
          </section>

          <section v-if="item.clientDescription" class="info-section glass-panel">
            <h3 class="section-title">Client Notes</h3>
            <div class="rich-text-container" v-html="item.clientDescription"></div>
          </section>
          
          <section v-if="visibleCustomFields.length" class="info-section glass-panel">
            <h3 class="section-title">Custom Information</h3>
            <div class="custom-fields-grid">
              <div v-for="field in visibleCustomFields" :key="field.id" class="cf-item">
                <span class="cf-label">{{ field.label }}</span>
                <span class="cf-value">{{ field.value }}</span>
              </div>
            </div>
          </section>

          <!-- TEAM NOTES SECTION -->
          <section class="info-section glass-panel">
            <h3 class="section-title">Team Notes</h3>
            <div class="team-notes-list">
              <article v-for="note in teamNotes" :key="note.id" class="team-note-card">
                <header class="note-header">
                  <strong>{{ note.createdByName || 'Team member' }}</strong>
                  <span class="note-meta">{{ note.createdByEmail || '-' }} • {{ note.createdByRole || '-' }} • {{ formatDateTime(note.createdAt) }}</span>
                </header>
                <div class="rich-text-container note-content" v-html="note.content"></div>
              </article>
              <p v-if="!teamNotes.length" class="empty-state" style="margin-bottom: 1.5rem;">No team notes yet.</p>
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
            <div v-if="files.length" class="files-list">
              <a v-for="file in files" :key="file.id" :href="fileDownloadUrl(file.id)" target="_blank" class="file-card" download>
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
    </template>
  </section>
</template>

<style scoped>
/* Premium Base Styles */
.premium-case-profile {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  color: var(--color-text, #e2e8f0);
  font-family: 'Inter', system-ui, sans-serif;
  max-width: 1400px;
  margin: 0 auto;
}

/* Glassmorphism Utilities */
.glass-panel {
  background: rgba(var(--rgb-foreground), 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(var(--rgb-background), 0.2);
}

/* Hero Section */
.profile-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2.5rem;
  gap: 2rem;
  background: linear-gradient(135deg, rgba(var(--rgb-foreground),0.05) 0%, rgba(var(--rgb-foreground),0.01) 100%);
}

.meta-kicker {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.case-id {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(var(--rgb-foreground),0.5);
}

.case-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--color-text-strong);
  letter-spacing: -0.5px;
}

/* Badges */
.status-badge, .archived-badge {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge { background: rgba(96, 165, 250, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3); }
.badge-in-progress { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); }
.badge-completed { background: rgba(52, 211, 153, 0.15); color: #34d399; border-color: rgba(52, 211, 153, 0.3); }
.archived-badge { background: rgba(248, 113, 113, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }

/* Buttons */
.hero-actions { display: flex; gap: 1rem; }

.premium-btn-primary, .premium-btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.premium-btn-primary {
  background: linear-gradient(135deg, #a89bf9, #8b7de6);
  color: var(--color-text-strong);
  border: none;
  box-shadow: 0 4px 15px rgba(168, 155, 249, 0.3);
}

.premium-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(168, 155, 249, 0.4);
}

.premium-btn-secondary {
  background: rgba(var(--rgb-foreground),0.05);
  color: var(--color-text-strong);
  border: 1px solid rgba(var(--rgb-foreground),0.1);
}

.premium-btn-secondary:hover {
  background: rgba(var(--rgb-foreground),0.1);
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: transform 0.2s ease;
}

.metric-card:hover { transform: translateY(-3px); }

.metric-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(var(--rgb-foreground),0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.metric-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text-strong);
}

.metric-value .dim { color: rgba(var(--rgb-foreground),0.3); font-size: 1.5rem; }
.highlight-text { color: var(--color-text); }
.status-text { font-size: 1.6rem; }

.progress-track {
  height: 6px;
  background: rgba(var(--rgb-foreground),0.1);
  border-radius: 999px;
  margin-top: 0.5rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FEE7CB, #a89bf9);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Layout */
.content-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

.main-column, .sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Sections */
.info-section {
  padding: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-strong);
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground),0.08);
}

/* Details Grid */
.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.d-label {
  font-size: 0.75rem;
  color: rgba(var(--rgb-foreground),0.4);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.d-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-strong);
}

.link-text { color: #a89bf9; }
.warning-text { color: #f87171; }

/* Rich Text */
.rich-text-container {
  color: rgba(var(--rgb-foreground),0.85);
  line-height: 1.7;
  font-size: 0.95rem;
}

.rich-text-container :deep(ul), .rich-text-container :deep(ol) { padding-left: 1.5rem; }
.rich-text-container :deep(p:first-child) { margin-top: 0; }
.rich-text-container :deep(p:last-child) { margin-bottom: 0; }

/* Custom Fields */
.custom-fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.cf-item {
  background: rgba(var(--rgb-background),0.2);
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rgb-foreground),0.05);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cf-label { font-size: 0.75rem; color: rgba(var(--rgb-foreground),0.4); }
.cf-value { font-size: 0.95rem; font-weight: 600; color: var(--color-text-strong); }

/* Team Notes */
.team-notes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-note-card {
  background: rgba(var(--rgb-foreground), 0.03);
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid rgba(var(--rgb-foreground), 0.05);
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.05);
}

.note-header strong {
  color: var(--color-text-strong);
  font-size: 0.95rem;
}

.note-meta {
  font-size: 0.8rem;
  color: rgba(var(--rgb-foreground), 0.4);
}

.note-content {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(var(--rgb-foreground), 0.85);
}

.team-note-form {
  padding-top: 1.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}

/* Team List */
.team-list { display: flex; flex-direction: column; gap: 1rem; }

.team-member {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(var(--rgb-foreground),0.03);
  border: 1px solid rgba(var(--rgb-foreground),0.05);
  transition: background 0.2s;
}

.team-member:hover { background: rgba(var(--rgb-foreground),0.06); }

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #FEE7CB, #fcd3a4);
  color: #1a1a1a;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.1rem;
}

.member-info { display: flex; flex-direction: column; gap: 0.25rem; }
.member-info strong { font-size: 0.95rem; color: var(--color-text-strong); }

/* Role badges */
.role-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  width: fit-content;
}
.role-badge--client {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}
.role-badge--staff {
  background: rgba(168, 155, 249, 0.12);
  color: #a89bf9;
  border: 1px solid rgba(168, 155, 249, 0.25);
}

/* Files List */
.files-list { display: flex; flex-direction: column; gap: 1rem; }

.file-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(var(--rgb-foreground),0.03);
  border: 1px solid rgba(var(--rgb-foreground),0.05);
  text-decoration: none;
  transition: all 0.2s;
}

.file-card:hover {
  background: rgba(var(--rgb-foreground),0.06);
  transform: translateY(-2px);
  border-color: rgba(var(--rgb-foreground),0.15);
}

.file-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--rgb-foreground),0.1);
  color: var(--color-text-strong);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.75rem;
}

.file-icon.is-pdf { background: rgba(248, 113, 113, 0.2); color: #f87171; }

.file-info { display: flex; flex-direction: column; gap: 0.15rem; overflow: hidden; }
.file-info strong { font-size: 0.9rem; color: var(--color-text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-info span { font-size: 0.75rem; color: rgba(var(--rgb-foreground),0.5); }

.empty-state {
  color: rgba(var(--rgb-foreground),0.4);
  font-style: italic;
  font-size: 0.9rem;
  margin: 0;
}

/* Loading & Error */
.premium-loading-state, .premium-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  gap: 1rem;
  color: rgba(var(--rgb-foreground),0.6);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(var(--rgb-foreground),0.1);
  border-top-color: #a89bf9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

/* Responsive */
@media (max-width: 1024px) {
  .content-layout { grid-template-columns: 1fr; }
  .profile-hero { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 640px) {
  .hero-actions { width: 100%; flex-direction: column; }
  .premium-btn-primary, .premium-btn-secondary { justify-content: center; width: 100%; }
}
</style>
