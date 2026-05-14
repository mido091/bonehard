<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API_BASE_URL, api } from '../../services/api';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import WorkflowFields from '../../components/admin/WorkflowFields.vue';
import ReferenceLinksEditor from '../../components/admin/ReferenceLinksEditor.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  CASE_ALLOWED_UPLOAD_EXTENSIONS,
  CASE_UPLOAD_ACCEPT,
  MAX_CASE_FILE_SIZE,
  MAX_CASE_FILE_SIZE_MB,
  UPLOAD_CATEGORIES,
} from '../../constants/uploadOptions';

// Auto-focus directive for rename inputs
const vFocus = { mounted: (el) => el.focus() };

const { showConfirm } = useConfirmDialog();
const route = useRoute();
const router = useRouter();
const isEdit = computed(() => Boolean(route.params.id));
const statuses = ref([]);
const users = ref([]);
const loading = ref(false);
const error = ref('');
const customFields = ref([]);
const customValues = reactive({});
const existingFiles = ref([]);
const selectedUploads = ref([]);
const savingFileNameId = ref(null);
const copiedFileId = ref(null);
const renamingFileId = ref(null);
const uploadInputs = reactive({});
const saveProgress = ref(0);
const saveProgressLabel = ref('');
// Users whose role is 'user' — shown in the Client dropdown
const clientUsers = computed(() => users.value.filter((u) => u.role === 'user'));

// Staff: everyone who is NOT a plain user — shown in Project Leader and Team Members
const staffUsers = computed(() => users.value.filter((u) => u.role !== 'user'));

// Team Members options: staff with name and role passed to the scoped slot
const teamMemberOptions = computed(() =>
  staffUsers.value.map((u) => ({
    id: u.id,
    label: u.name,
    name: u.name,
    role: u.role,
    value: u.id,
  }))
);
const uploadCategories = UPLOAD_CATEGORIES;
const maxUploadSizeMb = MAX_CASE_FILE_SIZE_MB;

const form = reactive({
  name: '',
  statusId: '',
  startDate: '',
  targetTime: '',
  description: '',
  clientDescription: '',
  price: '',
  targetId: '',
  projectLeaderId: '',
  teamMemberIds: [],
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

/**
 * Build the final payload for create/update.
 * Includes customFieldValues so the backend can persist them.
 */
function normalizePayload() {
  return {
    ...form,
    statusId: Number(form.statusId),
    targetId: form.targetId ? Number(form.targetId) : null,
    secondaryClientId: null,
    projectLeaderId: form.projectLeaderId ? Number(form.projectLeaderId) : null,
    price: form.price === '' ? null : Number(form.price),
    progressTracking: true,
    color: null,
    templateId: null,
    customUid: null,
    implantSystem: form.implantSystem || null,
    implantSystemOther: form.implantSystem === 'Other' ? form.implantSystemOther || null : null,
    servicesNeeded: form.servicesNeeded || [],
    servicesNeededOther: (form.servicesNeeded || []).includes('Other') ? form.servicesNeededOther || null : null,
    referenceLinks: cleanReferenceLinks(form.referenceLinks),
    // Send custom field values as a flat map: { fieldKey: value }
    customFieldValues: { ...customValues },
  };
}

function fillForm(item) {
  Object.assign(form, {
    name: item.name || '',
    statusId: item.statusId || '',
    startDate: item.startDate?.slice(0, 10) || '',
    targetTime: item.targetTime?.slice(0, 10) || '',
    description: item.description || '',
    clientDescription: item.clientDescription || '',
    price: item.price ?? '',
    targetId: item.targetId || '',
    projectLeaderId: item.projectLeaderId || '',
    teamMemberIds: item.teamMemberIds || [],
    implantSystem: item.implantSystem || '',
    implantSystemOther: item.implantSystemOther || '',
    servicesNeeded: item.servicesNeeded || [],
    servicesNeededOther: item.servicesNeededOther || '',
    referenceLinks: (item.links || item.referenceLinks || []).map((link) => ({ label: link.label || '', url: link.url || '' })),
  });

  // Pre-fill custom field values from the response
  if (item.customFieldValues) {
    Object.assign(customValues, item.customFieldValues);
  }
}

async function loadData() {
  const [statusResponse, userResponse] = await Promise.all([
    api.get('/api/case-statuses'),
    api.get('/api/admin/users/options'),
  ]);

  statuses.value = statusResponse.data;
  users.value = userResponse.data;

  // Load custom fields definitions
  try {
    const cfRes = await api.get('/api/cases/settings');
    customFields.value = cfRes.data.customFields || [];
    // Initialize empty values for each field (overwritten below on edit)
    customFields.value.forEach(f => { if (customValues[f.fieldKey] === undefined) customValues[f.fieldKey] = ''; });
  } catch {}

  if (!isEdit.value && statuses.value[0]) {
    form.statusId = statuses.value[0].id;
  }

  if (isEdit.value) {
    const [caseResponse, filesResponse] = await Promise.all([
      api.get(`/api/cases/${route.params.id}`),
      api.get(`/api/cases/${route.params.id}/files?page=1&perPage=100`)
    ]);
    fillForm(caseResponse.data);
    existingFiles.value = filesResponse.data || [];
  }
}

async function removeExistingFile(fileId) {
  const confirmed = await showConfirm('Are you sure you want to permanently delete this file?');
  if (!confirmed) return;
  try {
    await api.delete(`/api/cases/${route.params.id}/files/${fileId}`);
    existingFiles.value = existingFiles.value.filter(f => f.id !== fileId);
  } catch (err) {
    error.value = err.message;
  }
}

async function saveExistingFileName(file) {
  // file._stem holds the editable part; re-attach the original extension before saving
  const stem = String(file._stem ?? getStem(file.fileName) ?? '').trim();
  if (!stem || savingFileNameId.value === file.id) return;

  const ext = getExt(file.fileName);
  const fileName = stem + ext; // always preserve the extension

  savingFileNameId.value = file.id;
  error.value = '';

  try {
    const response = await api.patch(`/api/cases/${route.params.id}/files/${file.id}`, { fileName });
    existingFiles.value = response.data || existingFiles.value.map((item) =>
      item.id === file.id ? { ...item, fileName, _stem: stem, updatedAt: new Date().toISOString() } : item
    );
  } catch (err) {
    error.value = err.message || 'Failed to rename file.';
  } finally {
    savingFileNameId.value = null;
  }
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns the file extension (with dot) from a filename, e.g. ".pdf"
 * Returns '' if there is no extension.
 */
function getExt(name) {
  const match = String(name || '').match(/(\.\w+)$/);
  return match ? match[1] : '';
}

/**
 * Returns the stem (name without extension), e.g. "photo" from "photo.png"
 */
function getStem(name) {
  const ext = getExt(name);
  return ext ? String(name).slice(0, -ext.length) : String(name || '');
}

function uploadFileName(item) {
  const extension = item.ext || getExt(item.file?.name);
  const rawName = String(item.name || getStem(item.file?.name) || 'file').trim();
  const safeStem = extension && rawName.toLowerCase().endsWith(extension.toLowerCase())
    ? rawName.slice(0, -extension.length)
    : rawName;
  return `${safeStem || 'file'}${extension}`;
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
      name: stem,   // editable stem shown in the input
      ext,          // extension is fixed, appended on save
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    });
  });

  if (uploadInputs[category]) uploadInputs[category].value = '';
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
  return `${API_BASE_URL}/api/cases/${route.params.id}/files/${fileId}/download`;
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

function buildCaseSaveFormData() {
  const formData = new FormData();
  formData.append('payload', JSON.stringify({
    ...normalizePayload(),
    fileCategories: selectedUploads.value.map((item) => item.category || 'photos_documents'),
  }));
  selectedUploads.value.forEach((item) => formData.append('files', item.file, uploadFileName(item)));
  return formData;
}

async function saveCase() {
  loading.value = true;
  error.value = '';
  updateSaveProgress(8, 'Preparing case data...');

  try {
    const isUploadingFiles = selectedUploads.value.length > 0;
    updateSaveProgress(
      18,
      isUploadingFiles ? 'Uploading files to cloud storage...' : 'Saving case details...'
    );

    await api.upload(
      isEdit.value ? `/api/cases/${route.params.id}/with-files` : '/api/cases/with-files',
      buildCaseSaveFormData(),
      {
        method: isEdit.value ? 'PATCH' : 'POST',
        onProgress: (progress) => {
          const label = isUploadingFiles
            ? `Uploading files... ${progress}%`
            : `Saving... ${progress}%`;
          saveProgressLabel.value = label;
          saveProgress.value = Math.min(92, Math.max(18, Math.round(progress * 0.9)));
        },
      }
    );

    updateSaveProgress(100, 'Case saved successfully!');
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push('/admin/cases');
  } catch (err) {
    console.error('Save failed:', err);
    error.value = err.message || 'An error occurred while saving';
    updateSaveProgress(0, '');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
onUnmounted(() => {
  selectedUploads.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
});
</script>

<template>
  <section class="admin-panel case-form-page">
    <div class="admin-section-header">
      <div>
        <p class="admin-kicker">Project Details</p>
        <h2>{{ isEdit ? 'Edit Case' : 'Add Case' }}</h2>
      </div>
    </div>

    <p v-if="error" class="admin-error">{{ error }}</p>

    <form class="case-form" @submit.prevent="saveCase">
      <fieldset class="admin-form-section">
        <legend>Project Details</legend>
        <label class="admin-field">
          <span>Case Name *</span>
          <input v-model="form.name" required maxlength="190" />
        </label>
        <label class="admin-field">
          <span>Status *</span>
          <AdminSelect v-model="form.statusId" :options="statuses" required />
        </label>
        <label class="admin-field">
          <span>Case Start Date</span>
          <input v-model="form.startDate" type="date" />
        </label>
        <label class="admin-field">
          <span>Target Date</span>
          <input v-model="form.targetTime" type="date" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Project Notes (Visible to Staff only)</span>
          <RichTextEditor v-model="form.description" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Project Notes (Visible to Client)</span>
          <RichTextEditor v-model="form.clientDescription" />
        </label>
        <label class="admin-field">
          <span>Price</span>
          <input v-model="form.price" type="number" min="0" step="1" placeholder="0" />
        </label>
        <WorkflowFields
          v-model:implant-system="form.implantSystem"
          v-model:implant-system-other="form.implantSystemOther"
          v-model:services-needed="form.servicesNeeded"
          v-model:services-needed-other="form.servicesNeededOther"
        />
        <ReferenceLinksEditor v-model="form.referenceLinks" />
      </fieldset>

      <fieldset class="admin-form-section">
        <legend>Case Assignment</legend>
        <label class="admin-field">
          <span>Client</span>
          <AdminSelect v-model="form.targetId" :options="clientUsers" placeholder="No client" />
        </label>
        <label class="admin-field">
          <span>Project Leader</span>
          <AdminSelect v-model="form.projectLeaderId" :options="staffUsers" placeholder="No leader" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Team Members</span>
          <AdminSelect v-model="form.teamMemberIds" :options="teamMemberOptions" multiple placeholder="Select staff members">
            <template #option="{ option }">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>{{ option.name }}</span>
                <span class="role-badge" :class="'role-badge--' + option.role">{{ option.role }}</span>
              </div>
            </template>
          </AdminSelect>
        </label>
      </fieldset>

      <fieldset class="admin-form-section case-files-section">
        <legend>Case Files</legend>
        
        <!-- Existing Files List -->
        <section v-for="category in uploadCategories" v-show="existingFilesForCategory(category.key).length" :key="`saved-${category.key}`" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>Uploaded: {{ category.title }}</h4>
            <span class="file-count-badge">{{ existingFilesForCategory(category.key).length }} file{{ existingFilesForCategory(category.key).length === 1 ? '' : 's' }}</span>
          </header>
          <div class="file-list">
            <article v-for="file in existingFilesForCategory(category.key)" :key="file.id" class="file-row" :class="{ 'is-renaming': renamingFileId === file.id }">
              <!-- Icon -->
              <div class="file-row__icon" :class="file.mimeType?.includes('pdf') ? 'is-pdf' : 'is-doc'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <!-- Info -->
              <div class="file-row__info">
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
                  <span v-else class="file-name-text">{{ getStem(file.fileName) }}<em class="file-ext-dim">{{ getExt(file.fileName) }}</em></span>
                </div>
                <div class="file-row__meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span class="meta-sep">·</span>
                  <span>{{ new Date(file.updatedAt || file.createdAt).toLocaleDateString() }}</span>
                  <span class="meta-sep">·</span>
                  <a :href="fileDownloadUrl(file.id)" target="_blank" class="meta-download" download>Download</a>
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
                <button type="button" class="file-action-btn is-danger" title="Delete" @click="removeExistingFile(file.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </article>
          </div>
        </section>

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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <div class="dropzone-text">
                <span class="case-upload-dropzone__title">{{ category.title }}</span>
                <span class="case-upload-dropzone__hint">{{ category.hint }} Max {{ maxUploadSizeMb }}MB per file.</span>
              </div>
            </div>
          </label>
        </div>

        <!-- New Uploads Preview -->
        <section v-for="category in uploadCategories" v-show="selectedUploadsForCategory(category.key).length" :key="`new-${category.key}`" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>{{ category.title }}</h4>
            <span class="file-count-badge">{{ selectedUploadsForCategory(category.key).length }} file{{ selectedUploadsForCategory(category.key).length === 1 ? '' : 's' }}</span>
          </header>
          <div class="file-list">
            <article v-for="item in selectedUploadsForCategory(category.key)" :key="item.id" class="file-row is-new">
              <div class="file-row__icon" :class="item.previewUrl ? 'is-img' : 'is-doc'">
                <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="file-row__info">
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
              <div class="file-row__actions">
                <button type="button" class="file-action-btn" title="Remove" @click="removeUploadFile(item.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </article>
          </div>
        </section>
      </fieldset>

      <fieldset class="admin-form-section" v-if="customFields.length">
        <legend>Custom Fields</legend>
        <template v-for="field in customFields" :key="field.id">
          <label class="admin-field" :class="{ 'admin-field--wide': field.fieldType === 'textarea' }">
            <span>{{ field.label }}{{ field.isRequired ? ' *' : '' }}</span>
            <textarea v-if="field.fieldType === 'textarea'" v-model="customValues[field.fieldKey]" rows="3"></textarea>
            <AdminSelect v-else-if="field.fieldType === 'select'" v-model="customValues[field.fieldKey]" :options="field.options || []" placeholder="Select..." />
            <input
              v-else
              v-model="customValues[field.fieldKey]"
              :type="field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : field.fieldType === 'checkbox' ? 'checkbox' : 'text'"
              :required="field.isRequired"
            />
          </label>
        </template>
      </fieldset>

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
        <button class="admin-primary-button" type="submit" :disabled="loading">{{ loading ? 'Saving...' : 'Save' }}</button>
        <button class="admin-link-button" type="button" :disabled="loading" @click="router.push('/admin/cases')">Exit</button>
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

/* ── File list ─────────────────────────────────── */
.file-list { display: flex; flex-direction: column; gap: 0.5rem; }

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

.file-row__icon {
  flex: 0 0 36px; width: 36px; height: 36px;
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.08);
  display: grid; place-items: center; overflow: hidden;
}
.file-row__icon.is-pdf { background: rgba(248,113,113,0.15); color: #f87171; }
.file-row__icon.is-img { background: rgba(139,92,246,0.15); color: #a78bfa; }
.file-row__icon.is-doc { background: rgba(var(--rgb-foreground),0.08); color: rgba(var(--rgb-foreground),0.5); }
.file-row__icon svg { width: 18px; height: 18px; }
.file-row__icon img { width: 100%; height: 100%; object-fit: cover; }

.file-row__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }

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
.file-rename-input:focus { outline: 2px solid rgba(var(--rgb-accent), 0.3); }

.file-ext-badge {
  flex: 0 0 auto;
  padding: 0.18rem 0.45rem;
  border-radius: 5px;
  background: rgba(var(--rgb-foreground), 0.08);
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  white-space: nowrap; user-select: none;
}

.file-row__meta {
  display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
  font-size: 0.75rem; color: rgba(var(--rgb-foreground), 0.45);
}
.meta-sep { opacity: 0.4; }
.meta-download { color: rgba(var(--rgb-accent), 0.8); text-decoration: none; font-weight: 600; }
.meta-download:hover { text-decoration: underline; }
.badge-pending { color: #fbbf24; font-weight: 600; }
.badge-saved   { color: rgba(var(--rgb-accent), 0.9); font-weight: 600; }

.file-row__actions { flex: 0 0 auto; display: flex; align-items: center; gap: 0.35rem; }

.file-action-btn {
  position: relative;
  display: inline-grid; place-items: center;
  width: 32px; height: 32px;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 7px;
  background: rgba(var(--rgb-foreground), 0.04);
  color: rgba(var(--rgb-foreground), 0.6);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.file-action-btn svg { width: 15px; height: 15px; }
.file-action-btn:hover { background: rgba(var(--rgb-foreground),0.1); color: var(--color-text-strong); }
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

/* During rename, actions are hidden via v-if — info takes full width */
.file-row.is-renaming {
  align-items: center;
}

.file-row.is-renaming .file-row__info {
  flex: 1;
  min-width: 0;
}

.copied-feedback {
  position: absolute; bottom: 120%; left: 50%;
  transform: translateX(-50%);
  background: #34d399; color: #000;
  padding: 0.2rem 0.5rem; border-radius: 5px;
  font-size: 0.7rem; font-weight: 800;
  pointer-events: none; white-space: nowrap;
  animation: popFloatFade 1.5s ease-out forwards;
  z-index: 10; box-shadow: 0 4px 12px rgba(52,211,153,0.3);
}
@keyframes popFloatFade {
  0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.8); }
  15%  { opacity: 1; transform: translate(-50%, 0)   scale(1);   }
  80%  { opacity: 1; transform: translate(-50%, 0)   scale(1);   }
  100% { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
}
</style>
