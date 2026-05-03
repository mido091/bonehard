<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import CasesTopNav from '../../components/admin/CasesTopNav.vue';
import RichTextEditor from '../../components/admin/RichTextEditor.vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { api } from '../../services/api';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const { showConfirm, showAlert } = useConfirmDialog();
const router = useRouter();

const orders = ref([]);
const users = ref([]);
const meta = ref({ total: 0, page: 1, perPage: 20 });
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const filtersOpen = ref(false);
const openMenuId = ref(null);
const editingOrder = ref(null);

const filters = reactive({
  search: '',
  targetId: '',
  price: '',
  status: '',
  customUid: '',
  createdFrom: '',
  createdTo: '',
  page: 1,
  perPage: 20,
});

const blankForm = () => ({
  patientName: '',
  targetId: '',
  price: '',
  status: 'open',
  customUid: '',
  integrationUid: '',
  orderNotes: '',
  surgeryDate: '',
  dob: '',
  jawSelection: '',
  guideSupportType: '',
  impressionType: '',
  implantType: '',
  numberOfImplants: '',
    currency: 'EGP',
});

const form = reactive(blankForm());

const totalPages = computed(() => Math.max(Math.ceil(meta.value.total / meta.value.perPage), 1));

function resetForm() {
  Object.assign(form, blankForm());
  editingOrder.value = null;
}

function queryString() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

async function loadOrders() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get(`/api/cases/orders?${queryString()}`);
    orders.value = response.data;
    meta.value = response.meta || meta.value;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  const response = await api.get('/api/admin/users/options');
  users.value = response.data || [];
}

function applyFilters() {
  filters.page = 1;
  loadOrders();
}

function changePage(page) {
  filters.page = Math.min(Math.max(page, 1), totalPages.value);
  loadOrders();
}

function payload() {
  return {
    ...form,
    targetId: form.targetId ? Number(form.targetId) : null,
    price: form.price === '' ? null : Number(form.price),
    amount: form.price === '' ? null : Number(form.price),
    numberOfImplants: form.numberOfImplants === '' ? null : Number(form.numberOfImplants),
  };
}

async function saveOrder() {
  saving.value = true;
  error.value = '';
  try {
    if (editingOrder.value) {
      await api.patch(`/api/cases/orders/${editingOrder.value.id}`, payload());
    } else {
      await api.post('/api/cases/orders', payload());
    }
    resetForm();
    await loadOrders();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function editOrder(order) {
  editingOrder.value = order;
  Object.assign(form, {
    patientName: order.patientName || order.title || '',
    targetId: order.targetId || '',
    price: order.price ?? order.amount ?? '',
    status: ['open', 'converted', 'closed'].includes(order.status) ? order.status : 'open',
    customUid: order.customUid || '',
    integrationUid: order.integrationUid || '',
    orderNotes: order.orderNotes || '',
    surgeryDate: order.surgeryDate?.slice(0, 10) || '',
    dob: order.dob?.slice(0, 10) || '',
    jawSelection: order.jawSelection || '',
    guideSupportType: order.guideSupportType || '',
    impressionType: order.impressionType || '',
    implantType: order.implantType || '',
    numberOfImplants: order.numberOfImplants ?? '',
    currency: 'EGP',
  });
  openMenuId.value = null;
}

async function archiveOrder(order) {
  const confirmed = await showConfirm(`Archive order for ${order.patientName || order.title}?`);
  if (!confirmed) return;
  await api.delete(`/api/cases/orders/${order.id}`);
  await loadOrders();
}

async function convertToCase(order) {
  if (order.status === 'converted') {
    await showAlert('This order is already converted.');
    return;
  }
  const caseName = prompt(`Convert Order to Case\n\nEnter a name for the new case:`, order.patientName || order.title || `Case from Order #${order.id}`);
  if (!caseName) return;
  
  loading.value = true;
  error.value = '';
  try {
    const res = await api.post(`/api/cases/orders/${order.id}/convert`, { caseName });
    await showAlert(`Successfully converted! Case #${res.data.id} created.`);
    openMenuId.value = null;
    await loadOrders();
    // Optionally redirect to the new case
    const confirmed = await showConfirm('Do you want to open the new case now?');
    if (confirmed) {
      router.push(`/admin/cases/${res.data.id}`);
    }
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
}

async function copyIntegrationUid(order) {
  if (!order.integrationUid) return;
  await navigator.clipboard.writeText(order.integrationUid);
  openMenuId.value = null;
}

function closeMenus() {
  openMenuId.value = null;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-US') : '-';
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadOrders()]);
  document.addEventListener('click', closeMenus);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenus);
});
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
      <CasesTopNav />

      <div class="admin-panel-header">
        <div>
          <p class="admin-kicker">Work Requests</p>
          <h2>Orders</h2>
        </div>
        <div class="admin-toolbar">
          <span class="admin-muted">{{ meta.total }} orders</span>
          <AdminSelect 
            v-model="filters.perPage" 
            :options="[{value: 20, label: '20 / page'}, {value: 50, label: '50 / page'}, {value: 100, label: '100 / page'}]" 
            class="admin-compact-select admin-compact-select--fit" 
            style="width: 140px;"
            @change="applyFilters"
          />
          <button class="admin-link-button" type="button" @click="filtersOpen = !filtersOpen">Filter</button>
        </div>
      </div>

      <form v-if="filtersOpen" class="admin-filter-grid" @submit.prevent="applyFilters">
        <label class="admin-field">
          <span>Subject</span>
          <input v-model="filters.search" type="search" placeholder="Patient, UID, target..." />
        </label>
        <label class="admin-field">
          <span>Target</span>
          <AdminSelect v-model="filters.targetId" :options="users" placeholder="All" />
        </label>
        <label class="admin-field">
          <span>Price</span>
          <input v-model="filters.price" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-field">
          <span>Status</span>
          <AdminSelect v-model="filters.status" :options="[{value: 'open', label: 'Open'}, {value: 'converted', label: 'Converted'}, {value: 'closed', label: 'Closed'}]" placeholder="All" />
        </label>
        <label class="admin-field">
          <span>Created From</span>
          <input v-model="filters.createdFrom" type="date" />
        </label>
        <label class="admin-field">
          <span>Created To</span>
          <input v-model="filters.createdTo" type="date" />
        </label>
        <label class="admin-field">
          <span>Custom UID</span>
          <input v-model="filters.customUid" maxlength="80" />
        </label>
        <button class="admin-primary-button admin-field-action" type="submit">Apply Filters</button>
      </form>

      <form class="admin-form admin-form-section" @submit.prevent="saveOrder">
        <label class="admin-field">
          <span>Patient Name *</span>
          <input v-model="form.patientName" required maxlength="190" placeholder="e.g. John Doe" />
        </label>
        <label class="admin-field">
          <span>CRM Target</span>
          <AdminSelect v-model="form.targetId" :options="users" placeholder="No target" />
        </label>
        <label class="admin-field">
          <span>Price</span>
          <input v-model="form.price" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-field">
          <span>Status</span>
          <AdminSelect v-model="form.status" :options="[{value: 'open', label: 'Open'}, {value: 'converted', label: 'Converted'}, {value: 'closed', label: 'Closed'}]" />
        </label>
        <label class="admin-field">
          <span>Surgery Date</span>
          <input v-model="form.surgeryDate" type="date" />
        </label>
        <label class="admin-field">
          <span>DOB</span>
          <input v-model="form.dob" type="date" />
        </label>
        <label class="admin-field">
          <span>Jaw Selection</span>
          <AdminSelect v-model="form.jawSelection" :options="[{value: 'maxilla', label: 'Maxilla'}, {value: 'mandible', label: 'Mandible'}, {value: 'both', label: 'Both'}]" />
        </label>
        <label class="admin-field">
          <span>Guide Support Type</span>
          <AdminSelect v-model="form.guideSupportType" :options="[{value: 'tooth', label: 'Tooth'}, {value: 'tissue', label: 'Tissue'}, {value: 'bone', label: 'Bone'}]" />
        </label>
        <label class="admin-field">
          <span>Impression Type</span>
          <input v-model="form.impressionType" maxlength="120" placeholder="Physical, STL..." />
        </label>
        <label class="admin-field">
          <span>Implant Type</span>
          <input v-model="form.implantType" maxlength="120" placeholder="Nobel, MegaGen, Straumann..." />
        </label>
        <label class="admin-field">
          <span>Number of implants</span>
          <input v-model="form.numberOfImplants" type="number" min="0" max="64" />
        </label>
        <label class="admin-field">
          <span>Custom UID</span>
          <input v-model="form.customUid" maxlength="80" />
        </label>
        <label class="admin-field">
          <span>Integration UID</span>
          <input v-model="form.integrationUid" maxlength="120" />
        </label>
        <label class="admin-field admin-field--wide">
          <span>Order Notes</span>
          <RichTextEditor v-model="form.orderNotes" />
        </label>
        <div class="admin-actions admin-field-action">
          <button class="admin-primary-button" type="submit" :disabled="saving">
            {{ saving ? 'Saving...' : editingOrder ? 'Save Order' : '+ Add Order' }}
          </button>
          <button v-if="editingOrder" class="admin-link-button" type="button" @click="resetForm">Cancel Edit</button>
        </div>
      </form>

      <p v-if="loading" class="admin-loading">Loading orders...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="admin-table-wrap">
        <table class="admin-table responsive-table">
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Target</th>
              <th>Price</th>
              <th>Status</th>
              <th>Created</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td data-label="Patient Name">
                <strong>{{ order.patientName || order.title }}</strong>
                <span v-if="order.customUid" class="admin-muted admin-muted--small">#{{ order.customUid }}</span>
              </td>
              <td data-label="Target">{{ order.targetName || '-' }}</td>
                <td data-label="Price">{{ order.price || order.amount ? `EGP ${order.price || order.amount}` : '-' }}</td>
              <td data-label="Status"><span class="task-status task-status--sm">{{ order.status }}</span></td>
              <td data-label="Created">{{ formatDate(order.createdAt) }}</td>
              <td data-label="Options" class="admin-options-cell">
                <button class="admin-options-btn" type="button" title="Options" @click.stop="openMenuId = openMenuId === order.id ? null : order.id">...</button>
                <div v-if="openMenuId === order.id" class="admin-options-dropdown">
                  <button class="admin-options-dropdown__item" type="button" @click="editOrder(order)">View / Edit</button>
                  <button class="admin-options-dropdown__item" type="button" v-if="order.status !== 'converted'" @click="convertToCase(order)">Convert to Case</button>
                  <button class="admin-options-dropdown__item" type="button">Attached Files</button>
                  <button class="admin-options-dropdown__item" type="button" :disabled="!order.integrationUid" @click="copyIntegrationUid(order)">Copy Integration UID</button>
                  <button class="admin-options-dropdown__item" type="button" @click="archiveOrder(order)">Archive</button>
                  <button class="admin-options-dropdown__item admin-options-dropdown__item--danger" type="button" @click="archiveOrder(order)">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="!orders.length">
              <td colspan="6" class="admin-muted admin-table-empty">No orders found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination">
        <button class="admin-link-button" type="button" :disabled="filters.page <= 1" @click="changePage(filters.page - 1)">Previous</button>
        <span>Page {{ meta.page }} of {{ totalPages }} · {{ meta.total }} total</span>
        <button class="admin-link-button" type="button" :disabled="filters.page >= totalPages" @click="changePage(filters.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-options-cell { position: relative; }
.admin-options-btn {
  min-width: 34px;
  min-height: 34px;
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  background: var(--surface, #171717);
  color: var(--text, #e5e5e5);
  cursor: pointer;
}
.admin-options-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 200;
  min-width: 190px;
  overflow: hidden;
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  background: var(--surface, #1e1e2e);
  box-shadow: 0 14px 32px rgba(var(--rgb-background), 0.36);
}
.admin-options-dropdown__item {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text, #e5e5e5);
  cursor: pointer;
  padding: 0.65rem 0.9rem;
  text-align: left;
}
.admin-options-dropdown__item:hover { background: var(--surface-hover, rgba(var(--rgb-foreground),0.07)); }
.admin-options-dropdown__item--danger { color: var(--danger, #f87171); }
</style>
