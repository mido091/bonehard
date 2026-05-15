<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import WorkflowSummary from '../../components/admin/WorkflowSummary.vue';
import ReferenceLinksList from '../../components/admin/ReferenceLinksList.vue';
import ReferenceLinksEditor from '../../components/admin/ReferenceLinksEditor.vue';
import ClientTalkModal from '../../components/ClientTalkModal.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { API_BASE_URL, api } from '../../services/api';
import { statusProgressPercent } from '../../constants/workflowOptions';
import { formatCairoFileDateTime } from '../../utils/dateTime';

const route = useRoute();
const { showConfirm } = useConfirmDialog();

const order = ref(null);
const notes = ref([]);
const statuses = ref([]);
const noteDraft = ref('');
const noteLinks = ref([]);
const noteIsPrivate = ref(false);
const loading = ref(false);
const savingNote = ref(false);
const exporting = ref(false);
const exportingCsv = ref(false);
const error = ref('');
const copiedFileId = ref(null);
const savingFileNameId = ref(null);
const renamingFileId = ref(null);

// Note editing state
const editingNoteId = ref(null);
const editingNoteDraft = ref('');
const editingNoteLinks = ref([]);
const editingNoteIsPrivate = ref(false);
const savingEditNoteId = ref(null);
const deletingNoteId = ref(null);

// Admin file upload state
const adminFileInput = ref(null);
const adminFileVisibility = ref('private');
const uploadingFiles = ref(false);
const deletingFileId = ref(null);
const uploadDragOver = ref(false);
const savingStatus = ref(false);
const showClientTalk = ref(false);
const clientTalkSession = ref(null);
const openingClientTalk = ref(false);

const vFocus = { mounted: (el) => el.focus() };

function getExt(fname) {
  const parts = String(fname).split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}
function getStem(fname) {
  const parts = String(fname).split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : fname;
}

const customFieldRows = computed(() => Object.entries(order.value?.customFieldValues || {})
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => ({ key, value })));

const computedProgress = computed(() => statusProgressPercent(order.value?.statusName, order.value?.progressPercentage));

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}
function formatFileSize(size) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function cleanReferenceLinks(links = []) {
  return links
    .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
    .filter((link) => link.url);
}
function fileDownloadUrl(fileId) {
  return `${API_BASE_URL}/api/admin/user-orders/${route.params.id}/files/${fileId}/download`;
}
function absoluteFileDownloadUrl(fileId) {
  return new URL(fileDownloadUrl(fileId), window.location.origin).href;
}
async function copyFileLink(fileId) {
  try {
    await navigator.clipboard.writeText(absoluteFileDownloadUrl(fileId));
    copiedFileId.value = fileId;
    setTimeout(() => { if (copiedFileId.value === fileId) copiedFileId.value = null; }, 1500);
  } catch { error.value = 'Could not copy the file link.'; }
}
async function saveOrderFileName(file) {
  const stem = String(file._stem ?? getStem(file.fileName)).trim();
  if (!stem || savingFileNameId.value === file.id) return;
  const fullFileName = stem + getExt(file.fileName);
  savingFileNameId.value = file.id;
  error.value = '';
  try {
    const response = await api.patch(`/api/admin/user-orders/${route.params.id}/files/${file.id}`, { fileName: fullFileName });
    order.value = response.data || order.value;
    renamingFileId.value = null;
  } catch (err) { error.value = err.message || 'Failed to rename file.'; }
  finally { savingFileNameId.value = null; }
}

async function loadOrder() {
  loading.value = true; error.value = '';
  try {
    const [orderRes, notesRes, statusRes] = await Promise.all([
      api.get(`/api/admin/user-orders/${route.params.id}`),
      api.get(`/api/admin/user-orders/${route.params.id}/team-notes?perPage=50`),
      api.get('/api/case-statuses'),
    ]);
    order.value = orderRes.data;
    notes.value = notesRes.data || [];
    statuses.value = statusRes.data || [];
  } catch (err) { error.value = err.message; }
  finally { loading.value = false; }
}

async function updateOrderStatus(statusId) {
  if (!order.value || savingStatus.value) return;
  savingStatus.value = true; error.value = '';
  try {
    const res = await api.patch(`/api/admin/user-orders/${route.params.id}/status`, { statusId: Number(statusId) });
    order.value = res.data || order.value;
  } catch (err) { error.value = err.message || 'Failed to update order status.'; }
  finally { savingStatus.value = false; }
}

async function openClientTalk() {
  if (!order.value || openingClientTalk.value) return;
  openingClientTalk.value = true;
  error.value = '';

  try {
    const res = await api.post(`/api/admin/user-orders/${route.params.id}/client-talk/open`);
    clientTalkSession.value = res.data;
    showClientTalk.value = true;
  } catch (err) {
    error.value = err.message || 'Failed to open Client Talk.';
  } finally {
    openingClientTalk.value = false;
  }
}

// ── Notes CRUD ─────────────────────────────────────────────────────────────────
async function saveTeamNote() {
  const content = noteDraft.value.trim();
  if (!content) return;
  savingNote.value = true; error.value = '';
  try {
    const res = await api.post(`/api/admin/user-orders/${route.params.id}/team-notes`, {
      title: 'Team Note', content, isPrivate: noteIsPrivate.value, referenceLinks: cleanReferenceLinks(noteLinks.value),
    });
    notes.value = res.data || [];
    noteDraft.value = ''; noteLinks.value = []; noteIsPrivate.value = false;
  } catch (err) { error.value = err.message; }
  finally { savingNote.value = false; }
}

function startEditNote(note) {
  editingNoteId.value = note.id;
  editingNoteDraft.value = note.content || '';
  editingNoteLinks.value = (note.links || []).map((link) => ({ label: link.label || '', url: link.url || '' }));
  editingNoteIsPrivate.value = !!note.isPrivate;
}
function cancelEditNote() {
  editingNoteId.value = null; editingNoteDraft.value = ''; editingNoteLinks.value = []; editingNoteIsPrivate.value = false;
}
async function saveEditNote(note) {
  const content = editingNoteDraft.value.trim();
  if (!content || savingEditNoteId.value) return;
  savingEditNoteId.value = note.id; error.value = '';
  try {
    const res = await api.patch(
      `/api/admin/user-orders/${route.params.id}/team-notes/${note.id}`,
      { title: note.title || 'Team Note', content, isPrivate: editingNoteIsPrivate.value, referenceLinks: cleanReferenceLinks(editingNoteLinks.value) },
    );
    notes.value = res.data || [];
    cancelEditNote();
  } catch (err) { error.value = err.message; }
  finally { savingEditNoteId.value = null; }
}
async function deleteNote(noteId) {
  const confirmed = await showConfirm({
    title: 'Delete Note',
    message: 'Are you sure you want to delete this team note? This action cannot be undone.',
    confirmText: 'Delete',
    type: 'danger'
  });
  if (!confirmed) return;
  deletingNoteId.value = noteId; error.value = '';
  try {
    const res = await api.delete(`/api/admin/user-orders/${route.params.id}/team-notes/${noteId}`);
    notes.value = res.data || [];
  } catch (err) { error.value = err.message; }
  finally { deletingNoteId.value = null; }
}

// ── Admin File Upload ──────────────────────────────────────────────────────────
function triggerFileInput() { adminFileInput.value?.click(); }
function onDragOver(e) { e.preventDefault(); uploadDragOver.value = true; }
function onDragLeave() { uploadDragOver.value = false; }
function onDrop(e) {
  e.preventDefault(); uploadDragOver.value = false;
  const files = Array.from(e.dataTransfer.files);
  if (files.length) uploadAdminFiles(files);
}
function onFileInputChange(e) {
  const files = Array.from(e.target.files);
  if (files.length) uploadAdminFiles(files);
  e.target.value = '';
}
async function uploadAdminFiles(files) {
  uploadingFiles.value = true; error.value = '';
  try {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('folderType', adminFileVisibility.value);
    const res = await api.postForm(`/api/admin/user-orders/${route.params.id}/files`, formData);
    order.value = res.data || order.value;
  } catch (err) { error.value = err.message || 'Upload failed.'; }
  finally { uploadingFiles.value = false; }
}
async function deleteOrderFile(fileId) {
  console.log('Delete action triggered for fileId:', fileId);
  const confirmed = await showConfirm({
    title: 'Delete File',
    message: 'Are you sure you want to delete this file permanently? This action cannot be undone.',
    confirmText: 'Delete',
    type: 'danger'
  });
  if (!confirmed) return;
  
  deletingFileId.value = fileId;
  error.value = '';
  
  try {
    const res = await api.delete(`/api/admin/user-orders/${route.params.id}/files/${fileId}`);
    // The server returns the updated order object
    if (res.data) {
      order.value = res.data;
    }
  } catch (err) {
    error.value = err.message || 'Failed to delete file';
    console.error('Delete file error:', err);
  } finally {
    deletingFileId.value = null;
  }
}

// ── Export ─────────────────────────────────────────────────────────────────────
async function exportPackage() {
  if (!order.value) return;
  exporting.value = true; error.value = '';
  try {
    const { blob, fileName } = await api.download(`/api/admin/user-orders/${route.params.id}/export-package`, `${order.value.name || 'order'}.zip`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { error.value = err.message; } finally { exporting.value = false; }
}
async function exportCsvPackage() {
  if (!order.value) return;
  exportingCsv.value = true; error.value = '';
  try {
    const { blob, fileName } = await api.download(`/api/admin/user-orders/${route.params.id}/export-csv`, `${order.value.name || 'order'}.csv`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { error.value = err.message; } finally { exportingCsv.value = false; }
}

onMounted(loadOrder);
</script>

<template>
  <section class="premium-case-profile admin-order-detail-page">
    <!-- Global Confirmation Dialog -->
    <ConfirmDialog />
    <div v-if="loading" class="premium-loading-state">
      <div class="spinner"></div>
      <p>Loading order details...</p>
    </div>

    <div v-else-if="error && !order" class="premium-error-state">
      <p>{{ error }}</p>
      <button class="premium-btn-secondary" @click="loadOrder">Try Again</button>
    </div>

    <div v-else-if="order" class="profile-container">
      <!-- HERO HEADER -->
      <header class="profile-hero glass-panel">
        <div class="hero-content">
          <div class="meta-kicker">
            <span class="status-badge">User Order</span>
            <span class="case-id">ORDER #{{ order.id }}</span>
          </div>
          <h1 class="case-title">{{ order.name }}</h1>
        </div>
        <div class="hero-actions">
          <button class="premium-btn-secondary" type="button" :disabled="openingClientTalk" @click="openClientTalk">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
            {{ openingClientTalk ? 'Opening...' : 'Client Talk' }}
          </button>
          <button class="premium-btn-secondary" type="button" :disabled="exporting" @click="exportPackage">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ exporting ? 'Preparing...' : 'Export PDF' }}
          </button>
          <button class="premium-btn-secondary" type="button" :disabled="exportingCsv" @click="exportCsvPackage">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ exportingCsv ? 'Preparing...' : 'Export CSV' }}
          </button>
          <RouterLink class="premium-btn-secondary" to="/admin/user-orders">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </RouterLink>
        </div>
      </header>

      <!-- Error banner (non-blocking) -->
      <div v-if="error" class="error-banner">{{ error }}</div>

      <!-- MAIN CONTENT LAYOUT -->
      <div class="content-layout">
        <!-- LEFT COLUMN -->
        <div class="main-column">
          <section class="info-section glass-panel">
            <h3 class="section-title">Order Details</h3>
            <div class="details-grid">
              <div class="detail-item">
                <span class="d-label">Case Status</span>
                <AdminSelect
                  :model-value="order.statusId"
                  :options="statuses"
                  :disabled="savingStatus"
                  teleport
                  placeholder="Select status"
                  @update:model-value="updateOrderStatus"
                />
              </div>
              <div class="detail-item">
                <span class="d-label">Progress</span>
                <span class="d-value">{{ computedProgress }}%</span>
                <div class="case-progress"><span :style="{ width: `${computedProgress}%` }"></span></div>
              </div>
              <div class="detail-item">
                <span class="d-label">User</span>
                <span class="d-value link-text">{{ order.createdByName || order.targetName || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="d-label">Target Date</span>
                <span class="d-value">{{ order.targetTime ? new Date(order.targetTime).toLocaleDateString() : 'Not provided' }}</span>
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

          <section class="info-section glass-panel">
            <h3 class="section-title">Implant & Services</h3>
            <WorkflowSummary
              :implant-system="order.implantSystem"
              :implant-system-other="order.implantSystemOther"
              :services-needed="order.servicesNeeded || []"
              :services-needed-other="order.servicesNeededOther"
            />
          </section>

          <section v-if="order.links?.length" class="info-section glass-panel">
            <h3 class="section-title">Reference Links</h3>
            <ReferenceLinksList :links="order.links" />
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

          <!-- ── TEAM NOTES ───────────────────────────────────── -->
          <section class="info-section glass-panel">
            <h3 class="section-title">Team Notes</h3>

            <div class="team-notes-list">
              <article v-for="note in notes" :key="note.id" class="team-note-card">
                <!-- Edit mode -->
                <template v-if="editingNoteId === note.id">
                  <RichTextEditor v-model="editingNoteDraft" />
                  <ReferenceLinksEditor v-model="editingNoteLinks" />
                  <div class="note-edit-footer">
                    <!-- Visibility toggle inside edit -->
                    <button
                      type="button"
                      class="visibility-toggle"
                      :class="editingNoteIsPrivate ? 'is-private' : 'is-public'"
                      @click="editingNoteIsPrivate = !editingNoteIsPrivate"
                      :title="editingNoteIsPrivate ? 'Private — click to make public' : 'Public — click to make private'"
                    >
                      <!-- Lock icon -->
                      <svg v-if="editingNoteIsPrivate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <!-- Globe icon -->
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      {{ editingNoteIsPrivate ? 'Private' : 'Public' }}
                    </button>
                    <div class="note-edit-actions">
                      <button type="button" class="premium-btn-secondary btn-sm" @click="cancelEditNote">Cancel</button>
                      <button type="button" class="premium-btn-primary btn-sm"
                        :disabled="savingEditNoteId === note.id || !editingNoteDraft.trim()"
                        @click="saveEditNote(note)">
                        {{ savingEditNoteId === note.id ? 'Saving...' : 'Save Changes' }}
                      </button>
                    </div>
                  </div>
                </template>

                <!-- View mode -->
                <template v-else>
                  <header class="note-header">
                    <div class="note-author">
                      <strong>{{ note.createdByName || 'Team member' }}</strong>
                      <span class="note-meta">{{ note.createdByEmail || '' }} · {{ note.createdByRole || '' }} · {{ formatDate(note.createdAt) }}</span>
                    </div>
                    <div class="note-header-right">
                      <!-- Visibility badge -->
                      <span class="vis-badge" :class="note.isPrivate ? 'vis-private' : 'vis-public'">
                        <svg v-if="note.isPrivate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        {{ note.isPrivate ? 'Private' : 'Public' }}
                      </span>
                      <!-- Edit button -->
                      <button type="button" class="note-action-btn" title="Edit note" @click="startEditNote(note)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <!-- Delete button -->
                      <button type="button" class="note-action-btn is-danger" title="Delete note"
                        :disabled="deletingNoteId === note.id"
                        @click.stop="deleteNote(note.id)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </header>
                  <div class="rich-text-container note-content" v-html="note.content"></div>
                  <ReferenceLinksList :links="note.links || []" />
                </template>
              </article>
              <p v-if="!notes.length" class="empty-state" style="margin-bottom:1.5rem">No team notes yet.</p>
            </div>

            <!-- New note form -->
            <form @submit.prevent="saveTeamNote" class="team-note-form">
              <div class="note-form-header">
                <span class="note-form-label">Add New Note</span>
                <!-- New note visibility toggle -->
                <button
                  type="button"
                  class="visibility-toggle"
                  :class="noteIsPrivate ? 'is-private' : 'is-public'"
                  @click="noteIsPrivate = !noteIsPrivate"
                  :title="noteIsPrivate ? 'Private (admin only) — click to make public' : 'Public (visible to user) — click to make private'"
                >
                  <svg v-if="noteIsPrivate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  {{ noteIsPrivate ? 'Private' : 'Public' }}
                </button>
              </div>
              <RichTextEditor v-model="noteDraft" />
              <ReferenceLinksEditor v-model="noteLinks" />
              <div style="display:flex;justify-content:flex-end;margin-top:1rem;">
                <button type="submit" class="premium-btn-primary" :disabled="savingNote || !noteDraft.trim()">
                  {{ savingNote ? 'Saving...' : 'Save Note' }}
                </button>
              </div>
            </form>
          </section>
        </div>

        <!-- RIGHT COLUMN: Sidebar -->
        <aside class="sidebar-column">
          <!-- ── ADMIN FILE UPLOAD ─────────────────────────── -->
          <section class="info-section glass-panel">
            <div class="files-section-header">
              <h3 class="section-title" style="margin-bottom:0">Admin Files</h3>
              <!-- File visibility toggle -->
              <button
                type="button"
                class="visibility-toggle"
                :class="adminFileVisibility === 'private' ? 'is-private' : 'is-public'"
                @click="adminFileVisibility = adminFileVisibility === 'private' ? 'public' : 'private'"
                title="Toggle file visibility"
              >
                <svg v-if="adminFileVisibility === 'private'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                {{ adminFileVisibility === 'private' ? 'Private' : 'Public' }}
              </button>
            </div>

            <!-- Drop zone -->
            <div
              class="upload-drop-zone"
              :class="{ 'is-over': uploadDragOver, 'is-uploading': uploadingFiles }"
              @click="triggerFileInput"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
              @drop="onDrop"
            >
              <input ref="adminFileInput" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf" style="display:none" @change="onFileInputChange" />
              <div class="upload-drop-icon">
                <svg v-if="!uploadingFiles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div v-else class="spinner spinner-sm"></div>
              </div>
              <span class="upload-drop-text">
                {{ uploadingFiles ? 'Uploading...' : 'Drop files or click to upload' }}
              </span>
              <span class="upload-drop-hint">PDF, PNG, JPG, WEBP • max 100MB</span>
            </div>
          </section>

          <!-- ── ALL FILES LIST ───────────────────────────── -->
          <section class="info-section glass-panel">
            <h3 class="section-title">Attached Files</h3>
            <div v-if="order.files?.length" class="file-list">
              <article v-for="file in order.files" :key="file.id" class="file-row" :class="{ 'is-renaming': renamingFileId === file.id }">
                <div class="file-row__icon" :class="{'is-pdf': file.mimeType?.includes('pdf')}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="file-row__info">
                  <div class="file-row__name-wrap">
                    <template v-if="renamingFileId === file.id">
                      <input
                        :value="file._stem ?? getStem(file.fileName)"
                        class="file-rename-input"
                        maxlength="190"
                        :disabled="savingFileNameId === file.id"
                        @input="file._stem = $event.target.value"
                        @keyup.enter.prevent="saveOrderFileName(file)"
                        @keyup.escape="renamingFileId = null"
                        v-focus
                      />
                      <span class="file-ext-badge">{{ getExt(file.fileName) }}</span>
                      <button type="button" class="file-rename-save-btn" @click="saveOrderFileName(file)" :disabled="savingFileNameId === file.id">
                        {{ savingFileNameId === file.id ? '...' : 'Save' }}
                      </button>
                    </template>
                    <a v-else :href="fileDownloadUrl(file.id)" target="_blank" class="file-name-text" download>
                      {{ getStem(file.fileName) }}<em class="file-ext-dim">{{ getExt(file.fileName) }}</em>
                    </a>
                  </div>
                  <div class="file-row__meta">
                    <!-- Visibility badge -->
                    <span class="vis-badge-sm" :class="file.folderType === 'private' ? 'vis-private' : 'vis-public'">
                      {{ file.folderType === 'private' ? '🔒' : '🌐' }}
                    </span>
                    <span>{{ formatFileSize(file.fileSize) }}</span>
                    <span class="meta-sep">·</span>
                    <span>{{ formatCairoFileDateTime(file.updatedAt || file.createdAt) }}</span>
                  </div>
                </div>
                <!-- Actions: hidden during rename to prevent overlap -->
                <div v-if="renamingFileId !== file.id" class="file-row__actions">
                  <a class="file-action-btn" :href="fileDownloadUrl(file.id)" target="_blank" title="Download file" download>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                  <button type="button" class="file-action-btn" title="Rename" @click="renamingFileId = file.id">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button type="button" class="file-action-btn" :title="copiedFileId === file.id ? 'Copied!' : 'Copy link'" @click="copyFileLink(file.id)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span v-if="copiedFileId === file.id" class="copied-feedback">Copied!</span>
                  </button>
                  <button type="button" class="file-action-btn is-danger" title="Delete file"
                    :disabled="deletingFileId === file.id"
                    @click.stop="deleteOrderFile(file.id)">
                    <div v-if="deletingFileId === file.id" class="spinner spinner-sm"></div>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </article>
            </div>
            <p v-else class="empty-state">No files uploaded yet.</p>
          </section>
        </aside>
      </div>
    </div>

    <ClientTalkModal
      v-if="showClientTalk && clientTalkSession && order"
      :order-id="order.id"
      :order-name="order.name"
      :initial-session="clientTalkSession"
      @close="showClientTalk = false"
      @ended="showClientTalk = false"
    />
  </section>
</template>

<style scoped>
.premium-case-profile { padding: 2rem; max-width: 1400px; margin: 0 auto; min-height: 80vh; }
.glass-panel {
  background: rgba(var(--rgb-foreground), 0.03);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px; box-shadow: 0 8px 32px rgba(var(--rgb-background), 0.2);
}
.premium-loading-state, .premium-error-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 400px; gap: 1rem;
}
.spinner { width: 40px; height: 40px; border: 3px solid rgba(var(--rgb-foreground), 0.1); border-top-color: #a89bf9; border-radius: 50%; animation: spin 1s linear infinite; }
.spinner-sm { width: 22px; height: 22px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.premium-btn-primary, .premium-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.6rem 1.25rem; font-size: 0.9rem; font-weight: 700;
  border-radius: 8px; transition: all 0.2s ease; cursor: pointer; border: none;
}
.btn-sm { padding: 0.4rem 0.85rem; font-size: 0.82rem; }
.premium-btn-primary { background: #fee7cb; color: #1a1a1a; }
.premium-btn-primary:hover:not(:disabled) { background: #fff; transform: translateY(-1px); }
.premium-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.premium-btn-secondary { background: rgba(var(--rgb-foreground), 0.05); color: var(--color-text-strong); border: 1px solid rgba(var(--rgb-foreground), 0.1); }
.premium-btn-secondary:hover:not(:disabled) { background: rgba(var(--rgb-foreground), 0.1); }

.error-banner { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; color: #f87171; font-size: 0.9rem; font-weight: 600; }

.profile-hero { display: flex; justify-content: space-between; align-items: flex-end; padding: 2.5rem; margin-bottom: 2rem; background: linear-gradient(145deg, rgba(30,30,35,0.8), rgba(20,20,25,0.9)); flex-wrap: wrap; gap: 1rem; }
.meta-kicker { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
.status-badge { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; padding: 0.35rem 0.85rem; border-radius: 999px; background: rgba(168,155,249,0.15); color: #a89bf9; border: 1px solid rgba(168,155,249,0.3); }
.case-id { font-size: 0.85rem; font-weight: 700; color: rgba(var(--rgb-foreground), 0.4); letter-spacing: 0.05em; }
.case-title { font-size: 2.5rem; font-weight: 800; color: var(--color-text-strong); margin: 0; line-height: 1.1; letter-spacing: -0.02em; }
.hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.content-layout { display: grid; grid-template-columns: 1fr 360px; gap: 1.5rem; align-items: start; }
@media (max-width: 1024px) { .content-layout { grid-template-columns: 1fr; } }
.main-column { display: flex; flex-direction: column; gap: 1.5rem; }
.sidebar-column { display: flex; flex-direction: column; gap: 1.5rem; }

.info-section { padding: 2rem; }
.section-title { font-size: 1.1rem; font-weight: 700; color: var(--color-text-strong); margin: 0 0 1.5rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
.empty-state { color: rgba(var(--rgb-foreground), 0.4); font-size: 0.95rem; font-style: italic; }

.details-grid, .custom-fields-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.detail-item, .cf-item { display: flex; flex-direction: column; gap: 0.4rem; }
.d-label, .cf-label { font-size: 0.75rem; font-weight: 700; color: rgba(var(--rgb-foreground), 0.4); text-transform: uppercase; letter-spacing: 0.05em; }
.d-value, .cf-value { font-size: 0.95rem; font-weight: 600; color: var(--color-text-strong); line-height: 1.4; }
.link-text { color: #a89bf9; cursor: pointer; }
.link-text:hover { text-decoration: underline; }

.rich-text-container { color: rgba(var(--rgb-foreground), 0.85); line-height: 1.6; font-size: 0.95rem; }
.rich-text-container :deep(p) { margin: 0 0 1rem 0; }
.rich-text-container :deep(p:last-child) { margin-bottom: 0; }

/* ── Visibility Toggle ────────────────────────────── */
.visibility-toggle {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.3rem 0.75rem; border-radius: 999px;
  font-size: 0.78rem; font-weight: 700; cursor: pointer;
  border: 1px solid; transition: all 0.2s;
}
.visibility-toggle svg { width: 13px; height: 13px; }
.visibility-toggle.is-private { background: rgba(251,113,133,0.12); color: #fb7185; border-color: rgba(251,113,133,0.3); }
.visibility-toggle.is-private:hover { background: rgba(251,113,133,0.2); }
.visibility-toggle.is-public { background: rgba(52,211,153,0.12); color: #34d399; border-color: rgba(52,211,153,0.3); }
.visibility-toggle.is-public:hover { background: rgba(52,211,153,0.2); }

/* ── Visibility Badge ─────────────────────────────── */
.vis-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700;
}
.vis-badge svg { width: 11px; height: 11px; }
.vis-badge.vis-private { background: rgba(251,113,133,0.12); color: #fb7185; }
.vis-badge.vis-public { background: rgba(52,211,153,0.12); color: #34d399; }
.vis-badge-sm { font-size: 0.78rem; }

/* ── Team Notes ─────────────────────────────────── */
.team-notes-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 0.5rem; }
.team-note-card { background: rgba(var(--rgb-foreground), 0.03); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(var(--rgb-foreground), 0.05); }
.note-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(var(--rgb-foreground), 0.05); flex-wrap: wrap; }
.note-author { display: flex; flex-direction: column; gap: 0.2rem; }
.note-author strong { color: var(--color-text-strong); font-size: 0.95rem; }
.note-meta { font-size: 0.78rem; color: rgba(var(--rgb-foreground), 0.4); }
.note-header-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.note-content { font-size: 0.95rem; line-height: 1.6; }

.note-action-btn {
  display: inline-grid; place-items: center; width: 30px; height: 30px;
  border-radius: 7px; border: 1px solid rgba(var(--rgb-foreground), 0.1);
  background: rgba(var(--rgb-foreground), 0.04); color: rgba(var(--rgb-foreground), 0.5);
  cursor: pointer; transition: all 0.15s;
}
.note-action-btn svg { width: 14px; height: 14px; }
.note-action-btn:hover:not(:disabled) { background: rgba(var(--rgb-foreground), 0.1); color: var(--color-text-strong); }
.note-action-btn.is-danger:hover:not(:disabled) { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }
.note-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.note-edit-footer { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
.note-edit-actions { display: flex; gap: 0.5rem; }

.note-form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; }
.note-form-label { font-weight: 700; color: var(--color-text-strong); font-size: 0.95rem; }

.team-note-form { padding-top: 1.5rem; margin-top: 1.5rem; border-top: 1px solid rgba(var(--rgb-foreground), 0.08); }

/* ── Admin File Upload ─────────────────────────── */
.files-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }

.upload-drop-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 1.75rem 1rem; margin-top: 0.75rem;
  border: 2px dashed rgba(var(--rgb-foreground), 0.15); border-radius: 12px;
  cursor: pointer; transition: all 0.2s;
  background: rgba(var(--rgb-foreground), 0.02);
}
.upload-drop-zone:hover, .upload-drop-zone.is-over { border-color: rgba(168,155,249,0.5); background: rgba(168,155,249,0.05); }
.upload-drop-zone.is-uploading { cursor: wait; opacity: 0.7; }
.upload-drop-icon svg { width: 28px; height: 28px; color: rgba(var(--rgb-foreground), 0.35); }
.upload-drop-text { font-size: 0.88rem; font-weight: 600; color: rgba(var(--rgb-foreground), 0.6); }
.upload-drop-hint { font-size: 0.75rem; color: rgba(var(--rgb-foreground), 0.35); }

/* ── File List ─────────────────────────────────── */
.file-list { display: flex; flex-direction: column; gap: 0.5rem; }
.file-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.8rem; border-radius: 12px; border: 1px solid rgba(var(--rgb-foreground), 0.08); background: rgba(var(--rgb-foreground), 0.03); min-width: 0; }
.file-row__icon { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 8px; background: rgba(var(--rgb-foreground), 0.08); display: grid; place-items: center; }
.file-row__icon.is-pdf { background: rgba(248,113,113,0.15); color: #f87171; }
.file-row__icon svg { width: 18px; height: 18px; }
.file-row__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.file-row__name-wrap { display: flex; align-items: center; gap: 0.5rem; min-width: 0; width: 100%; flex-wrap: wrap; }
.file-name-text { font-weight: 700; font-size: 0.95rem; color: var(--color-text-strong); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.file-name-text:hover { text-decoration: underline; }
.file-ext-dim { font-style: normal; font-weight: 400; color: rgba(var(--rgb-foreground),0.4); font-size: 0.82rem; }
.file-rename-input { flex: 1; width: 100%; min-width: 120px; padding: 0.4rem 0.6rem; border: 1px solid rgba(var(--rgb-accent), 0.5); border-radius: 8px; background: rgba(var(--rgb-background), 0.4); color: var(--color-text-strong); font: inherit; font-weight: 700; font-size: 0.9rem; }
.file-rename-input:focus { outline: 2px solid rgba(var(--rgb-accent), 0.3); }
.file-rename-save-btn { padding: 0.3rem 0.6rem; background: var(--color-accent, #a89bf9); color: #000; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; }
.file-rename-save-btn:hover { opacity: 0.9; }
.file-ext-badge { flex: 0 0 auto; padding: 0.18rem 0.45rem; border-radius: 5px; background: rgba(var(--rgb-foreground), 0.08); color: rgba(var(--rgb-foreground), 0.45); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.file-row__meta { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: rgba(var(--rgb-foreground), 0.45); flex-wrap: wrap; }
.meta-sep { opacity: 0.4; }
.file-row__actions { flex: 0 0 auto; display: flex; align-items: center; gap: 0.35rem; }
.file-action-btn { position: relative; display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid rgba(var(--rgb-foreground), 0.1); border-radius: 7px; background: rgba(var(--rgb-foreground), 0.04); color: rgba(var(--rgb-foreground), 0.6); cursor: pointer; text-decoration: none; transition: all 0.15s; }
.file-action-btn svg { width: 15px; height: 15px; }
.file-action-btn:hover:not(:disabled) { background: rgba(var(--rgb-foreground),0.1); color: var(--color-text-strong); }
.file-action-btn.is-active { background: rgba(var(--rgb-accent), 0.15); border-color: rgba(var(--rgb-accent), 0.4); color: rgba(var(--rgb-accent), 0.9); }
.file-action-btn.is-danger:hover:not(:disabled) { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }
.file-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* During rename, actions are hidden via v-if — info takes full width */
.file-row.is-renaming { align-items: center; }
.file-row.is-renaming .file-row__info { flex: 1; min-width: 0; }

.copied-feedback { position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); background: #34d399; color: #000; padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; animation: popFloatFade 1.5s ease-out forwards; pointer-events: none; }
@keyframes popFloatFade {
  0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.8); }
  15%  { opacity: 1; transform: translate(-50%, 0)   scale(1); }
  80%  { opacity: 1; transform: translate(-50%, 0)   scale(1); }
  100% { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
}
</style>
