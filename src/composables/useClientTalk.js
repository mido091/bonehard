/**
 * useClientTalk.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Composable that encapsulates all Client Talk state and API calls.
 * Handles Pusher subscriptions, session lifecycle, and message streaming.
 *
 * Usage:
 *   const { session, messages, status, ... } = useClientTalk(orderId);
 */

import { computed, onBeforeUnmount, ref } from 'vue';
import { api } from '../services/api';
import { getPusherClient } from '../services/pusherClient';
import { authState } from '../stores/authStore';

export function useClientTalk(orderId) {
  // ── State ────────────────────────────────────────────────────────────────
  const session       = ref(null);   // full session object from server
  const messages      = ref([]);
  const loading       = ref(false);
  const sending       = ref(false);
  const accepting     = ref(false);
  const ending        = ref(false);
  const error         = ref('');

  // Derived status for easy template conditionals
  const status = computed(() => session.value?.status || null);

  // ── Pusher internals ─────────────────────────────────────────────────────
  let pusherClient  = null;
  let activeChannel = null;

  async function subscribeToSession(sessionId) {
    if (activeChannel?.name === `private-client-talk-session-${sessionId}`) return;

    unsubscribeFromSession();

    try {
      pusherClient  = await getPusherClient();
      activeChannel = pusherClient.subscribe(`private-client-talk-session-${sessionId}`);

      // Incoming message from the other party or loopback
      activeChannel.bind('message.created', (msg) => {
        // If message is already in list (e.g. from HTTP response), ignore
        if (messages.value.find((m) => m.id === msg.id)) return;

        const currentUserId = authState.user?.id;
        // If we sent this message ourselves, check if we have a pending optimistic entry to replace
        if (currentUserId && Number(msg.senderId) === Number(currentUserId)) {
          const pendingIdx = messages.value.findIndex((m) => m._pending && m.body === msg.body);
          if (pendingIdx !== -1) {
            // Replace the pending optimistic entry with the real incoming message
            const updated = [...messages.value];
            updated[pendingIdx] = msg;
            messages.value = updated;
            return;
          }
        }

        // Otherwise, append the incoming message
        messages.value = [...messages.value, msg];
      });

      // Admin/assistant joined
      activeChannel.bind('session.accepted', (payload) => {
        if (session.value) {
          session.value = {
            ...session.value,
            status:       'active',
            assignedTo:   payload.assignedTo,
            assignedName: payload.assignedName,
          };
        }
      });

      // Either party ended the conversation
      activeChannel.bind('session.ended', (payload) => {
        if (session.value) {
          session.value = {
            ...session.value,
            status:  'ended',
            endedBy: payload.endedBy,
            endedAt: payload.endedAt,
          };
        }
      });
    } catch (err) {
      console.warn('[ClientTalk] Realtime unavailable:', err.message);
    }
  }

  function unsubscribeFromSession() {
    if (activeChannel) {
      activeChannel.unbind_all();
      pusherClient?.unsubscribe(activeChannel.name);
    }
    activeChannel = null;
  }

  // ── API helpers ──────────────────────────────────────────────────────────

  /** Fetch the current open session for this order (if any). */
  async function fetchSession() {
    loading.value = true;
    error.value   = '';
    try {
      const res = await api.get(`/api/user/orders/${orderId}/client-talk/session`);
      session.value = res.data;
      if (session.value?.id) {
        await subscribeToSession(session.value.id);
        if (['pending', 'active', 'ended'].includes(session.value.status)) {
          await fetchMessages();
        }
      }
    } catch (err) {
      error.value = err.message || 'Failed to load session';
    } finally {
      loading.value = false;
    }
  }

  /** POST a new session request (or reuse an existing pending one). */
  async function requestTalk() {
    loading.value = true;
    error.value   = '';
    try {
      const res = await api.post(`/api/user/orders/${orderId}/client-talk/request`);
      session.value = res.data;
      await subscribeToSession(session.value.id);
      if (['pending', 'active', 'ended'].includes(session.value.status)) {
        await fetchMessages();
      }
    } catch (err) {
      error.value = err.message || 'Failed to send request';
    } finally {
      loading.value = false;
    }
  }

  /** Admin/assistant: open or reuse an order/case conversation immediately. */
  async function openStaffTalk(targetId = orderId, resourceType = 'user-orders') {
    loading.value = true;
    error.value   = '';
    try {
      const res = await api.post(`/api/admin/${resourceType}/${targetId}/client-talk/open`);
      session.value = res.data;
      await subscribeToSession(session.value.id);
      await fetchMessages();
      return { success: true, session: res.data };
    } catch (err) {
      error.value = err.message || 'Failed to open Client Talk';
      return { success: false };
    } finally {
      loading.value = false;
    }
  }

  /** Load all messages for the current session. */
  async function fetchMessages() {
    if (!session.value?.id) return;
    try {
      const res = await api.get(`/api/client-talk/sessions/${session.value.id}/messages?perPage=100`);
      messages.value = res.data || [];
    } catch (err) {
      error.value = err.message || 'Failed to load messages';
    }
  }

  /**
   * Send a text message. Optimistically adds it to the local list so
   * the UI feels instant; the server response replaces the temp entry.
   */
  async function sendMessage(body) {
    if (!session.value?.id || !body.trim()) return;
    sending.value = true;
    error.value   = '';

    // Optimistic insert with a temporary id
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sessionId:   session.value.id,
      senderId:    authState.user?.id || null, // assign optimistic senderId
      senderName:  'You',
      body:        body.trim(),
      createdAt:   new Date().toISOString(),
      _pending:    true,
    };
    messages.value = [...messages.value, tempMsg];

    try {
      const res = await api.post(
        `/api/client-talk/sessions/${session.value.id}/messages`,
        { body: body.trim() },
      );
      // Replace the temp entry with the real one
      messages.value = messages.value.map((m) =>
        m.id === tempId ? res.data : m,
      );
    } catch (err) {
      // Remove the failed temp message
      messages.value = messages.value.filter((m) => m.id !== tempId);
      error.value = err.message || 'Failed to send message';
    } finally {
      sending.value = false;
    }
  }

  /** Admin/assistant: claim a pending session. */
  async function acceptSession(sessionId) {
    accepting.value = true;
    error.value     = '';
    try {
      const res = await api.patch(`/api/client-talk/sessions/${sessionId}/accept`);
      session.value = res.data;
      await subscribeToSession(sessionId);
      await fetchMessages();
      return { success: true, session: res.data };
    } catch (err) {
      if (err.status === 409) {
        return { success: false, alreadyAccepted: true, details: err.details };
      }
      error.value = err.message || 'Failed to accept session';
      return { success: false };
    } finally {
      accepting.value = false;
    }
  }

  /** Either participant: end the active conversation. */
  async function endSession() {
    if (!session.value?.id) return;
    ending.value = true;
    error.value  = '';
    try {
      const res = await api.patch(`/api/client-talk/sessions/${session.value.id}/end`);
      session.value = res.data;
    } catch (err) {
      error.value = err.message || 'Failed to end conversation';
    } finally {
      ending.value = false;
    }
  }

  /** Load session by id directly (for admin request modal). */
  async function loadSessionById(sessionId) {
    loading.value = true;
    error.value   = '';
    try {
      // Admin doesn't have the user-order route; use the messages route to ping existence.
      // But we actually need a different approach for admin claim flow.
      // We'll store the session from the notification data and load messages when accepted.
      const res = await api.get(`/api/client-talk/sessions/${sessionId}/messages?perPage=100`);
      messages.value = res.data || [];
    } catch (err) {
      error.value = err.message || 'Failed to load messages';
    } finally {
      loading.value = false;
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  onBeforeUnmount(() => {
    unsubscribeFromSession();
  });

  return {
    // State
    session,
    messages,
    status,
    loading,
    sending,
    accepting,
    ending,
    error,
    // Actions
    fetchSession,
    requestTalk,
    openStaffTalk,
    fetchMessages,
    sendMessage,
    acceptSession,
    endSession,
    loadSessionById,
    subscribeToSession,
    unsubscribeFromSession,
  };
}
