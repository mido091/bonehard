import { ref, unref } from 'vue';
import { api } from '../services/api';
import { authState } from '../stores/authStore';

export function useClientTalkHistory({ recordId, historyPath, transcriptPath, canDelete = false }) {
  const historyOpen = ref(false);
  const historyLoading = ref(false);
  const historyError = ref('');
  const sessions = ref([]);
  const transcriptOpen = ref(false);
  const transcriptLoading = ref(false);
  const transcript = ref(null);
  const deletingSessionId = ref(null);

  async function loadHistory() {
    if (!recordId.value) return;
    historyLoading.value = true;
    historyError.value = '';
    try {
      const response = await api.get(historyPath(recordId.value));
      sessions.value = response.data || [];
    } catch (err) {
      historyError.value = err.message || 'Failed to load conversations.';
    } finally {
      historyLoading.value = false;
    }
  }

  async function openHistory() {
    historyOpen.value = true;
    await loadHistory();
  }

  function closeHistory() {
    historyOpen.value = false;
  }

  async function loadTranscript(session) {
    if (!session?.id || !recordId.value) return null;
    transcriptLoading.value = true;
    try {
      const response = await api.get(transcriptPath(recordId.value, session.id));
      transcript.value = response.data;
      transcriptOpen.value = true;
      return response.data;
    } finally {
      transcriptLoading.value = false;
    }
  }

  function closeTranscript() {
    transcriptOpen.value = false;
    transcript.value = null;
  }

  async function deleteTranscript(session) {
    if (!unref(canDelete) || authState.user?.role !== 'admin' || session?.status !== 'ended') return;
    deletingSessionId.value = session.id;
    try {
      await api.delete(`/api/admin/client-talk/archive/${session.id}`);
      sessions.value = sessions.value.filter((item) => Number(item.id) !== Number(session.id));
      if (Number(transcript.value?.id) === Number(session.id)) closeTranscript();
    } finally {
      deletingSessionId.value = null;
    }
  }

  return {
    historyOpen,
    historyLoading,
    historyError,
    sessions,
    transcriptOpen,
    transcriptLoading,
    transcript,
    deletingSessionId,
    loadHistory,
    openHistory,
    closeHistory,
    loadTranscript,
    closeTranscript,
    deleteTranscript,
  };
}
