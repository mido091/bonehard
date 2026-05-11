<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../../services/api';
import { UPLOAD_CATEGORIES } from '../../constants/uploadOptions';

const route = useRoute();
const rows = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(false);
const error = ref('');

const filters = reactive({
  search: '',
  uploadCategory: '',
  page: 1,
  perPage: 20,
});

const isFiles = computed(() => route.name === 'user-order-files');
const pageTitle = computed(() => (isFiles.value ? 'Files' : 'Notes'));
const endpoint = computed(() => (isFiles.value ? '/api/user/orders/files' : '/api/user/orders/notes'));
const totalPages = computed(() => Math.max(Math.ceil((meta.value.total || 0) / (meta.value.perPage || 20)), 1));

const categoryOptions = computed(() => [
  { key: '', title: 'All Categories' },
  ...UPLOAD_CATEGORIES,
]);

const groupedRows = computed(() => {
  const map = new Map();
  rows.value.forEach((row) => {
    const key = `${row.caseId || 'general'}:${row.caseName || 'General'}`;
    if (!map.has(key)) {
      map.set(key, {
        caseId: row.caseId,
        caseName: row.caseName || 'General',
        sourceType: row.sourceType || 'order',
        items: [],
      });
    }
    map.get(key).items.push(row);
  });
  return Array.from(map.values());
});

function queryString() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function categoryLabel(category) {
  return UPLOAD_CATEGORIES.find((item) => item.key === category)?.title || 'Photos & Documents';
}

async function loadRows() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get(`${endpoint.value}?${queryString()}`);
    rows.value = response.data || [];
    meta.value = response.meta || meta.value;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  filters.page = 1;
  loadRows();
}

function changePage(page) {
  filters.page = Math.min(Math.max(page, 1), totalPages.value);
  loadRows();
}

watch(() => route.name, () => {
  filters.page = 1;
  filters.uploadCategory = '';
  loadRows();
});

onMounted(loadRows);
</script>

<template>
  <section class="admin-page-stack user-library-page">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Order Library</p>
          <h2>{{ pageTitle }}</h2>
        </div>
        <RouterLink class="admin-primary-button" to="/dashboard/orders/new">+ Add Order</RouterLink>
      </div>

      <form class="library-filter" @submit.prevent="applyFilters">
        <label class="admin-field">
          <span>Search</span>
          <input v-model="filters.search" type="search" :placeholder="isFiles ? 'File or order name...' : 'Note or order name...'" />
        </label>
        <label v-if="isFiles" class="admin-field">
          <span>File Category</span>
          <select v-model="filters.uploadCategory">
            <option v-for="category in categoryOptions" :key="category.key" :value="category.key">
              {{ category.title }}
            </option>
          </select>
        </label>
        <button class="admin-link-button" type="submit">Search</button>
      </form>

      <p v-if="loading" class="admin-loading">Loading {{ pageTitle.toLowerCase() }}...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="library-groups">
        <article v-for="group in groupedRows" :key="`${group.caseId}-${group.caseName}`" class="library-group">
          <header class="library-group__header">
            <div>
              <span class="library-group__type">{{ group.sourceType }}</span>
              <h3>{{ group.caseName }}</h3>
            </div>
            <RouterLink v-if="group.caseId" class="admin-link-button" :to="`/dashboard/orders/${group.caseId}`">Open Order</RouterLink>
          </header>

          <div class="library-items">
            <template v-if="isFiles">
              <a
                v-for="item in group.items"
                :key="item.id"
                class="library-item library-item--link"
                :href="item.fileUrl"
                target="_blank"
                rel="noopener"
              >
                <span class="library-item__icon">FILE</span>
                <span>
                  <strong>{{ item.fileName }}</strong>
                  <small>{{ categoryLabel(item.uploadCategory) }} · {{ formatDate(item.createdAt || item.updatedAt) }}</small>
                </span>
              </a>
            </template>

            <template v-else>
              <article v-for="item in group.items" :key="item.id" class="library-item">
                <span class="library-item__icon">NOTE</span>
                <span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.noteType || 'Team Notes' }} · {{ formatDate(item.updatedAt || item.createdAt) }}</small>
                  <span v-if="item.content" class="library-item__content" v-html="item.content"></span>
                </span>
              </article>
            </template>
          </div>
        </article>

        <p v-if="!rows.length" class="admin-empty">No {{ pageTitle.toLowerCase() }} found yet.</p>
      </div>

      <div class="admin-pagination">
        <button class="admin-link-button" type="button" :disabled="filters.page <= 1" @click="changePage(filters.page - 1)">Previous</button>
        <span>Page {{ meta.page }} of {{ totalPages }} - {{ meta.total }} total</span>
        <button class="admin-link-button" type="button" :disabled="filters.page >= totalPages" @click="changePage(filters.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.library-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem) auto;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1.25rem;
}

.library-groups {
  display: grid;
  gap: 1rem;
}

.library-group {
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.9rem;
  background: rgba(var(--rgb-foreground), 0.035);
  overflow: hidden;
}

.library-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.library-group__header h3 {
  margin: 0.2rem 0 0;
  color: var(--color-text-strong);
}

.library-group__type {
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.library-items {
  display: grid;
  gap: 0.65rem;
  padding: 1rem;
}

.library-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: start;
  padding: 0.85rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 0.72rem;
  background: rgba(var(--rgb-background), 0.28);
  color: var(--color-text-strong);
  text-decoration: none;
}

.library-item--link:hover {
  border-color: rgba(var(--rgb-accent), 0.34);
  background: rgba(var(--rgb-accent), 0.07);
}

.library-item__icon {
  padding: 0.34rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--rgb-accent), 0.12);
  color: var(--color-text);
  font-size: 0.66rem;
  font-weight: 900;
}

.library-item strong,
.library-item small {
  display: block;
}

.library-item small {
  margin-top: 0.2rem;
  color: rgba(var(--rgb-foreground), 0.56);
}

.library-item__content {
  display: block;
  margin-top: 0.6rem;
  color: rgba(var(--rgb-foreground), 0.72);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .library-filter {
    grid-template-columns: 1fr;
  }

  .library-group__header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
