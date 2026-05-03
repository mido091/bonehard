<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../../services/api';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm } = useConfirmDialog();

const orders = ref([]);
const loading = ref(true);
const error = ref('');
const updating = ref(null);
const filterStatus = ref('');

const statusLabels = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  completed: 'Completed',
};

const statusColors = {
  new: '#3b82f6',
  in_review: '#f59e0b',
  contacted: '#8b5cf6',
  completed: '#10b981',
};

async function fetchOrders() {
  loading.value = true;
  try {
    const params = filterStatus.value ? `?status=${filterStatus.value}` : '';
    const response = await api.get(`/api/orders${params}`);
    orders.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function updateStatus(order, newStatus) {
  updating.value = order.id;
  try {
    await api.patch(`/api/orders/${order.id}`, { status: newStatus, notes: order.notes });
    order.status = newStatus;
  } finally {
    updating.value = null;
  }
}

async function deleteOrder(id) {
  const confirmed = await showConfirm('Delete this order?');
  if (!confirmed) return;
  await api.delete(`/api/orders/${id}`);
  orders.value = orders.value.filter(o => o.id !== id);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

onMounted(fetchOrders);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
    <div class="admin-toolbar admin-toolbar--end">
      <AdminSelect 
        v-model="filterStatus" 
        :options="[{value: 'new', label: 'New'}, {value: 'in_review', label: 'In Review'}, {value: 'contacted', label: 'Contacted'}, {value: 'completed', label: 'Completed'}]" 
        class="admin-compact-select admin-compact-select--wide" 
        placeholder="All Statuses"
        @change="fetchOrders"
      />
    </div>

    <p v-if="loading" class="admin-loading">Loading orders...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>
    <p v-else-if="orders.length === 0" class="admin-muted">No orders found.</p>

    <div v-else class="orders-table-wrapper">
      <table class="orders-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Scope of Work</th>
            <th>File Link</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td class="orders-table__id">{{ order.id }}</td>
            <td>
              <span class="orders-table__name">{{ order.contact_name }}</span>
              <span class="orders-table__email">{{ order.contact_email }}</span>
            </td>
            <td>{{ order.contact_number }}</td>
            <td>{{ order.scope_of_work }}</td>
            <td>
              <a v-if="order.file_link" :href="order.file_link" target="_blank" rel="noopener" class="orders-table__link">Open File</a>
              <span v-else class="admin-muted">—</span>
            </td>
            <td>
              <AdminSelect
                :modelValue="order.status"
                @update:modelValue="updateStatus(order, $event)"
                class="orders-status-select"
                :style="{ borderColor: statusColors[order.status] }"
                :disabled="updating === order.id"
                :options="Object.entries(statusLabels).map(([value, label]) => ({value, label}))"
              />
            </td>
            <td class="orders-table__date">{{ formatDate(order.created_at) }}</td>
            <td>
              <button class="orders-delete-btn" @click="deleteOrder(order.id)" title="Delete order">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </section>
</template>
