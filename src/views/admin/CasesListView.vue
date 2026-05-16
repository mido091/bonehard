<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import ClientTalkModal from '../../components/ClientTalkModal.vue';
import { useTheme } from '../../composables/useTheme';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { statusProgressPercent } from '../../constants/workflowOptions';

const { showConfirm } = useConfirmDialog();
const router = useRouter();
const { theme } = useTheme();

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
const statusFilterOpen = ref(false);
const statusMenuId = ref(null);
const statusUpdatingId = ref(null);
const statusMenuAnchor = ref(null);
const statusMenuStyle = ref({});
const clientTalkCase = ref(null);
const clientTalkSession = ref(null);
const openingClientTalkId = ref(null);

const totalPages = computed(() => Math.max(Math.ceil(meta.value.total / meta.value.perPage), 1));
const selectedStatusLabel = computed(() => {
  if (!filters.statusIds.length) return 'All Statuses';
  if (filters.statusIds.length === 1) {
    const selected = statuses.value.find((status) => Number(status.id) === Number(filters.statusIds[0]));
    return selected?.name || '1 Status';
  }
  return `${filters.statusIds.length} Statuses`;
});

function normalizeCase(item) {
  return { ...item };
}

function progressForCase(item) {
  return statusProgressPercent(item.statusName, item.progressPercentage);
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

function applyQuickStatus(statusId = null) {
  filters.statusIds = statusId ? [Number(statusId)] : [];
  statusFilterOpen.value = false;
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
  statusFilterOpen.value = false;
  statusMenuId.value = null;
  statusMenuAnchor.value = null;
}

function getStatusMenuItem() {
  return cases.value.find((item) => item.id === statusMenuId.value) || null;
}

function updateStatusMenuPosition() {
  if (!statusMenuAnchor.value || !statusMenuId.value) return;

  const rect = statusMenuAnchor.value.getBoundingClientRect();
  const width = Math.min(352, Math.max(240, window.innerWidth - 24));
  const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));

  statusMenuStyle.value = {
    position: 'fixed',
    top: `${Math.min(window.innerHeight - 16, rect.bottom + 8)}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: 5000,
  };
}

async function toggleStatusMenu(id, event) {
  const nextValue = statusMenuId.value === id ? null : id;
  statusMenuId.value = statusMenuId.value === id ? null : id;
  actionMenuId.value = null;
  statusFilterOpen.value = false;
  statusMenuAnchor.value = nextValue ? event?.currentTarget || null : null;

  if (nextValue) {
    await nextTick();
    updateStatusMenuPosition();
  }
}

function closeFloatingMenus(event) {
  if (statusMenuId.value) {
    const clickedTrigger = statusMenuAnchor.value?.contains?.(event.target);
    const clickedMenu = event.target.closest?.('.inline-status-menu--teleported');
    if (!clickedTrigger && !clickedMenu) {
      statusMenuId.value = null;
      statusMenuAnchor.value = null;
    }
  }

  if (actionMenuId.value && !event.target.closest?.('.case-options')) {
    actionMenuId.value = null;
  }

  if (statusFilterOpen.value && !event.target.closest?.('.case-status-filter')) {
    statusFilterOpen.value = false;
  }
}

function syncFloatingMenus() {
  if (statusMenuId.value) updateStatusMenuPosition();
}

async function changeCaseStatus(item, status) {
  if (Number(item.statusId) === Number(status.id) || statusUpdatingId.value) {
    statusMenuId.value = null;
    statusMenuAnchor.value = null;
    return;
  }
  statusUpdatingId.value = item.id;
  error.value = '';
  try {
    const response = await api.patch(`/api/cases/${item.id}/status`, { statusId: status.id });
    const updated = response.data;
    cases.value = cases.value.map((row) => row.id === item.id ? normalizeCase({ ...row, ...updated }) : row);
    statusMenuId.value = null;
    statusMenuAnchor.value = null;
  } catch (err) {
    error.value = err.message || 'Failed to update case status.';
  } finally {
    statusUpdatingId.value = null;
  }
}

async function openClientTalk(item) {
  if (!item || openingClientTalkId.value) return;
  openingClientTalkId.value = item.id;
  actionMenuId.value = null;
  error.value = '';

  try {
    const response = await api.post(`/api/admin/cases/${item.id}/client-talk/open`);
    clientTalkCase.value = item;
    clientTalkSession.value = response.data;
  } catch (err) {
    error.value = err.message || 'Failed to open Client Talk.';
  } finally {
    openingClientTalkId.value = null;
  }
}

function openCaseDetails(id) {
  actionMenuId.value = null;
  router.push(`/admin/cases/${id}`);
}

onMounted(async () => {
  document.addEventListener('click', closeFloatingMenus);
  window.addEventListener('resize', syncFloatingMenus);
  window.addEventListener('scroll', syncFloatingMenus, true);

  const [statusResponse, userResponse, teamResponse] = await Promise.all([
    api.get('/api/case-statuses'),
    api.get('/api/admin/users/options'),
    api.get('/api/admin/teams/options'),
  ]);
  statuses.value = statusResponse.data || [];
  users.value = userResponse.data;
  teams.value = teamResponse.data;
  await loadCases();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeFloatingMenus);
  window.removeEventListener('resize', syncFloatingMenus);
  window.removeEventListener('scroll', syncFloatingMenus, true);
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
              class="case-status-filter__trigger"
              type="button"
              :aria-expanded="statusFilterOpen"
              @click="statusFilterOpen = !statusFilterOpen"
            >
              <span>Case Status</span>
              <strong>{{ selectedStatusLabel }}</strong>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div v-if="statusFilterOpen" class="case-status-filter__menu" :class="{ 'case-status-filter__menu--light': theme === 'light' }">
              <button
                class="case-status-filter__option"
                :class="{ 'case-status-filter__option--active': !filters.statusIds.length }"
                type="button"
                @click="applyQuickStatus()"
              >
                <span class="case-status-filter__dot case-status-filter__dot--all"></span>
                <span>All Statuses</span>
                <span v-if="!filters.statusIds.length" class="case-status-filter__check">Selected</span>
              </button>
              <button
                v-for="status in statuses"
                :key="status.id"
                class="case-status-filter__option"
                :class="{ 'case-status-filter__option--active': filters.statusIds.length === 1 && Number(filters.statusIds[0]) === Number(status.id) }"
                type="button"
                @click="applyQuickStatus(status.id)"
              >
                <span class="case-status-filter__dot" :style="{ '--status-color': status.color || '#60a5fa' }"></span>
                <span>{{ status.name }}</span>
                <span
                  v-if="filters.statusIds.length === 1 && Number(filters.statusIds[0]) === Number(status.id)"
                  class="case-status-filter__check"
                >
                  Selected
                </span>
              </button>
            </div>
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
              <span>Case Status</span>
              <AdminSelect v-model="filters.statusIds" :options="statuses" multiple placeholder="All Statuses" class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>From Target Date</span>
              <input v-model="filters.fromDueDate" type="date" class="glass-input" />
            </label>
            
            <label class="admin-field">
              <span>To Target Date</span>
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
          :class="{ 'case-card--menu-open': actionMenuId === item.id || statusMenuId === item.id }"
          role="link"
          tabindex="0"
          :aria-label="`Open details for ${item.name}`"
          @click="openCaseDetails(item.id)"
          @keydown.enter.prevent="openCaseDetails(item.id)"
          @keydown.space.prevent="openCaseDetails(item.id)"
        >
          <div class="inline-status-control" :class="{ 'is-open': statusMenuId === item.id }" @click.stop @keydown.stop>
            <button class="case-status case-status--button" type="button" :style="{ '--status-color': item.statusColor }" @click="toggleStatusMenu(item.id, $event)">
              {{ statusUpdatingId === item.id ? 'Saving...' : item.statusName }}
            </button>
          </div>
          <h3 class="case-click-title">{{ item.name }}</h3>
          <p>{{ item.targetName || 'No target assigned' }}</p>
          <div class="case-progress">
            <span :style="{ width: `${progressForCase(item)}%` }"></span>
          </div>
          <small class="case-progress__label">{{ progressForCase(item) }}% by status</small>
          <div class="case-options" :class="{ 'is-open': actionMenuId === item.id }" @click.stop @keydown.stop>
            <button class="case-options__trigger" type="button" aria-label="Case options" @click="toggleActionMenu(item.id)">
              <span></span><span></span><span></span>
            </button>
            <div v-if="actionMenuId === item.id" class="case-options__menu" :class="{ 'case-options__menu--light': theme === 'light' }">
              <button class="case-options__item case-options__item--accent" type="button" :disabled="openingClientTalkId === item.id" @click="openClientTalk(item); actionMenuId = null">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span>{{ openingClientTalkId === item.id ? 'Opening...' : 'Client Talk' }}</span>
              </button>
              <RouterLink class="case-options__item" :to="`/admin/cases/${item.id}/edit`">Edit</RouterLink>
              <button class="case-options__item case-options__item--danger" type="button" @click="archiveCase(item.id)">Delete</button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="admin-table-wrap cases-table-wrap">
        <table class="admin-table responsive-table cases-table">
          <thead>
            <tr>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('name')">Name</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('status')">Status</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('target')">Client</button></th>
              <th><button class="admin-sort-button" type="button" @click="cycleSort('dueDate')">Target Date</button></th>
              <th>Progress</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in cases"
              :key="item.id"
              class="case-row case-row--interactive"
              :class="{ 'case-row--menu-open': actionMenuId === item.id || statusMenuId === item.id }"
              role="link"
              tabindex="0"
              :aria-label="`Open details for ${item.name}`"
              @click="openCaseDetails(item.id)"
              @keydown.enter.prevent="openCaseDetails(item.id)"
              @keydown.space.prevent="openCaseDetails(item.id)"
            >
              <td data-label="Name"><span class="case-row__name">{{ item.name }}</span></td>
              <td data-label="Status">
                <div class="inline-status-control" :class="{ 'is-open': statusMenuId === item.id }" @click.stop @keydown.stop>
                  <button class="case-status case-status--button" type="button" :style="{ '--status-color': item.statusColor }" @click="toggleStatusMenu(item.id, $event)">
                    {{ statusUpdatingId === item.id ? 'Saving...' : item.statusName }}
                  </button>
                </div>
              </td>
              <td data-label="Client">{{ item.targetName || '-' }}</td>
              <td data-label="Target Date">{{ formatDate(item.targetTime) }}</td>
              <td data-label="Progress">
                <div class="case-progress"><span :style="{ width: `${progressForCase(item)}%` }"></span></div>
                <small class="case-progress__label">{{ progressForCase(item) }}% by status</small>
              </td>
              <td data-label="Options" :class="{ 'case-cell--menu-open': actionMenuId === item.id }">
                <div class="case-options" :class="{ 'is-open': actionMenuId === item.id }" @click.stop @keydown.stop>
                  <button class="case-options__trigger" type="button" aria-label="Case options" @click="toggleActionMenu(item.id)">
                    <span></span><span></span><span></span>
                  </button>
                  <div v-if="actionMenuId === item.id" class="case-options__menu" :class="{ 'case-options__menu--light': theme === 'light' }">
                    <button class="case-options__item case-options__item--accent" type="button" :disabled="openingClientTalkId === item.id" @click="openClientTalk(item); actionMenuId = null">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      <span>{{ openingClientTalkId === item.id ? 'Opening...' : 'Client Talk' }}</span>
                    </button>
                    <RouterLink class="case-options__item" :to="`/admin/cases/${item.id}/edit`">Edit</RouterLink>
                    <button class="case-options__item case-options__item--danger" type="button" @click="archiveCase(item.id)">Delete</button>
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

    <ClientTalkModal
      v-if="clientTalkCase && clientTalkSession"
      :order-id="clientTalkCase.id"
      :order-name="clientTalkCase.name || ''"
      :initial-session="clientTalkSession"
      @close="clientTalkCase = null; clientTalkSession = null"
      @ended="clientTalkCase = null; clientTalkSession = null"
    />

    <Teleport to="body">
      <Transition name="fade-down">
        <div
          v-if="getStatusMenuItem()"
          class="inline-status-menu inline-status-menu--teleported"
          :class="{ 'inline-status-menu--light': theme === 'light' }"
          :style="statusMenuStyle"
        >
          <button
            v-for="status in statuses"
            :key="status.id"
            class="inline-status-menu__item"
            :class="{
              'inline-status-menu__item--active': Number(status.id) === Number(getStatusMenuItem()?.statusId),
              'inline-status-menu__item--light': theme === 'light'
            }"
            type="button"
            @click="changeCaseStatus(getStatusMenuItem(), status)"
          >
            <span class="case-status-filter__dot" :style="{ '--status-color': status.color || '#60a5fa' }"></span>
            <span>{{ status.name }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.case-status-filter {
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: 0.85rem;
  max-width: min(100%, 24rem);
}

.case-status-filter__trigger {
  min-width: min(100vw - 2rem, 22rem);
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.15rem 0.9rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.8rem;
  background: rgba(var(--rgb-foreground), 0.045);
  color: var(--color-text-strong);
  cursor: pointer;
  padding: 0.8rem 0.95rem;
  text-align: left;
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.case-status-filter__trigger:hover,
.case-status-filter__trigger[aria-expanded="true"] {
  border-color: rgba(var(--rgb-accent), 0.42);
  background: rgba(var(--rgb-accent), 0.08);
  box-shadow: 0 16px 38px rgba(var(--rgb-background), 0.18);
}

.case-status-filter__trigger span {
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.case-status-filter__trigger strong {
  color: var(--color-text-strong);
  font-size: 0.98rem;
  font-weight: 900;
}

.case-status-filter__trigger svg {
  grid-row: 1 / span 2;
  grid-column: 2;
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.72;
}

.case-status-filter__menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  left: 0;
  z-index: 1000;
  width: 100%;
  max-height: min(22rem, 58vh);
  overflow: auto;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-background), 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(var(--rgb-foreground), 0.06);
  padding: 0.5rem;
}

.case-status-filter__menu--light {
  background: rgba(255, 255, 255, 0.985) !important;
  border-color: rgba(15, 23, 42, 0.12) !important;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}

:global(body.light-mode) .case-status-filter__menu,
:global(.light-mode) .case-status-filter__menu,
:global([data-theme="light"]) .case-status-filter__menu {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.inline-status-control {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.inline-status-control.is-open {
  z-index: 1700;
}

.inline-status-control:has(.inline-status-menu) {
  z-index: 700;
}

:deep(.case-status--button) {
  cursor: pointer;
  border-color: color-mix(in srgb, var(--status-color, #60a5fa) 48%, transparent);
}

.inline-status-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 1800;
  width: min(22rem, calc(100vw - 2rem));
  max-height: min(19rem, 52vh);
  overflow: auto;
  padding: 0.5rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.85rem;
  background: #070707;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.inline-status-menu--teleported {
  position: fixed;
  top: auto;
  left: auto;
  z-index: 5000 !important;
}

.inline-status-menu--light {
  background: rgba(255, 255, 255, 0.985) !important;
  border-color: rgba(15, 23, 42, 0.12) !important;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}

.inline-status-menu__item {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
  border: 0;
  border-radius: 0.62rem;
  background: transparent;
  color: var(--color-text-strong);
  cursor: pointer;
  padding: 0.68rem 0.75rem;
  text-align: left;
  font: inherit;
  font-weight: 850;
}

.inline-status-menu__item:hover,
.inline-status-menu__item--active {
  background: rgba(var(--rgb-foreground), 0.08);
}

.inline-status-menu__item--light {
  color: #172033 !important;
}

.inline-status-menu__item--light:hover,
.inline-status-menu__item--light.inline-status-menu__item--active {
  background: #f8efe1 !important;
  color: #0f172a !important;
}

.case-status-filter__option {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  border: 0;
  border-radius: 0.68rem;
  background: transparent;
  color: var(--color-text-strong);
  cursor: pointer;
  font: inherit;
  font-weight: 850;
  padding: 0.72rem 0.78rem;
  text-align: left;
}

.case-status-filter__option:hover,
.case-status-filter__option--active {
  background: rgba(var(--rgb-accent), 0.11);
}

.case-status-filter__menu--light .case-status-filter__option {
  color: #172033 !important;
}

.case-status-filter__menu--light .case-status-filter__option:hover,
.case-status-filter__menu--light .case-status-filter__option--active {
  background: #f8efe1 !important;
  color: #0f172a !important;
}

:global(body.light-mode) .case-status-filter__option,
:global(.light-mode) .case-status-filter__option,
:global([data-theme="light"]) .case-status-filter__option {
  color: #172033;
}

:global(body.light-mode) .case-status-filter__option:hover,
:global(body.light-mode) .case-status-filter__option--active,
:global(.light-mode) .case-status-filter__option:hover,
:global(.light-mode) .case-status-filter__option--active,
:global([data-theme="light"]) .case-status-filter__option:hover,
:global([data-theme="light"]) .case-status-filter__option--active {
  background: #f8efe1;
  color: #0f172a;
}

.case-status-filter__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
  background: var(--status-color, #60a5fa);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--status-color, #60a5fa) 18%, transparent);
}

.case-status-filter__dot--all {
  background: linear-gradient(135deg, #60a5fa, #34d399);
  box-shadow: 0 0 0 4px rgba(var(--rgb-accent), 0.14);
}

.case-status-filter__check {
  color: rgba(var(--rgb-accent), 0.9);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

:global(body.light-mode) .case-status-filter__check,
:global(.light-mode) .case-status-filter__check,
:global([data-theme="light"]) .case-status-filter__check {
  color: #b45309;
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

.case-card--menu-open,
.case-row--menu-open {
  position: relative;
  z-index: 1800;
  overflow: visible !important;
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

.admin-table-wrap:has(.case-options__menu),
.admin-table-wrap:has(.inline-status-menu),
.case-card-grid:has(.case-options__menu) {
  overflow: visible;
}

.admin-table tbody tr:has(.case-options__menu),
.admin-table tbody tr:has(.inline-status-menu),
.case-card:has(.case-options__menu) {
  position: relative;
  z-index: 1200;
}

.case-options {
  position: relative;
  display: inline-flex;
  justify-content: flex-end;
  cursor: default;
}

.case-options.is-open {
  z-index: 1800;
}

.case-options:has(.case-options__menu) {
  z-index: 1300;
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
  z-index: 1400;
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

.case-options__menu--light {
  background: rgba(255, 255, 255, 0.985) !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18) !important;
}

.case-options__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 0.62rem 0.7rem;
  text-align: left;
  text-decoration: none;
}

.case-options__item svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: 0 0 auto;
}

.case-options__item:hover,
.case-options__item--active {
  background: rgba(var(--rgb-accent), 0.1);
  color: #ffffff;
}

.case-options__menu--light .case-options__item {
  color: #172033 !important;
}

.case-options__menu--light .case-options__item:hover,
.case-options__menu--light .case-options__item--active {
  background: #f8efe1 !important;
  color: #0f172a !important;
}

.case-options__item--accent {
  color: #34d399;
}

.case-options__menu--light .case-options__item--accent {
  color: #047857 !important;
}

.case-options__item--danger {
  color: #ffb4b4;
}

.case-options__menu--light .case-options__item--danger {
  color: #b42318 !important;
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

:global(body.light-mode) .case-options__menu,
:global(.light-mode) .case-options__menu,
:global([data-theme="light"]) .case-options__menu {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.16);
}

:global(body.light-mode) .case-options__item,
:global(.light-mode) .case-options__item,
:global([data-theme="light"]) .case-options__item {
  color: #172033;
}

:global(body.light-mode) .case-options__item:hover,
:global(.light-mode) .case-options__item:hover,
:global([data-theme="light"]) .case-options__item:hover {
  background: rgba(248, 217, 170, 0.5);
  color: #0f172a;
}

:global(body.light-mode) .case-options__item--danger,
:global(.light-mode) .case-options__item--danger,
:global([data-theme="light"]) .case-options__item--danger {
  color: #b42318;
}

:global(body.light-mode) .case-options__divider,
:global(.light-mode) .case-options__divider,
:global([data-theme="light"]) .case-options__divider {
  background: rgba(15, 23, 42, 0.1);
}

:global(body.light-mode) .inline-status-menu,
:global(.light-mode) .inline-status-menu,
:global([data-theme="light"]) .inline-status-menu {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

:global(body.light-mode .inline-status-menu),
:global(.light-mode .inline-status-menu),
:global([data-theme="light"] .inline-status-menu),
:global(body.light-mode .inline-status-menu--teleported),
:global(.light-mode .inline-status-menu--teleported),
:global([data-theme="light"] .inline-status-menu--teleported) {
  background: rgba(255, 255, 255, 0.98) !important;
  border-color: rgba(15, 23, 42, 0.12) !important;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}

:global(body.light-mode) .inline-status-menu__item,
:global(.light-mode) .inline-status-menu__item,
:global([data-theme="light"]) .inline-status-menu__item {
  color: #172033;
}

:global(body.light-mode .inline-status-menu__item),
:global(.light-mode .inline-status-menu__item),
:global([data-theme="light"] .inline-status-menu__item) {
  color: #172033 !important;
}

:global(body.light-mode) .inline-status-menu__item:hover,
:global(body.light-mode) .inline-status-menu__item--active,
:global(.light-mode) .inline-status-menu__item:hover,
:global(.light-mode) .inline-status-menu__item--active,
:global([data-theme="light"]) .inline-status-menu__item:hover,
:global([data-theme="light"]) .inline-status-menu__item--active {
  background: #f8efe1;
  color: #0f172a;
}

:global(body.light-mode .inline-status-menu__item:hover),
:global(body.light-mode .inline-status-menu__item--active),
:global(.light-mode .inline-status-menu__item:hover),
:global(.light-mode .inline-status-menu__item--active),
:global([data-theme="light"] .inline-status-menu__item:hover),
:global([data-theme="light"] .inline-status-menu__item--active) {
  background: #f8efe1 !important;
  color: #0f172a !important;
}

:global(body.light-mode .case-options__menu),
:global(.light-mode .case-options__menu),
:global([data-theme="light"] .case-options__menu) {
  background: #ffffff !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18) !important;
}

:global(body.light-mode .case-options__item),
:global(.light-mode .case-options__item),
:global([data-theme="light"] .case-options__item) {
  color: #172033 !important;
}

:global(body.light-mode .case-options__item:hover),
:global(body.light-mode .case-options__item--active),
:global(.light-mode .case-options__item:hover),
:global(.light-mode .case-options__item--active),
:global([data-theme="light"] .case-options__item:hover),
:global([data-theme="light"] .case-options__item--active) {
  background: #f8efe1 !important;
  color: #0f172a !important;
}

:global(body.light-mode .case-options__item--accent),
:global(.light-mode .case-options__item--accent),
:global([data-theme="light"] .case-options__item--accent) {
  color: #047857 !important;
}

:global(body.light-mode .case-options__item--danger),
:global(.light-mode .case-options__item--danger),
:global([data-theme="light"] .case-options__item--danger) {
  color: #b42318 !important;
}

:global(body.light-mode .case-options__divider),
:global(.light-mode .case-options__divider),
:global([data-theme="light"] .case-options__divider) {
  background: rgba(15, 23, 42, 0.1) !important;
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

  .case-status-filter__trigger,
  .case-status-filter__menu {
    width: 100%;
    min-width: 0;
  }

  .case-options {
    width: auto;
    justify-content: flex-end;
  }

  .case-options__trigger {
    width: 2.75rem;
    min-width: 2.75rem;
  }

  .case-options__menu {
    left: auto;
    right: 0;
    width: min(13rem, calc(100vw - 3rem));
  }

  .responsive-table,
  .responsive-table tbody,
  .responsive-table tr:has(.case-options__menu),
  .responsive-table td:has(.case-options__menu) {
    overflow: visible !important;
  }

  .responsive-table tr:has(.case-options__menu) {
    z-index: 1600;
  }

  .responsive-table tr:has(.case-options__menu) + tr {
    position: relative;
    z-index: 1;
  }
}

@media (max-width: 1100px) {
  .cases-table-wrap {
    overflow: visible !important;
  }

  .cases-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
  }

  .cases-table thead {
    display: none !important;
  }

  .cases-table,
  .cases-table tbody,
  .cases-table tr,
  .cases-table td {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  .cases-table tr {
    position: relative;
    margin: 0 0 0.8rem !important;
    overflow: hidden !important;
    border: 1px solid var(--admin-border, rgba(var(--rgb-foreground), 0.12)) !important;
    border-radius: 0.85rem !important;
    background: rgba(var(--rgb-foreground), 0.035) !important;
  }

  .cases-table tr:has(.case-options__menu),
  .cases-table tr:has(.inline-status-menu) {
    z-index: 1800;
    overflow: visible !important;
  }

  .cases-table td {
    display: grid !important;
    grid-template-columns: minmax(6.5rem, 34%) minmax(0, 1fr);
    align-items: center !important;
    gap: 0.75rem !important;
    padding: 0.78rem 1rem !important;
    border-bottom: 1px solid rgba(var(--rgb-foreground), 0.07) !important;
    text-align: right !important;
  }

  .cases-table td:last-child {
    border-bottom: 0 !important;
  }

  .cases-table td::before {
    content: attr(data-label);
    grid-column: 1;
    color: rgba(var(--rgb-foreground), 0.52);
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    line-height: 1.35;
    text-align: left;
    text-transform: uppercase;
  }

  .cases-table td > * {
    grid-column: 2;
    min-width: 0;
    max-width: 100%;
    justify-self: end;
  }

  .cases-table td:has(.case-options__menu) {
    position: relative;
    z-index: 2001;
    overflow: visible !important;
  }

  .cases-table td.case-cell--menu-open {
    position: relative;
    z-index: 2200;
    overflow: visible !important;
  }

  .cases-table .case-progress {
    width: min(14rem, 100%);
  }

  .cases-table .case-progress__label {
    display: block;
    margin-top: 0.25rem;
    text-align: right;
  }

  .cases-table .case-options {
    width: 100%;
    justify-content: flex-end;
  }

  .cases-table .case-options__menu {
    right: 0;
    left: auto;
    z-index: 3000;
    width: min(13rem, calc(100vw - 3rem));
  }
}

@media (max-width: 520px) {
  .cases-table td {
    grid-template-columns: minmax(5.4rem, 32%) minmax(0, 1fr);
    padding: 0.72rem 0.82rem !important;
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

.client-talk-row-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  min-height: 2.45rem;
  white-space: nowrap;
  border-color: rgba(52, 211, 153, 0.24);
  color: #34d399;
}

.client-talk-row-button svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: 0 0 auto;
}

.client-talk-row-button:hover:not(:disabled) {
  border-color: rgba(52, 211, 153, 0.45);
  background: rgba(16, 185, 129, 0.1);
}

@media (max-width: 760px) {
  .case-options {
    width: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .case-options .case-options__trigger {
    width: 2.75rem;
    min-width: 2.75rem;
    padding: 0;
  }
}
</style>
