<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../services/api';

const filters = reactive({
  search: '',
  page: 1,
  perPage: 20,
  sortBy: 'createdAt',
  sortDir: 'desc',
});

const orders = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(false);
const error = ref('');

const totalPages = computed(() => Math.max(Math.ceil((meta.value.total || 0) / (meta.value.perPage || 20)), 1));

function queryString() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

async function loadOrders() {
  loading.value = true;
  error.value = '';

  try {
    const response = await api.get(`/api/user/orders?${queryString()}`);
    orders.value = response.data || [];
    meta.value = response.meta || meta.value;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  filters.page = 1;
  loadOrders();
}

function changePage(nextPage) {
  filters.page = Math.min(Math.max(nextPage, 1), totalPages.value);
  loadOrders();
}

onMounted(loadOrders);
</script>

<template>
  <section class="admin-page-stack user-orders-page">
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Order Requests</p>
          <h2>Orders</h2>
        </div>

        <div class="admin-toolbar">
          <div class="admin-toolbar__summary">
            <span>{{ meta.total }} orders</span>
          </div>
          <RouterLink class="admin-primary-button" to="/dashboard/orders/new">+ Add Order</RouterLink>
        </div>
      </div>

      <form class="user-orders-filter" @submit.prevent="applySearch">
        <label class="admin-field">
          <span>Search Orders</span>
          <input v-model="filters.search" type="search" placeholder="Order name..." />
        </label>
        <button class="admin-link-button" type="submit">Search</button>
      </form>

      <p v-if="loading" class="admin-loading">Loading orders...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Submitted Date</th>
              <th>Target Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td data-label="Order">
                <RouterLink :to="`/dashboard/orders/${order.id}`">{{ order.name }}</RouterLink>
              </td>
              <td data-label="Phone">{{ order.contactPhone || '-' }}</td>
              <td data-label="Email">{{ order.contactEmail || '-' }}</td>
              <td data-label="Submitted Date">{{ formatDate(order.startDate || order.createdAt) }}</td>
              <td data-label="Target Time">{{ order.targetTime || '-' }}</td>
            </tr>
            <tr v-if="!orders.length">
              <td colspan="5" class="admin-empty">No orders submitted yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination">
        <button class="admin-link-button" type="button" :disabled="filters.page <= 1" @click="changePage(filters.page - 1)">Previous</button>
        <span>Page {{ meta.page }} of {{ totalPages }} - {{ meta.total }} total</span>
        <button class="admin-link-button" type="button" :disabled="filters.page >= totalPages" @click="changePage(filters.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.user-orders-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1.25rem;
}

@media (max-width: 720px) {
  .user-orders-filter {
    grid-template-columns: 1fr;
  }
}
</style>
