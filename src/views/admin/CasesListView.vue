<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm } = useConfirmDialog();
const router = useRouter();

const officialStatuses = ['New', 'In Progress', 'Completed'];
const statusProgressMap = {
  New: 10,
  'In Progress': 55,
  Completed: 100,
};

const filters = reactive({
  search: '',
  statusIds: [],
  targetId: '',
  projectLeaderId: '',
  fromDueDate: '',
  toDueDate: '',
  perPage: 20,
  page: 1,
  sortBy: 'createdAt',
  sortDir: 'desc',
});

const cases = ref([]);
const statuses = ref([]);
const users = ref([]);
const teams = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(false);
const error = ref('');
const viewMode = ref('list');
const filtersOpen = ref(false);
const actionMenuId = ref(null);
const quickStatus = ref('all');

const totalPages = computed(() => Math.max(Math.ceil(meta.value.total / meta.value.perPage), 1));

function normalizeStatusName(value) {
  if (officialStatuses.includes(value)) return value;

  const text = String(value || '').toLowerCase();
  if (['completed', 'delivered', 'closed'].some((token) => text.includes(token))) return 'Completed';
  if (['progress', 'planning', 'approved', 'guide', 'qc', 'hold', 'printing', 'shipping'].some((token) => text.includes(token))) {
    return 'In Progress';
  }

  return 'New';
}

function normalizeCase(item) {
  return {
    ...item,
    statusName: normalizeStatusName(item.statusName),
  };
}

function statusOptionsFor(item) {
  const current = normalizeStatusName(item.statusName);
  const currentIndex = officialStatuses.indexOf(current);
  return officialStatuses.slice(currentIndex + 1);
}

function statusProgressPercent(item) {
  return statusProgressMap[normalizeStatusName(item.statusName)] || 0;
}

function queryString() {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    if (value === false && key === 'archived') return;
    if (value !== '' && value !== null && value !== undefined) {
      params.set(key, value);
    }
  });

  params.set('view', viewMode.value);
  return params.toString();
}

async function loadCases() {
  loading.value = true;
  error.value = '';

  try {
    const response = await api.get(`/api/cases?${queryString()}`);
    cases.value = (response.data || []).map(normalizeCase);
    meta.value = response.meta;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  filters.page = 1;
  loadCases();
}

function changePage(nextPage) {
  filters.page = Math.min(Math.max(nextPage, 1), totalPages.value);
  loadCases();
}

function toggleStatus(id) {
  const value = Number(id);
  quickStatus.value = 'all';
  if (filters.statusIds.includes(value)) {
    filters.statusIds = filters.statusIds.filter((item) => item !== value);
  } else {
    filters.statusIds = [...filters.statusIds, value];
  }
}

function applyQuickStatus(name) {
  quickStatus.value = name;
  filters.statusIds = [];
  if (name !== 'all') {
    const status = statuses.value.find((item) => item.name === name);
    if (status) filters.statusIds = [status.id];
  }
  applyFilters();
}

function cycleSort(column) {
  if (filters.sortBy === column) {
    filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    filters.sortBy = column;
    filters.sortDir = 'asc';
  }
  loadCases();
}

async function archiveCase(id) {
  const confirmed = await showConfirm('Delete this case? It will be removed from the active cases list.');
  if (!confirmed) return;
  await api.delete(`/api/cases/${id}`);
  actionMenuId.value = null;
  await loadCases();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-US') : 'Not Provided';
}

function toggleActionMenu(id) {
  actionMenuId.value = actionMenuId.value === id ? null : id;
}

function openCaseDetails(id) {
  actionMenuId.value = null;
  router.push(`/admin/cases/${id}`);
}

async function updateCaseStatus(item, statusName) {
  const response = await api.patch(`/api/cases/${item.id}/status`, { statusName });
  const updated = normalizeCase(response.data);
  item.statusId = updated.statusId;
  item.statusName = updated.statusName;
  item.statusColor = updated.statusColor;
  actionMenuId.value = null;
}

onMounted(async () => {
  const [statusResponse, userResponse, teamResponse] = await Promise.all([
    api.get('/api/case-statuses'),
    api.get('/api/admin/users/options'),
    api.get('/api/admin/teams/options'),
  ]);
  statuses.value = (statusResponse.data || []).filter((status) => officialStatuses.includes(status.name));
  users.value = userResponse.data;
  teams.value = teamResponse.data;
  await loadCases();
});
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Cases Management</p>
          <h2>Cases</h2>
          <div class="case-status-filter" aria-label="Quick case status filter">
            <button
              class="admin-filter-chip"
              :class="{ 'admin-filter-chip--active': quickStatus === 'all' }"
              type="button"
              @click="applyQuickStatus('all')"
            >
              All
            </button>
            <button
              v-for="statusName in officialStatuses"
              :key="statusName"
              class="admin-filter-chip"
              :class="{ 'admin-filter-chip--active': quickStatus === statusName }"
              type="button"
              @click="applyQuickStatus(statusName)"
            >
              {{ statusName }}
            </button>
          </div>
        </div>

        <div class="admin-toolbar">
          <div class="admin-toolbar__summary">
            <span>{{ meta.total }} cases</span>
          </div>
          <AdminSelect
            v-model="filters.perPage"
            :options="[{value: 20, label: '20 / page'}, {value: 50, label: '50 / page'}, {value: 100, label: '100 / page'}]"
            style="width: 140px;"
            @change="applyFilters"
          />
          <button class="admin-link-button" type="button" @click="filtersOpen = !filtersOpen">Filter</button>
          <button class="admin-link-button" type="button" @click="viewMode = viewMode === 'list' ? 'card' : 'list'">
            {{ viewMode === 'list' ? 'Card View' : 'List View' }}
          </button>
          <RouterLink class="admin-primary-button" to="/admin/cases/new">+ Add Case</RouterLink>
        </div>
      </div>

      <Transition name="filter-fade">
        <form v-if="filtersOpen" class="admin-filter-panel glass-panel" @submit.prevent="applyFilters">
          <div class="filter-panel-header">
            <h3>Advanced Filters</h3>
            <button class="admin-link-button" type="button" @click="filtersOpen = false">Close</button>
          </div>
          
          <div class="admin-filter-grid">
            <label class="admin-field">
              <span>Search by Name</span>
              <input v-model="filters.search" type="search" placeholder="Case name..." class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>Search By Client</span>
              <AdminSelect v-model="filters.targetId" :options="users" placeholder="All Clients" class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>Project Leader</span>
              <AdminSelect v-model="filters.projectLeaderId" :options="users" placeholder="All Leaders" class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>From Due Date</span>
              <input v-model="filters.fromDueDate" type="date" class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>To Due Date</span>
              <input v-model="filters.toDueDate" type="date" class="glass-input" />
            </label>
          </div>
          
          <div class="filter-panel-actions">
            <button class="admin-primary-button" type="submit" style="width: 100%; max-width: 200px;">Apply Filters</button>
          </div>
        </form>
      </Transition>

      <p v-if="loading" class="admin-loading">Loading cases...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else-if="viewMode === 'card'" class="case-card-grid">
        <article
          v-for="item in cases"
          :key="item.id"
          class="case-card case-card--interactive"
          role="link"
          tabindex="0"
          :aria-label="`Open details for ${item.name}`"
          @click="openCaseDetails(item.id)"
          @keydown.enter.prevent="openCaseDetails(item.id)"
          @keydown.space.prevent="openCaseDetails(item.id)"
        >
          <span class="case-status" :style="{ '--status-color': item.statusColor }">{{ item.statusName }}</span>
          <h3 class="case-click-title">{{ item.name }}</h3>
          <p>{{ item.targetName || 'No target assigned' }}</p>
          <div class="case-progress">
            <span :style="{ width: `${statusProgressPercent(item)}%` }"></span>
          </div>
          <small class="case-progress__label">{{ statusProgressPercent(item) }}% by status</small>
          <div class="case-options" @click.stop @keydown.stop>
            <button class="case-options__trigger" type="button" aria-label="Case options" @click="toggleActionMenu(item.id)">
              <span></span><span></span><span></span>
            </button>
            <div v-if="actionMenuId === item.id" class="case-options__menu">
              <RouterLink class="case-options__item" :to="`/admin/cases/${item.id}/edit`">Edit</RouterLink>
              <button class="case-options__item case-options__item--danger" type="button" @click="archiveCase(item.id)">Delete</button>
              <div class="case-options__divider"></div>
              <button
                v-for="statusName in statusOptionsFor(item)"
                :key="statusName"
                class="case-options__item"
                type="button"
                @click="updateCaseStatus(item, statusName)"
              >
                {{ statusName }}
              </button>
              <span v-if="!statusOptionsFor(item).length" class="case-options__note">Final status reached</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table">
          <thead>
            <tr>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('name')">Name</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('status')">Status</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('target')">Client</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('dueDate')">Due Date</button></th>
              <th>Progress</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in cases"
              :key="item.id"
              class="case-row case-row--interactive"
              role="link"
              tabindex="0"
              :aria-label="`Open details for ${item.name}`"
              @click="openCaseDetails(item.id)"
              @keydown.enter.prevent="openCaseDetails(item.id)"
              @keydown.space.prevent="openCaseDetails(item.id)"
            >
              <td data-label="Name"><span class="case-row__name">{{ item.name }}</span></td>
              <td data-label="Status"><span class="case-status" :style="{ '--status-color': item.statusColor }">{{ item.statusName }}</span></td>
              <td data-label="Client">{{ item.targetName || '-' }}</td>
              <td data-label="Due Date">{{ formatDate(item.estimatedCompletionDate) }}</td>
              <td data-label="Progress">
                <div class="case-progress"><span :style="{ width: `${statusProgressPercent(item)}%` }"></span></div>
                <small class="case-progress__label">{{ statusProgressPercent(item) }}% by status</small>
              </td>
              <td data-label="Options">
                <div class="case-options" @click.stop @keydown.stop>
                  <button class="case-options__trigger" type="button" aria-label="Case options" @click="toggleActionMenu(item.id)">
                    <span></span><span></span><span></span>
                  </button>
                  <div v-if="actionMenuId === item.id" class="case-options__menu">
                    <RouterLink class="case-options__item" :to="`/admin/cases/${item.id}/edit`">Edit</RouterLink>
                    <button class="case-options__item case-options__item--danger" type="button" @click="archiveCase(item.id)">Delete</button>
                    <div class="case-options__divider"></div>
                    <button
                      v-for="statusName in statusOptionsFor(item)"
                      :key="statusName"
                      class="case-options__item"
                      type="button"
                      @click="updateCaseStatus(item, statusName)"
                    >
                      {{ statusName }}
                    </button>
                    <span v-if="!statusOptionsFor(item).length" class="case-options__note">Final status reached</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination">
        <button class="admin-link-button" type="button" :disabled="filters.page <= 1" @click="changePage(filters.page - 1)">Previous</button>
        <span>Page {{ meta.page }} of {{ totalPages }} · {{ meta.total }} total</span>
        <button class="admin-link-button" type="button" :disabled="filters.page >= totalPages" @click="changePage(filters.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.case-status-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

:deep(.case-status) {
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease;
}

:deep(.case-progress) {
  overflow: hidden;
}

:deep(.case-progress span) {
  min-width: 0.45rem;
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease;
  will-change: width;
}

.case-progress__label {
  display: inline-block;
  min-width: 5.6rem;
  transition: color 180ms ease;
}

.case-card--interactive,
.case-row--interactive {
  cursor: pointer;
}

.case-card--interactive {
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.case-card--interactive:hover,
.case-row--interactive:hover {
  border-color: rgba(var(--rgb-accent), 0.36);
}

.case-card--interactive:focus-visible,
.case-row--interactive:focus-visible {
  outline: 2px solid rgba(var(--rgb-accent), 0.72);
  outline-offset: 3px;
}

.case-click-title,
.case-row__name {
  color: var(--color-text-strong);
  font-weight: 800;
}

.case-row__name {
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.admin-table-wrap:has(.case-options__menu) {
  overflow: visible;
}

.admin-table tbody tr:has(.case-options__menu) {
  position: relative;
  z-index: 80;
}

.case-options {
  position: relative;
  display: inline-flex;
  justify-content: flex-end;
  cursor: default;
}

.case-options:has(.case-options__menu) {
  z-index: 200;
}

.case-options__trigger {
  width: 2.75rem;
  height: 2.45rem;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.23rem;
  border: 1px solid var(--admin-border, rgba(var(--rgb-foreground),0.12));
  border-radius: 0.65rem;
  background: rgba(var(--rgb-foreground), 0.04);
  color: var(--admin-text, #fff);
  cursor: pointer;
}

.case-options__trigger span {
  width: 1.1rem;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.case-options__menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 300;
  width: 12.5rem;
  padding: 0.45rem;
  border: 1px solid var(--admin-border, rgba(var(--rgb-foreground),0.12));
  border-radius: 0.75rem;
  background: #090909;
  box-shadow: 0 24px 60px rgba(var(--rgb-background), 0.72), inset 0 1px 0 rgba(var(--rgb-foreground), 0.04);
  isolation: isolate;
  overflow: hidden;
  animation: case-menu-in 140ms ease-out;
  transform-origin: top right;
}

.case-options__item {
  width: 100%;
  display: block;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: rgba(var(--rgb-foreground), 0.78);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 0.62rem 0.7rem;
  text-align: left;
  text-decoration: none;
}

.case-options__item:hover,
.case-options__item--active {
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-text);
}

.case-options__item--danger {
  color: #ffb4b4;
}

.case-options__divider {
  height: 1px;
  margin: 0.35rem 0;
  background: rgba(var(--rgb-foreground), 0.08);
}

.case-options__note {
  display: block;
  padding: 0.62rem 0.7rem;
  color: rgba(var(--rgb-foreground), 0.46);
  font-size: 0.78rem;
  font-weight: 800;
}

@keyframes case-menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 760px) {
  .case-status-filter {
    width: 100%;
  }

  .case-options,
  .case-options__trigger {
    width: 100%;
  }

  .case-options__menu {
    left: 0;
    right: auto;
    width: min(100%, 13rem);
  }
}

/* New Advanced Filter Panel Styles */
.admin-filter-panel {
  margin-top: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(30, 30, 35, 0.4);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  box-shadow: 0 10px 30px rgba(var(--rgb-background),0.2);
  backdrop-filter: blur(12px);
}

.filter-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.05);
  padding-bottom: 0.75rem;
}

.filter-panel-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-strong);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-panel-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.05);
}

.filter-fade-enter-active,
.filter-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.filter-fade-enter-from,
.filter-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.glass-input {
  background: rgba(var(--rgb-background), 0.2) !important;
  border: 1px solid rgba(var(--rgb-foreground), 0.1) !important;
  color: var(--color-text-strong) !important;
  border-radius: 12px !important;
  transition: all 0.2s ease;
}

.glass-input:focus {
  background: rgba(var(--rgb-background), 0.3) !important;
  border-color: rgba(168, 155, 249, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(168, 155, 249, 0.2);
}

/* Fix for AdminSelect double borders when using glass-input */
.admin-select.glass-input {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
}

.admin-select.glass-input .admin-select-display {
  background: rgba(var(--rgb-background), 0.2) !important;
  border: 1px solid rgba(var(--rgb-foreground), 0.1) !important;
  border-radius: 12px !important;
  color: var(--color-text-strong) !important;
  transition: all 0.2s ease;
}

.admin-select.glass-input:focus-within .admin-select-display,
.admin-select.glass-input.is-open .admin-select-display {
  background: rgba(var(--rgb-background), 0.3) !important;
  border-color: rgba(168, 155, 249, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(168, 155, 249, 0.2) !important;
}
</style>
