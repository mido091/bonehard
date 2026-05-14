<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { API_BASE_URL, api } from '../../services/api';
import WorkflowSummary from '../../components/admin/WorkflowSummary.vue';
import ReferenceLinksList from '../../components/admin/ReferenceLinksList.vue';
import ClientTalkModal from '../../components/ClientTalkModal.vue';
import { statusProgressPercent } from '../../constants/workflowOptions';

const route = useRoute();
const order = ref(null);
const customFields = ref([]);
const loading = ref(false);
const error = ref('');
const copiedFileId = ref(null);
const renamingFileId = ref(null);
const savingFileNameId = ref(null);
const computedProgress = computed(() => statusProgressPercent(order.value?.statusName, order.value?.progressPercentage));
const showClientTalk = ref(false);

const vFocus = { mounted: (el) => el.focus() };

const customFieldRows = computed(() => {
  const values = order.value?.customFieldValues || {};
  return customFields.value
    .map((field) => ({
      ...field,
      value: values[field.fieldKey],
    }))
    .filter((field) => field.value !== undefined && field.value !== null && field.value !== '');
});

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

function formatFileSize(size) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(name) {
  const match = String(name || '').match(/(\.\w+)$/);
  return match ? match[1] : '';
}

function getStem(name) {
  const ext = getExt(name);
  return ext ? String(name).slice(0, -ext.length) : String(name || '');
}

function fileDownloadUrl(fileId) {
  return `${API_BASE_URL}/api/user/orders/${route.params.id}/files/${fileId}/download`;
}

function absoluteFileDownloadUrl(fileId) {
  return new URL(fileDownloadUrl(fileId), window.location.origin).href;
}

async function copyFileLink(fileId) {
  try {
    await navigator.clipboard.writeText(absoluteFileDownloadUrl(fileId));
    copiedFileId.value = fileId;
    setTimeout(() => {
      if (copiedFileId.value === fileId) copiedFileId.value = null;
    }, 1500);
  } catch {
    error.value = 'Could not copy the file link.';
  }
}

function startRename(file) {
  file._stem = getStem(file.fileName);
  renamingFileId.value = file.id;
}

function cancelRename(file) {
  delete file._stem;
  renamingFileId.value = null;
}

async function saveFileName(file) {
  const stem = String(file._stem ?? getStem(file.fileName)).trim();
  if (!stem || savingFileNameId.value === file.id) return;

  const fileName = `${stem}${getExt(file.fileName)}`;
  savingFileNameId.value = file.id;
  error.value = '';

  try {
    const response = await api.patch(`/api/user/orders/${route.params.id}/files/${file.id}`, { fileName });
    if (response.data?.files) {
      order.value = response.data;
    } else if (order.value?.files) {
      order.value.files = order.value.files.map((item) =>
        Number(item.id) === Number(file.id)
          ? { ...item, fileName, _stem: stem, updatedAt: new Date().toISOString() }
          : item
      );
    }
    renamingFileId.value = null;
  } catch (err) {
    error.value = err.message || 'Failed to rename file.';
  } finally {
    savingFileNameId.value = null;
  }
}

async function loadOrder() {
  loading.value = true;
  error.value = '';

  try {
    const [orderResponse, settingsResponse] = await Promise.all([
      api.get(`/api/user/orders/${route.params.id}`),
      api.get('/api/user/orders/settings'),
    ]);
    order.value = orderResponse.data;
    customFields.value = settingsResponse.data?.customFields || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadOrder);
</script>

<template>
  <div class="view-root">
    <section class="admin-page-stack user-order-detail-page">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Order Details</p>
          <h2>{{ order?.name || 'Order' }}</h2>
        </div>
        <div class="admin-toolbar">
          <button class="admin-link-button client-talk-button" type="button" @click="showClientTalk = true">Client Talk</button>
          <RouterLink class="admin-primary-button" :to="`/dashboard/orders/${route.params.id}/edit`">Edit Order</RouterLink>
          <RouterLink class="admin-link-button" to="/dashboard">Back to Orders</RouterLink>
        </div>
      </div>

      <p v-if="loading" class="admin-loading">Loading order...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else-if="order" class="user-order-detail">
        <section class="admin-form-section">
          <legend>Order Summary</legend>
          <dl class="user-order-detail-grid">
            <div>
              <dt>Status</dt>
              <dd>{{ order.statusName || 'Order Received' }}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>
                {{ computedProgress }}%
                <div class="case-progress user-order-progress"><span :style="{ width: `${computedProgress}%` }"></span></div>
              </dd>
            </div>
            <div>
              <dt>Submitted Date</dt>
              <dd>{{ formatDate(order.startDate || order.createdAt) }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ order.contactPhone || '-' }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{{ order.contactEmail || '-' }}</dd>
            </div>
            <div>
              <dt>Target Date</dt>
              <dd>{{ order.targetTime ? new Date(order.targetTime).toLocaleDateString() : '-' }}</dd>
            </div>
          </dl>
        </section>

        <section class="admin-form-section">
          <legend>Implant & Services</legend>
          <WorkflowSummary
            :implant-system="order.implantSystem"
            :implant-system-other="order.implantSystemOther"
            :services-needed="order.servicesNeeded || []"
            :services-needed-other="order.servicesNeededOther"
          />
        </section>

        <section v-if="order.links?.length" class="admin-form-section">
          <legend>Reference Links</legend>
          <ReferenceLinksList :links="order.links" />
        </section>

        <section class="admin-form-section">
          <legend>Project Notes</legend>
          <div v-if="order.clientDescription" class="user-order-rich-text" v-html="order.clientDescription"></div>
          <p v-else class="admin-muted">No notes provided.</p>
        </section>

        <section v-if="customFieldRows.length" class="admin-form-section">
          <legend>Custom Fields</legend>
          <dl class="user-order-detail-grid">
            <div v-for="field in customFieldRows" :key="field.id">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.fieldType === 'checkbox' ? (field.value === 'true' || field.value === true ? 'Yes' : 'No') : field.value }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="order.notes?.length" class="admin-form-section team-notes-section">
          <legend>Team Notes</legend>
          <div class="team-notes-list">
            <article v-for="note in order.notes" :key="note.id" class="team-note-card">
              <div class="note-header">
                <div class="note-author">
                  <strong>{{ note.createdByName || 'Team' }}</strong>
                  <span class="note-meta">{{ formatDate(note.updatedAt || note.createdAt) }}</span>
                </div>
              </div>
              <div class="note-content" v-html="note.content"></div>
              <ReferenceLinksList :links="note.links || []" />
            </article>
          </div>
        </section>

        <section class="admin-form-section">
          <legend>Files</legend>
          <div v-if="order.files?.length" class="case-upload-list">
            <article
              v-for="file in order.files"
              :key="file.id"
              class="case-upload-item"
              :class="{ 'is-renaming': renamingFileId === file.id }"
            >
              <div class="case-upload-file-icon" :class="{ 'is-pdf': file.mimeType?.includes('pdf'), 'is-img': !file.mimeType?.includes('pdf') }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div class="case-upload-item__body">
                <div class="case-upload-name-wrap">
                  <template v-if="renamingFileId === file.id">
                    <input
                      v-model.trim="file._stem"
                      class="file-rename-input"
                      maxlength="190"
                      :disabled="savingFileNameId === file.id"
                      @keyup.enter.prevent="saveFileName(file)"
                      @keyup.escape.prevent="cancelRename(file)"
                      v-focus
                    />
                    <span class="file-ext-badge">{{ getExt(file.fileName) }}</span>
                    <button
                      type="button"
                      class="file-icon-button is-success"
                      title="Save file name"
                      :disabled="savingFileNameId === file.id"
                      @click="saveFileName(file)"
                    >
                      <span v-if="savingFileNameId === file.id" class="file-saving-spinner"></span>
                      <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6 9 17l-5-5"></path>
                      </svg>
                    </button>
                  </template>
                  <a v-else :href="fileDownloadUrl(file.id)" target="_blank" class="case-upload-download" download>
                    {{ getStem(file.fileName) }}<em>{{ getExt(file.fileName) }}</em>
                  </a>
                </div>
                <!-- Action buttons: hidden during rename to avoid overlap -->
                <div v-if="renamingFileId !== file.id" class="case-upload-actions">
                  <a :href="fileDownloadUrl(file.id)" target="_blank" class="file-icon-button" title="Download file" download>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </a>
                  <button type="button" class="file-icon-button" title="Rename file" @click="startRename(file)">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                    </svg>
                  </button>
                  <button type="button" class="file-icon-button" :title="copiedFileId === file.id ? 'Copied' : 'Copy download link'" @click="copyFileLink(file.id)">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span v-if="copiedFileId === file.id" class="copied-feedback">Copied!</span>
                  </button>
                </div>
                <div class="case-upload-meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span>{{ formatDate(file.updatedAt || file.createdAt) }}</span>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="admin-muted">No files uploaded.</p>
        </section>
      </div>
    </div>
    </section>

    <ClientTalkModal
      v-if="showClientTalk"
      :order-id="Number(route.params.id)"
      :order-name="order?.name || ''"
      @close="showClientTalk = false"
    />
  </div>
</template>

<style scoped>
/* Transparent single-root wrapper required by Vue <Transition> */
.view-root { display: contents; }

.user-order-detail {
  display: grid;
  gap: 1.5rem;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-order-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin: 0;
}

.user-order-detail-grid div {
  padding: 1.25rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 12px;
  background: rgba(var(--rgb-foreground), 0.02);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.user-order-detail-grid div:hover {
  background: rgba(var(--rgb-foreground), 0.04);
  border-color: rgba(var(--rgb-accent), 0.2);
}

.user-order-detail-grid dt {
  margin-bottom: 0.5rem;
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.user-order-detail-grid dd {
  margin: 0;
  color: var(--color-text-strong);
  font-weight: 600;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.user-order-progress {
  margin-top: 0.6rem;
  max-width: 12rem;
}

.user-order-rich-text {
  color: rgba(var(--rgb-foreground), 0.85);
  line-height: 1.8;
  font-size: 0.95rem;
}

/* ── Team Notes ───────────────────────────────── */
.team-notes-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.team-note-card {
  padding: 1.5rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 16px;
  background: rgba(var(--rgb-foreground), 0.03);
  position: relative;
  overflow: hidden;
}

.team-note-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 4px; height: 100%;
  background: var(--color-accent);
  opacity: 0.6;
}

.note-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.06);
}

.note-author {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.note-author strong {
  color: var(--color-text-strong);
  font-size: 1rem;
  font-weight: 800;
}

.note-meta {
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.75rem;
  font-weight: 600;
}

.note-content {
  color: rgba(var(--rgb-foreground), 0.9);
  font-size: 0.95rem;
  line-height: 1.7;
}

/* ── Files ────────────────────────────────────── */
.case-upload-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.case-upload-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 12px;
  background: rgba(var(--rgb-foreground), 0.03);
  transition: all 0.2s ease;
}

.case-upload-item:hover {
  background: rgba(var(--rgb-foreground), 0.05);
  border-color: rgba(var(--rgb-accent), 0.3);
  transform: translateY(-2px);
}

.case-upload-file-icon {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
}

.case-upload-file-icon.is-pdf { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.case-upload-file-icon.is-img { background: rgba(var(--rgb-accent), 0.12); color: var(--color-accent); }

.case-upload-file-icon svg { width: 22px; height: 22px; }

.case-upload-item__body {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
}

.case-upload-name-wrap {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  flex-wrap: wrap;
}

.case-upload-download {
  color: var(--color-text-strong);
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-upload-download em {
  color: rgba(var(--rgb-foreground), 0.42);
  font-style: normal;
  font-weight: 600;
}

.case-upload-download:hover { text-decoration: underline; color: var(--color-accent); }

.case-upload-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.file-icon-button {
  position: relative;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.04);
  color: rgba(var(--rgb-foreground), 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  display: grid;
  place-items: center;
  text-decoration: none;
}

.file-icon-button:hover {
  background: rgba(var(--rgb-foreground), 0.1);
  color: var(--color-text-strong);
  border-color: rgba(var(--rgb-accent), 0.4);
}

.file-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.file-icon-button.is-success {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.28);
  color: #4ade80;
}

.file-rename-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(var(--rgb-accent), 0.48);
  border-radius: 8px;
  background: rgba(var(--rgb-background), 0.42);
  color: var(--color-text-strong);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 750;
  outline: none;
}

.file-rename-input:focus {
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.16);
}

.file-ext-badge {
  flex: 0 0 auto;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(var(--rgb-foreground), 0.08);
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.file-saving-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 999px;
  animation: fileSpin 0.75s linear infinite;
}

@keyframes fileSpin {
  to { transform: rotate(360deg); }
}

.case-upload-meta {
  grid-column: 1 / span 2;
  display: flex;
  gap: 0.75rem;
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.72rem;
  font-weight: 700;
}

/* During rename: body becomes single-column, name-wrap uses a grid to keep
   input | ext-badge | save-btn tidy in one row */
.case-upload-item.is-renaming {
  align-items: center;
}

.case-upload-item.is-renaming .case-upload-item__body {
  grid-template-columns: 1fr;
}

.case-upload-item.is-renaming .case-upload-meta {
  grid-column: auto;
}

.case-upload-item.is-renaming .case-upload-name-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.4rem;
}

.copied-feedback {
  position: absolute;
  bottom: 130%;
  left: 50%;
  transform: translateX(-50%);
  background: #10b981;
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  animation: popFloatFade 1.5s ease-out forwards;
}

@keyframes popFloatFade {
  0% { opacity: 0; transform: translate(-50%, 10px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  80% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -15px); }
}

@media (max-width: 600px) {
  .case-upload-list { grid-template-columns: 1fr; }

  .case-upload-item {
    align-items: flex-start;
  }

  .case-upload-item__body {
    grid-template-columns: 1fr;
  }

  .case-upload-actions {
    justify-content: flex-start;
  }

  .case-upload-item.is-renaming .case-upload-name-wrap {
    grid-template-columns: 1fr auto;
  }

  .case-upload-item.is-renaming .file-rename-input {
    grid-column: 1 / -1;
  }

  .case-upload-meta {
    grid-column: auto;
  }
}
</style>
