<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm } = useConfirmDialog();

const route = useRoute();
const phases = ref([]);
const loading = ref(true);
const error = ref('');
const form = ref({ name: '', sortOrder: 0 });
const editingId = ref(null);
const editName = ref('');

async function loadPhases() {
  loading.value = true;
  try {
    const res = await api.get(`/api/cases/${route.params.id}/phases`);
    phases.value = res.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function addPhase() {
  if (!form.value.name.trim()) return;
  form.value.sortOrder = phases.value.length;
  const res = await api.post(`/api/cases/${route.params.id}/phases`, form.value);
  phases.value.push(res.data);
  form.value = { name: '', sortOrder: 0 };
}

function startEdit(phase) {
  editingId.value = phase.id;
  editName.value = phase.name;
}

async function saveEdit(phase) {
  await api.patch(`/api/cases/${route.params.id}/phases/${phase.id}`, { name: editName.value });
  phase.name = editName.value;
  editingId.value = null;
}

async function deletePhase(id) {
  const confirmed = await showConfirm('Delete this phase?');
  if (!confirmed) return;
  await api.delete(`/api/cases/${route.params.id}/phases/${id}`);
  phases.value = phases.value.filter(p => p.id !== id);
}

onMounted(loadPhases);
</script>

<template>
  <section class="admin-panel">
    <div class="admin-section-header">
      <div>
        <p class="admin-kicker">Case Workspace</p>
        <h2>Phases</h2>
      </div>
    </div>

    <form class="admin-form admin-form-section" @submit.prevent="addPhase">
      <label class="admin-field">
        <span>Phase Name</span>
        <input v-model="form.name" required maxlength="190" placeholder="e.g. Planning, Design, Review..." />
      </label>
      <button class="admin-primary-button" type="submit">+ Add Phase</button>
    </form>

    <p v-if="loading" class="admin-muted">Loading phases...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <div v-else class="phases-list">
      <p v-if="!phases.length" class="admin-muted">No phases yet. Add the first phase above.</p>

      <div v-for="(phase, index) in phases" :key="phase.id" class="phase-item">
        <div class="phase-item__index">{{ index + 1 }}</div>
        <div class="phase-item__body">
          <template v-if="editingId === phase.id">
            <input
              v-model="editName"
              class="phase-item__edit-input"
              @keyup.enter="saveEdit(phase)"
              @keyup.esc="editingId = null"
              autofocus
            />
            <button class="admin-primary-button" type="button" @click="saveEdit(phase)">Save</button>
            <button class="admin-link-button" type="button" @click="editingId = null">Cancel</button>
          </template>
          <template v-else>
            <span class="phase-item__name">{{ phase.name }}</span>
            <button class="admin-link-button" type="button" @click="startEdit(phase)">Edit</button>
            <button class="admin-danger-button" type="button" @click="deletePhase(phase.id)">Delete</button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
