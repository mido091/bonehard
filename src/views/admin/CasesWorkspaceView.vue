<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import CasesTopNav from '../../components/admin/CasesTopNav.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm, showAlert } = useConfirmDialog();
const route = useRoute();
const mode = computed(() => route.meta.workspace);
const rows = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(true);
const error = ref('');
const monthCursor = ref(new Date());

const casesList = ref([]);
const usersList = ref([]);
const showTaskModal = ref(false);
const taskLoading = ref(false);

const taskForm = reactive({
  caseId: '',
  title: '',
  description: '',
  priority: 'normal',
  status: 'open',
  taskType: 'to-do',
  dueDate: '',
  estimatedMinutes: '',
});

const filters = reactive({
  search: '',
  status: '',
  priority: '',
  taskType: '',
  assigneeId: '',
  tag: '',
  fromDueDate: '',
  toDueDate: '',
  perPage: 20,
  page: 1,
});

const filtersOpen = ref(false);

// Bulk actions state
const selectedTaskIds = ref(new Set());
const allTasksSelected = computed(() => rows.value.length > 0 && rows.value.every(t => selectedTaskIds.value.has(t.id)));
const someTasksSelected = computed(() => selectedTaskIds.value.size > 0);

function toggleAllTasks() {
  if (allTasksSelected.value) selectedTaskIds.value = new Set();
  else selectedTaskIds.value = new Set(rows.value.map(t => t.id));
}

function toggleOneTask(id) {
  const next = new Set(selectedTaskIds.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selectedTaskIds.value = next;
}

async function bulkTaskStatus(status) {
  if (!selectedTaskIds.value.size) return;
  try {
    for (const id of selectedTaskIds.value) {
      const task = rows.value.find(t => t.id === id);
      if (task) await api.patch(`/api/cases/${task.caseId || task.case_id}/tasks/${id}`, { status });
    }
    await loadRows();
    selectedTaskIds.value = new Set();
  } catch (err) {
    showAlert(err.message);
  }
}

async function bulkTaskDelete() {
  if (!selectedTaskIds.value.size) return;
  const confirmed = await showConfirm(`Delete ${selectedTaskIds.value.size} tasks?`);
  if (!confirmed) return;
  try {
    for (const id of selectedTaskIds.value) {
      const task = rows.value.find(t => t.id === id);
      if (task) await api.delete(`/api/cases/${task.caseId || task.case_id}/tasks/${id}`);
    }
    await loadRows();
    selectedTaskIds.value = new Set();
  } catch (err) {
    showAlert(err.message);
  }
}

const config = computed(() => {
  const map = {
    myTasks: { title: 'My Tasks', endpoint: '/api/cases/tasks/my', type: 'tasks' },
    allTasks: { title: 'All Tasks', endpoint: '/api/cases/tasks/all', type: 'tasks' },
    archive: { title: 'Archive', endpoint: '/api/cases/archive', type: 'cases' },
    timers: { title: 'Timers', endpoint: '/api/cases/timers', type: 'timers' },
    notesExport: { title: 'Notes Export', endpoint: '/api/cases/notes-export', type: 'exports' },
    generators: { title: 'Generators', endpoint: '/api/cases/generators', type: 'generators' },
    calendar: { title: 'Calendar', endpoint: '/api/cases/tasks/all', type: 'calendar' },
  };
  return map[mode.value];
});

const monthLabel = computed(() =>
  monthCursor.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
);

const calendarDays = computed(() => {
  if (config.value?.type !== 'calendar') return [];
  const first = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1);
  const last = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 0);
  const cells = [];

  for (let i = 0; i < first.getDay(); i += 1) {
    cells.push({ date: null, tasks: [] });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const dateStr = `${monthCursor.value.getFullYear()}-${String(monthCursor.value.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      date: day,
      dateStr,
      tasks: rows.value.filter((task) => task.dueDate && task.dueDate.startsWith(dateStr)),
    });
  }
  return cells;
});

function prevMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1);
}

function nextMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1);
}

function buildQuery() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

async function loadRows() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get(`${config.value.endpoint}?${buildQuery()}`);
    rows.value = response.data;
    meta.value = response.meta || { total: response.data.length, page: 1, perPage: 20 };
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }

  // Fetch users/cases for dropdowns and filters if needed
  if (['calendar', 'tasks'].includes(config.value?.type) && !casesList.value.length) {
    try {
      const [casesRes, usersRes] = await Promise.all([
        api.get('/api/cases?perPage=100'),
        api.get('/api/admin/users/options')
      ]);
      casesList.value = casesRes.data || [];
      usersList.value = usersRes.data || [];
    } catch (e) {
      console.error('Failed to load cases/users:', e);
    }
  }
}

function openTaskModal(dateStr) {
  if (!dateStr) return;
  taskForm.caseId = '';
  taskForm.title = '';
  taskForm.description = '';
  taskForm.priority = 'normal';
  taskForm.status = 'open';
  taskForm.taskType = 'to-do';
  taskForm.dueDate = dateStr;
  taskForm.estimatedMinutes = '';
  showTaskModal.value = true;
}

async function saveCalendarTask() {
  if (!taskForm.caseId) {
    await showAlert('Please select a Case');
    return;
  }
  taskLoading.value = true;
  try {
    const payload = {
      ...taskForm,
      estimatedMinutes: taskForm.estimatedMinutes === '' ? null : Number(taskForm.estimatedMinutes)
    };
    await api.post(`/api/cases/${taskForm.caseId}/tasks`, payload);
    showTaskModal.value = false;
    await loadRows();
  } catch (err) {
    showAlert(err.message);
  } finally {
    taskLoading.value = false;
  }
}

async function applyGenerator(generator) {
  if (!generator.templateId) return;
  error.value = 'Open a case from the cases list to apply this generator template.';
}

function formatDuration(seconds = 0) {
  const s = Math.max(0, Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

onMounted(loadRows);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
      <CasesTopNav />

      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Cases Workspace</p>
          <h2>{{ config.title }}</h2>
        </div>
        <div v-if="config.type !== 'calendar'" class="admin-toolbar">
          <input v-model="filters.search" class="admin-search" type="search" placeholder="Search..." />
          <AdminSelect v-if="['tasks', 'timers'].includes(config.type)" v-model="filters.status" :options="config.type === 'timers' ? [{value: 'running', label: 'Running'}, {value: 'stopped', label: 'Stopped'}] : [{value: 'open', label: 'Open'}, {value: 'assigned', label: 'Assigned'}, {value: 'to-do', label: 'To Do'}, {value: 'in-progress', label: 'In Progress'}, {value: 'completed', label: 'Completed'}]" placeholder="All statuses" class="admin-compact-select admin-compact-select--fit" style="width: 160px;" />
          <button class="admin-link-button" type="button" @click="filtersOpen = !filtersOpen">Filter</button>
          <button class="admin-primary-button" type="button" @click="loadRows">Refresh</button>
        </div>
        <div v-else class="admin-actions">
          <button class="admin-link-button" type="button" @click="prevMonth">Prev</button>
          <strong class="admin-month-title">{{ monthLabel }}</strong>
          <button class="admin-link-button" type="button" @click="nextMonth">Next</button>
        </div>
      </div>

      <form v-if="filtersOpen && config.type === 'tasks'" class="admin-filter-grid" @submit.prevent="loadRows">
        <label class="admin-field">
          <span>Search</span>
          <input v-model="filters.search" type="search" placeholder="Task title..." />
        </label>
        <label class="admin-field">
          <span>Status</span>
          <AdminSelect v-model="filters.status" :options="[{value: 'open', label: 'OPEN'}, {value: 'assigned', label: 'ASSIGNED'}, {value: 'to-do', label: 'TO-DO'}, {value: 'in-progress', label: 'IN PROGRESS'}, {value: 'completed', label: 'COMPLETED'}]" placeholder="All" />
        </label>
        <label class="admin-field">
          <span>Priority</span>
          <AdminSelect v-model="filters.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" placeholder="All" />
        </label>
        <label class="admin-field">
          <span>Task Type</span>
          <AdminSelect v-model="filters.taskType" :options="[{value: 'to-do', label: 'To-Do'}, {value: 'milestone', label: 'Milestone'}]" placeholder="All" />
        </label>
        <label class="admin-field">
          <span>Assignee</span>
          <AdminSelect v-model="filters.assigneeId" :options="usersList" placeholder="Anyone" />
        </label>
        <label class="admin-field">
          <span>Tag</span>
          <input v-model="filters.tag" type="search" placeholder="Tag..." />
        </label>
        <label class="admin-field">
          <span>Due From</span>
          <input v-model="filters.fromDueDate" type="date" />
        </label>
        <label class="admin-field">
          <span>Due To</span>
          <input v-model="filters.toDueDate" type="date" />
        </label>
        <button class="admin-primary-button admin-field-action" type="submit">Apply Filters</button>
      </form>

      <!-- Bulk Actions Bar -->
      <div v-if="someTasksSelected && config.type === 'tasks'" class="admin-toolbar" style="background:var(--surface-hover,rgba(var(--rgb-foreground),0.05)); border-radius:6px; padding:0.5rem 1rem; gap:0.5rem; margin-bottom:0.75rem;">
        <span class="admin-muted">{{ selectedTaskIds.size }} selected</span>
        <button class="admin-link-button" type="button" @click="bulkTaskStatus('completed')">✓ Mark Completed</button>
        <button class="admin-link-button" type="button" @click="bulkTaskStatus('open')">↩ Mark Open</button>
        <button class="admin-danger-button" type="button" @click="bulkTaskDelete">🗑 Delete Selected</button>
        <button class="admin-link-button" type="button" @click="selectedTaskIds = new Set()">✕ Clear</button>
      </div>

      <p v-if="loading" class="admin-loading">Loading...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else-if="config.type === 'calendar'" class="cal-grid">
        <div class="cal-weekdays">
          <span v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</span>
        </div>
        <div class="cal-days">
          <div v-for="(cell, index) in calendarDays" :key="index" class="cal-day" :class="{ 'cal-day--empty': !cell.date, 'cal-day--has-tasks': cell.tasks.length > 0 }" @click="openTaskModal(cell.dateStr)">
            <span v-if="cell.date" class="cal-day__num">{{ cell.date }}</span>
            <div class="cal-day__tasks">
              <div v-for="task in cell.tasks.slice(0, 3)" :key="task.id" class="cal-task-chip" @click.stop="$router.push(`/admin/cases/${task.caseId || task.case_id}`)">{{ task.title }}</div>
              <div v-if="cell.tasks.length > 3" class="cal-task-chip cal-task-chip--more">+{{ cell.tasks.length - 3 }} more</div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table">
          <thead>
            <tr v-if="config.type === 'tasks'">
              <th style="width:36px;">
                <input type="checkbox" :checked="allTasksSelected" @change="toggleAllTasks" />
              </th>
              <th>Case</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Due Date</th>
            </tr>
            <tr v-else-if="config.type === 'cases'">
              <th>Name</th>
              <th>Status</th>
              <th>Client</th>
              <th>Due Date</th>
              <th>Progress</th>
            </tr>
            <tr v-else-if="config.type === 'timers'">
              <th>Case</th>
              <th>Title</th>
              <th>Status</th>
              <th>User</th>
              <th>Total Time</th>
            </tr>
            <tr v-else-if="config.type === 'exports'">
              <th>Created</th>
              <th>File Rows</th>
              <th>Exported</th>
              <th>Status</th>
              <th>File</th>
            </tr>
            <tr v-else>
              <th>Name</th>
              <th>Template</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="config.type === 'tasks'">
              <tr v-for="row in rows" :key="row.id" :class="{ 'admin-table-row--selected': selectedTaskIds.has(row.id) }">
                <td data-label="Select">
                  <input type="checkbox" :checked="selectedTaskIds.has(row.id)" @change="toggleOneTask(row.id)" />
                </td>
                <td data-label="Case">{{ row.caseName }}</td>
                <td data-label="Title">{{ row.title }}</td>
                <td data-label="Priority">{{ row.priority }}</td>
                <td data-label="Status">{{ row.status }}</td>
                <td data-label="Assignee">{{ row.assigneeName || 'Unassigned' }}</td>
                <td data-label="Due Date">{{ row.dueDate || 'Not Provided' }}</td>
              </tr>
            </template>
            <template v-else-if="config.type === 'cases'">
              <tr v-for="row in rows" :key="row.id">
                <td data-label="Name"><RouterLink :to="`/admin/cases/${row.id}`">{{ row.name }}</RouterLink></td>
                <td data-label="Status">{{ row.statusName }}</td>
                <td data-label="Client">{{ row.targetName || '-' }}</td>
                <td data-label="Due Date">{{ row.estimatedCompletionDate || '-' }}</td>
                <td data-label="Progress">
                  <div class="case-progress"><span :style="{ width: `${row.progressPercentage || 0}%` }"></span></div>
                  <small>{{ row.completedTasks }} of {{ row.totalTasks }} ({{ row.progressPercentage || 0 }}%)</small>
                </td>
              </tr>
            </template>
            <template v-else-if="config.type === 'timers'">
              <tr v-for="row in rows" :key="row.id">
                <td data-label="Case">{{ row.caseName }}</td>
                <td data-label="Title">{{ row.title }}</td>
                <td data-label="Status">{{ row.status }}</td>
                <td data-label="User">{{ row.userName || '-' }}</td>
                <td data-label="Total Time">
                  {{ formatDuration(row.durationSeconds) }}
                  <small v-if="row.totalAmount" class="admin-muted" style="display:block;">
                      Total: EGP {{ row.totalAmount }}
                  </small>
                </td>
              </tr>
            </template>
            <template v-else-if="config.type === 'exports'">
              <tr v-for="row in rows" :key="row.id">
                <td data-label="Created">{{ row.createdAt }}</td>
                <td data-label="File Rows">{{ row.fileRows }}</td>
                <td data-label="Exported">{{ row.exportedAt || '-' }}</td>
                <td data-label="Status">{{ row.status }}</td>
                <td data-label="File">{{ row.fileUrl || '-' }}</td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="row in rows" :key="row.id">
                <td data-label="Name">{{ row.name }}</td>
                <td data-label="Template">{{ row.templateName || '-' }}</td>
                <td data-label="Status">{{ row.isActive ? 'Active' : 'Disabled' }}</td>
                <td data-label="Action">
                  <button class="admin-link-button" type="button" :disabled="!row.templateId" @click="applyGenerator(row)">Use Template</button>
                </td>
              </tr>
            </template>
            <tr v-if="!rows.length">
              <td class="admin-table-empty admin-muted" colspan="6">No records found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Task from Calendar Modal -->
    <Teleport to="body">
      <div v-if="showTaskModal" class="modal-backdrop" @click.self="showTaskModal = false">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <h3>Add Task for {{ taskForm.dueDate }}</h3>
            <button class="admin-link-button" type="button" @click="showTaskModal = false">✕</button>
          </header>
          <form class="admin-form" style="padding:1.25rem;" @submit.prevent="saveCalendarTask">
            <label class="admin-field admin-field--wide">
          <span>Case *</span>
          <AdminSelect v-model="taskForm.caseId" :options="casesList.map(c => ({value: c.id, label: c.name}))" placeholder="-- Select a Case --" required />
        </label>
            <label class="admin-field admin-field--wide">
              <span>Title *</span>
              <input v-model="taskForm.title" required maxlength="190" />
            </label>
            <label class="admin-field">
              <span>Priority</span>
              <AdminSelect v-model="taskForm.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" />
            </label>
            <label class="admin-field">
              <span>Status</span>
              <AdminSelect v-model="taskForm.status" :options="[{value: 'open', label: 'OPEN'}, {value: 'assigned', label: 'ASSIGNED'}, {value: 'to-do', label: 'TO-DO'}, {value: 'in-progress', label: 'IN PROGRESS'}, {value: 'completed', label: 'COMPLETED'}]" />
            </label>
            <label class="admin-field">
              <span>Task Type</span>
              <AdminSelect v-model="taskForm.taskType" :options="[{value: 'to-do', label: 'To-Do'}, {value: 'milestone', label: 'Milestone'}]" />
            </label>
            <label class="admin-field">
              <span>Due Date</span>
              <input v-model="taskForm.dueDate" type="date" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Description</span>
              <RichTextEditor v-model="taskForm.description" />
            </label>
            <div class="admin-actions" style="justify-content:flex-end; padding-top:0.5rem;">
              <button class="admin-link-button" type="button" @click="showTaskModal = false">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="taskLoading">
                {{ taskLoading ? 'Saving...' : 'Create Task' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--rgb-background), 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}
.modal {
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 20px 60px rgba(var(--rgb-background), 0.5);
  max-height: 90vh;
  overflow-y: auto;
}
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #333);
}
.modal__header h3 { margin: 0; }
.cal-day { cursor: pointer; transition: background 0.2s; }
.cal-day:hover { background: rgba(124, 106, 247, 0.08); }
</style>
