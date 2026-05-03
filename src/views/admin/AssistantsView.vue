<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../../services/api';
import PhoneInput from '../../components/PhoneInput.vue';
import PasswordInput from '../../components/PasswordInput.vue';

const assistants = ref([]);
const loading = ref(true);
const error = ref('');
const form = ref({ name: '', email: '', password: '', phone: '', address: '' });


async function loadAssistants() {
  loading.value = true;
  try {
    const response = await api.get('/api/admin/assistants?page=1&perPage=50');
    assistants.value = response.data;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createAssistant() {
  await api.post('/api/admin/assistants', form.value);
  form.value = { name: '', email: '', password: '', phone: '', address: '' };
  await loadAssistants();
}


onMounted(loadAssistants);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">


    <form class="admin-form admin-form-section" @submit.prevent="createAssistant">
      <label class="admin-field">
        <span>Name</span>
        <input v-model="form.name" required maxlength="160" />
      </label>
      <label class="admin-field">
        <span>Email</span>
        <input v-model="form.email" required type="email" maxlength="190" />
      </label>
      <label class="admin-field">
        <span>Password</span>
        <PasswordInput v-model="form.password" required minlength="8" autocomplete="new-password" />
      </label>
      <div class="admin-field">
        <span>Phone</span>
        <PhoneInput v-model="form.phone" placeholder="50 123 4567" />
      </div>
      <label class="admin-field">
        <span>Address <small class="admin-muted">(optional)</small></span>
        <input v-model="form.address" maxlength="255" placeholder="City, Country" />
      </label>

      <button class="admin-primary-button" type="submit">Create Assistant</button>
    </form>

    <p v-if="loading" class="admin-loading">Loading assistants...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <div v-else class="admin-table-wrap">
      <table class="admin-table responsive-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="assistant in assistants" :key="assistant.id">
            <td data-label="Name"><strong>{{ assistant.name }}</strong></td>
            <td data-label="Email">{{ assistant.email }}</td>
            <td data-label="Phone">{{ assistant.phone || '—' }}</td>
            <td data-label="Created At">{{ new Date(assistant.createdAt).toLocaleDateString('en-US') }}</td>
          </tr>
          <tr v-if="!assistants.length">
            <td colspan="4" class="admin-muted admin-table-empty">
              No assistants yet. Use the form above to create the first one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </section>
</template>
