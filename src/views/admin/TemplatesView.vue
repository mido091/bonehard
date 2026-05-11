<script setup>
import { onMounted, reactive, ref } from 'vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm } = useConfirmDialog();

// ─── Templates list ─────────────────────────────────────────────
const templates = ref([]);
const loading   = ref(true);
const error     = ref('');
const form      = ref({ name: '', description: '', isActive: true });

async function loadTemplates() {
  loading.value = true;
  try {
    const response = await api.get('/api/cases/templates?page=1&perPage=50');
    templates.value = response.data;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createTemplate() {
  await api.post('/api/cases/templates', form.value);
  form.value = { name: '', description: '', isActive: true };
  await loadTemplates();
}

async function deleteTemplate(id, name) {
  const confirmed = await showConfirm(`Delete template "${name}"? All its tasks will also be deleted.`);
  if (!confirmed) return;
  await api.delete(`/api/cases/templates/${id}`);
  await loadTemplates();
}

// ─── Template Tasks Panel ────────────────────────────────────────
const activeTemplate  = ref(null);  // The template whose tasks we're managing
const templateTasks   = ref([]);
const tasksLoading    = ref(false);
const taskForm        = reactive({
  title: '',
  priority: 'normal',
  status: 'open',
  phaseName: '',
  privateTask: false,
  estimatedMinutes: '',
  taskType: 'to-do',
  startOffsetDays: '',
  dueOffsetDays: '',
  tagsText: '',
  sortOrder: 0,
});
const editingTask     = ref(null);
const editTaskForm    = reactive({
  title: '',
  priority: 'normal',
  status: 'open',
  phaseName: '',
  privateTask: false,
  estimatedMinutes: '',
  taskType: 'to-do',
  startOffsetDays: '',
  dueOffsetDays: '',
  tagsText: '',
});

async function openTemplate(template) {
  activeTemplate.value = template;
  await loadTemplateTasks(template.id);
}

function closeTemplate() {
  activeTemplate.value = null;
  templateTasks.value  = [];
}

async function loadTemplateTasks(templateId) {
  tasksLoading.value = true;
  try {
    const res = await api.get(`/api/cases/templates/${templateId}/tasks`);
    templateTasks.value = res.data;
  } finally {
    tasksLoading.value = false;
  }
}

async function addTask() {
  if (!taskForm.title.trim()) return;
  taskForm.sortOrder = templateTasks.value.length;
  await api.post(`/api/cases/templates/${activeTemplate.value.id}/tasks`, {
    ...taskForm,
    estimatedMinutes: taskForm.estimatedMinutes === '' ? null : Number(taskForm.estimatedMinutes),
    startOffsetDays: taskForm.startOffsetDays === '' ? null : Number(taskForm.startOffsetDays),
    dueOffsetDays: taskForm.dueOffsetDays === '' ? null : Number(taskForm.dueOffsetDays),
    tags: taskForm.tagsText.split(',').map(tag => tag.trim()).filter(Boolean),
  });
  await loadTemplateTasks(activeTemplate.value.id);
  Object.assign(taskForm, {
    title: '',
    priority: 'normal',
    status: 'open',
    phaseName: '',
    privateTask: false,
    estimatedMinutes: '',
    taskType: 'to-do',
    startOffsetDays: '',
    dueOffsetDays: '',
    tagsText: '',
    sortOrder: 0,
  });
}

function startEditTask(task) {
  editingTask.value = task;
  Object.assign(editTaskForm, {
    title: task.title,
    priority: task.priority,
    status: task.status,
    phaseName: task.phaseName || '',
    privateTask: Boolean(task.privateTask),
    estimatedMinutes: task.estimatedMinutes ?? '',
    taskType: task.taskType || 'to-do',
    startOffsetDays: task.startOffsetDays ?? '',
    dueOffsetDays: task.dueOffsetDays ?? '',
    tagsText: (task.tags || []).join(', '),
  });
}

async function saveEditTask() {
  await api.patch(`/api/cases/templates/${activeTemplate.value.id}/tasks/${editingTask.value.id}`, {
    ...editTaskForm,
    estimatedMinutes: editTaskForm.estimatedMinutes === '' ? null : Number(editTaskForm.estimatedMinutes),
    startOffsetDays: editTaskForm.startOffsetDays === '' ? null : Number(editTaskForm.startOffsetDays),
    dueOffsetDays: editTaskForm.dueOffsetDays === '' ? null : Number(editTaskForm.dueOffsetDays),
    tags: editTaskForm.tagsText.split(',').map(tag => tag.trim()).filter(Boolean),
  });
  await loadTemplateTasks(activeTemplate.value.id);
  editingTask.value = null;
}

async function deleteTask(taskId) {
  const confirmed = await showConfirm('Remove this task from the template?');
  if (!confirmed) return;
  await api.delete(`/api/cases/templates/${activeTemplate.value.id}/tasks/${taskId}`);
  await loadTemplateTasks(activeTemplate.value.id);
}

// ─── Apply Template to Case ─────────────────────────────────────
const applyModal     = ref(false);
const applyTemplate  = ref(null);
const cases          = ref([]);
const applyCaseId    = ref('');
const applying       = ref(false);
const applySuccess   = ref('');

async function openApplyModal(template) {
  applyTemplate.value = template;
  applyModal.value    = true;
  applySuccess.value  = '';
  // Load active cases for selection
  try {
    const res = await api.get('/api/cases?perPage=100&page=1');
    cases.value = res.data;
  } catch {}
}

async function applyToCase() {
  if (!applyCaseId.value) return;
  applying.value = true;
  try {
    await api.post(`/api/cases/${applyCaseId.value}/templates/${applyTemplate.value.id}/apply`);
    applySuccess.value = `Template "${applyTemplate.value.name}" applied successfully!`;
    applyCaseId.value  = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    applying.value = false;
  }
}

onMounted(loadTemplates);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Cases Workspace</p>
          <h2>Templates</h2>
        </div>
      </div>

      <!-- Create Template Form -->
      <form class="admin-form admin-form-section" @submit.prevent="createTemplate">
        <label class="admin-field">
          <span>Name</span>
          <input v-model="form.name" required maxlength="160" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Description</span>
          <textarea v-model="form.description" rows="3" maxlength="10000"></textarea>
        </label>
        <label class="admin-check">
          <input v-model="form.isActive" type="checkbox" />
          <span>Active</span>
        </label>
        <button class="admin-primary-button" type="submit">Create Template</button>
      </form>

      <p v-if="loading" class="admin-loading">Loading templates...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tasks</th>
              <th>Phases</th>
              <th>Status</th>
              <th>Created</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="template in templates" :key="template.id">
              <td data-label="Name"><strong>{{ template.name }}</strong></td>
              <td data-label="Tasks">{{ template.taskCount || 0 }}</td>
              <td data-label="Phases">{{ template.phaseCount || 0 }}</td>
              <td data-label="Status">
                <span :class="template.isActive ? 'admin-badge--active' : 'admin-badge--inactive'">
                  {{ template.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
              <td data-label="Created">{{ new Date(template.createdAt).toLocaleDateString('en-US') }}</td>
              <td data-label="Options">
                <button class="admin-link-button" type="button" @click="openTemplate(template)">⚙ Manage Tasks</button>
                <button class="admin-link-button" type="button" @click="openApplyModal(template)">▶ Apply to Case</button>
                <button class="admin-danger-button" type="button" @click="deleteTemplate(template.id, template.name)">Delete</button>
              </td>
            </tr>
            <tr v-if="!templates.length">
              <td colspan="6" class="admin-muted admin-table-empty">
                No templates yet. Create one using the form above.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── Manage Tasks Panel (Slide-in) ───────────────────── -->
    <Teleport to="body">
      <div v-if="activeTemplate" class="modal-backdrop" @click.self="closeTemplate">
        <div class="modal modal--wide" role="dialog" aria-modal="true">
          <header class="modal__header">
            <div>
              <p class="admin-kicker">Template</p>
              <h3>{{ activeTemplate.name }} — Tasks</h3>
            </div>
            <button class="admin-link-button" type="button" @click="closeTemplate">✕ Close</button>
          </header>

          <!-- Add Task Form -->
          <div style="padding:1rem; border-bottom:1px solid var(--border);">
            <form class="admin-form" @submit.prevent="addTask">
              <label class="admin-field admin-field--wide">
                <span>Task Title *</span>
                <input v-model="taskForm.title" required maxlength="190" placeholder="e.g. Design surgical guide" />
              </label>
              <label class="admin-field">
                <span>Priority</span>
                <AdminSelect v-model="taskForm.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" />
              </label>
              <label class="admin-field">
                <span>Task Type</span>
                <AdminSelect v-model="taskForm.taskType" :options="[{value: 'to-do', label: 'To-Do'}, {value: 'milestone', label: 'Milestone'}]" />
              </label>
              <label class="admin-field">
                <span>Phase Name</span>
                <input v-model="taskForm.phaseName" maxlength="160" placeholder="e.g. Planning" />
              </label>
              <label class="admin-field">
                <span>Estimated Minutes</span>
                <input v-model="taskForm.estimatedMinutes" type="number" min="0" />
              </label>
              <label class="admin-field">
                <span>Start Offset Days</span>
                <input v-model="taskForm.startOffsetDays" type="number" />
              </label>
              <label class="admin-field">
                <span>Due Offset Days</span>
                <input v-model="taskForm.dueOffsetDays" type="number" />
              </label>
              <label class="admin-field admin-field--wide">
                <span>Tags</span>
                <input v-model="taskForm.tagsText" placeholder="planning, design" />
              </label>
              <label class="admin-check">
                <input v-model="taskForm.privateTask" type="checkbox" />
                <span>Private Task</span>
              </label>
              <button class="admin-primary-button" type="submit">+ Add Task</button>
            </form>
          </div>

          <!-- Tasks List -->
          <div style="padding:1rem; max-height:420px; overflow-y:auto;">
            <p v-if="tasksLoading" class="admin-muted">Loading tasks...</p>
            <p v-else-if="!templateTasks.length" class="admin-muted">No tasks yet. Add the first one above.</p>
            <div v-else class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Phase</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="task in templateTasks" :key="task.id">
                    <td>{{ task.id }}</td>
                    <td>
                      <template v-if="editingTask?.id === task.id">
                        <input v-model="editTaskForm.title" required maxlength="190" style="width:100%;" />
                      </template>
                      <template v-else>{{ task.title }}</template>
                    </td>
                    <td>
                      <template v-if="editingTask?.id === task.id">
                        <AdminSelect v-model="editTaskForm.priority" :options="[{value: 'low', label: 'LOW'}, {value: 'normal', label: 'NORMAL'}, {value: 'medium', label: 'MEDIUM'}, {value: 'high', label: 'HIGH'}, {value: 'urgent', label: 'URGENT'}]" />
                      </template>
                      <template v-else>
                        <span class="task-priority" :class="`task-priority--${task.priority}`">{{ task.priority }}</span>
                      </template>
                    </td>
                    <td>
                      <template v-if="editingTask?.id === task.id">
                        <input v-model="editTaskForm.phaseName" maxlength="160" />
                      </template>
                      <template v-else>{{ task.phaseName || '—' }}</template>
                    </td>
                    <td>
                      <template v-if="editingTask?.id === task.id">
                        <button class="admin-primary-button" type="button" @click="saveEditTask">Save</button>
                        <button class="admin-link-button" type="button" @click="editingTask = null">Cancel</button>
                      </template>
                      <template v-else>
                        <button class="admin-link-button" type="button" @click="startEditTask(task)">Edit</button>
                        <button class="admin-danger-button" type="button" @click="deleteTask(task.id)">Delete</button>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ─── Apply to Case Modal ─────────────────────────────── -->
    <Teleport to="body">
      <div v-if="applyModal" class="modal-backdrop" @click.self="applyModal = false">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <h3>Apply "{{ applyTemplate?.name }}"</h3>
            <button class="admin-link-button" type="button" @click="applyModal = false">✕</button>
          </header>
          <div style="padding:1.25rem;">
            <p v-if="applySuccess" class="admin-muted" style="color:var(--success,#4ade80); margin-bottom:1rem;">✓ {{ applySuccess }}</p>

            <label class="admin-field admin-field--wide">
              <span>Select Case to Apply Template</span>
              <AdminSelect v-model="applyCaseId" :options="cases.map(c => ({value: c.id, label: c.name}))" placeholder="— Choose a case —" />
            </label>
            <div class="admin-actions" style="justify-content:flex-end; margin-top:1rem;">
              <button class="admin-link-button" type="button" @click="applyModal = false">Cancel</button>
              <button class="admin-primary-button" type="button" :disabled="!applyCaseId || applying" @click="applyToCase">
                {{ applying ? 'Applying...' : 'Apply Template' }}
              </button>
            </div>
          </div>
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
.modal--wide { max-width: 780px; }
.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #333);
}
.modal__header h3 { margin: 0; }
</style>
