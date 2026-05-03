<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import PhoneInput from '../../components/PhoneInput.vue';
import PasswordInput from '../../components/PasswordInput.vue';
import { useToast } from '../../composables/useToast';
import { api } from '../../services/api';
import { authState } from '../../stores/authStore';

const { showConfirm } = useConfirmDialog();
const { showToast } = useToast();

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'admin', label: 'Admin' },
];

const users = ref([]);
const meta = ref(null);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const search = ref('');
const modalOpen = ref(false);
const editingUser = ref(null);

// Initial state for the user form to ensure consistency when resetting
const initialFormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  role: 'user',
  isActive: true,
  chatEnabled: false,
};

const form = ref({ ...initialFormState });

const modalTitle = computed(() => (editingUser.value ? 'Edit User' : 'Create User'));

/**
 * Resets the form to its initial state and clears any error messages.
 * This ensures no data lingers between create/edit sessions.
 */
function resetForm() {
  form.value = { ...initialFormState };
  error.value = '';
}

function openCreateModal() {
  editingUser.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEditModal(user) {
  editingUser.value = user;
  // Populate form with existing user data
  form.value = {
    name: user.name || '',
    email: user.email || '',
    password: '', // Password always starts empty for edits
    phone: user.phone || '',
    address: user.address || '',
    role: user.role || 'user',
    isActive: user.isActive !== false && user.isActive !== 0,
    chatEnabled: user.chatEnabled === true || user.chatEnabled === 1,
  };
  modalOpen.value = true;
}

function closeModal() {
  if (saving.value) return;
  modalOpen.value = false;
  editingUser.value = null;
  resetForm();
}

async function loadUsers() {
  loading.value = true;
  try {
    const query = new URLSearchParams({ search: search.value, page: '1', perPage: '100' });
    const response = await api.get(`/api/admin/users?${query}`);
    users.value = response.data || [];
    meta.value = response.meta;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function buildPayload() {
  const payload = {
    name: form.value.name,
    email: form.value.email,
    phone: form.value.phone || null,
    address: form.value.address || null,
    role: form.value.role,
    isActive: form.value.isActive,
    chatEnabled: form.value.chatEnabled,
  };

  if (!editingUser.value || form.value.password) {
    payload.password = form.value.password;
  }

  return payload;
}

/**
 * Handles saving user data (both creation and updates).
 * It builds the payload, calls the appropriate API method, and provides
 * visual feedback to the user upon success or failure.
 */
async function saveUser() {
  saving.value = true;
  error.value = '';

  try {
    if (editingUser.value) {
      await api.patch(`/api/admin/users/${editingUser.value.id}`, buildPayload());
    } else {
      await api.post('/api/admin/users', buildPayload());
    }

    // Store editing state before closing modal as closeModal() resets editingUser
    const isEditing = !!editingUser.value;
    
    // Refresh list and notify user
    await loadUsers();
    showToast(isEditing ? 'User updated successfully' : 'User created successfully', 'success');
    
    saving.value = false;
    closeModal();
  } catch (err) {
    saving.value = false;
    error.value = err.message;
  }
}

async function deleteUser(user) {
  const confirmed = await showConfirm(`Delete ${user.name}? This account will be removed from the dashboard.`);
  if (!confirmed) return;

  try {
    await api.delete(`/api/admin/users/${user.id}`);
    await loadUsers();
    showToast('User deleted successfully', 'success');
  } catch (err) {
    error.value = err.message;
  }
}

async function updateRole(user, role) {
  try {
    await api.patch(`/api/admin/users/${user.id}`, { role });
    user.role = role;
    showToast('Role updated successfully', 'success');
  } catch (err) {
    error.value = err.message;
  }
}

async function toggleUserFlag(user, field, value) {
  if (field === 'isActive' && Number(user.id) === Number(authState.user?.id) && !value) {
    showToast('You cannot disable your own account', 'error');
    return;
  }

  const previous = user[field];
  user[field] = value;
  try {
    await api.patch(`/api/admin/users/${user.id}`, { [field]: value });
    showToast(field === 'chatEnabled' ? 'Chat access updated' : 'Account status updated', 'success');
  } catch (err) {
    user[field] = previous;
    error.value = err.message;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="admin-page-stack users-management-page">
    <div class="admin-panel users-management-panel">
      <header class="users-page-header">
        <div>
          <p class="admin-kicker">Account Management</p>
          <h2>Users</h2>
          <span class="admin-muted">{{ meta?.total || users.length }} total accounts</span>
        </div>
        <button class="admin-primary-button" type="button" @click="openCreateModal">Create User</button>
      </header>

      <form class="users-toolbar" @submit.prevent="loadUsers">
        <input v-model="search" class="admin-compact-input" type="search" placeholder="Search name or email" />
        <button class="admin-link-button" type="submit">Search</button>
      </form>

      <p v-if="loading" class="admin-loading">Loading users...</p>
      <p v-else-if="error && !modalOpen" class="admin-error">{{ error }}</p>

      <div v-else class="admin-table-wrap users-table-wrap">
        <table class="admin-table responsive-table users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Contact</th>
              <th>Latest Case</th>
              <th>Status</th>
              <th>Chat</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td data-label="Name">
                <RouterLink class="user-identity" :to="`/admin/users/${user.id}/reports`">
                  <span class="user-avatar">{{ user.name?.slice(0, 1) || 'U' }}</span>
                  <strong>{{ user.name }}</strong>
                </RouterLink>
              </td>
              <td data-label="Email">{{ user.email }}</td>
              <td data-label="Contact">
                <span>{{ user.phone || '-' }}</span>
                <small>{{ user.address || 'No address' }}</small>
              </td>
              <td data-label="Latest Case">
                <span v-if="user.latestCaseStatus" class="case-status case-status--neutral">
                  {{ user.latestCaseStatus }}
                </span>
                <span v-else class="admin-muted">-</span>
              </td>
              <td data-label="Status">
                <label class="users-inline-toggle">
                  <input
                    type="checkbox"
                    :checked="user.isActive !== false && user.isActive !== 0"
                    :disabled="Number(user.id) === Number(authState.user?.id)"
                    @change="toggleUserFlag(user, 'isActive', $event.target.checked)"
                  />
                  <span>{{ user.isActive ? 'Active' : 'Inactive' }}</span>
                </label>
              </td>
              <td data-label="Chat">
                <label class="users-inline-toggle">
                  <input
                    type="checkbox"
                    :checked="user.chatEnabled === true || user.chatEnabled === 1"
                    @change="toggleUserFlag(user, 'chatEnabled', $event.target.checked)"
                  />
                  <span>{{ user.chatEnabled ? 'Enabled' : 'Locked' }}</span>
                </label>
              </td>
              <td data-label="Role">
                <AdminSelect
                  class="users-role-select"
                  :modelValue="user.role"
                  :options="roleOptions"
                  teleport
                  required
                  @update:modelValue="updateRole(user, $event)"
                />
              </td>
              <td data-label="Actions">
                <div class="users-row-actions">
                  <button class="admin-link-button" type="button" @click="openEditModal(user)">Edit</button>
                  <button class="admin-danger-button" type="button" @click="deleteUser(user)">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="!users.length">
              <td colspan="8" class="admin-muted admin-table-empty">No accounts found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="modalOpen" class="users-modal-backdrop" @click.self="closeModal">
          <form class="users-modal" autocomplete="off" @submit.prevent="saveUser">
            <header class="users-modal__header">
              <div>
                <p class="admin-kicker">User Account</p>
                <h3>{{ modalTitle }}</h3>
              </div>
              <button class="users-modal__close" type="button" aria-label="Close user form" @click="closeModal">×</button>
            </header>

            <p v-if="error" class="admin-error">{{ error }}</p>

            <div class="users-form-grid">
              <label class="admin-field">
                <span>Name</span>
                <input v-model="form.name" required maxlength="160" autocomplete="off" />
              </label>
              <label class="admin-field">
                <span>Email</span>
                <input v-model="form.email" required type="email" maxlength="190" autocomplete="off" />
              </label>
              <label class="admin-field">
                <span>Password</span>
                <PasswordInput
                  v-model="form.password"
                  :required="!editingUser"
                  minlength="8"
                  autocomplete="new-password"
                  :placeholder="editingUser ? 'Leave empty to keep current password' : ''"
                />
              </label>
              <label class="admin-field">
                <span>Role</span>
                <AdminSelect v-model="form.role" :options="roleOptions" />
              </label>
              <div class="admin-field">
                <span>Phone</span>
                <PhoneInput v-model="form.phone" placeholder="50 123 4567" />
              </div>
              <label class="admin-field">
                <span>Address</span>
                <input v-model="form.address" maxlength="255" placeholder="City, Country" />
              </label>
              <label class="users-toggle-field">
                <input v-model="form.isActive" type="checkbox" />
                <span>Active account</span>
              </label>
              <label class="users-toggle-field">
                <input v-model="form.chatEnabled" type="checkbox" />
                <span>Chat access enabled</span>
              </label>
            </div>

            <footer class="users-modal__footer">
              <button class="admin-link-button" type="button" :disabled="saving" @click="closeModal">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="saving">
                {{ saving ? 'Saving...' : 'Save User' }}
              </button>
            </footer>
          </form>
        </div>
      </transition>
    </Teleport>
  </section>
</template>

<style scoped>
.users-inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  color: var(--color-text-strong);
  cursor: pointer;
}

.users-inline-toggle input,
.users-toggle-field input {
  width: 1rem;
  height: 1rem;
  accent-color: #f8d9aa;
}

.users-inline-toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
