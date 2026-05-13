<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import { api, API_BASE_URL } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { CASE_UPLOAD_ACCEPT, UPLOAD_CATEGORIES, uploadCategoryLabel } from '../../constants/uploadOptions';

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
  folderType: '',
  uploadCategory: '',
  fromDueDate: '',
  toDueDate: '',
  perPage: 20,
  page: 1,
});

const filtersOpen = ref(false);
const generalFiles = ref([]);
const generalFileVisibility = ref('private');
const generalFileCategory = ref('general');
const generalFileCategoryOtherLabel = ref('');
const generalFileInput = ref(null);
const showFileModal = ref(false);
const showNoteModal = ref(false);
const editingNote = ref(null);
const savingLibraryItem = ref(false);
const copiedFileId = ref(null);
const renamingFileId = ref(null);
const renameFileValue = ref('');
const generalNoteForm = reactive({
  title: '',
  content: '',
  visibility: 'private',
  noteType: 'General',
  referenceLinks: [],
});

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
    files: { title: 'Files', endpoint: '/api/cases/files', type: 'files' },
    notes: { title: 'Notes', endpoint: '/api/cases/notes', type: 'notes' },
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

const fileCategoryOptions = computed(() => [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General Library' },
  ...UPLOAD_CATEGORIES.map((category) => ({ value: category.key, label: compactUploadCategoryLabel(category.key) })),
  { value: 'other', label: 'Other' },
]);

const uploadFileCategoryOptions = computed(() => [
  ...fileCategoryOptions.value.filter((item) => item.value),
]);

const fileLibraryStats = computed(() => {
  const counts = rows.value.reduce(
    (summary, row) => {
      const visibility = row.folderType === 'public' ? 'public' : 'private';
      const category = row.uploadCategory || 'photos_documents';
      summary.total += 1;
      summary[visibility] += 1;
      summary.categories[category] = (summary.categories[category] || 0) + 1;
      return summary;
    },
    { total: 0, public: 0, private: 0, categories: {} },
  );

  return [
    { label: 'Total Files', value: counts.total },
    { label: 'Public', value: counts.public },
    { label: 'Private', value: counts.private },
    { label: 'DICOM / STL', value: (counts.categories.dicom || 0) + (counts.categories.stl || 0) },
  ];
});

const groupedFileRows = computed(() => {
  const groups = new Map();
  rows.value.forEach((row) => {
    const isGeneral = (row.sourceType || 'general') === 'general';
    const groupName = isGeneral ? displayUploadCategory(row) : (row.caseName || 'General Library');
    const key = isGeneral
      ? `general:${row.uploadCategory || 'general'}:${row.uploadCategoryOtherLabel || groupName}`
      : `${row.sourceType || 'case'}:${row.caseId || 'library'}:${groupName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        caseId: isGeneral ? null : row.caseId,
        caseName: groupName,
        sourceType: row.sourceType || 'general',
        items: [],
      });
    }
    groups.get(key).items.push(row);
  });
  return Array.from(groups.values());
});

const noteLibraryStats = computed(() => {
  const counts = rows.value.reduce(
    (summary, row) => {
      const visibility = row.visibility === 'public' ? 'public' : 'private';
      summary.total += 1;
      summary[visibility] += 1;
      if ((row.noteType || 'General') === 'General') summary.general += 1;
      return summary;
    },
    { total: 0, public: 0, private: 0, general: 0 },
  );

  return [
    { label: 'Total Notes', value: counts.total },
    { label: 'Public', value: counts.public },
    { label: 'Private', value: counts.private },
    { label: 'General', value: counts.general },
  ];
});

const groupedNoteRows = computed(() => {
  const groups = new Map();
  rows.value.forEach((row) => {
    const key = `${row.sourceType || 'general'}:${row.caseId || 'library'}:${row.caseName || 'General Library'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        caseId: row.caseId,
        caseName: row.caseName || 'General Library',
        sourceType: row.sourceType || 'general',
        items: [],
      });
    }
    groups.get(key).items.push(row);
  });
  return Array.from(groups.values());
});

function prevMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1);
}

function nextMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1);
}

function compactUploadCategoryLabel(value) {
  if (value === 'other') return 'Other';
  if (value === 'general') return 'General Library';
  return uploadCategoryLabel(value)
    .replace("Upload the patient's ", '')
    .replace(' - and any additional documents', '');
}

function displayUploadCategory(row) {
  if (row.uploadCategory === 'other') return row.uploadCategoryOtherLabel || 'Other';
  return compactUploadCategoryLabel(row.uploadCategory || 'photos_documents');
}

function libraryItemKey(row) {
  return `${row.sourceType || 'general'}-${row.id}`;
}

function sourceLabel(value) {
  if (value === 'order') return 'Order';
  if (value === 'case') return 'Case';
  return 'General';
}

function sourceRoute(group) {
  if (!group.caseId) return '';
  return group.sourceType === 'order' ? `/admin/user-orders/${group.caseId}` : `/admin/cases/${group.caseId}`;
}

function fileInitial(fileName = '') {
  const extension = fileName.split('.').pop()?.slice(0, 4) || 'FILE';
  return extension.toUpperCase();
}

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return 'Size not provided';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

function chooseGeneralFile() {
  generalFileInput.value?.click();
}

function onGeneralFileSelected(event) {
  const newFiles = Array.from(event.target.files || []);
  const existingNames = new Set(generalFiles.value.map(f => f.name));
  const uniqueNew = newFiles.filter(f => !existingNames.has(f.name));
  generalFiles.value = [...generalFiles.value, ...uniqueNew];
}

function resetFileForm() {
  generalFiles.value = [];
  generalFileVisibility.value = 'private';
  generalFileCategory.value = 'general';
  generalFileCategoryOtherLabel.value = '';
  if (generalFileInput.value) generalFileInput.value.value = '';
}

function openFileModal() {
  resetFileForm();
  showFileModal.value = true;
}

function closeFileModal() {
  showFileModal.value = false;
  resetFileForm();
}

function resetNoteForm() {
  editingNote.value = null;
  generalNoteForm.title = '';
  generalNoteForm.content = '';
  generalNoteForm.visibility = 'private';
  generalNoteForm.noteType = 'General';
  generalNoteForm.referenceLinks = [];
}

function openNoteModal(note = null) {
  if (note) {
    editingNote.value = note;
    generalNoteForm.title = note.title || '';
    generalNoteForm.content = note.content || '';
    generalNoteForm.visibility = note.visibility === 'public' ? 'public' : 'private';
    generalNoteForm.noteType = note.noteType || 'General';
    generalNoteForm.referenceLinks = normalizeReferenceLinks(note.links);
  } else {
    resetNoteForm();
  }
  showNoteModal.value = true;
}

function closeNoteModal() {
  showNoteModal.value = false;
  resetNoteForm();
}

function fileDownloadUrl(row) {
  if (row.sourceType === 'general') return `${API_BASE_URL}/api/cases/files/general/${row.id}/download`;
  return `${API_BASE_URL}/api/cases/files/${row.id}/download`;
}

function fileRenameEndpoint(row) {
  if (row.sourceType === 'general') return `/api/cases/files/general/${row.id}`;
  return `/api/cases/files/${row.id}`;
}

function noteEndpoint(row) {
  if (row.sourceType === 'general') return `/api/cases/notes/general/${row.id}`;
  return `/api/cases/notes/${row.id}`;
}

function normalizeReferenceLinks(links = []) {
  return Array.isArray(links)
    ? links.map((link) => ({ label: link.label || '', url: link.url || '' })).filter((link) => link.url || link.label)
    : [];
}

function cleanReferenceLinks(links = []) {
  return links
    .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
    .filter((link) => link.url);
}

function addNoteLink() {
  generalNoteForm.referenceLinks.push({ url: '' });
}

function removeNoteLink(index) {
  generalNoteForm.referenceLinks.splice(index, 1);
}

async function copyReferenceLink(link) {
  try {
    await navigator.clipboard.writeText(link.url);
  } catch {
    await showAlert('Could not copy the link.');
  }
}

function startRenameFile(row) {
  renamingFileId.value = libraryItemKey(row);
  renameFileValue.value = row.fileName || '';
}

function cancelRenameFile() {
  renamingFileId.value = null;
  renameFileValue.value = '';
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

async function uploadGeneralLibraryFile() {
  if (!generalFiles.value.length) {
    await showAlert('Please select at least one file.');
    return;
  }
  if (generalFileCategory.value === 'other' && generalFileCategoryOtherLabel.value.trim().length < 2) {
    await showAlert('Custom category name is required.');
    return;
  }
  savingLibraryItem.value = true;
  try {
    const formData = new FormData();
    formData.append('visibility', generalFileVisibility.value);
    formData.append('uploadCategory', generalFileCategory.value);
    formData.append('uploadCategoryOtherLabel', generalFileCategoryOtherLabel.value.trim());
    generalFiles.value.forEach(file => {
      formData.append('files', file);
    });
    await api.upload('/api/cases/files/general', formData);
    closeFileModal();
    await loadRows();
  } catch (err) {
    error.value = err.message;
  } finally {
    savingLibraryItem.value = false;
  }
}

async function saveGeneralLibraryNote() {
  if (!generalNoteForm.title.trim()) {
    await showAlert('Note title is required.');
    return;
  }
  savingLibraryItem.value = true;
  try {
    const payload = {
      title: generalNoteForm.title,
      content: generalNoteForm.content,
      visibility: generalNoteForm.visibility,
      isPrivate: generalNoteForm.visibility !== 'public',
      noteType: generalNoteForm.noteType || 'General',
      referenceLinks: cleanReferenceLinks(generalNoteForm.referenceLinks),
    };

    if (editingNote.value) await api.patch(noteEndpoint(editingNote.value), payload);
    else await api.post('/api/cases/notes/general', payload);

    closeNoteModal();
    await loadRows();
  } catch (err) {
    error.value = err.message;
  } finally {
    savingLibraryItem.value = false;
  }
}

async function copyFileLink(row) {
  try {
    await navigator.clipboard.writeText(fileDownloadUrl(row));
    copiedFileId.value = libraryItemKey(row);
    window.setTimeout(() => {
      if (copiedFileId.value === libraryItemKey(row)) copiedFileId.value = null;
    }, 1800);
  } catch {
    await showAlert('Could not copy the file link.');
  }
}

async function saveFileRename(row) {
  const nextName = renameFileValue.value.trim();
  if (nextName.length < 2) {
    await showAlert('File name must be at least 2 characters.');
    return;
  }
  savingLibraryItem.value = true;
  try {
    await api.patch(fileRenameEndpoint(row), { fileName: nextName });
    cancelRenameFile();
    await loadRows();
  } catch (err) {
    await showAlert(err.message || 'Failed to rename file.');
  } finally {
    savingLibraryItem.value = false;
  }
}

async function deleteFile(row) {
  const confirmed = await showConfirm(`Delete "${row.fileName}" permanently?`);
  if (!confirmed) return;
  savingLibraryItem.value = true;
  try {
    await api.delete(fileRenameEndpoint(row));
    await loadRows();
  } catch (err) {
    await showAlert(err.message || 'Failed to delete file.');
  } finally {
    savingLibraryItem.value = false;
  }
}

async function deleteNote(row) {
  const confirmed = await showConfirm(`Delete note "${row.title}" permanently?`);
  if (!confirmed) return;
  savingLibraryItem.value = true;
  try {
    await api.delete(noteEndpoint(row));
    await loadRows();
  } catch (err) {
    await showAlert(err.message || 'Failed to delete note.');
  } finally {
    savingLibraryItem.value = false;
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
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Cases Workspace</p>
          <h2>{{ config.title }}</h2>
        </div>
        <div v-if="config.type !== 'calendar'" class="admin-toolbar" :class="{ 'library-toolbar': ['files', 'notes'].includes(config.type) }">
          <label class="library-search">
            <span>Search</span>
            <input
              v-model="filters.search"
              type="search"
              :placeholder="config.type === 'files' ? 'Search by file, case, or order...' : config.type === 'notes' ? 'Search by note, case, or order...' : 'Search...'"
              @keyup.enter="loadRows"
            />
          </label>
          <AdminSelect v-if="['tasks', 'timers'].includes(config.type)" v-model="filters.status" :options="config.type === 'timers' ? [{value: 'running', label: 'Running'}, {value: 'stopped', label: 'Stopped'}] : [{value: 'open', label: 'Open'}, {value: 'assigned', label: 'Assigned'}, {value: 'to-do', label: 'To Do'}, {value: 'in-progress', label: 'In Progress'}, {value: 'completed', label: 'Completed'}]" placeholder="All statuses" class="admin-compact-select admin-compact-select--fit" style="width: 160px;" />
          <button class="admin-link-button library-search-button" type="button" @click="loadRows">Search</button>
          <button class="admin-link-button" type="button" @click="filtersOpen = !filtersOpen">Filter</button>
          <button class="admin-primary-button" type="button" @click="loadRows">Refresh</button>
          <button v-if="config.type === 'files'" class="admin-primary-button" type="button" @click="openFileModal">+ Add File</button>
          <button v-if="config.type === 'notes'" class="admin-primary-button" type="button" @click="openNoteModal()">+ Add Note</button>
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

      <section v-if="filtersOpen && ['files', 'notes'].includes(config.type)" class="files-filter-panel">
        <label class="admin-field">
          <span>Visibility</span>
          <AdminSelect v-model="filters.folderType" :options="[{ value: '', label: 'All Visibility' }, { value: 'private', label: 'Private' }, { value: 'public', label: 'Public' }]" />
        </label>
        <label v-if="config.type === 'files'" class="admin-field">
          <span>File Category</span>
          <AdminSelect v-model="filters.uploadCategory" :options="fileCategoryOptions" />
        </label>
        <button class="admin-primary-button" type="button" @click="loadRows">Apply Filters</button>
      </section>

      <section v-if="config.type === 'files'" class="files-library-overview">
        <div class="files-stat-grid">
          <article v-for="stat in fileLibraryStats" :key="stat.label" class="files-stat-card">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        </div>
      </section>

      <section v-if="config.type === 'notes'" class="files-library-overview">
        <div class="files-stat-grid">
          <article v-for="stat in noteLibraryStats" :key="stat.label" class="files-stat-card">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        </div>
      </section>

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

      <div v-else-if="config.type === 'files'" class="files-library-groups">
        <article v-for="group in groupedFileRows" :key="group.key" class="files-library-group">
          <header class="files-library-group__header">
            <div>
              <span class="files-library-group__type">{{ sourceLabel(group.sourceType) }}</span>
              <h3>{{ group.caseName }}</h3>
            </div>
            <RouterLink v-if="group.caseId" class="admin-link-button files-library-group__link" :to="sourceRoute(group)">
              Open {{ sourceLabel(group.sourceType) }}
            </RouterLink>
          </header>

          <div class="files-card-grid">
            <article
              v-for="row in group.items"
              :key="`${row.sourceType}-${row.id}`"
              class="files-file-card"
            >
              <span class="files-file-card__icon">{{ fileInitial(row.fileName) }}</span>
              <span class="files-file-card__content">
                <span v-if="renamingFileId === libraryItemKey(row)" class="files-rename-row">
                  <input v-model="renameFileValue" class="files-rename-input" maxlength="190" @keyup.enter="saveFileRename(row)" />
                  <button class="files-mini-action files-mini-action--primary" type="button" :disabled="savingLibraryItem" @click="saveFileRename(row)">Save</button>
                  <button class="files-mini-action" type="button" @click="cancelRenameFile">Cancel</button>
                </span>
                <strong v-else>{{ row.fileName }}</strong>
                <small class="files-detail-line">{{ displayUploadCategory(row) }} - {{ formatFileSize(row.fileSize) }}</small>
                <small class="files-detail-line">Uploaded by {{ row.uploadedByName || 'Unknown' }} - {{ formatDate(row.updatedAt || row.createdAt) }}</small>
                <small>{{ compactUploadCategoryLabel(row.uploadCategory) }} · {{ formatFileSize(row.fileSize) }}</small>
                <small>Uploaded by {{ row.uploadedByName || 'Unknown' }} · {{ formatDate(row.updatedAt || row.createdAt) }}</small>
              </span>
              <span class="files-file-card__meta">
                <span class="files-chip" :class="`files-chip--${row.folderType || 'private'}`">{{ row.folderType || 'private' }}</span>
                <span class="files-actions">
                  <a class="files-open" :href="fileDownloadUrl(row)" target="_blank" rel="noopener">Open</a>
                  <button class="files-open" type="button" @click="copyFileLink(row)">{{ copiedFileId === libraryItemKey(row) ? 'Copied' : 'Copy' }}</button>
                  <button v-if="row.canManage !== false" class="files-open" type="button" @click="startRenameFile(row)">Rename</button>
                  <button v-if="row.canManage !== false" class="files-open files-open--danger" type="button" @click="deleteFile(row)">Delete</button>
                </span>
              </span>
            </article>
          </div>
        </article>

        <p v-if="!rows.length" class="admin-empty">No files found yet.</p>
      </div>

      <div v-else-if="config.type === 'notes'" class="files-library-groups">
        <article v-for="group in groupedNoteRows" :key="group.key" class="files-library-group">
          <header class="files-library-group__header">
            <div>
              <span class="files-library-group__type">{{ sourceLabel(group.sourceType) }}</span>
              <h3>{{ group.caseName }}</h3>
            </div>
            <RouterLink v-if="group.caseId" class="admin-link-button files-library-group__link" :to="sourceRoute(group)">
              Open {{ sourceLabel(group.sourceType) }}
            </RouterLink>
          </header>

          <div class="files-card-grid">
            <article v-for="row in group.items" :key="`${row.sourceType}-${row.id}`" class="files-file-card notes-card">
              <span class="files-file-card__icon">NOTE</span>
              <span class="files-file-card__content">
                <strong>{{ row.title }}</strong>
                <small class="files-detail-line">{{ row.noteType || 'General' }} - {{ formatDate(row.updatedAt || row.createdAt) }}</small>
                <small class="files-detail-line">Created by {{ row.createdByName || 'Unknown' }}</small>
                <span v-if="row.content" class="notes-card__preview" v-html="row.content"></span>
              </span>
              <span class="files-file-card__meta">
                <span class="files-chip" :class="`files-chip--${row.visibility || 'private'}`">{{ row.visibility || 'private' }}</span>
                <span class="files-actions">
                  <button v-if="row.canManage !== false" class="files-open" type="button" @click="openNoteModal(row)">Edit</button>
                  <button v-if="row.canManage !== false" class="files-open files-open--danger" type="button" @click="deleteNote(row)">Delete</button>
                </span>
              </span>
              <div v-if="row.links?.length" class="reference-links reference-links--card">
                <a v-for="link in row.links" :key="link.id || link.url" :href="link.url" target="_blank" rel="noopener">
                  {{ link.label || link.url }}
                </a>
              </div>
            </article>
          </div>
        </article>

        <p v-if="!rows.length" class="admin-empty">No notes found yet.</p>
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
            <tr v-else-if="config.type === 'files'">
              <th>Case / Order</th>
              <th>File</th>
              <th>Category</th>
              <th>Visibility</th>
              <th>Uploaded</th>
            </tr>
            <tr v-else-if="config.type === 'notes'">
              <th>Case / Order</th>
              <th>Type</th>
              <th>Title</th>
              <th>Visibility</th>
              <th>Updated</th>
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
            <template v-else-if="config.type === 'files'">
              <tr v-for="row in rows" :key="`${row.sourceType}-${row.id}`">
                <td data-label="Case / Order">
                  <strong>{{ row.caseName }}</strong>
                  <span class="admin-muted" style="display:block;">{{ row.sourceType }}</span>
                </td>
                <td data-label="File">
                  <a :href="row.fileUrl" target="_blank" rel="noopener" class="case-click-title">{{ row.fileName }}</a>
                  <span class="admin-muted" style="display:block;">{{ row.uploadedByName || '-' }}</span>
                </td>
                <td data-label="Category">{{ row.uploadCategory || 'photos_documents' }}</td>
                <td data-label="Visibility">{{ row.folderType || 'private' }}</td>
                <td data-label="Uploaded">{{ row.updatedAt || row.createdAt }}</td>
              </tr>
            </template>
            <template v-else-if="config.type === 'notes'">
              <tr v-for="row in rows" :key="`${row.sourceType}-${row.id}`">
                <td data-label="Case / Order">
                  <strong>{{ row.caseName }}</strong>
                  <span class="admin-muted" style="display:block;">{{ row.sourceType }}</span>
                </td>
                <td data-label="Type">{{ row.noteType || 'General' }}</td>
                <td data-label="Title">
                  <strong>{{ row.title }}</strong>
                  <span class="admin-muted" style="display:block;">{{ row.createdByName || '-' }}</span>
                </td>
                <td data-label="Visibility">{{ row.visibility || 'private' }}</td>
                <td data-label="Updated">{{ row.updatedAt || row.createdAt }}</td>
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

    <Teleport to="body">
      <div v-if="showFileModal" class="modal-backdrop" @click.self="closeFileModal">
        <div class="modal library-modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <div>
              <p class="admin-kicker">Files Library</p>
              <h3>Add File</h3>
            </div>
            <button class="admin-link-button" type="button" @click="closeFileModal">Close</button>
          </header>
          <form class="library-modal__body" @submit.prevent="uploadGeneralLibraryFile">
            <label class="admin-field">
              <span>Visibility</span>
              <AdminSelect v-model="generalFileVisibility" :options="[{ value: 'private', label: 'Private' }, { value: 'public', label: 'Public' }]" />
            </label>
            <label class="admin-field">
              <span>Category</span>
              <AdminSelect v-model="generalFileCategory" :options="uploadFileCategoryOptions" />
            </label>
            <label v-if="generalFileCategory === 'other'" class="admin-field admin-field--wide">
              <span>Custom category name</span>
              <input v-model.trim="generalFileCategoryOtherLabel" maxlength="120" placeholder="Type the section name..." />
            </label>
            <!-- Hidden native file input — always accepts multiple files -->
            <input ref="generalFileInput" class="files-native-input" type="file" multiple :accept="CASE_UPLOAD_ACCEPT" @change="onGeneralFileSelected" />

            <!-- Selected files list -->
            <div v-if="generalFiles.length" class="file-upload-list admin-field--wide">
              <div v-for="(file, i) in generalFiles" :key="i" class="file-upload-list__row">
                <span class="file-upload-list__icon">{{ file.name.split('.').pop().toUpperCase().slice(0, 3) }}</span>
                <span class="file-upload-list__info">
                  <strong>{{ file.name }}</strong>
                  <small>{{ formatFileSize(file.size) }}</small>
                </span>
                <button class="file-upload-list__remove" type="button" @click="generalFiles = generalFiles.filter((_, idx) => idx !== i)">✕</button>
              </div>
            </div>

            <!-- Empty state / primary add button -->
            <button v-if="!generalFiles.length" class="files-picker admin-field--wide" type="button" @click="chooseGeneralFile">
              <span class="files-picker__icon">UP</span>
              <span>
                <strong>Choose files</strong>
                <small>Max 1024MB per file · Multiple files supported</small>
              </span>
            </button>

            <!-- Add more files (shown when files already selected) -->
            <button v-else class="admin-link-button file-upload-add-more" type="button" @click="chooseGeneralFile">
              + Add more files
            </button>

            <div class="library-modal__actions">
              <button class="admin-link-button" type="button" @click="closeFileModal">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="savingLibraryItem || !generalFiles.length">
                {{ savingLibraryItem ? `Uploading ${generalFiles.length} file(s)…` : `Upload ${generalFiles.length || ''} File${generalFiles.length !== 1 ? 's' : ''}` }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showNoteModal" class="modal-backdrop" @click.self="closeNoteModal">
        <div class="modal library-modal library-modal--wide" role="dialog" aria-modal="true">
          <header class="modal__header">
            <div>
              <p class="admin-kicker">Notes Library</p>
              <h3>{{ editingNote ? 'Edit Note' : 'Add Note' }}</h3>
            </div>
            <button class="admin-link-button" type="button" @click="closeNoteModal">Close</button>
          </header>
          <form class="library-modal__body" @submit.prevent="saveGeneralLibraryNote">
            <label class="admin-field">
              <span>Visibility</span>
              <AdminSelect v-model="generalNoteForm.visibility" :options="[{ value: 'private', label: 'Private' }, { value: 'public', label: 'Public' }]" />
            </label>
            <label class="admin-field">
              <span>Note Type</span>
              <input v-model.trim="generalNoteForm.noteType" maxlength="80" placeholder="General, Internal, Project..." />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Title</span>
              <input v-model.trim="generalNoteForm.title" maxlength="190" required />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Note</span>
              <RichTextEditor v-model="generalNoteForm.content" />
            </label>
            <section class="admin-field admin-field--wide reference-link-editor">
              <div class="reference-link-editor__header">
                <span>Reference Links</span>
                <button class="admin-link-button" type="button" @click="addNoteLink">+ Add link</button>
              </div>
              <div v-for="(link, index) in generalNoteForm.referenceLinks" :key="index" class="reference-link-row">
                <input v-model.trim="link.url" type="url" maxlength="1000" placeholder="https://example.com" />
                <button class="files-mini-action" type="button" @click="removeNoteLink(index)">Remove</button>
              </div>
              <p v-if="!generalNoteForm.referenceLinks.length" class="admin-muted">Add links that should appear under this note.</p>
            </section>
            <div class="library-modal__actions">
              <button class="admin-link-button" type="button" @click="closeNoteModal">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="savingLibraryItem">
                {{ savingLibraryItem ? 'Saving...' : editingNote ? 'Save Changes' : 'Add Note' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

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
.library-toolbar {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) auto auto auto auto;
  width: min(100%, 66rem);
  align-items: end;
}

.library-search {
  display: grid;
  gap: 0.35rem;
}

.library-search span {
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.library-search input {
  width: 100%;
  min-height: 3.2rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.15);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-foreground), 0.055);
  color: var(--color-text-strong);
  padding: 0.85rem 1rem;
  font: inherit;
  font-weight: 700;
}

.library-search input:focus {
  border-color: rgba(var(--rgb-accent), 0.55);
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.12);
  outline: none;
}

.files-filter-panel {
  display: grid;
  grid-template-columns: minmax(12rem, 18rem) minmax(14rem, 22rem) auto;
  gap: 1rem;
  align-items: end;
  margin: 0 0 1rem;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.9rem;
  background: rgba(var(--rgb-foreground), 0.035);
}

.files-library-overview {
  margin: 1rem 0 1.4rem;
}

.files-upload-card,
.files-stat-card,
.files-library-group {
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  background:
    radial-gradient(circle at top right, rgba(248, 217, 170, 0.1), transparent 32rem),
    rgba(var(--rgb-foreground), 0.035);
  border-radius: 1rem;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.16);
}

.files-upload-card {
  display: grid;
  grid-template-columns: minmax(16rem, 0.8fr) minmax(0, 1.2fr);
  gap: 1rem;
  align-items: stretch;
  padding: 1.1rem;
}

.files-upload-card__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100%;
  padding: 0.2rem;
}

.files-upload-card__copy h3 {
  margin: 0.2rem 0 0.45rem;
  color: var(--color-text-strong);
  font-size: clamp(1.2rem, 2vw, 1.7rem);
}

.files-upload-card__copy p:last-child {
  max-width: 42rem;
  margin: 0;
  color: rgba(var(--rgb-foreground), 0.62);
  line-height: 1.6;
}

.files-upload-card__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.files-native-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.files-picker {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  width: 100%;
  min-height: 4.5rem;
  padding: 0.95rem;
  border: 1px dashed rgba(var(--rgb-accent), 0.45);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-accent), 0.07);
  color: var(--color-text-strong);
  text-align: left;
  cursor: pointer;
}

.files-picker:hover,
.files-picker:focus-visible {
  border-color: rgba(var(--rgb-accent), 0.75);
  background: rgba(var(--rgb-accent), 0.11);
  outline: none;
}

.files-picker__icon,
.files-file-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 0.8rem;
  background: rgba(59, 130, 246, 0.16);
  color: #60a5fa;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.files-picker strong,
.files-picker small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files-picker small {
  margin-top: 0.2rem;
  color: rgba(var(--rgb-foreground), 0.58);
}

.files-upload-card__button {
  grid-column: 1 / -1;
  min-height: 3.3rem;
}

.files-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.files-stat-card {
  min-height: 6.2rem;
  padding: 1rem;
}

.files-stat-card span {
  display: block;
  color: rgba(var(--rgb-foreground), 0.55);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.files-stat-card strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--color-text-strong);
  font-size: 2rem;
  line-height: 1;
}

.files-library-groups {
  display: grid;
  gap: 1rem;
}

.files-library-group {
  overflow: hidden;
}

.files-library-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.files-library-group__header h3 {
  margin: 0.15rem 0 0;
  color: var(--color-text-strong);
}

.files-library-group__type {
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.files-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  padding: 1rem;
}

.files-file-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
  min-height: 8.5rem;
  padding: 0.9rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-background), 0.24);
  color: var(--color-text-strong);
  text-decoration: none;
}

.files-file-card:hover,
.files-file-card:focus-visible {
  border-color: rgba(var(--rgb-accent), 0.38);
  background: rgba(var(--rgb-accent), 0.07);
  outline: none;
}

.files-file-card__content {
  min-width: 0;
}

.files-file-card__content strong,
.files-file-card__content small {
  display: block;
  min-width: 0;
}

.files-file-card__content > small:not(.files-detail-line) {
  display: none;
}

.files-file-card__content strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files-file-card__content small {
  margin-top: 0.25rem;
  color: rgba(var(--rgb-foreground), 0.58);
  line-height: 1.35;
}

.files-file-card__meta {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  margin-top: auto;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.files-actions,
.library-modal__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
}

.files-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.28rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.files-chip--public {
  background: rgba(34, 197, 94, 0.14);
  color: #22c55e;
}

.files-chip--private {
  background: rgba(248, 217, 170, 0.14);
  color: #f8d9aa;
}

.files-open {
  border: 0;
  background: transparent;
  color: var(--color-accent, #f8d9aa);
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  padding: 0;
}

.files-open--danger {
  color: #fca5a5;
}

.reference-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.reference-links--card {
  grid-column: 1 / -1;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.reference-links a {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(var(--rgb-accent), 0.24);
  border-radius: 999px;
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-accent, #f8d9aa);
  padding: 0.35rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 900;
  text-decoration: none;
}

.reference-link-editor {
  gap: 0.7rem;
}

.reference-link-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.reference-link-editor__header > span {
  color: rgba(var(--rgb-foreground), 0.72);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reference-link-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.reference-link-row input {
  width: 100%;
  min-height: 2.8rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.15);
  border-radius: 0.7rem;
  background: rgba(var(--rgb-foreground), 0.05);
  color: var(--color-text-strong);
  padding: 0.5rem 0.8rem;
  font: inherit;
  font-weight: 600;
  transition: all 0.2s ease;
}

.reference-link-row input:focus {
  outline: none;
  border-color: rgba(var(--rgb-accent), 0.5);
  background: rgba(var(--rgb-background), 0.8);
}

.files-rename-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.4rem;
  align-items: center;
}

.files-rename-input {
  min-width: 0;
  border: 1px solid rgba(var(--rgb-accent), 0.45);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-background), 0.35);
  color: var(--color-text-strong);
  padding: 0.45rem 0.6rem;
  font: inherit;
  font-weight: 800;
}

.files-mini-action {
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.5rem;
  background: rgba(var(--rgb-foreground), 0.06);
  color: var(--color-text-strong);
  padding: 0.42rem 0.58rem;
  font-weight: 900;
  cursor: pointer;
}

.files-mini-action--primary {
  background: var(--color-accent, #f8d9aa);
  color: #111827;
}

.notes-card__preview {
  display: -webkit-box;
  margin-top: 0.55rem;
  color: rgba(var(--rgb-foreground), 0.68);
  line-height: 1.45;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.library-modal {
  max-width: 680px;
  background:
    radial-gradient(circle at top right, rgba(var(--rgb-accent), 0.08), transparent 24rem),
    rgba(var(--rgb-background), 1);
  border-color: rgba(var(--rgb-accent), 0.16);
  color: var(--color-text-strong);
}

.library-modal--wide {
  max-width: 860px;
}

.library-modal__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  padding: 1.25rem;
  max-height: min(70vh, 44rem);
  overflow: auto;
}

/* ── File upload list inside the modal ───────────── */
.file-upload-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-foreground), 0.03);
}

.file-upload-list__row {
  display: grid;
  grid-template-columns: 2.4rem 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.2rem;
}

.file-upload-list__row + .file-upload-list__row {
  border-top: 1px solid rgba(var(--rgb-foreground), 0.07);
  padding-top: 0.6rem;
}

.file-upload-list__icon {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.55rem;
  background: rgba(var(--rgb-accent), 0.14);
  color: var(--color-accent, #f8d9aa);
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.file-upload-list__info {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.file-upload-list__info strong {
  display: block;
  font-size: 0.87rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-strong);
}

.file-upload-list__info small {
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.75rem;
}

.file-upload-list__remove {
  width: 1.8rem;
  height: 1.8rem;
  border: 0;
  border-radius: 0.45rem;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.file-upload-list__remove:hover {
  background: rgba(239, 68, 68, 0.22);
}

.file-upload-add-more {
  font-size: 0.82rem;
  opacity: 0.75;
  margin-top: -0.2rem;
}

:global([data-theme="light"]) .file-upload-list {
  background: #f8fafc;
  border-color: rgba(15, 23, 42, 0.1);
}

:global([data-theme="light"]) .file-upload-list__remove {
  color: #b91c1c;
}

.library-modal__actions {
  grid-column: 1 / -1;
  position: sticky;
  bottom: -1.1rem;
  margin: 0 -1.1rem -1.1rem;
  padding: 1rem 1.1rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.1);
  background: rgba(var(--rgb-background), 0.94);
  backdrop-filter: blur(14px);
  padding-top: 0.4rem;
}

:global([data-theme="light"]) .files-upload-card,
:global([data-theme="light"]) .files-stat-card,
:global([data-theme="light"]) .files-library-group,
:global([data-theme="light"]) .files-filter-panel {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.11);
  box-shadow: 0 1rem 2.5rem rgba(15, 23, 42, 0.08);
}

:global([data-theme="light"]) .files-upload-card__copy p:last-child,
:global([data-theme="light"]) .files-stat-card span,
:global([data-theme="light"]) .files-library-group__type,
:global([data-theme="light"]) .files-file-card__content small,
:global([data-theme="light"]) .files-picker small {
  color: rgba(15, 23, 42, 0.62);
}

:global([data-theme="light"]) .files-picker {
  background: rgba(59, 130, 246, 0.07);
  color: #0f172a;
}

:global([data-theme="light"]) .files-file-card {
  background: #f8fafc;
  color: #0f172a;
}

:global([data-theme="light"]) .library-search input,
:global([data-theme="light"]) .files-rename-input {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.16);
  color: #0f172a;
}

:global([data-theme="light"]) .files-open {
  color: #7c4a03;
}

:global([data-theme="light"]) .files-open--danger {
  color: #b91c1c;
}



:global([data-theme="light"]) .reference-links a {
  background: rgba(124, 74, 3, 0.08);
  border-color: rgba(124, 74, 3, 0.18);
  color: #7c4a03;
}

:global([data-theme="light"]) .reference-link-row input {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.16);
  color: #0f172a;
}

:global([data-theme="light"]) .reference-link-row input:focus {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

:global([data-theme="light"]) .files-chip--private {
  background: rgba(120, 113, 108, 0.13);
  color: #57534e;
}

@media (max-width: 1180px) {
  .files-stat-grid,
  .files-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .modal__header {
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .modal__header .admin-link-button {
    width: auto !important;
    margin-left: auto;
  }

  .library-toolbar,
  .files-filter-panel,
  .files-upload-card__controls,
  .files-card-grid,
  .files-stat-grid,
  .library-modal__body,
  .files-rename-row,
  .reference-link-row {
    grid-template-columns: 1fr;
  }

  .files-library-group__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .files-library-group__link {
    width: 100%;
    justify-content: center;
  }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--rgb-background), 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  /* Use flex with overflow-y: auto — the most reliable mobile centering pattern */
  display: flex;
  align-items: center;
  justify-content: center;
  /* Allow backdrop to scroll when modal is taller than the viewport (landscape mobile) */
  overflow-y: auto;
  padding: 1rem;
  z-index: 900;
}

.modal {
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border, #333);
  border-radius: 14px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
  max-height: calc(100dvh - 2rem); /* dvh = dynamic viewport height (excludes browser chrome) */
  overflow-y: auto;
  position: relative;
  /* margin: auto ensures true centering inside the flex backdrop on all devices */
  margin: auto;
  /* Prevent the modal from shrinking below its content height */
  flex-shrink: 0;
}

.modal.library-modal {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(var(--rgb-accent), 0.08), transparent 24rem),
    rgba(var(--rgb-background), 1);
  border-color: rgba(var(--rgb-accent), 0.16);
}

.modal.library-modal--wide {
  max-width: 860px;
}



:global([data-theme="light"]) .modal.library-modal .modal__header {
  border-color: rgba(15, 23, 42, 0.1);
}

:global([data-theme="light"]) .modal.library-modal .library-modal__actions {
  background: #f8fafc;
  border-color: rgba(15, 23, 42, 0.1);
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
