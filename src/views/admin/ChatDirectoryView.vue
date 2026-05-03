<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api';

const route = useRoute();
const rows = ref([]);
const loading = ref(true);
const error = ref('');

const config = computed(() => {
  if (route.name === 'admin-chat-assistants') {
    return { title: 'Chat Assistants', endpoint: '/api/admin/assistants?page=1&perPage=50', empty: 'No assistants yet.' };
  }
  if (route.name === 'admin-chat-groups') {
    return { title: 'Chat Groups', endpoint: '/api/chats/conversations?page=1&perPage=50', empty: 'No groups yet.' };
  }
  return { title: 'Chat Users', endpoint: '/api/admin/users?page=1&perPage=50', empty: 'No users yet.' };
});

async function loadRows() {
  loading.value = true;
  try {
    const response = await api.get(config.value.endpoint);
    rows.value = response.data;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadRows);
</script>

<template>
  <section class="admin-panel">
    <div class="admin-section-header">
      <div>
        <p class="admin-kicker">Live Chat</p>
        <h2>{{ config.title }}</h2>
      </div>
    </div>

    <p v-if="loading" class="admin-muted">Loading...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <div v-else class="admin-list-grid">
      <article v-for="row in rows" :key="row.id" class="admin-card compact-card">
        <h3>{{ row.name }}</h3>
        <p>{{ row.email || row.type || 'Conversation' }}</p>
      </article>
      <p v-if="!rows.length" class="admin-muted">{{ config.empty }}</p>
    </div>
  </section>
</template>
