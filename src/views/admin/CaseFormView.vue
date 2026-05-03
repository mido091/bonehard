<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API_BASE_URL, api } from '../../services/api';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

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
const uploadInput = ref(null);
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
const allowedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const maxUploadSizeMb = 50;
const maxUploadSize = maxUploadSizeMb * 1024 * 1024;

const form = reactive({
  name: '',
  statusId: '',
  startDate: '',
  estimatedCompletionDate: '',
  targetTime: '',
  description: '',
  clientDescription: '',
  price: '',
  targetId: '',
  projectLeaderId: '',
  teamMemberIds: [],
});

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
    // Send custom field values as a flat map: { fieldKey: value }
    customFieldValues: { ...customValues },
  };
}

function fillForm(item) {
  Object.assign(form, {
    name: item.name || '',
    statusId: item.statusId || '',
    startDate: item.startDate?.slice(0, 10) || '',
    estimatedCompletionDate: item.estimatedCompletionDate?.slice(0, 10) || '',
    targetTime: item.targetTime || '',
    description: item.description || '',
    clientDescription: item.clientDescription || '',
    price: item.price ?? '',
    targetId: item.targetId || '',
    projectLeaderId: item.projectLeaderId || '',
    teamMemberIds: item.teamMemberIds || [],
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

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function addUploadFiles(event) {
  const files = Array.from(event.target.files || []);
  error.value = '';

  files.forEach((file) => {
    if (!allowedUploadTypes.has(file.type) || file.size > maxUploadSize) {
      error.value = `Only images and PDFs up to ${maxUploadSizeMb}MB are allowed.`;
      return;
    }

    selectedUploads.value.push({
      id: `${file.name}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    });
  });

  if (uploadInput.value) uploadInput.value.value = '';
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

function buildCaseSaveFormData() {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(normalizePayload()));
  selectedUploads.value.forEach((item) => formData.append('files', item.file, item.file.name));
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
          <span>Estimated Completion Date</span>
          <input v-model="form.estimatedCompletionDate" type="date" />
        </label>
        <label class="admin-field">
          <span>Target Time</span>
          <AdminSelect v-model="form.targetTime" :options="['Same day', '24 hours', '48 hours', '72 hours', '1 week']" placeholder="Make a selection" />
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
        <section v-if="existingFiles.length" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>Uploaded Files</h4>
            <span class="file-count-badge">{{ existingFiles.length }} file{{ existingFiles.length === 1 ? '' : 's' }}</span>
          </header>
          <div class="case-upload-list">
            <article v-for="file in existingFiles" :key="file.id" class="case-upload-item">
              <div class="case-upload-file-icon" :class="{ 'is-pdf': file.mimeType?.includes('pdf'), 'is-img': !file.mimeType?.includes('pdf') }">
                <svg v-if="file.mimeType?.includes('pdf')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <div class="case-upload-item__body">
                <a :href="fileDownloadUrl(file.id)" target="_blank" class="case-upload-download" download :title="file.fileName">{{ file.fileName }}</a>
                <div class="case-upload-meta">
                  <span class="file-size">{{ formatFileSize(file.fileSize) }}</span>
                  <span class="file-date">{{ new Date(file.createdAt).toLocaleDateString() }}</span>
                </div>
              </div>
              <button type="button" class="case-upload-remove" @click="removeExistingFile(file.id)" title="Delete file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </article>
          </div>
        </section>

        <label class="case-upload-dropzone admin-field--wide">
          <input
            ref="uploadInput"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
            @change="addUploadFiles"
          />
          <div class="dropzone-content">
            <div class="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <div class="dropzone-text">
              <span class="case-upload-dropzone__title">Click or drag files to upload</span>
              <span class="case-upload-dropzone__hint">Images or PDFs. Max {{ maxUploadSizeMb }}MB per file.</span>
            </div>
          </div>
        </label>

        <!-- New Uploads Preview -->
        <section v-if="selectedUploads.length" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>Ready to Upload</h4>
            <span class="file-count-badge">{{ selectedUploads.length }} file{{ selectedUploads.length === 1 ? '' : 's' }}</span>
          </header>
          <div class="case-upload-list">
            <article v-for="item in selectedUploads" :key="item.id" class="case-upload-item is-new">
              <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="case-upload-img-preview" />
              <div v-else class="case-upload-file-icon is-pdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div class="case-upload-item__body">
                <strong :title="item.name">{{ item.name }}</strong>
                <div class="case-upload-meta">
                  <span class="file-size">{{ formatFileSize(item.size) }}</span>
                  <span class="file-status">Pending Upload</span>
                </div>
              </div>
              <button type="button" class="case-upload-remove" @click="removeUploadFile(item.id)" title="Remove file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
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
