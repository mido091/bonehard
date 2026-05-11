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
const statusMenuId = ref(null);
const statusUpdatingId = ref(null);

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

function toggleStatusMenu(id) {
  statusMenuId.value = statusMenuId.value === id ? null : id;
}

async function changeOrderStatus(order, status) {
  if (Number(order.statusId) === Number(status.id) || statusUpdatingId.value) {
    statusMenuId.value = null;
    return;
  }
  statusUpdatingId.value = order.id;
  error.value = '';
  try {
    const response = await api.patch(`/api/admin/user-orders/${order.id}/status`, { statusId: status.id });
    const updated = response.data;
    orders.value = orders.value.map((item) => item.id === order.id ? { ...item, ...updated } : item);
    statusMenuId.value = null;
  } catch (err) {
    error.value = err.message || 'Failed to update order status.';
  } finally {
    statusUpdatingId.value = null;
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
                  <div class="inline-status-control">
                    <button class="case-status case-status--button" type="button" :style="{ '--status-color': order.statusColor }" @click="toggleStatusMenu(order.id)">
                      {{ statusUpdatingId === order.id ? 'Saving...' : order.statusName || 'Order Received' }}
                    </button>
                    <div v-if="statusMenuId === order.id" class="inline-status-menu">
                      <button
                        v-for="status in statuses"
                        :key="status.id"
                        class="inline-status-menu__item"
                        :class="{ 'inline-status-menu__item--active': Number(status.id) === Number(order.statusId) }"
                        type="button"
                        @click="changeOrderStatus(order, status)"
                      >
                        <span class="inline-status-menu__dot" :style="{ '--status-color': status.color || '#60a5fa' }"></span>
                        <span>{{ status.name }}</span>
                      </button>
                    </div>
                  </div>
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

.inline-status-control {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.inline-status-control:has(.inline-status-menu) {
  z-index: 700;
}

:deep(.case-status--button) {
  cursor: pointer;
  border-color: color-mix(in srgb, var(--status-color, #60a5fa) 48%, transparent);
}

.inline-status-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 1800;
  width: min(22rem, calc(100vw - 2rem));
  max-height: min(19rem, 52vh);
  overflow: auto;
  padding: 0.5rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.85rem;
  background: #070707;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.inline-status-menu__item {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
  border: 0;
  border-radius: 0.62rem;
  background: transparent;
  color: var(--color-text-strong);
  cursor: pointer;
  padding: 0.68rem 0.75rem;
  text-align: left;
  font: inherit;
  font-weight: 850;
}

.inline-status-menu__item:hover,
.inline-status-menu__item--active {
  background: rgba(var(--rgb-foreground), 0.08);
}

.inline-status-menu__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: var(--status-color, #60a5fa);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--status-color, #60a5fa) 18%, transparent);
}

.admin-table-wrap:has(.inline-status-menu) {
  overflow: visible;
}

.admin-table tbody tr:has(.inline-status-menu) {
  position: relative;
  z-index: 220;
}

:global(body.light-mode) .inline-status-menu,
:global(.light-mode) .inline-status-menu,
:global([data-theme="light"]) .inline-status-menu {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18);
}

:global(body.light-mode) .inline-status-menu__item,
:global(.light-mode) .inline-status-menu__item,
:global([data-theme="light"]) .inline-status-menu__item {
  color: #172033;
}

:global(body.light-mode) .inline-status-menu__item:hover,
:global(body.light-mode) .inline-status-menu__item--active,
:global(.light-mode) .inline-status-menu__item:hover,
:global(.light-mode) .inline-status-menu__item--active,
:global([data-theme="light"]) .inline-status-menu__item:hover,
:global([data-theme="light"]) .inline-status-menu__item--active {
  background: #f1f5f9;
  color: #0f172a;
}

@media (max-width: 640px) {
  .order-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
