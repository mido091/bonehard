<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { api } from '../../services/api';
import { statusProgressPercent } from '../../constants/workflowOptions';

const { showConfirm } = useConfirmDialog();

const orders = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(false);
const error = ref('');
const actionLoading = ref('');
const statuses = ref([]);
const filters = ref({ statusIds: [] });

const totalPages = computed(() => Math.max(Math.ceil((meta.value.total || 0) / (meta.value.perPage || 20)), 1));

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

async function loadOrders(page = meta.value.page || 1) {
  loading.value = true;
  error.value = '';

  try {
    const params = new URLSearchParams({
      page,
      perPage: meta.value.perPage || 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
    if (filters.value.statusIds.length) params.set('statusIds', filters.value.statusIds.join(','));
    const response = await api.get(`/api/admin/user-orders?${params.toString()}`);
    orders.value = response.data || [];
    meta.value = response.meta || meta.value;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function progressForOrder(order) {
  return statusProgressPercent(order.statusName, order.progressPercentage);
}

async function applyFilters() {
  await loadOrders(1);
}

async function changePage(page) {
  await loadOrders(Math.min(Math.max(page, 1), totalPages.value));
}

async function deleteOrder(order) {
  const confirmed = await showConfirm(`Delete order "${order.name}"? It will be removed from active orders.`);
  if (!confirmed) return;

  actionLoading.value = `delete-${order.id}`;
  try {
    await api.delete(`/api/admin/user-orders/${order.id}`);
    await loadOrders();
  } catch (err) {
    error.value = err.message;
  } finally {
    actionLoading.value = '';
  }
}

onMounted(async () => {
  const statusResponse = await api.get('/api/case-statuses');
  statuses.value = statusResponse.data || [];
  await loadOrders(1);
});
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">User Orders</p>
          <h2>Orders</h2>
        </div>
        <div class="admin-toolbar">
          <div class="admin-toolbar__summary">
            <span>{{ meta.total }} orders</span>
          </div>
          <AdminSelect
            v-model="filters.statusIds"
            :options="statuses"
            multiple
            placeholder="All Statuses"
            style="width: min(100%, 260px);"
            @change="applyFilters"
          />
        </div>
      </div>

      <p v-if="loading" class="admin-loading">Loading orders...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table dashboard-orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>User</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="order in orders" :key="order.id">
              <tr>
                <td data-label="Order">
                  <strong>{{ order.name }}</strong>
                  <div class="admin-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">Target Date: {{ order.targetTime ? new Date(order.targetTime).toLocaleDateString() : '-' }}</div>
                </td>
                <td data-label="User">
                  <strong>{{ order.createdByName || order.targetName || '-' }}</strong>
                  <div class="admin-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">{{ order.createdByEmail || '-' }}</div>
                </td>
                <td data-label="Contact">
                  <strong>{{ order.contactPhone || '-' }}</strong>
                  <div class="admin-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">{{ order.contactEmail || '-' }}</div>
                </td>
                <td data-label="Status">
                  <span class="case-status" :style="{ '--status-color': order.statusColor }">{{ order.statusName || 'Order Received' }}</span>
                </td>
                <td data-label="Progress">
                  <div class="case-progress"><span :style="{ width: `${progressForOrder(order)}%` }"></span></div>
                  <small class="case-progress__label">{{ progressForOrder(order) }}% by status</small>
                </td>
                <td data-label="Date">{{ formatDate(order.startDate || order.createdAt) }}</td>
                <td data-label="Actions">
                  <div class="order-actions">
                    <RouterLink class="admin-link-button" :to="`/admin/user-orders/${order.id}`">Details</RouterLink>
                    <button class="case-options__trigger" style="color: #ffb4b4;" type="button" aria-label="Delete order" :disabled="actionLoading === `delete-${order.id}`" @click="deleteOrder(order)">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!orders.length">
              <td colspan="7" class="admin-empty">No user orders yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination">
        <button class="admin-link-button" type="button" :disabled="meta.page <= 1" @click="changePage(meta.page - 1)">Previous</button>
        <span>Page {{ meta.page }} of {{ totalPages }} · {{ meta.total }} total</span>
        <button class="admin-link-button" type="button" :disabled="meta.page >= totalPages" @click="changePage(meta.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.glass-panel {
  background: rgba(var(--rgb-foreground), 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(var(--rgb-background), 0.2);
}

.order-actions,
.case-options {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: flex-end;
}

.case-options__trigger {
  width: 2.75rem;
  height: 2.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--admin-border, rgba(var(--rgb-foreground),0.12));
  border-radius: 0.65rem;
  background: rgba(var(--rgb-foreground), 0.04);
  color: var(--admin-text, #fff);
  cursor: pointer;
  transition: all 0.2s ease;
}

.case-options__trigger:hover {
  background: rgba(var(--rgb-foreground), 0.1);
  transform: translateY(-1px);
}

.case-options__trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 640px) {
  .order-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
