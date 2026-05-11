<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import WorkflowFields from '../../components/admin/WorkflowFields.vue';
import ReferenceLinksEditor from '../../components/admin/ReferenceLinksEditor.vue';
import PhoneInput from '../../components/PhoneInput.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { API_BASE_URL, api } from '../../services/api';
import {
  CASE_ALLOWED_UPLOAD_EXTENSIONS,
  CASE_UPLOAD_ACCEPT,
  MAX_CASE_FILE_SIZE,
  MAX_CASE_FILE_SIZE_MB,
  UPLOAD_CATEGORIES,
} from '../../constants/uploadOptions';

// Auto-focus directive used when rename input is shown
const vFocus = { mounted: (el) => el.focus() };

const route = useRoute();
const router = useRouter();
const { showConfirm } = useConfirmDialog();
const isEditing = computed(() => !!route.params.id);
const loading = ref(false);
const error = ref('');
const customFields = ref([]);
const customValues = reactive({});
const selectedUploads = ref([]);
const uploadInputs = reactive({});
const saveProgress = ref(0);
const saveProgressLabel = ref('');

const uploadCategories = UPLOAD_CATEGORIES;
const maxUploadSizeMb = MAX_CASE_FILE_SIZE_MB;

// Existing files (loaded when editing an order)
const existingFiles = ref([]);
const deletingFileId = ref(null);
const savingFileNameId = ref(null);
const copiedFileId = ref(null);
// Tracks which existing file is in inline-rename mode
const renamingFileId = ref(null);

const form = reactive({
  name: '',
  contactPhone: '',
  contactEmail: '',
  targetTime: '',
  clientDescription: '',
  implantSystem: '',
  implantSystemOther: '',
  servicesNeeded: [],
  servicesNeededOther: '',
  referenceLinks: [],
});

function cleanReferenceLinks(links = []) {
  return links
    .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
    .filter((link) => link.url);
}

function normalizePayload() {
  return {
    name: form.name,
    contactPhone: form.contactPhone,
    contactEmail: form.contactEmail,
    targetTime: form.targetTime || null,
    clientDescription: form.clientDescription || null,
    implantSystem: form.implantSystem || null,
    implantSystemOther: form.implantSystem === 'Other' ? form.implantSystemOther || null : null,
    servicesNeeded: form.servicesNeeded || [],
    servicesNeededOther: (form.servicesNeeded || []).includes('Other') ? form.servicesNeededOther || null : null,
    referenceLinks: cleanReferenceLinks(form.referenceLinks),
    customFieldValues: { ...customValues },
  };
}

async function loadSettings() {
  const response = await api.get('/api/user/orders/settings');
  customFields.value = response.data?.customFields || [];
  customFields.value.forEach((field) => {
    if (customValues[field.fieldKey] === undefined) {
      customValues[field.fieldKey] = field.fieldType === 'checkbox' ? false : '';
    }
  });

  if (isEditing.value) {
    try {
      const orderRes = await api.get(`/api/user/orders/${route.params.id}`);
      const order = orderRes.data;
      form.name = order.name;
      form.contactPhone = order.contactPhone || '';
      form.contactEmail = order.contactEmail || '';
      form.targetTime = order.targetTime?.slice(0, 10) || '';
      form.clientDescription = order.clientDescription || '';
      form.implantSystem = order.implantSystem || '';
      form.implantSystemOther = order.implantSystemOther || '';
      form.servicesNeeded = order.servicesNeeded || [];
      form.servicesNeededOther = order.servicesNeededOther || '';
      form.referenceLinks = (order.links || order.referenceLinks || []).map((link) => ({ label: link.label || '', url: link.url || '' }));
      
      const existingValues = order.customFieldValues || {};
      Object.keys(existingValues).forEach((key) => {
        customValues[key] = existingValues[key];
      });

      // Load existing files so user can delete them
      existingFiles.value = order.files || [];
    } catch (err) {
      error.value = 'Failed to load order details for editing.';
    }
  }
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns the file extension (with dot) e.g. ".pdf"
 */
function getExt(name) {
  const match = String(name || '').match(/(\.\w+)$/);
  return match ? match[1] : '';
}

/**
 * Returns the stem (name without extension) e.g. "photo" from "photo.png"
 */
function getStem(name) {
  const ext = getExt(name);
  return ext ? String(name).slice(0, -ext.length) : String(name || '');
}

function existingFilesForCategory(category) {
  return existingFiles.value.filter((file) => (file.uploadCategory || 'photos_documents') === category);
}

function selectedUploadsForCategory(category) {
  return selectedUploads.value.filter((file) => file.category === category);
}

function addUploadFiles(event, category = 'photos_documents') {
  const files = Array.from(event.target.files || []);
  error.value = '';

  files.forEach((file) => {
    const ext = getExt(file.name).toLowerCase();
    if (!CASE_ALLOWED_UPLOAD_EXTENSIONS.has(ext) || file.size > MAX_CASE_FILE_SIZE) {
      error.value = `Allowed files are PDF, Office docs, archives, images, STL/DCM/PLY/OBJ, and MP4 up to ${maxUploadSizeMb}MB per file.`;
      return;
    }

    const stem = getStem(file.name);
    selectedUploads.value.push({
      id: `${file.name}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random()}`,
      file,
      category,
      name: stem,  // editable stem
      ext,         // read-only extension
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    });
  });

  if (uploadInputs[category]) uploadInputs[category].value = '';
}

/**
 * Delete an existing file from the server.
 * Updates the local list optimistically after successful deletion.
 */
async function deleteExistingFile(fileId) {
  const confirmed = await showConfirm({
    title: 'Delete File',
    message: 'Are you sure you want to delete this file permanently? This action cannot be undone.',
    confirmText: 'Delete',
    type: 'danger'
  });
  if (!confirmed) return;

  if (deletingFileId.value === fileId) return;
  deletingFileId.value = fileId;
  error.value = '';

  try {
    const res = await api.delete(`/api/user/orders/${route.params.id}/files/${fileId}`);
    // Update local files list from server response
    existingFiles.value = res.data?.files || existingFiles.value.filter((f) => f.id !== fileId);
  } catch (err) {
    error.value = err.message || 'Failed to delete file.';
  } finally {
    deletingFileId.value = null;
  }
}

async function saveExistingFileName(file) {
  // Re-attach the original extension so the full filename is always preserved
  const stem = String(file._stem ?? getStem(file.fileName) ?? '').trim();
  if (!stem || savingFileNameId.value === file.id) return;

  const ext = getExt(file.fileName);
  const fileName = stem + ext;

  savingFileNameId.value = file.id;
  error.value = '';

  try {
    const res = await api.patch(`/api/user/orders/${route.params.id}/files/${file.id}`, { fileName });
    existingFiles.value = res.data?.files || existingFiles.value.map((item) =>
      item.id === file.id ? { ...item, fileName, _stem: stem, updatedAt: new Date().toISOString() } : item
    );
  } catch (err) {
    error.value = err.message || 'Failed to rename file.';
  } finally {
    savingFileNameId.value = null;
  }
}

function removeUploadFile(uploadId) {
  const upload = selectedUploads.value.find((item) => item.id === uploadId);
  if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
  selectedUploads.value = selectedUploads.value.filter((item) => item.id !== uploadId);
}

function updateSaveProgress(value, label) {
  saveProgress.value = value;
  saveProgressLabel.value = label;
}

function fileDownloadUrl(fileId) {
  return `${API_BASE_URL}/api/user/orders/${route.params.id}/files/${fileId}/download`;
}

async function copyFileLink(fileId) {
  try {
    await navigator.clipboard.writeText(new URL(fileDownloadUrl(fileId), window.location.origin).href);
    copiedFileId.value = fileId;
    setTimeout(() => {
      if (copiedFileId.value === fileId) copiedFileId.value = null;
    }, 1500);
  } catch {
    error.value = 'Could not copy the file link.';
  }
}

function buildOrderSaveFormData() {
  const formData = new FormData();
  formData.append('payload', JSON.stringify({
    ...normalizePayload(),
    fileCategories: selectedUploads.value.map((item) => item.category || 'photos_documents'),
  }));
  // Append the extension back so the server receives the full original filename
  selectedUploads.value.forEach((item) => formData.append('files', item.file, (item.name || getStem(item.file.name)) + (item.ext || getExt(item.file.name))));
  return formData;
}

async function saveOrder() {
  loading.value = true;
  error.value = '';
  updateSaveProgress(8, 'Preparing order data...');

  try {
    const isUploadingFiles = selectedUploads.value.length > 0;
    updateSaveProgress(18, isUploadingFiles ? 'Uploading files...' : (isEditing.value ? 'Updating order...' : 'Submitting order...'));

    const endpoint = isEditing.value ? `/api/user/orders/${route.params.id}/with-files` : '/api/user/orders/with-files';
    const method = isEditing.value ? 'PUT' : 'POST';

    await api.upload(endpoint, buildOrderSaveFormData(), {
      method,
      onProgress: (progress) => {
        saveProgress.value = Math.min(92, Math.max(18, Math.round(progress * 0.9)));
        saveProgressLabel.value = isUploadingFiles ? `Uploading files... ${progress}%` : `Saving... ${progress}%`;
      },
    });

    updateSaveProgress(100, isEditing.value ? 'Order updated successfully!' : 'Order submitted successfully!');
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push(isEditing.value ? `/dashboard/orders/${route.params.id}` : '/dashboard');
  } catch (err) {
    error.value = err.message || 'An error occurred while submitting your order';
    updateSaveProgress(0, '');
  } finally {
    loading.value = false;
  }
}

onMounted(loadSettings);
onUnmounted(() => {
  selectedUploads.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
});
</script>

<template>
  <section class="admin-panel case-form-page user-order-form-page">
    <ConfirmDialog />
    <div class="admin-section-header">
        <div>
          <p class="admin-kicker">Order Details</p>
          <h2>{{ isEditing ? 'Edit Order' : 'Add Order' }}</h2>
        </div>
        <RouterLink
          class="admin-link-button client-talk-button"
          :to="isEditing ? `/dashboard/chats?orderId=${route.params.id}` : '/dashboard/chats?draftOrder=1'"
        >
          Client Talk
        </RouterLink>
      </div>

    <p v-if="error" class="admin-error">{{ error }}</p>

    <form class="case-form" @submit.prevent="saveOrder">
      <fieldset class="admin-form-section">
        <legend>Order Details</legend>
        <label class="admin-field">
          <span>Order Name *</span>
          <input v-model="form.name" required maxlength="190" />
        </label>
        <div class="admin-field">
          <span>Phone Number *</span>
          <PhoneInput v-model="form.contactPhone" placeholder="50 123 4567" :required="true" />
        </div>
        <label class="admin-field">
          <span>Email Address *</span>
          <input v-model="form.contactEmail" type="email" required maxlength="190" autocomplete="email" />
        </label>
        <label class="admin-field">
          <span>Target Date</span>
          <input v-model="form.targetTime" type="date" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Project Notes</span>
          <RichTextEditor v-model="form.clientDescription" />
        </label>
        <WorkflowFields
          v-model:implant-system="form.implantSystem"
          v-model:implant-system-other="form.implantSystemOther"
          v-model:services-needed="form.servicesNeeded"
          v-model:services-needed-other="form.servicesNeededOther"
        />
        <ReferenceLinksEditor v-model="form.referenceLinks" />
      </fieldset>

      <fieldset class="admin-form-section case-files-section">
        <legend>Order Files</legend>

        <div class="categorized-upload-grid">
          <label v-for="category in uploadCategories" :key="category.key" class="case-upload-dropzone categorized-upload-card admin-field--wide">
            <input
              :ref="(el) => { if (el) uploadInputs[category.key] = el }"
              type="file"
              multiple
              :accept="CASE_UPLOAD_ACCEPT"
              @change="addUploadFiles($event, category.key)"
            />
            <div class="dropzone-content">
              <div class="dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div class="dropzone-text">
                <span class="case-upload-dropzone__title">{{ category.title }}</span>
                <span class="case-upload-dropzone__hint">{{ category.hint }} Max {{ maxUploadSizeMb }}MB per file.</span>
              </div>
            </div>
          </label>
        </div>

        <!-- New files queued for upload -->
        <section v-for="category in uploadCategories" v-show="selectedUploadsForCategory(category.key).length" :key="`new-${category.key}`" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>{{ category.title }}</h4>
            <span class="file-count-badge">{{ selectedUploadsForCategory(category.key).length }} file{{ selectedUploadsForCategory(category.key).length === 1 ? '' : 's' }}</span>
          </header>
          <div class="file-list">
            <article v-for="item in selectedUploadsForCategory(category.key)" :key="item.id" class="file-row is-new">
              <!-- Icon -->
              <div class="file-row__icon" :class="item.previewUrl ? 'is-img' : 'is-doc'">
                <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <!-- Info -->
              <div class="file-row__info">
                <!-- Name: always editable for new uploads -->
                <div class="file-row__name-wrap">
                  <input v-model.trim="item.name" class="file-rename-input" maxlength="190" />
                  <span class="file-ext-badge">{{ item.ext }}</span>
                </div>
                <div class="file-row__meta">
                  <span>{{ formatFileSize(item.size) }}</span>
                  <span class="meta-sep">·</span>
                  <span class="badge-pending">Pending Upload</span>
                </div>
              </div>
              <!-- Actions -->
              <div class="file-row__actions">
                <button type="button" class="file-action-btn" title="Remove" @click="removeUploadFile(item.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </article>
          </div>
        </section>

        <!-- Existing saved files (edit mode) -->
        <section v-for="category in uploadCategories" v-show="isEditing && existingFilesForCategory(category.key).length" :key="`saved-${category.key}`" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>Uploaded: {{ category.title }}</h4>
            <span class="file-count-badge">{{ existingFilesForCategory(category.key).length }} file{{ existingFilesForCategory(category.key).length === 1 ? '' : 's' }}</span>
          </header>
          <div class="file-list">
            <article v-for="file in existingFilesForCategory(category.key)" :key="file.id" class="file-row">
              <!-- Icon -->
              <div class="file-row__icon" :class="file.mimeType?.includes('pdf') ? 'is-pdf' : 'is-doc'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <!-- Info -->
              <div class="file-row__info">
                <!-- Name display or rename input -->
                <div class="file-row__name-wrap">
                  <template v-if="renamingFileId === file.id">
                    <input
                      :value="file._stem ?? getStem(file.fileName)"
                      class="file-rename-input"
                      maxlength="190"
                      :disabled="savingFileNameId === file.id"
                      @input="file._stem = $event.target.value"
                      @blur="saveExistingFileName(file); renamingFileId = null"
                      @keyup.enter.prevent="saveExistingFileName(file); renamingFileId = null"
                      @keyup.escape="renamingFileId = null"
                      v-focus
                    />
                    <span class="file-ext-badge">{{ getExt(file.fileName) }}</span>
                  </template>
                  <span v-else class="file-name-text" @dblclick="renamingFileId = file.id">{{ getStem(file.fileName) }}<em class="file-ext-dim">{{ getExt(file.fileName) }}</em></span>
                </div>
                <div class="file-row__meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span class="meta-sep">·</span>
                  <span>{{ new Date(file.updatedAt || file.createdAt).toLocaleDateString() }}</span>
                  <span class="meta-sep">·</span>
                  <span class="badge-saved">Saved</span>
                </div>
              </div>
              <!-- Actions -->
              <div class="file-row__actions">
                <!-- Rename toggle -->
                <button
                  type="button"
                  class="file-action-btn"
                  :class="{ 'is-active': renamingFileId === file.id }"
                  title="Rename"
                  @click="renamingFileId = renamingFileId === file.id ? null : file.id"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <!-- Copy link -->
                <button type="button" class="file-action-btn" :title="copiedFileId === file.id ? 'Copied!' : 'Copy link'" @click="copyFileLink(file.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span v-if="copiedFileId === file.id" class="copied-feedback">Copied!</span>
                </button>
                <!-- Delete -->
                <button
                  type="button"
                  class="file-action-btn is-danger"
                  title="Delete"
                  :disabled="deletingFileId === file.id"
                  @click.stop="deleteExistingFile(file.id)"
                >
                  <div v-if="deletingFileId === file.id" class="file-deleting-spinner"></div>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </article>
          </div>
        </section>

        <p v-if="isEditing && !existingFiles.length" class="admin-muted" style="margin-top: 0.5rem">No files uploaded yet.</p>

      </fieldset>

      <fieldset v-if="customFields.length" class="admin-form-section">
        <legend>Custom Fields</legend>
        <template v-for="field in customFields" :key="field.id">
          <label class="admin-field" :class="{ 'admin-field--wide': field.fieldType === 'textarea' }">
            <span>{{ field.label }}{{ field.isRequired ? ' *' : '' }}</span>
            <textarea v-if="field.fieldType === 'textarea'" v-model="customValues[field.fieldKey]" rows="3" :required="field.isRequired"></textarea>
            <AdminSelect
              v-else-if="field.fieldType === 'select'"
              v-model="customValues[field.fieldKey]"
              :options="field.options || []"
              :required="field.isRequired"
              placeholder="Select..."
            />
            <input
              v-else
              v-model="customValues[field.fieldKey]"
              :type="field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : field.fieldType === 'checkbox' ? 'checkbox' : 'text'"
              :required="field.fieldType !== 'checkbox' && field.isRequired"
            />
          </label>
        </template>
      </fieldset>

      <ReferenceLinksEditor v-model="form.referenceLinks" />

      <div class="case-form-footer">
        <div v-if="loading" class="case-save-progress" role="status" aria-live="polite">
          <div class="case-save-progress__meta">
            <span>{{ saveProgressLabel }}</span>
            <strong>{{ saveProgress }}%</strong>
          </div>
          <div class="case-save-progress__track" aria-hidden="true">
            <span :style="{ width: `${saveProgress}%` }"></span>
          </div>
        </div>
        <button class="admin-primary-button" type="submit" :disabled="loading">{{ loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Submit Order') }}</button>
        <RouterLink
          class="admin-link-button client-talk-button"
          :to="isEditing ? `/dashboard/chats?orderId=${route.params.id}` : '/dashboard/chats?draftOrder=1'"
        >
          Client Talk
        </RouterLink>
        <button class="admin-link-button" type="button" :disabled="loading" @click="router.back()">Cancel</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.categorized-upload-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.categorized-upload-card {
  min-height: 9.5rem;
  margin: 0;
}

.categorized-upload-card.admin-field--wide {
  grid-column: auto;
}

.categorized-upload-card :deep(.dropzone-content),
.categorized-upload-card .dropzone-content {
  min-height: 12rem;
  padding: 1.45rem 1rem;
}

.categorized-upload-card :deep(.dropzone-icon),
.categorized-upload-card .dropzone-icon {
  width: 3.4rem;
  height: 3.4rem;
}

.categorized-upload-card :deep(.dropzone-icon svg),
.categorized-upload-card .dropzone-icon svg {
  width: 1.7rem;
  height: 1.7rem;
}

.categorized-upload-card :deep(.case-upload-dropzone__title),
.categorized-upload-card .case-upload-dropzone__title {
  font-size: 1rem;
  line-height: 1.25;
}

.categorized-upload-card :deep(.case-upload-dropzone__hint),
.categorized-upload-card .case-upload-dropzone__hint {
  font-size: 0.78rem;
  line-height: 1.45;
}

@media (max-width: 1180px) {
  .categorized-upload-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .categorized-upload-grid {
    grid-template-columns: 1fr;
  }
}

/* ── File list ────────────────────────────────── */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  background: rgba(var(--rgb-foreground), 0.03);
  min-width: 0;
}

/* Icon cell: fixed size, never shrinks */
.file-row__icon {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.08);
  display: grid;
  place-items: center;
  overflow: hidden;
}
.file-row__icon.is-pdf { background: rgba(248,113,113,0.15); color: #f87171; }
.file-row__icon.is-img { background: rgba(139,92,246,0.15); color: #a78bfa; }
.file-row__icon.is-doc { background: rgba(var(--rgb-foreground), 0.08); color: rgba(var(--rgb-foreground),0.5); }
.file-row__icon svg { width: 18px; height: 18px; }
.file-row__icon img { width: 100%; height: 100%; object-fit: cover; }

/* Info cell: takes remaining space, clips overflow */
.file-row__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

/* Name row */
.file-row__name-wrap { 
  display: flex; 
  align-items: center; 
  gap: 0.5rem; 
  min-width: 0;
  flex-wrap: wrap; 
}

.file-name-text {
  font-weight: 700; font-size: 0.95rem;
  color: var(--color-text-strong);
  text-decoration: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}
.file-name-text:hover { text-decoration: underline; }
.file-ext-dim { font-style: normal; font-weight: 400; color: rgba(var(--rgb-foreground),0.4); font-size: 0.82rem; }

.file-rename-input {
  flex: 1;
  min-width: 120px;
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(var(--rgb-accent), 0.5);
  border-radius: 8px;
  background: rgba(var(--rgb-background), 0.4);
  color: var(--color-text-strong);
  font: inherit; font-weight: 700; font-size: 0.9rem;
}
.file-rename-input:focus {
  outline: 2px solid rgba(var(--rgb-accent), 0.3);
}

/* Extension badge */
.file-ext-badge {
  flex: 0 0 auto;
  padding: 0.18rem 0.45rem;
  border-radius: 5px;
  background: rgba(var(--rgb-foreground), 0.08);
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
}

/* Meta row */
.file-row__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: rgba(var(--rgb-foreground), 0.45);
  flex-wrap: wrap;
}
.meta-sep { opacity: 0.4; }
.badge-pending { color: #fbbf24; font-weight: 600; }
.badge-saved   { color: rgba(var(--rgb-accent), 0.9); font-weight: 600; }

/* Actions cell: fixed, never shrinks */
.file-row__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.file-action-btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 7px;
  background: rgba(var(--rgb-foreground), 0.04);
  color: rgba(var(--rgb-foreground), 0.6);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.file-action-btn svg { width: 15px; height: 15px; }
.file-action-btn:hover {
  background: rgba(var(--rgb-foreground), 0.1);
  color: var(--color-text-strong);
}
.file-action-btn.is-active {
  background: rgba(var(--rgb-accent), 0.15);
  border-color: rgba(var(--rgb-accent), 0.4);
  color: rgba(var(--rgb-accent), 0.9);
}
.file-action-btn.is-danger:hover {
  background: rgba(248,113,113,0.15);
  border-color: rgba(248,113,113,0.3);
  color: #f87171;
}
.file-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Copied toast */
.copied-feedback {
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: #34d399;
  color: #000;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 800;
  pointer-events: none;
  white-space: nowrap;
  animation: popFloatFade 1.5s ease-out forwards;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(52,211,153,0.3);
}
@keyframes popFloatFade {
  0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.8); }
  15%  { opacity: 1; transform: translate(-50%, 0)   scale(1);   }
  80%  { opacity: 1; transform: translate(-50%, 0)   scale(1);   }
  100% { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
}

/* Deleting spinner */
.file-deleting-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(var(--rgb-foreground), 0.2);
  border-top-color: #f87171;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
