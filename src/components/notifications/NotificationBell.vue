<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { api } from '../../services/api';
import { getPusherClient } from '../../services/pusherClient';
import { authState } from '../../stores/authStore';
import { useRouter } from 'vue-router';
import ClientTalkRequestModal from '../admin/ClientTalkRequestModal.vue';
import ClientTalkModal from '../ClientTalkModal.vue';

const notifications = ref([]);
const unreadCount = ref(0);
const loading = ref(false);
const actionLoading = ref(false);
const deleteLoadingId = ref(null);
const open = ref(false);
const error = ref('');
const root = ref(null);
const router = useRouter();
let pusher = null;
let channel = null;

// State for admin/assistant Client Talk request modal
const activeClientTalkReq = ref(null);
const activeClientTalkSession = ref(null);
const activeClientTalkUnread = ref(false);
const activeClientTalkNotificationId = ref(null);

// State for real-time premium pop-up toast notifications
const activeToasts = ref([]);

function handleToastClick(toast) {
  dismissToast(toast);
  markRead(toast);
}

function dismissToast(toast) {
  activeToasts.value = activeToasts.value.filter((t) => t.toastKey !== toast.toastKey);
}

const currentUserId = computed(() => authState.user?.id || null);
const activeTalkStorageKey = computed(() =>
  currentUserId.value ? `bonehard:client-talk:active:${currentUserId.value}` : null
);

function normalizeNotification(item) {
  return {
    ...item,
    dataJson: typeof item.dataJson === 'string' ? safeJson(item.dataJson) : item.dataJson,
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatRelativeDate(value) {
  if (!value) return '';
  // MySQL returns datetimes without timezone suffix (e.g. "2026-05-13 19:01:15").
  // Without 'Z', Date() treats the string as LOCAL time, adding an incorrect offset.
  // We normalize to ISO UTC so the diff is always calculated correctly.
  const normalized =
    typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')
      ? value.replace(' ', 'T') + 'Z'
      : value;
  const date = new Date(normalized);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function rememberActiveClientTalk(session) {
  if (!activeTalkStorageKey.value || !session?.id || session.status !== 'active') return;
  if (Number(session.assignedTo) !== Number(currentUserId.value)) return;

  localStorage.setItem(activeTalkStorageKey.value, JSON.stringify({
    sessionId: session.id,
    orderId: session.orderId,
    orderName: session.orderName || '',
    savedAt: Date.now(),
  }));
}

function clearRememberedClientTalk(sessionId = null) {
  if (!activeTalkStorageKey.value) return;

  if (sessionId) {
    const raw = localStorage.getItem(activeTalkStorageKey.value);
    const saved = raw ? safeJson(raw) : null;
    if (saved?.sessionId && Number(saved.sessionId) !== Number(sessionId)) return;
  }

  localStorage.removeItem(activeTalkStorageKey.value);
}

async function restoreActiveClientTalkShortcut() {
  if (!activeTalkStorageKey.value || !['admin', 'assistant'].includes(authState.user?.role)) return;

  const raw = localStorage.getItem(activeTalkStorageKey.value);
  const saved = raw ? safeJson(raw) : null;
  if (!saved?.sessionId) return;

  try {
    const response = await api.get(`/api/client-talk/sessions/${saved.sessionId}`);
    const session = response.data;

    if (
      session?.status === 'active' &&
      Number(session.assignedTo) === Number(currentUserId.value)
    ) {
      activeClientTalkSession.value = session;
      activeClientTalkUnread.value = false;
      return;
    }

    clearRememberedClientTalk(saved.sessionId);
  } catch {
    clearRememberedClientTalk(saved.sessionId);
  }
}

function handleClientTalkAccepted(session) {
  rememberActiveClientTalk(session);
}

function handleClientTalkEnded(session) {
  clearRememberedClientTalk(session?.id);
  activeClientTalkSession.value = null;
  activeClientTalkUnread.value = false;
  activeClientTalkNotificationId.value = null;
  activeClientTalkReq.value = null;
}

async function markActiveClientTalkOpened() {
  activeClientTalkUnread.value = false;

  const notificationId = activeClientTalkNotificationId.value;
  if (!notificationId) return;

  const item = notifications.value.find((notification) =>
    Number(notification.id) === Number(notificationId)
  );

  if (item && !item.readAt) {
    item.readAt = new Date().toISOString();
    unreadCount.value = Math.max(unreadCount.value - 1, 0);

    try {
      await api.patch(`/api/notifications/${notificationId}/read`, {});
    } catch {
      // The chat is already visible, so avoid interrupting the user for a
      // non-critical read receipt failure. The next notification refresh will
      // reconcile the server state.
    }
  }

  activeClientTalkNotificationId.value = null;
}

async function loadNotifications() {
  if (!currentUserId.value) return;

  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/api/notifications?perPage=10');
    notifications.value = (response.data || []).map(normalizeNotification);
    unreadCount.value = Number(response.meta?.unreadCount || 0);
  } catch (err) {
    error.value = err.message || 'Failed to load notifications';
  } finally {
    loading.value = false;
  }
}

async function togglePanel() {
  open.value = !open.value;
  if (open.value) {
    await loadNotifications();
  }
}

async function markRead(item) {
  if (!item) return;

  // Optimistically mark as read in local state
  if (!item.readAt) {
    const previousReadAt = item.readAt;
    item.readAt = new Date().toISOString();
    unreadCount.value = Math.max(unreadCount.value - 1, 0);

    try {
      await api.patch(`/api/notifications/${item.id}/read`, {});
    } catch (err) {
      item.readAt = previousReadAt;
      unreadCount.value += 1;
      error.value = err.message || 'Failed to mark notification as read';
    }
  }

  // Handle navigation based on notification type
  const data = item.dataJson;

  // Client Talk notification — open claim modal for admin/assistant
  if (item.type === 'client_talk' && data?.sessionId) {
    const role = authState.user?.role;
    if (role === 'admin' || role === 'assistant') {
      activeClientTalkReq.value = {
        sessionId:   data.sessionId,
        orderId:     data.orderId,
        orderName:   data.orderName || '',
        userName:    data.userName || 'Client',
        requestedAt: item.createdAt,
        sessionStatus: data.sessionStatus,
        assignedTo:  data.assignedTo,
      };
      open.value = false;
      return;
    }
  }

  if (item.type === 'client_talk_message' && data?.sessionId) {
    try {
      const response = await api.get(`/api/client-talk/sessions/${data.sessionId}`);
      activeClientTalkSession.value = response.data;
      activeClientTalkUnread.value = true;
      activeClientTalkNotificationId.value = null;
      open.value = false;
      return;
    } catch (err) {
      error.value = err.message || 'Failed to open Client Talk';
    }
  }

  if (data?.orderId) {
    const prefix = authState.user?.role === 'admin' || authState.user?.role === 'assistant' ? '/admin/user-orders' : '/dashboard/orders';
    router.push(`${prefix}/${data.orderId}`);
    open.value = false;
  } else if (data?.caseId) {
    const prefix = authState.user?.role === 'admin' || authState.user?.role === 'assistant' ? '/admin/cases' : '/dashboard/cases';
    router.push(`${prefix}/${data.caseId}`);
    open.value = false;
  }
}

async function markAllRead() {
  if (!unreadCount.value) return;

  actionLoading.value = true;
  error.value = '';
  const previousItems = notifications.value.map((item) => ({ id: item.id, readAt: item.readAt }));
  const previousCount = unreadCount.value;

  notifications.value = notifications.value.map((item) => ({
    ...item,
    readAt: item.readAt || new Date().toISOString(),
  }));
  unreadCount.value = 0;

  try {
    await api.patch('/api/notifications/read-all', {});
  } catch (err) {
    notifications.value = notifications.value.map((item) => ({
      ...item,
      readAt: previousItems.find((previous) => previous.id === item.id)?.readAt || null,
    }));
    unreadCount.value = previousCount;
    error.value = err.message || 'Failed to mark notifications as read';
  } finally {
    actionLoading.value = false;
  }
}

async function deleteNotification(item) {
  if (!item) return;

  deleteLoadingId.value = item.id;
  error.value = '';

  const previousItems = [...notifications.value];
  const previousCount = unreadCount.value;

  notifications.value = notifications.value.filter((notification) => Number(notification.id) !== Number(item.id));
  if (!item.readAt) {
    unreadCount.value = Math.max(unreadCount.value - 1, 0);
  }

  try {
    await api.delete(`/api/notifications/${item.id}`);
  } catch (err) {
    notifications.value = previousItems;
    unreadCount.value = previousCount;
    error.value = err.message || 'Failed to delete notification';
  } finally {
    deleteLoadingId.value = null;
  }
}

async function deleteAllNotifications() {
  if (!notifications.value.length) return;

  actionLoading.value = true;
  error.value = '';

  const previousItems = [...notifications.value];
  const previousCount = unreadCount.value;

  notifications.value = [];
  unreadCount.value = 0;

  try {
    await api.delete('/api/notifications');
  } catch (err) {
    notifications.value = previousItems;
    unreadCount.value = previousCount;
    error.value = err.message || 'Failed to delete notifications';
  } finally {
    actionLoading.value = false;
  }
}

function handleRealtimeNotification(payload) {
  const incoming = normalizeNotification(payload);
  notifications.value = [
    incoming,
    ...notifications.value.filter((item) => Number(item.id) !== Number(incoming.id)),
  ].slice(0, 10);
  if (!incoming.readAt) {
    unreadCount.value += 1;
  }

  // Display pop-up toast with premium animation for 5 seconds
  const toastObj = { ...incoming, toastKey: Date.now() + '_' + Math.random() };
  activeToasts.value = [...activeToasts.value, toastObj];

  setTimeout(() => {
    activeToasts.value = activeToasts.value.filter((t) => t.toastKey !== toastObj.toastKey);
  }, 5000);

  if (incoming.type === 'client_talk_message' && incoming.dataJson?.sessionId) {
    api.get(`/api/client-talk/sessions/${incoming.dataJson.sessionId}`)
      .then((response) => {
        activeClientTalkSession.value = response.data;
        activeClientTalkUnread.value = true;
        activeClientTalkNotificationId.value = incoming.id;
      })
      .catch(() => {});
  }
}

function handleRealtimeDeletion(payload) {
  const targetId = Number(payload.id);
  const existing = notifications.value.find((item) => Number(item.id) === targetId);
  if (existing) {
    notifications.value = notifications.value.filter((item) => Number(item.id) !== targetId);
    if (!existing.readAt) {
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }
  // Instantly dismiss any active pop-up toast for this deleted notification
  activeToasts.value = activeToasts.value.filter((t) => Number(t.id) !== targetId);
}

async function setupRealtime() {
  if (!currentUserId.value) return;

  try {
    pusher = await getPusherClient();
    channel = pusher.subscribe(`private-user-${currentUserId.value}`);
    channel.bind('notification.created', handleRealtimeNotification);
    channel.bind('notification.deleted', handleRealtimeDeletion);
  } catch (err) {
    console.warn('[Notifications] Realtime unavailable:', err.message);
  }
}

function teardownRealtime() {
  if (channel) {
    channel.unbind('notification.created', handleRealtimeNotification);
    channel.unbind('notification.deleted', handleRealtimeDeletion);
    pusher?.unsubscribe(channel.name);
  }
  channel = null;
  pusher = null;
}

function handleDocumentClick(event) {
  if (!root.value?.contains(event.target)) {
    open.value = false;
  }
}

watch(currentUserId, async (userId) => {
  teardownRealtime();
  notifications.value = [];
  unreadCount.value = 0;
  activeClientTalkReq.value = null;
  activeClientTalkSession.value = null;
  activeClientTalkUnread.value = false;
  activeClientTalkNotificationId.value = null;

  if (userId) {
    await loadNotifications();
    await setupRealtime();
    await restoreActiveClientTalkShortcut();
  }
});

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick);
  await loadNotifications();
  await setupRealtime();
  await restoreActiveClientTalkShortcut();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  teardownRealtime();
});
</script>

<template>
  <div v-if="authState.user" ref="root" class="notification-bell">

    <!-- Client Talk request modal — shown when admin/assistant clicks the notification -->
    <ClientTalkRequestModal
      v-if="activeClientTalkReq"
      :session-id="activeClientTalkReq.sessionId"
      :order-id="activeClientTalkReq.orderId"
      :order-name="activeClientTalkReq.orderName"
      :user-name="activeClientTalkReq.userName"
      :requested-at="activeClientTalkReq.requestedAt"
      @accepted="handleClientTalkAccepted"
      @ended="handleClientTalkEnded"
      @close="activeClientTalkReq = null"
    />

    <ClientTalkModal
      v-if="activeClientTalkSession"
      :key="activeClientTalkSession.id"
      :order-id="activeClientTalkSession.orderId"
      :order-name="activeClientTalkSession.orderName || ''"
      :initial-session="activeClientTalkSession"
      initial-minimized
      :initial-unread="activeClientTalkUnread"
      @opened="markActiveClientTalkOpened"
      @ended="handleClientTalkEnded"
      @close="activeClientTalkSession = null; activeClientTalkUnread = false; activeClientTalkNotificationId = null"
    />

    <button
      class="notification-bell__button"
      type="button"
      :aria-expanded="open"
      aria-label="Notifications"
      title="Notifications"
      @click.stop="togglePanel"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
      <span v-if="unreadCount > 0" class="notification-bell__unread-dot">
        <span class="notification-bell__sr-only">{{ unreadCount }} unread notifications</span>
      </span>
    </button>

    <transition name="notification-panel">
      <section v-if="open" class="notification-bell__panel" aria-label="Notifications list">
        <header class="notification-bell__header">
          <div>
            <p>Notifications</p>
            <span>{{ unreadCount }} unread</span>
          </div>
          <div class="notification-bell__header-actions">
            <button
              class="notification-bell__text-action"
              type="button"
              :disabled="!unreadCount || actionLoading"
              @click="markAllRead"
            >
              Mark all read
            </button>
            <button
              class="notification-bell__text-action notification-bell__text-action--danger"
              type="button"
              :disabled="!notifications.length || actionLoading"
              @click="deleteAllNotifications"
            >
              Delete all
            </button>
          </div>
        </header>

        <p v-if="loading" class="notification-bell__state">Loading notifications...</p>
        <p v-else-if="error" class="notification-bell__state notification-bell__state--error">{{ error }}</p>

        <TransitionGroup v-else name="notification-list" tag="div" class="notification-bell__list">
          <article
            v-for="item in notifications"
            :key="item.id"
            class="notification-bell__item"
            :class="{ 'notification-bell__item--unread': !item.readAt }"
            @click="markRead(item)"
          >
            <span class="notification-bell__dot" aria-hidden="true"></span>
            <span class="notification-bell__content">
              <strong>{{ item.title || 'Notification' }}</strong>
              <span v-if="item.body">{{ item.body }}</span>
              <time :datetime="item.createdAt">{{ formatRelativeDate(item.createdAt) }}</time>
            </span>
            <button
              class="notification-bell__delete"
              type="button"
              :disabled="deleteLoadingId === item.id"
              :aria-label="`Delete notification: ${item.title || 'Notification'}`"
              title="Delete notification"
              @click.stop="deleteNotification(item)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 15H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </article>

          <p v-if="!notifications.length" key="empty-state" class="notification-bell__state">
            No notifications yet.
          </p>
        </TransitionGroup>
      </section>
    </transition>

    <!-- Real-time Toast pop-up notifications container -->
    <Teleport to="body">
      <div class="notification-toasts" aria-live="polite">
        <TransitionGroup name="toast-slide">
          <div
            v-for="toast in activeToasts"
            :key="toast.toastKey"
            class="notification-toast"
            @click="handleToastClick(toast)"
          >
            <div class="notification-toast__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
                <path d="M10 21h4" />
              </svg>
            </div>
            <div class="notification-toast__content">
              <p class="notification-toast__title">{{ toast.title || 'New Notification' }}</p>
              <p v-if="toast.body" class="notification-toast__body">{{ toast.body }}</p>
            </div>
            <button
              class="notification-toast__close"
              type="button"
              aria-label="Close"
              @click.stop="dismissToast(toast)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
}

.notification-bell__button {
  position: relative;
  display: inline-grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 8px;
  background: rgba(var(--rgb-foreground), 0.05);
  color: #f8fafc;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.notification-bell__button:hover {
  transform: translateY(-1px);
  border-color: rgba(248, 217, 170, 0.5);
  background: rgba(248, 217, 170, 0.14);
}

.notification-bell__button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.notification-bell__unread-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16), 0 0 16px rgba(239, 68, 68, 0.65);
}

.notification-bell__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.notification-bell__panel {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 80;
  width: min(380px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 92px));
  overflow: hidden;
  border: 1px solid rgba(248, 217, 170, 0.22);
  border-radius: 8px;
  background: rgba(13, 13, 13, 0.98);
  box-shadow: 0 24px 70px rgba(var(--rgb-background), 0.55);
}

.notification-bell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.notification-bell__header p {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 1rem;
  font-weight: 800;
}

.notification-bell__header span {
  display: block;
  margin-top: 0.2rem;
  color: rgba(var(--rgb-foreground), 0.55);
  font-size: 0.78rem;
}

.notification-bell__header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.notification-bell__text-action {
  flex: 0 0 auto;
  border: 1px solid rgba(248, 217, 170, 0.24);
  border-radius: 8px;
  background: rgba(248, 217, 170, 0.08);
  color: #f8d9aa;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.55rem 0.75rem;
}

.notification-bell__text-action--danger {
  border-color: rgba(248, 113, 113, 0.24);
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
}

.notification-bell__text-action:hover:not(:disabled) {
  border-color: rgba(248, 217, 170, 0.45);
  background: rgba(248, 217, 170, 0.14);
}

.notification-bell__text-action--danger:hover:not(:disabled) {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.14);
}

.notification-bell__text-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.notification-bell__list {
  max-height: 420px;
  overflow-y: auto;
  padding: 0.45rem;
}

.notification-bell__item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 34px;
  align-items: start;
  gap: 0.7rem;
  width: 100%;
  padding: 0.8rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.notification-list-move,
.notification-list-enter-active,
.notification-list-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease, max-height 0.22s ease, margin 0.22s ease, padding 0.22s ease;
}

.notification-list-enter-from,
.notification-list-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  max-height: 0;
  margin: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.notification-list-enter-to,
.notification-list-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 140px;
}

.notification-bell__item:hover {
  border-color: rgba(248, 217, 170, 0.18);
  background: rgba(var(--rgb-foreground), 0.045);
}

.notification-bell__item--unread {
  background: rgba(248, 217, 170, 0.07);
}

.notification-bell__dot {
  width: 8px;
  height: 8px;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: rgba(var(--rgb-foreground), 0.16);
}

.notification-bell__item--unread .notification-bell__dot {
  background: #f8d9aa;
  box-shadow: 0 0 14px rgba(248, 217, 170, 0.45);
}

.notification-bell__content {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.notification-bell__content strong {
  color: var(--color-text-strong);
  font-size: 0.9rem;
  line-height: 1.3;
}

.notification-bell__content span {
  color: rgba(var(--rgb-foreground), 0.7);
  font-size: 0.8rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.notification-bell__content time {
  color: rgba(var(--rgb-foreground), 0.42);
  font-size: 0.72rem;
  font-weight: 700;
}

.notification-bell__delete {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(248, 113, 113, 0.18);
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.06);
  color: #fca5a5;
  cursor: pointer;
  opacity: 0.82;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.notification-bell__delete:hover:not(:disabled) {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.16);
  opacity: 1;
}

.notification-bell__delete:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.notification-bell__delete svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.notification-bell__state {
  margin: 0;
  padding: 1.4rem 1rem;
  color: rgba(var(--rgb-foreground), 0.58);
  text-align: center;
}

.notification-bell__state--error {
  color: #fca5a5;
}

[data-theme="light"] .notification-bell__button {
  background: #ffffff;
  border-color: #e2e8f0;
  color: #0f172a;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

[data-theme="light"] .notification-bell__button:hover {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #92400e;
}

[data-theme="light"] .notification-bell__unread-dot {
  border-color: #ffffff;
}

[data-theme="light"] .notification-bell__panel {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
}

[data-theme="light"] .notification-bell__header {
  border-bottom-color: #e2e8f0;
}

[data-theme="light"] .notification-bell__header span,
[data-theme="light"] .notification-bell__content span,
[data-theme="light"] .notification-bell__content time,
[data-theme="light"] .notification-bell__state {
  color: #64748b;
}

[data-theme="light"] .notification-bell__text-action {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #92400e;
}

[data-theme="light"] .notification-bell__text-action--danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

[data-theme="light"] .notification-bell__item:hover,
[data-theme="light"] .notification-bell__item--unread {
  background: #fff7ed;
  border-color: #fed7aa;
}

[data-theme="light"] .notification-bell__dot {
  background: #cbd5e1;
}

[data-theme="light"] .notification-bell__item--unread .notification-bell__dot {
  background: #dc2626;
  box-shadow: 0 0 14px rgba(220, 38, 38, 0.35);
}

[data-theme="light"] .notification-bell__delete {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.notification-panel-enter-active,
.notification-panel-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.notification-panel-enter-from,
.notification-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 760px) {
  .notification-bell__panel {
    position: fixed;
    top: 68px;
    right: 12px;
    left: 12px;
    width: auto;
  }

  .notification-bell__header {
    align-items: flex-start;
  }

  .notification-bell__header-actions {
    max-width: 9.5rem;
  }
}

/* Premium Real-time Toast Pop-ups */
.notification-toasts {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
  max-width: 380px;
  width: calc(100vw - 2rem);
}

.notification-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 16px;
  background: rgba(18, 18, 18, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(248, 217, 170, 0.25);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  color: #f8fafc;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.notification-toast:hover {
  transform: translateY(-2px);
  border-color: rgba(248, 217, 170, 0.5);
}

.notification-toast__icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(248, 217, 170, 0.12);
  color: #f8d9aa;
}

.notification-toast__icon svg {
  width: 18px;
  height: 18px;
}

.notification-toast__content {
  flex-grow: 1;
  display: grid;
  gap: 0.2rem;
}

.notification-toast__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #f8d9aa;
}

.notification-toast__body {
  margin: 0;
  font-size: 0.82rem;
  color: #e2e8f0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-toast__close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.notification-toast__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* Toast Slide Animations */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.92);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.92);
}
</style>
