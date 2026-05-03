<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { API_BASE_URL, api } from '../../services/api';

const route = useRoute();
const order = ref(null);
const customFields = ref([]);
const loading = ref(false);
const error = ref('');

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

function fileDownloadUrl(fileId) {
  return `${API_BASE_URL}/api/user/orders/${route.params.id}/files/${fileId}/download`;
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
  <section class="admin-page-stack user-order-detail-page">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Order Details</p>
          <h2>{{ order?.name || 'Order' }}</h2>
        </div>
        <div class="admin-toolbar">
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
              <dt>Target Time</dt>
              <dd>{{ order.targetTime || '-' }}</dd>
            </div>
          </dl>
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

        <section class="admin-form-section">
          <legend>Files</legend>
          <div v-if="order.files?.length" class="case-upload-list">
            <article v-for="file in order.files" :key="file.id" class="case-upload-item">
              <div class="case-upload-file-icon" :class="{ 'is-pdf': file.mimeType?.includes('pdf'), 'is-img': !file.mimeType?.includes('pdf') }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div class="case-upload-item__body">
                <a :href="fileDownloadUrl(file.id)" target="_blank" class="case-upload-download" download>{{ file.fileName }}</a>
                <div class="case-upload-meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span>{{ formatDate(file.createdAt) }}</span>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="admin-muted">No files uploaded.</p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.user-order-detail {
  display: grid;
  gap: 1.25rem;
}

.user-order-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
}

.user-order-detail-grid div {
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-accent), 0.1);
  border-radius: 0.75rem;
  background: rgba(var(--rgb-foreground), 0.03);
}

.user-order-detail-grid dt {
  margin-bottom: 0.4rem;
  color: rgba(var(--rgb-foreground), 0.55);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.user-order-detail-grid dd {
  margin: 0;
  color: var(--color-text-strong);
  overflow-wrap: anywhere;
}

.user-order-rich-text {
  color: rgba(var(--rgb-foreground), 0.82);
  line-height: 1.7;
}

@media (max-width: 720px) {
  .user-order-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
