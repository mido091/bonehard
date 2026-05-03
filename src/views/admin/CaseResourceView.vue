<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { getPusherClient } from '../../services/pusherClient';
import { authState } from '../../stores/authStore';


const route = useRoute();
const rows = ref([]);
const loading = ref(true);
const error = ref('');
const form = ref({});

// Files: active folder tab (private | public | tasks)
const filesTab = ref('private');

// Client Talk: ref to chat container for auto-scroll
const chatContainer = ref(null);

let pusher = null;
let channel = null;

const resource = computed(() => route.meta.resource);

// Use the already-loaded auth session to identify the current user's messages
const myUserId = computed(() => authState.user?.id || null);


// Duration formatter for timers: converts raw seconds to HH:MM:SS
function formatDuration(seconds = 0) {
  const s = Math.max(0, Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

const config = computed(() => {
  const id = route.params.id;
  const map = {
    timers: {
      title: 'Timers',
      endpoint: `/api/cases/${id}/timers`,
      empty: 'No timers yet.',
      defaults: {
        title: '',
        timerType: 'counting',
        status: 'stopped',
        workDate: '',
        durationSeconds: 0,
        hourlyRate: '',
        totalAmount: '',
        clientId: '',
        note: '',
      },
    },
    files: {
      title: 'Files',
      endpoint: `/api/cases/${id}/files`,
      empty: 'No file metadata yet.',
      defaults: { folderType: 'private', fileName: '', fileUrl: '', mimeType: '', fileSize: 0 },
    },
    notes: {
      title: 'Case Notes',
      endpoint: `/api/cases/${id}/notes`,
      empty: 'No notes yet.',
      defaults: { subject: '', content: '' },
    },
    generalNotes: {
      title: 'Notes',
      endpoint: `/api/cases/${id}/general-notes`,
      empty: 'No general notes yet.',
      defaults: { title: '', content: '' },
    },
    notesExport: {
      title: 'Notes Export',
      endpoint: `/api/cases/${id}/notes-export`,
      empty: 'No notes exports yet.',
      defaults: { fileRows: 0, fileUrl: '' },
    },
    clientTalk: {
      title: 'Client Talk',
      endpoint: `/api/cases/${id}/client-talk`,
      empty: 'No client messages yet.',
      defaults: { body: '' },
    },
    settings: {
      title: 'Case Settings',
      endpoint: `/api/cases/settings`,
      empty: 'No custom fields yet.',
      defaults: null,
    },
  };

  return map[resource.value] || map.notes;
});

/** Files filtered by active folder tab */
const filteredFiles = computed(() => {
  if (resource.value !== 'files') return rows.value;
  return rows.value.filter(f => f.folderType === filesTab.value);
});

function resetForm() {
  form.value = { ...(config.value.defaults || {}) };
  // Default folderType to current files tab
  if (resource.value === 'files') form.value.folderType = filesTab.value;
}

async function loadRows() {
  loading.value = true;
  try {
    const response = await api.get(config.value.endpoint);
    rows.value = resource.value === 'settings' ? (response.data.customFields || []) : response.data;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  if (!config.value.defaults) return;
  const response = await api.post(config.value.endpoint, form.value);
  if (Array.isArray(response.data)) {
    rows.value = response.data;
  } else if (!rows.value.some(row => row.id === response.data.id)) {
    rows.value = [...rows.value, response.data];
  }
  resetForm();

  // Auto-scroll to bottom of chat after sending
  if (resource.value === 'clientTalk') {
    await nextTick();
    scrollChat();
  }
}

function scrollChat() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

async function toggleTimer(row, action) {
  const response = await api.patch(`/api/cases/${route.params.id}/timers/${row.id}/${action}`);
  rows.value = response.data;
}

async function subscribeClientTalk() {
  if (resource.value !== 'clientTalk') return;
  pusher = await getPusherClient();
  channel = pusher.subscribe(`private-case-${route.params.id}`);
  channel.bind('message.created', async (message) => {
    if (!rows.value.some(row => row.id === message.id)) {
      rows.value = [...rows.value, message];
      await nextTick();
      scrollChat();
    }
  });
}

onMounted(async () => {
  resetForm();
  await loadRows();
  await subscribeClientTalk();
  if (resource.value === 'clientTalk') {
    await nextTick();
    scrollChat();
  }
});

// Keep folderType in form synced when tab changes
watch(filesTab, () => {
  if (resource.value === 'files') form.value.folderType = filesTab.value;
});

onBeforeUnmount(() => {
  if (channel && pusher) {
    channel.unbind_all();
    pusher.unsubscribe(channel.name);
  }
});
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">

      <div class="admin-panel-header admin-panel-header--compact">
        <div>
          <p class="admin-kicker">Case Resource</p>
          <h2>{{ config.title }}</h2>
        </div>
      </div>

      <!-- ─── FILES: Folder Tabs ──────────────────────────────── -->
      <template v-if="resource === 'files'">
        <div class="resource-folder-tabs">
          <button
            v-for="tab in [{ key: 'private', label: '🔒 Private Files' }, { key: 'public', label: '🌐 Public Files' }, { key: 'tasks', label: '📋 Tasks' }]"
            :key="tab.key"
            class="resource-folder-tab"
            :class="{ 'resource-folder-tab--active': filesTab === tab.key }"
            type="button"
            @click="filesTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <!-- File Upload Form -->
        <form class="admin-form admin-form-section" @submit.prevent="submitForm">
          <input type="hidden" :value="filesTab" />
          <label class="admin-field">
            <span>File Name</span>
            <input v-model="form.fileName" required maxlength="190" />
          </label>
          <label class="admin-field admin-field--wide">
            <span>File URL</span>
            <input v-model="form.fileUrl" required type="url" maxlength="700" />
          </label>
          <label class="admin-field">
            <span>MIME Type</span>
            <input v-model="form.mimeType" maxlength="120" />
          </label>
          <button class="admin-primary-button" type="submit">Upload File</button>
        </form>

        <p v-if="loading" class="admin-muted">Loading files...</p>
        <p v-else-if="error" class="admin-error">{{ error }}</p>
        <div v-else class="admin-list-grid">
          <article v-for="file in filteredFiles" :key="file.id" class="admin-card compact-card">
            <h3>{{ file.fileName }}</h3>
            <p><a :href="file.fileUrl" target="_blank" rel="noopener noreferrer" class="admin-link-button">Open File ↗</a></p>
            <span class="admin-muted">{{ file.mimeType || 'Unknown type' }}</span>
          </article>
          <p v-if="!filteredFiles.length" class="admin-muted">No files in this folder yet.</p>
        </div>
      </template>

      <!-- ─── CLIENT TALK: Chat Bubble UI ───────────────────────── -->
      <template v-else-if="resource === 'clientTalk'">
        <!-- Messages Window -->
        <div ref="chatContainer" class="chat-window">
          <p v-if="loading" class="admin-muted admin-muted--center">Loading messages...</p>
          <p v-else-if="error" class="admin-error">{{ error }}</p>
          <template v-else>
            <div
              v-for="msg in rows"
              :key="msg.id"
              class="chat-bubble-row"
              :class="myUserId && msg.senderId === myUserId ? 'chat-bubble-row--mine' : 'chat-bubble-row--theirs'"
            >
              <div class="chat-bubble">
                <p class="chat-bubble__body">{{ msg.body || msg.content }}</p>
                <span class="chat-bubble__meta">
                  {{ msg.senderName || 'Client' }} ·
                  {{ msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '' }}
                </span>
              </div>
            </div>
            <p v-if="!rows.length" class="admin-muted admin-muted--center">No messages yet. Start the conversation below.</p>
          </template>
        </div>

        <!-- Composer -->
        <form class="chat-composer" @submit.prevent="submitForm">
          <textarea
            v-model="form.body"
            class="chat-composer__input"
            rows="3"
            maxlength="5000"
            placeholder="Type a message…"
            @keydown.enter.ctrl="submitForm"
          ></textarea>
          <button class="admin-primary-button chat-composer__send" type="submit" :disabled="!form.body?.trim()">
            Send ↑
          </button>
        </form>
      </template>

      <!-- ─── ALL OTHER RESOURCES (Timers, Notes, etc.) ──────── -->
      <template v-else>
        <form v-if="config.defaults" class="admin-form admin-form-section" @submit.prevent="submitForm">
          <template v-if="resource === 'timers'">
            <label class="admin-field">
              <span>Title</span>
              <input v-model="form.title" required maxlength="190" />
            </label>
            <label class="admin-field">
              <span>Timer Type</span>
              <AdminSelect v-model="form.timerType" :options="[{value: 'counting', label: 'Counting Timer'}, {value: 'manual', label: 'Manual Entry'}]" />
            </label>
            <label class="admin-field">
              <span>Status</span>
              <AdminSelect v-model="form.status" :options="[{value: 'stopped', label: 'Stopped'}, {value: 'running', label: 'Running'}]" />
            </label>
            <label class="admin-field">
              <span>Date</span>
              <input v-model="form.workDate" type="date" />
            </label>
            <label class="admin-field">
              <span>Time Spent (seconds)</span>
              <input v-model="form.durationSeconds" type="number" min="0" />
            </label>
            <label class="admin-field">
              <span>Hourly Rate</span>
              <input v-model="form.hourlyRate" type="number" min="0" step="0.01" />
            </label>
            <label class="admin-field">
              <span>Total Amount</span>
              <input v-model="form.totalAmount" type="number" min="0" step="0.01" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Notes</span>
              <input v-model="form.note" maxlength="500" />
            </label>
          </template>

          <template v-else-if="resource === 'notesExport'">
            <label class="admin-field">
              <span>File Rows</span>
              <input v-model="form.fileRows" type="number" min="0" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>File URL</span>
              <input v-model="form.fileUrl" type="url" placeholder="Optional export file URL" />
            </label>
          </template>

          <template v-else-if="resource === 'generalNotes'">
            <label class="admin-field">
              <span>Title</span>
              <input v-model="form.title" required maxlength="190" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Content</span>
              <textarea v-model="form.content" rows="8" maxlength="200000"></textarea>
            </label>
          </template>

          <template v-else>
            <label class="admin-field">
              <span>Subject</span>
              <input v-model="form.subject" required maxlength="190" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Content</span>
              <textarea v-model="form.content" rows="3" maxlength="10000"></textarea>
            </label>
          </template>

          <button class="admin-primary-button" type="submit">Save</button>
        </form>

        <p v-if="loading" class="admin-muted">Loading...</p>
        <p v-else-if="error" class="admin-error">{{ error }}</p>

        <div v-else class="admin-list-grid">
          <article v-for="row in rows" :key="row.id" class="admin-card compact-card">
            <h3>{{ row.title || row.subject || row.fileName || row.label || row.senderName || 'Item' }}</h3>
            <p>{{ row.body || row.content || row.fileUrl || row.note || row.fieldKey || row.createdAt || 'Saved item' }}</p>

            <!-- Timers: formatted HH:MM:SS duration -->
            <span v-if="resource === 'timers'" class="timer-duration">
              ⏱ {{ formatDuration(row.durationSeconds) }} · {{ row.status }} · {{ row.timerType || 'counting' }}
            </span>
            <span v-if="resource === 'timers' && row.hourlyRate" class="admin-muted">
              Rate {{ row.hourlyRate }} · Total {{ row.totalAmount || 0 }}
            </span>
            <span v-else>{{ row.createdAt || row.fieldType || row.status || '' }}</span>

            <div v-if="resource === 'timers'" class="admin-actions compact-card__actions">
              <button v-if="row.status !== 'running'" class="admin-link-button" type="button" @click="toggleTimer(row, 'start')">▶ Start</button>
              <button v-if="row.status === 'running'" class="admin-link-button" type="button" @click="toggleTimer(row, 'stop')">⏹ Stop</button>
            </div>
          </article>
          <p v-if="!rows.length" class="admin-muted">{{ config.empty }}</p>
        </div>
      </template>

    </div>
  </section>
</template>

<style scoped>
/* ── Files Folder Tabs ─────────────────────────────────── */
.resource-folder-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border, #333);
  padding-bottom: 0.5rem;
}
.resource-folder-tab {
  padding: 0.4rem 1rem;
  border-radius: 6px 6px 0 0;
  border: 1px solid transparent;
  background: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s, color 0.15s;
}
.resource-folder-tab:hover { background: var(--surface-hover, rgba(var(--rgb-foreground),0.05)); }
.resource-folder-tab--active {
  background: var(--surface-hover, rgba(99,102,241,0.12));
  border-color: var(--border, #444);
  color: var(--primary, #6366f1);
  font-weight: 600;
}

/* ── Chat Bubble UI ────────────────────────────────────── */
.chat-window {
  min-height: 300px;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-deep, rgba(var(--rgb-background),0.2));
  border-radius: 8px;
  margin-bottom: 1rem;
}
.chat-bubble-row {
  display: flex;
}
.chat-bubble-row--mine { justify-content: flex-end; }
.chat-bubble-row--theirs { justify-content: flex-start; }

.chat-bubble {
  max-width: 72%;
  padding: 0.65rem 1rem;
  border-radius: 14px;
  line-height: 1.5;
}
.chat-bubble-row--mine .chat-bubble {
  background: var(--primary, #6366f1);
  color: var(--color-text-strong);
  border-bottom-right-radius: 4px;
}
.chat-bubble-row--theirs .chat-bubble {
  background: var(--surface-hover, rgba(var(--rgb-foreground),0.08));
  color: var(--text, #e0e0e0);
  border-bottom-left-radius: 4px;
}
.chat-bubble__body { margin: 0; }
.chat-bubble__meta {
  display: block;
  font-size: 0.7rem;
  opacity: 0.65;
  margin-top: 0.3rem;
  text-align: right;
}
.chat-bubble-row--theirs .chat-bubble__meta { text-align: left; }

.chat-composer {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}
.chat-composer__input {
  flex: 1;
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  color: var(--text, #e0e0e0);
  padding: 0.65rem;
  resize: none;
  font-size: 0.9rem;
}
.chat-composer__send { white-space: nowrap; }

/* Timer duration badge */
.timer-duration { font-family: monospace; font-size: 0.85rem; }
</style>
