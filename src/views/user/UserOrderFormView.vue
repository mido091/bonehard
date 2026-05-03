<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import PhoneInput from '../../components/PhoneInput.vue';
import { api } from '../../services/api';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const customFields = ref([]);
const customValues = reactive({});
const selectedUploads = ref([]);
const uploadInput = ref(null);
const saveProgress = ref(0);
const saveProgressLabel = ref('');

const allowedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const maxUploadSizeMb = 50;
const maxUploadSize = maxUploadSizeMb * 1024 * 1024;

const form = reactive({
  name: '',
  contactPhone: '',
  contactEmail: '',
  targetTime: '',
  clientDescription: '',
});

const targetTimeOptions = ['Same day', '24 hours', '48 hours', '72 hours', '1 week'];

function normalizePayload() {
  return {
    name: form.name,
    contactPhone: form.contactPhone,
    contactEmail: form.contactEmail,
    targetTime: form.targetTime || null,
    clientDescription: form.clientDescription || null,
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

function buildOrderSaveFormData() {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(normalizePayload()));
  selectedUploads.value.forEach((item) => formData.append('files', item.file, item.file.name));
  return formData;
}

async function saveOrder() {
  loading.value = true;
  error.value = '';
  updateSaveProgress(8, 'Preparing order data...');

  try {
    const isUploadingFiles = selectedUploads.value.length > 0;
    updateSaveProgress(18, isUploadingFiles ? 'Uploading files...' : 'Submitting order...');

    await api.upload('/api/user/orders/with-files', buildOrderSaveFormData(), {
      method: 'POST',
      onProgress: (progress) => {
        saveProgress.value = Math.min(92, Math.max(18, Math.round(progress * 0.9)));
        saveProgressLabel.value = isUploadingFiles ? `Uploading files... ${progress}%` : `Submitting... ${progress}%`;
      },
    });

    updateSaveProgress(100, 'Order submitted successfully!');
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push('/dashboard');
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
    <div class="admin-section-header">
      <div>
        <p class="admin-kicker">Order Details</p>
        <h2>Add Order</h2>
      </div>
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
          <span>Target Time</span>
          <AdminSelect v-model="form.targetTime" :options="targetTimeOptions" placeholder="Make a selection" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Project Notes</span>
          <RichTextEditor v-model="form.clientDescription" />
        </label>
      </fieldset>

      <fieldset class="admin-form-section case-files-section">
        <legend>Order Files</legend>

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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div class="dropzone-text">
              <span class="case-upload-dropzone__title">Click or drag files to upload</span>
              <span class="case-upload-dropzone__hint">Images or PDFs. Max {{ maxUploadSizeMb }}MB per file.</span>
            </div>
          </div>
        </label>

        <section v-if="selectedUploads.length" class="case-upload-group">
          <header class="case-upload-group__header">
            <h4>Ready to Upload</h4>
            <span class="file-count-badge">{{ selectedUploads.length }} file{{ selectedUploads.length === 1 ? '' : 's' }}</span>
          </header>
          <div class="case-upload-list">
            <article v-for="item in selectedUploads" :key="item.id" class="case-upload-item is-new">
              <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="case-upload-img-preview" />
              <div v-else class="case-upload-file-icon is-pdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <div class="case-upload-item__body">
                <strong :title="item.name">{{ item.name }}</strong>
                <div class="case-upload-meta">
                  <span class="file-size">{{ formatFileSize(item.size) }}</span>
                  <span class="file-status">Pending Upload</span>
                </div>
              </div>
              <button type="button" class="case-upload-remove" title="Remove file" @click="removeUploadFile(item.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </article>
          </div>
        </section>
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
        <button class="admin-primary-button" type="submit" :disabled="loading">{{ loading ? 'Submitting...' : 'Submit Order' }}</button>
        <button class="admin-link-button" type="button" :disabled="loading" @click="router.push('/dashboard')">Exit</button>
      </div>
    </form>
  </section>
</template>
