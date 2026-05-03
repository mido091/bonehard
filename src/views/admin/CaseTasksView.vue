<script setup>
import { onMounted, reactive, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../services/api';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm } = useConfirmDialog();
const route = useRoute();
const tasks = ref([]);
const users = ref([]);
const meta = ref({ total: 0 });
const loading = ref(false);
const error = ref('');
const viewMode = ref('list');

// Bulk selection state
const selectedIds = ref(new Set());
const allSelected = computed(() => tasks.value.length > 0 && tasks.value.every(t => selectedIds.value.has(t.id)));
const someSelected = computed(() => selectedIds.value.size > 0);

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(tasks.value.map(t => t.id));
  }
}

function toggleOne(id) {
  const next = new Set(selectedIds.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selectedIds.value = next;
}

const filters = reactive({
  search: '',
  taskId: '',
  status: '',
  priority: '',
  assigneeId: '',
  phaseId: '',
  taskType: '',
  tag: '',
  perPage: 20,
});

// Create form
const form = reactive({
  title: '',
  description: '',
  priority: 'normal',
  status: 'open',
  privateTask: false,
  preventEditing: false,
  estimatedMinutes: '',
  timeSpentMinutes: 0,
  taskType: 'to-do',
  startDate: '',
  assigneeId: '',
  dueDate: '',
  phaseId: '',
  tagsText: '',
  watcherIds: [],
});

// Edit modal state
const editTask   = ref(null);
const editLoading = ref(false);
const editForm   = reactive({
  title: '',
  description: '',
  priority: 'normal',
  status: 'open',
  privateTask: false,
  preventEditing: false,
  estimatedMinutes: '',
  timeSpentMinutes: 0,
  taskType: 'to-do',
  startDate: '',
  assigneeId: '',
  dueDate: '',
  phaseId: '',
  tagsText: '',
  watcherIds: [],
});

function openEdit(task) {
  editTask.value = task;
  Object.assign(editForm, {
    title:      task.title,
    description: task.description || '',
    priority:   task.priority,
    status:     task.status,
    privateTask: Boolean(task.privateTask),
    preventEditing: Boolean(task.preventEditing),
    estimatedMinutes: task.estimatedMinutes ?? '',
    timeSpentMinutes: task.timeSpentMinutes ?? 0,
    taskType: task.taskType || 'to-do',
    startDate: task.startDate ? task.startDate.slice(0, 10) : '',
    assigneeId: task.assigneeId || '',
    dueDate:    task.dueDate ? task.dueDate.slice(0, 10) : '',
    phaseId: task.phaseId || '',
    tagsText: (task.tags || []).join(', '),
    watcherIds: [],
  });
}

function closeEdit() {
  editTask.value = null;
}

async function saveEdit() {
  if (!editTask.value) return;
  editLoading.value = true;
  try {
    await api.patch(`/api/cases/${route.params.id}/tasks/${editTask.value.id}`, {
      ...editForm,
      assigneeId: editForm.assigneeId ? Number(editForm.assigneeId) : null,
      phaseId: editForm.phaseId ? Number(editForm.phaseId) : null,
      estimatedMinutes: editForm.estimatedMinutes === '' ? null : Number(editForm.estimatedMinutes),
      timeSpentMinutes: editForm.timeSpentMinutes === '' ? 0 : Number(editForm.timeSpentMinutes),
      preventEditing: editForm.preventEditing,
      dueDate: editForm.dueDate || null,
      startDate: editForm.startDate || null,
      tags: editForm.tagsText.split(',').map(tag => tag.trim()).filter(Boolean),
      watcherIds: editForm.watcherIds.map(Number),
    });
    await loadTasks();
    closeEdit();
  } catch (err) {
    error.value = err.message;
  } finally {
    editLoading.value = false;
  }
}

async function loadTasks() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) params.set(key, value);
    });
    const response = await api.get(`/api/cases/${route.params.id}/tasks?${params.toString()}`);
    tasks.value = response.data;
    meta.value = response.meta;
    // Clear any stale selections
    selectedIds.value = new Set();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  const response = await api.get('/api/admin/users/options');
  users.value = response.data;
}

function payload() {
  return {
    ...form,
    assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    phaseId: form.phaseId ? Number(form.phaseId) : null,
    estimatedMinutes: form.estimatedMinutes === '' ? null : Number(form.estimatedMinutes),
    timeSpentMinutes: form.timeSpentMinutes === '' ? 0 : Number(form.timeSpentMinutes),
    preventEditing: form.preventEditing,
    startDate: form.startDate || null,
    dueDate: form.dueDate || null,
    tags: form.tagsText.split(',').map(tag => tag.trim()).filter(Boolean),
    watcherIds: form.watcherIds.map(Number),
  };
}

async function createTask() {
  try {
    const response = await api.post(`/api/cases/${route.params.id}/tasks`, payload());
    tasks.value = response.data;
    meta.value = response.meta;
    Object.assign(form, {
      title: '',
      description: '',
      priority: 'normal',
      status: 'open',
      privateTask: false,
      preventEditing: false,
      estimatedMinutes: '',
      timeSpentMinutes: 0,
      taskType: 'to-do',
      startDate: '',
      assigneeId: '',
      dueDate: '',
      phaseId: '',
      tagsText: '',
      watcherIds: [],
    });
  } catch (err) {
    error.value = err.message;
  }
}

async function updateTaskStatus(task, status) {
  const response = await api.patch(`/api/cases/${route.params.id}/tasks/${task.id}`, { status });
  tasks.value = response.data;
  meta.value = response.meta;
}

async function removeTask(task) {
  const confirmed = await showConfirm('Delete this task?');
  if (!confirmed) return;
  await api.delete(`/api/cases/${route.params.id}/tasks/${task.id}`);
  await loadTasks();
}

/** Bulk delete selected tasks */
async function bulkDelete() {
  if (!selectedIds.value.size) return;
  const confirmed = await showConfirm(`Delete ${selectedIds.value.size} selected task(s)?`);
  if (!confirmed) return;
  try {
    for (const id of selectedIds.value) {
      await api.delete(`/api/cases/${route.params.id}/tasks/${id}`);
    }
    await loadTasks();
  } catch (err) {
    error.value = err.message;
  }
}

/** Bulk status change for selected tasks */
async function bulkStatus(status) {
  if (!selectedIds.value.size) return;
  try {
    for (const id of selectedIds.value) {
      await api.patch(`/api/cases/${route.params.id}/tasks/${id}`, { status });
    }
    await loadTasks();
  } catch (err) {
    error.value = err.message;
  }
}

function setDueDays(days, targetForm) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  targetForm.dueDate = date.toISOString().slice(0, 10);
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadTasks()]);
});
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">

      <!-- Toolbar -->
      <div class="admin-toolbar admin-toolbar--end">
        <RouterLink class="admin-link-button" :to="`/admin/cases/${route.params.id}`">← Back to Case</RouterLink>
        <AdminSelect 
          v-model="filters.perPage" 
          :options="[{value: 20, label: '20 / page'}, {value: 50, label: '50 / page'}, {value: 100, label: '100 / page'}]" 
          class="admin-compact-select admin-compact-select--fit" 
          style="width: 140px;"
          @change="loadTasks" 
        />
        <button class="admin-link-button" type="button" @click="viewMode = viewMode === 'list' ? 'card' : 'list'">
          {{ viewMode === 'list' ? 'Card View' : 'List View' }}
        </button>
      </div>

      <!-- Bulk Actions Bar -->
      <div v-if="someSelected" class="admin-toolbar" style="background:var(--surface-hover,rgba(var(--rgb-foreground),0.05)); border-radius:6px; padding:0.5rem 1rem; gap:0.5rem; margin-bottom:0.75rem;">
        <span class="admin-muted">{{ selectedIds.size }} selected</span>
        <button class="admin-link-button" type="button" @click="bulkStatus('completed')">✓ Mark Completed</button>
        <button class="admin-link-button" type="button" @click="bulkStatus('open')">↩ Mark Open</button>
        <button class="admin-danger-button" type="button" @click="bulkDelete">🗑 Delete Selected</button>
        <button class="admin-link-button" type="button" @click="selectedIds = new Set()">✕ Clear</button>
      </div>

      <!-- Add Task Form -->
      <form class="task-create-form" @submit.prevent="createTask">
        <label class="admin-field">
          <span>Title</span>
          <input v-model="form.title" required />
        </label>
        <label class="admin-field">
          <span>Priority</span>
          <AdminSelect v-model="form.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" />
        </label>
        <label class="admin-field">
          <span>Status</span>
          <AdminSelect v-model="form.status" :options="[{value: 'open', label: 'OPEN'}, {value: 'assigned', label: 'ASSIGNED'}, {value: 'to-do', label: 'TO-DO'}, {value: 'in-progress', label: 'IN PROGRESS'}, {value: 'completed', label: 'COMPLETED'}]" />
        </label>
        <label class="admin-field">
          <span>Assignee</span>
          <AdminSelect v-model="form.assigneeId" :options="users" placeholder="Unassigned" />
        </label>
        <label class="admin-field">
          <span>Task Type</span>
          <AdminSelect v-model="form.taskType" :options="[{value: 'to-do', label: 'To-Do'}, {value: 'milestone', label: 'Milestone'}]" />
        </label>
        <label class="admin-field">
          <span>Estimated Time (minutes)</span>
          <input v-model="form.estimatedMinutes" type="number" min="0" />
        </label>
        <label class="admin-field">
          <span>Time Spent (minutes)</span>
          <input v-model="form.timeSpentMinutes" type="number" min="0" />
        </label>
        <label class="admin-field">
          <span>Start Date</span>
          <input v-model="form.startDate" type="date" />
        </label>
        <label class="admin-field">
          <div style="display:flex; justify-content:space-between; width:100%;">
            <span>Due Date</span>
            <span style="display:flex; gap:0.25rem;">
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(3, form)">+3d</button>
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(7, form)">+7d</button>
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(14, form)">+14d</button>
            </span>
          </div>
          <input v-model="form.dueDate" type="date" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Description</span>
          <RichTextEditor v-model="form.description" />
        </label>
        <label class="admin-field">
          <span>Tags</span>
          <input v-model="form.tagsText" placeholder="planning, urgent" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Followers / Watchers</span>
          <AdminSelect v-model="form.watcherIds" :options="users" multiple placeholder="Select watchers" />
        </label>
        <label class="admin-check">
          <input v-model="form.privateTask" type="checkbox" />
          <span>Private Task</span>
        </label>
        <label class="admin-check">
          <input v-model="form.preventEditing" type="checkbox" />
          <span>Lock Task (Prevent Staff Edits)</span>
        </label>
        <button class="admin-primary-button" type="submit">+ Add Task</button>
      </form>

      <!-- Filters -->
      <div class="admin-filter-grid">
        <label class="admin-field">
          <span>Search</span>
          <input v-model="filters.search" type="search" placeholder="Task title" />
        </label>
        <label class="admin-field">
          <span>Task ID</span>
          <input v-model="filters.taskId" type="number" min="1" placeholder="# ID" />
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
          <span>Tags</span>
          <input v-model="filters.tag" type="search" placeholder="Tag" />
        </label>
        <label class="admin-field">
          <span>Assignee</span>
          <AdminSelect v-model="filters.assigneeId" :options="users" placeholder="Anyone" />
        </label>
        <button class="admin-primary-button admin-field-action" type="button" @click="loadTasks">Apply Filters</button>
      </div>

      <p v-if="loading" class="admin-muted">Loading tasks...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <!-- Card View -->
      <div v-else-if="viewMode === 'card'" class="task-card-grid">
        <article v-for="task in tasks" :key="task.id" class="admin-card compact-card">
          <div class="compact-card__header">
            <input type="checkbox" :checked="selectedIds.has(task.id)" @change="toggleOne(task.id)" style="margin-right:0.5rem;" />
            <span class="task-priority" :class="`task-priority--${task.priority}`">{{ task.priority?.toUpperCase() }}</span>
            <span class="task-status">{{ task.status }}</span>
          </div>
          <h3>{{ task.title }}</h3>
          <p class="admin-muted">{{ task.assigneeName || 'Unassigned' }}</p>
          <p class="admin-muted admin-muted--small">Due: {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'Not Provided' }}</p>
          <div class="admin-actions compact-card__actions">
            <button class="admin-link-button" type="button" @click="openEdit(task)">Edit</button>
            <button class="admin-link-button" type="button" @click="updateTaskStatus(task, task.status === 'completed' ? 'open' : 'completed')">
              {{ task.status === 'completed' ? 'Reopen' : 'Complete' }}
            </button>
            <button class="admin-danger-button" type="button" @click="removeTask(task)">Delete</button>
          </div>
        </article>
        <p v-if="!tasks.length" class="admin-muted">No tasks yet.</p>
      </div>

      <!-- List View -->
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width:36px;">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>#</th>
              <th>Priority</th>
              <th>Title</th>
              <th>Assignee</th>
              <th>Type</th>
              <th>Due Date</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" :class="{ 'admin-table-row--selected': selectedIds.has(task.id) }">
              <td>
                <input type="checkbox" :checked="selectedIds.has(task.id)" @change="toggleOne(task.id)" />
              </td>
              <td>{{ task.id }}</td>
              <td><span class="task-priority" :class="`task-priority--${task.priority}`">{{ task.priority }}</span></td>
              <td>
                <strong>{{ task.title }}</strong>
                <span class="task-status">{{ task.status }}</span>
                <span v-if="task.privateTask" class="task-status">PRIVATE</span>
              </td>
              <td>{{ task.assigneeName || 'Unassigned' }}</td>
              <td>{{ task.taskType || 'to-do' }}</td>
              <td>{{ task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'Not Provided' }}</td>
              <td>
                <button class="admin-link-button" type="button" @click="openEdit(task)">Edit</button>
                <button class="admin-link-button" type="button" @click="updateTaskStatus(task, task.status === 'completed' ? 'open' : 'completed')">
                  {{ task.status === 'completed' ? 'Reopen' : 'Complete' }}
                </button>
                <button class="admin-danger-button" type="button" @click="removeTask(task)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="admin-muted">{{ meta.total }} tasks total</p>
      </div>
    </div>

    <!-- ─── Edit Task Modal ───────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="editTask" class="modal-backdrop" @click.self="closeEdit">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <h3>Edit Task #{{ editTask.id }}</h3>
            <button class="admin-link-button" type="button" @click="closeEdit">✕</button>
          </header>

          <form class="admin-form" style="padding:1.25rem;" @submit.prevent="saveEdit">
            <label class="admin-field admin-field--wide">
              <span>Title *</span>
              <input v-model="editForm.title" required maxlength="190" />
            </label>
            <label class="admin-field">
              <span>Priority</span>
              <AdminSelect v-model="editForm.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" />
            </label>
            <label class="admin-field">
              <span>Status</span>
              <AdminSelect v-model="editForm.status" :options="[{value: 'open', label: 'OPEN'}, {value: 'assigned', label: 'ASSIGNED'}, {value: 'to-do', label: 'TO-DO'}, {value: 'in-progress', label: 'IN PROGRESS'}, {value: 'completed', label: 'COMPLETED'}]" />
            </label>
            <label class="admin-field">
              <span>Assignee</span>
              <AdminSelect v-model="editForm.assigneeId" :options="users" placeholder="Unassigned" />
            </label>
            <label class="admin-field">
              <span>Task Type</span>
              <AdminSelect v-model="editForm.taskType" :options="[{value: 'to-do', label: 'To-Do'}, {value: 'milestone', label: 'Milestone'}]" />
            </label>
            <label class="admin-field">
              <span>Estimated Time</span>
              <input v-model="editForm.estimatedMinutes" type="number" min="0" />
            </label>
            <label class="admin-field">
              <span>Time Spent</span>
              <input v-model="editForm.timeSpentMinutes" type="number" min="0" />
            </label>
            <label class="admin-field">
              <span>Start Date</span>
              <input v-model="editForm.startDate" type="date" />
            </label>
            <label class="admin-field">
          <div style="display:flex; justify-content:space-between; width:100%;">
            <span>Due Date</span>
            <span style="display:flex; gap:0.25rem;">
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(3, editForm)">+3d</button>
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(7, editForm)">+7d</button>
              <button type="button" class="admin-badge" style="cursor:pointer;" @click="setDueDays(14, editForm)">+14d</button>
            </span>
          </div>
              <input v-model="editForm.dueDate" type="date" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Description</span>
              <RichTextEditor v-model="editForm.description" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Tags</span>
              <input v-model="editForm.tagsText" placeholder="planning, urgent" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Followers / Watchers</span>
              <AdminSelect v-model="editForm.watcherIds" :options="users" multiple placeholder="Select watchers" />
            </label>
            <label class="admin-check">
              <input v-model="editForm.privateTask" type="checkbox" />
              <span>Private Task</span>
            </label>
            <label class="admin-check">
              <input v-model="editForm.preventEditing" type="checkbox" />
              <span>Lock Task (Prevent Staff Edits)</span>
            </label>
            <div class="admin-actions" style="justify-content:flex-end; padding-top:0.5rem;">
              <button class="admin-link-button" type="button" @click="closeEdit">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="editLoading">
                {{ editLoading ? 'Saving...' : 'Save Changes' }}
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
}
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #333);
}
.modal__header h3 { margin: 0; }
.admin-table-row--selected td { background: rgba(99,102,241,0.08); }
</style>
