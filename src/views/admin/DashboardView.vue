<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import html2pdf from 'html2pdf.js';
import { api } from '../../services/api';
import { authState } from '../../stores/authStore';
import { useSiteSettings } from '../../composables/useSiteSettings';

const { hero } = useSiteSettings();
const dashboard = ref(null);
const loading = ref(true);
const error = ref('');
const exporting = ref(false);
const exportingCsv = ref(false);
const dashboardSurface = ref(null);

const summary = computed(() => dashboard.value?.summary || {});
const profit = computed(() => summary.value.profit || {});
const charts = computed(() => dashboard.value?.charts || {});
const lists = computed(() => dashboard.value?.lists || {});
const isAdmin = computed(() => authState.user?.role === 'admin');

const currentDateStr = computed(() => {
  const value = dashboard.value?.generatedAt ? new Date(dashboard.value.generatedAt) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
});

const fileDateStr = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
});

const maxTrendValue = computed(() => Math.max(
  1,
  ...(charts.value.casesTrend || []).map((item) => item.total || 0),
  ...(charts.value.ordersTrend || []).map((item) => item.total || 0),
));

const visibleCaseStatuses = computed(() => (charts.value.casesByStatus || []).filter((item) => Number(item.total || 0) > 0));
const maxStatusValue = computed(() => Math.max(1, ...visibleCaseStatuses.value.map((item) => item.total || 0)));
const maxLeaderWorkload = computed(() => Math.max(1, ...(charts.value.workload?.leaders || []).map((item) => item.activeCases || 0)));
const maxAssigneeWorkload = computed(() => Math.max(1, ...(charts.value.workload?.assignees || []).map((item) => item.openTasks || 0)));
const maxProfitPart = computed(() => Math.max(1, profit.value.cases || 0, profit.value.orders || 0, profit.value.chat || 0));

const kpis = computed(() => [
  {
    label: 'Accounts',
    value: summary.value.totalUsers || 0,
    sub: `${summary.value.activeUsers || 0} active accounts`,
    to: isAdmin.value ? '/admin/users' : '/admin',
    tone: 'violet',
    icon: 'users',
  },
  {
    label: 'Active Cases',
    value: summary.value.activeCases || 0,
    sub: `${summary.value.newCases14d || 0} new in 14 days`,
    to: '/admin/cases',
    tone: 'cream',
    icon: 'cases',
  },
  {
    label: 'User Orders',
    value: summary.value.totalOrders || 0,
    sub: `${summary.value.newOrders14d || 0} submitted in 14 days`,
    to: '/admin/user-orders',
    tone: 'blue',
    icon: 'orders',
  },
  {
    label: 'Profit',
    value: formatMoneyCompact(profit.value.total || 0),
    sub: `${formatMoneyCompact(profit.value.month || 0)} this month`,
    to: '/admin/payments',
    tone: 'gold',
    icon: 'profit',
  },
  {
    label: 'Open Tasks',
    value: summary.value.openTasks || 0,
    sub: `${summary.value.urgentTasks || 0} urgent`,
    to: '/admin/cases/tasks/all',
    tone: 'green',
    icon: 'tasks',
  },
  {
    label: 'Messages',
    value: summary.value.unreadMessages || 0,
    sub: `${summary.value.newMessages14d || 0} new in 14 days`,
    to: '/admin/messages',
    tone: 'violet',
    icon: 'messages',
  },
]);

const icons = {
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  cases: ['M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z'],
  orders: ['M6 3h9l3 3v15H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  profit: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6', 'M18 19H8'],
  tasks: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  messages: ['M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Z', 'M22 7l-10 6L2 7'],
};

const colorProperties = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'columnRuleColor',
  'fill',
  'stroke',
];

onMounted(loadDashboard);

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/api/admin/dashboard');
    dashboard.value = response.data;
  } catch (err) {
    error.value = err.message || 'Failed to load dashboard';
  } finally {
    loading.value = false;
  }
}

async function exportPDF() {
  const source = dashboardSurface.value;
  if (!source) return;

  const clone = source.cloneNode(true);
  const wrapper = document.createElement('div');
  const width = Math.ceil(source.scrollWidth);

  wrapper.className = 'ops-pdf-snapshot-wrap';
  clone.classList.add('ops-dashboard--pdf-snapshot');
  clone.querySelector('.ops-hero')?.remove();
  clone.style.width = `${width}px`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  sanitizePdfSnapshotColors(clone, window);

  try {
    exporting.value = true;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 180));

    const height = Math.ceil(clone.scrollHeight);

    await html2pdf().set({
      margin: 0,
      filename: `operations_dashboard_${fileDateStr.value}.pdf`,
      image: { type: 'png', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#050505',
        windowWidth: width,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          const clonedRoot = clonedDocument.querySelector('.ops-dashboard--pdf-snapshot');
          if (clonedRoot) {
            sanitizePdfSnapshotColors(clonedRoot, clonedDocument.defaultView || window);
          }
        },
      },
      jsPDF: {
        unit: 'px',
        format: [width, height],
        orientation: width > height ? 'landscape' : 'portrait',
      },
      pagebreak: { mode: [] },
    }).from(clone).save();
  } catch (err) {
    error.value = err.message || 'Failed to export dashboard PDF';
  } finally {
    wrapper.remove();
    exporting.value = false;
  }
}

async function exportCSV() {
  exportingCsv.value = true;
  error.value = '';

  try {
    const { blob, fileName } = await api.download('/api/admin/dashboard/export-csv', `operations_dashboard_${fileDateStr.value}.csv`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err.message || 'Failed to export dashboard CSV';
  } finally {
    exportingCsv.value = false;
  }
}

function hasUnsupportedColorFunction(value) {
  return typeof value === 'string' && /(^|[\s,(])color\(/i.test(value);
}

function fallbackColorFor(property, node) {
  if (property === 'backgroundColor') {
    return node.classList?.contains('ops-dashboard--pdf-snapshot') ? '#050505' : 'rgba(var(--rgb-background), 0)';
  }

  if (property.startsWith('border') || property === 'outlineColor' || property === 'columnRuleColor') {
    return 'rgba(var(--rgb-accent), 0.16)';
  }

  if (property === 'fill' || property === 'stroke') {
    return node.closest?.('.ops-kpi__icon') ? '#f8d9aa' : '#f8fafc';
  }

  return '#f8fafc';
}

function sanitizePdfSnapshotColors(root, view) {
  const nodes = [root, ...root.querySelectorAll('*')];

  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);

    colorProperties.forEach((property) => {
      const value = computed[property];
      if (hasUnsupportedColorFunction(value)) {
        node.style[property] = fallbackColorFor(property, node);
      }
    });

    if (hasUnsupportedColorFunction(computed.boxShadow)) {
      node.style.boxShadow = 'none';
    }

    if (hasUnsupportedColorFunction(computed.textShadow)) {
      node.style.textShadow = 'none';
    }

    if (hasUnsupportedColorFunction(computed.backgroundImage)) {
      node.style.backgroundImage = 'none';
      if (!node.style.backgroundColor) {
        node.style.backgroundColor = node.classList?.contains('ops-dashboard--pdf-snapshot') ? '#050505' : 'rgba(var(--rgb-foreground), 0.03)';
      }
    }
  });
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

function formatMoney(value) {
  return `EGP ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

function formatMoneyCompact(value) {
  const amount = Number(value || 0);
  if (amount < 1000) return formatMoney(amount);
  return `EGP ${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)}`;
}

function shortDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit' }).format(new Date(value));
}

function percent(value, max) {
  return `${Math.max(4, Math.round((Number(value || 0) / Math.max(Number(max || 1), 1)) * 100))}%`;
}

function statusPercent(value) {
  const total = visibleCaseStatuses.value.reduce((sum, row) => sum + Number(row.total || 0), 0);
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}
</script>

<template>
  <section ref="dashboardSurface" class="ops-dashboard">
    <div class="ops-hero">
      <div>
        <p class="admin-kicker">{{ hero.title }} Operations</p>
        <h2>Command Center</h2>
        <p class="ops-hero__copy">
          Live operational view for cases, user orders, team workload, messages, and overdue work.
        </p>
      </div>

      <div class="ops-hero__actions">
        <span class="ops-generated">Updated {{ currentDateStr }}</span>
        <RouterLink class="admin-primary-button" to="/admin/cases/new">+ Add Case</RouterLink>
        <RouterLink class="admin-link-button" to="/admin/cases">View Cases</RouterLink>
        <RouterLink class="admin-link-button" to="/admin/user-orders">View Orders</RouterLink>
        <RouterLink class="admin-link-button" to="/admin/messages">View Messages</RouterLink>
        <RouterLink v-if="isAdmin" class="admin-link-button" to="/admin/users">Manage Users</RouterLink>
        <button class="admin-link-button" type="button" :disabled="exporting || loading" @click="exportPDF">
          {{ exporting ? 'Preparing PDF...' : 'Export Dashboard PDF' }}
        </button>
        <button class="admin-link-button" type="button" :disabled="exportingCsv || loading" @click="exportCSV">
          {{ exportingCsv ? 'Preparing CSV...' : 'Export Dashboard CSV' }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="admin-loading">Loading real dashboard analytics...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <div v-else class="ops-grid">
      <RouterLink v-for="card in kpis" :key="card.label" class="ops-kpi" :class="`ops-kpi--${card.tone}`" :to="card.to">
        <span class="ops-kpi__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-for="path in icons[card.icon]" :key="path" :d="path" />
          </svg>
        </span>
        <span class="ops-kpi__body">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.sub }}</small>
        </span>
      </RouterLink>

      <section class="ops-panel ops-panel--wide">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">14-Day Flow</p>
            <h3>Cases vs User Orders</h3>
          </div>
          <span class="ops-chip">{{ summary.newCases14d || 0 }} cases / {{ summary.newOrders14d || 0 }} orders</span>
        </div>
        <div class="ops-trend">
          <div v-for="(day, index) in charts.casesTrend || []" :key="day.date" class="ops-trend__day">
            <div class="ops-trend__bars">
              <span class="ops-trend__bar ops-trend__bar--cases" :style="{ height: percent(day.total, maxTrendValue) }">
                <em>{{ day.total }}</em>
              </span>
              <span class="ops-trend__bar ops-trend__bar--orders" :style="{ height: percent((charts.ordersTrend || [])[index]?.total, maxTrendValue) }">
                <em>{{ (charts.ordersTrend || [])[index]?.total || 0 }}</em>
              </span>
            </div>
            <small>{{ shortDate(day.date) }}</small>
          </div>
        </div>
        <div class="ops-legend">
          <span><i class="legend-cases"></i>Cases</span>
          <span><i class="legend-orders"></i>User orders</span>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Profit Watch</p>
            <h3>Tracked profit</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/payments">Payments</RouterLink>
        </div>
        <div class="ops-profit">
          <div class="ops-profit__total">
            <span>Total tracked</span>
            <strong>{{ formatMoney(profit.total) }}</strong>
            <small>{{ formatMoney(profit.month) }} this month</small>
          </div>
          <article class="ops-profit__row">
            <span>Cases</span>
            <div><i :style="{ width: percent(profit.cases, maxProfitPart) }"></i></div>
            <strong>{{ formatMoneyCompact(profit.cases) }}</strong>
          </article>
          <article class="ops-profit__row">
            <span>User orders</span>
            <div><i :style="{ width: percent(profit.orders, maxProfitPart) }"></i></div>
            <strong>{{ formatMoneyCompact(profit.orders) }}</strong>
          </article>
          <article class="ops-profit__row">
            <span>Chat payments</span>
            <div><i :style="{ width: percent(profit.chat, maxProfitPart) }"></i></div>
            <strong>{{ formatMoneyCompact(profit.chat) }}</strong>
          </article>
          <div class="ops-profit__pending">
            <span>Open / pending value</span>
            <strong>{{ formatMoney(profit.openValue) }}</strong>
          </div>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Case Health</p>
            <h3>Status Distribution</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/cases">Open</RouterLink>
        </div>
        <div class="ops-status-list">
          <article v-for="status in visibleCaseStatuses" :key="status.statusName" class="ops-status">
            <div>
              <span>{{ status.statusName }}</span>
              <strong>{{ status.total }}</strong>
            </div>
            <div class="ops-status__track">
              <span :style="{ width: percent(status.total, maxStatusValue), background: status.statusColor || '#f8d9aa' }"></span>
            </div>
            <small>{{ statusPercent(status.total) }}</small>
          </article>
          <p v-if="!visibleCaseStatuses.length" class="admin-muted">No active case status data yet.</p>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Recent Cases</p>
            <h3>Latest work opened</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/cases">View all</RouterLink>
        </div>
        <div class="ops-list">
          <RouterLink v-for="item in lists.recentCases || []" :key="item.id" class="ops-list__item" :to="`/admin/cases/${item.id}`">
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.clientName || 'No client' }} · {{ item.projectLeaderName || 'No leader' }}</small>
            </span>
            <span class="case-status">{{ item.statusName }}</span>
          </RouterLink>
          <p v-if="!(lists.recentCases || []).length" class="admin-muted">No cases yet.</p>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Latest Orders</p>
            <h3>User order inbox</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/user-orders">View all</RouterLink>
        </div>
        <div class="ops-list">
          <RouterLink v-for="item in lists.recentOrders || []" :key="item.id" class="ops-list__item" :to="`/admin/user-orders/${item.id}`">
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.userName || 'User' }} · {{ item.contactPhone || item.contactEmail || 'No contact' }}</small>
            </span>
            <span class="case-status">{{ item.statusName || 'Order Received' }}</span>
          </RouterLink>
          <p v-if="!(lists.recentOrders || []).length" class="admin-muted">No user orders yet.</p>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Messages</p>
            <h3>Recent contact requests</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/messages">Open</RouterLink>
        </div>
        <div class="ops-list">
          <RouterLink v-for="item in lists.recentMessages || []" :key="item.id" class="ops-list__item" to="/admin/messages">
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.subject }} · {{ formatDate(item.createdAt) }}</small>
            </span>
            <span class="case-status" :class="item.status === 'new' ? 'case-status--danger' : 'case-status--neutral'">{{ item.status }}</span>
          </RouterLink>
          <p v-if="!(lists.recentMessages || []).length" class="admin-muted">No contact messages yet.</p>
        </div>
      </section>

      <section class="ops-panel ops-panel--wide">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Team Workload</p>
            <h3>Leaders and task assignees</h3>
          </div>
          <RouterLink class="ops-mini-link" to="/admin/cases/tasks/all">Tasks</RouterLink>
        </div>
        <div class="ops-workload">
          <div>
            <h4>Project leaders</h4>
            <article v-for="leader in charts.workload?.leaders || []" :key="leader.id" class="ops-workload__row">
              <span>{{ leader.name }}</span>
              <div><i :style="{ width: percent(leader.activeCases, maxLeaderWorkload) }"></i></div>
              <strong>{{ leader.activeCases }}</strong>
            </article>
            <p v-if="!(charts.workload?.leaders || []).length" class="admin-muted">No assigned project leaders.</p>
          </div>
          <div>
            <h4>Task assignees</h4>
            <article v-for="assignee in charts.workload?.assignees || []" :key="assignee.id" class="ops-workload__row">
              <span>{{ assignee.name }}</span>
              <div><i :style="{ width: percent(assignee.openTasks, maxAssigneeWorkload) }"></i></div>
              <strong>{{ assignee.openTasks }}</strong>
            </article>
            <p v-if="!(charts.workload?.assignees || []).length" class="admin-muted">No assigned open tasks.</p>
          </div>
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p class="admin-kicker">Users</p>
            <h3>Newest accounts</h3>
          </div>
          <RouterLink v-if="isAdmin" class="ops-mini-link" to="/admin/users">Manage</RouterLink>
        </div>
        <div class="ops-list">
          <RouterLink v-for="item in lists.recentUsers || []" :key="item.id" class="ops-list__item" :to="isAdmin ? `/admin/users/${item.id}/reports` : '/admin'">
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.email }} · {{ formatDate(item.createdAt) }}</small>
            </span>
            <span class="case-status" :class="item.role === 'admin' ? 'case-status--danger' : item.role === 'assistant' ? 'case-status--success' : 'case-status--blue'">{{ item.role }}</span>
          </RouterLink>
        </div>
      </section>
    </div>

  </section>
</template>

<style scoped>
.ops-dashboard {
  display: grid;
  gap: 1.25rem;
}

.ops-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.35rem;
  border: 1px solid rgba(var(--rgb-accent), 0.12);
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(var(--rgb-foreground), 0.045), rgba(var(--rgb-foreground), 0.015));
  box-shadow: 0 18px 48px rgba(var(--rgb-background), 0.32);
}

.ops-hero h2,
.ops-panel h3,
.ops-workload h4 {
  margin: 0;
  color: var(--color-text-strong);
}

.ops-hero h2 {
  font-size: clamp(1.65rem, 3vw, 2.65rem);
}

.ops-hero__copy {
  max-width: 48rem;
  margin: 0.55rem 0 0;
  color: rgba(var(--rgb-foreground), 0.64);
  line-height: 1.6;
}

.ops-hero__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.ops-generated,
.ops-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(var(--rgb-accent), 0.14);
  border-radius: 0.45rem;
  color: rgba(var(--rgb-foreground), 0.66);
  background: rgba(var(--rgb-foreground), 0.035);
  font-size: 0.78rem;
  font-weight: 800;
}

.ops-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem;
}

.ops-kpi,
.ops-panel {
  border: 1px solid rgba(var(--rgb-accent), 0.1);
  border-radius: 0.75rem;
  background: rgba(var(--rgb-foreground), 0.032);
  box-shadow: 0 16px 42px rgba(var(--rgb-background), 0.28);
}

.ops-kpi {
  grid-column: span 12;
  display: flex;
  gap: 0.9rem;
  min-height: 8.25rem;
  padding: 1rem;
  color: inherit;
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.ops-kpi:hover {
  transform: translateY(-2px);
  border-color: rgba(248, 217, 170, 0.35);
  background: rgba(248, 217, 170, 0.05);
}

.ops-kpi__icon {
  display: grid;
  width: 3.3rem;
  height: 3.3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
}

.ops-kpi__icon svg {
  width: 1.45rem;
  height: 1.45rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ops-kpi--cream .ops-kpi__icon { color: #f8d9aa; background: rgba(248, 217, 170, 0.12); }
.ops-kpi--gold .ops-kpi__icon { color: #fbbf24; background: rgba(251, 191, 36, 0.13); }
.ops-kpi--blue .ops-kpi__icon { color: #60a5fa; background: rgba(96, 165, 250, 0.13); }
.ops-kpi--danger .ops-kpi__icon { color: #f87171; background: rgba(248, 113, 113, 0.13); }
.ops-kpi--green .ops-kpi__icon { color: #34d399; background: rgba(52, 211, 153, 0.13); }
.ops-kpi--violet .ops-kpi__icon { color: #a78bfa; background: rgba(167, 139, 250, 0.13); }

.ops-kpi__body {
  display: grid;
  gap: 0.2rem;
}

.ops-kpi__body span {
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.ops-kpi__body strong {
  color: var(--color-text-strong);
  font-size: clamp(1.75rem, 3vw, 2.2rem);
  line-height: 1;
  white-space: nowrap;
}

.ops-kpi__body small,
.ops-list__item small {
  color: rgba(var(--rgb-foreground), 0.55);
  line-height: 1.45;
}

.ops-panel {
  grid-column: span 12;
  min-width: 0;
  padding: 1rem;
}

.ops-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.ops-mini-link {
  color: #f8d9aa;
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;
}

.ops-trend {
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  gap: 0.45rem;
  min-height: 15rem;
}

.ops-trend__day {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0.45rem;
  min-width: 0;
}

.ops-trend__bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.18rem;
  min-height: 12.5rem;
  padding: 0.35rem;
  border-radius: 0.45rem;
  background: rgba(var(--rgb-foreground), 0.025);
}

.ops-trend__bar {
  position: relative;
  width: 38%;
  min-height: 0.4rem;
  border-radius: 999px 999px 0.2rem 0.2rem;
  transition: height 0.35s ease;
}

.ops-trend__bar em {
  position: absolute;
  top: -1.25rem;
  left: 50%;
  color: rgba(var(--rgb-foreground), 0.7);
  font-size: 0.68rem;
  font-style: normal;
  transform: translateX(-50%);
  opacity: 0;
}

.ops-trend__bar:hover em {
  opacity: 1;
}

.ops-trend__bar--cases { background: linear-gradient(180deg, #f8d9aa, rgba(248, 217, 170, 0.18)); }
.ops-trend__bar--orders { background: linear-gradient(180deg, #60a5fa, rgba(96, 165, 250, 0.16)); }

.ops-trend__day small {
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.66rem;
  text-align: center;
}

.ops-legend {
  display: flex;
  gap: 1rem;
  margin-top: 0.85rem;
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.78rem;
  font-weight: 800;
}

.ops-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.ops-legend i {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
}

.legend-cases { background: #f8d9aa; }
.legend-orders { background: #60a5fa; }

.ops-status-list,
.ops-list,
.ops-status {
  display: grid;
  gap: 0.45rem;
}

.ops-profit {
  display: grid;
  gap: 0.75rem;
}

.ops-profit__total,
.ops-profit__pending {
  display: grid;
  gap: 0.3rem;
  padding: 0.85rem;
  border: 1px solid rgba(251, 191, 36, 0.14);
  border-radius: 0.6rem;
  background: rgba(251, 191, 36, 0.055);
}

.ops-profit__total span,
.ops-profit__pending span {
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.74rem;
  font-weight: 900;
  text-transform: uppercase;
}

.ops-profit__total strong {
  color: #f8d9aa;
  font-size: clamp(1.55rem, 4vw, 2.25rem);
  line-height: 1;
}

.ops-profit__total small {
  color: rgba(var(--rgb-foreground), 0.58);
  font-weight: 800;
}

.ops-profit__row {
  display: grid;
  grid-template-columns: minmax(6.5rem, 0.75fr) minmax(0, 1fr) minmax(4.5rem, auto);
  align-items: center;
  gap: 0.65rem;
  color: rgba(var(--rgb-foreground), 0.72);
  font-size: 0.84rem;
  font-weight: 800;
}

.ops-profit__row div {
  overflow: hidden;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(var(--rgb-foreground), 0.08);
}

.ops-profit__row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #fbbf24, rgba(251, 191, 36, 0.25));
}

.ops-profit__row strong,
.ops-profit__pending strong {
  color: var(--color-text-strong);
  text-align: right;
  white-space: nowrap;
}

.ops-status > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(var(--rgb-foreground), 0.72);
  font-weight: 800;
}

.ops-status__track,
.ops-workload__row div {
  overflow: hidden;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(var(--rgb-foreground), 0.08);
}

.ops-status__track span,
.ops-workload__row i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.ops-status small {
  color: rgba(var(--rgb-foreground), 0.45);
}

.ops-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.06);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-background), 0.18);
  color: inherit;
  text-decoration: none;
}

.ops-list__item:hover {
  border-color: rgba(248, 217, 170, 0.25);
  background: rgba(248, 217, 170, 0.045);
}

.ops-list__item > span:first-child {
  min-width: 0;
}

.ops-list__item strong {
  display: block;
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-workload {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.ops-workload h4 {
  margin-bottom: 0.8rem;
  font-size: 0.95rem;
}

.ops-workload__row {
  display: grid;
  grid-template-columns: minmax(7rem, 0.9fr) minmax(0, 1fr) 2.5rem;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.7rem;
  color: rgba(var(--rgb-foreground), 0.72);
}

.ops-workload__row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
}

.ops-workload__row i {
  background: linear-gradient(90deg, #f8d9aa, rgba(248, 217, 170, 0.25));
}

.ops-workload__row strong {
  color: var(--color-text-strong);
  text-align: right;
}

:global(.ops-pdf-snapshot-wrap) {
  position: fixed;
  top: 0;
  left: -100000px;
  z-index: -1;
  overflow: visible;
  padding: 24px;
  background: var(--color-bg);
}

.ops-dashboard--pdf-snapshot {
  padding: 0;
  background: var(--color-bg);
}

.ops-dashboard--pdf-snapshot,
.ops-dashboard--pdf-snapshot :is(h2, h3, h4, p, span, strong, small, a, button, em) {
  font-family: Arial, "Helvetica Neue", sans-serif !important;
  letter-spacing: 0 !important;
  text-shadow: none !important;
  -webkit-font-smoothing: antialiased;
}

.ops-dashboard--pdf-snapshot :is(h2, h3, h4, p, span, strong, small, a, button, em) {
  line-height: 1.35 !important;
}

.ops-dashboard--pdf-snapshot .ops-kpi,
.ops-dashboard--pdf-snapshot .ops-panel,
.ops-dashboard--pdf-snapshot .ops-list__item {
  overflow: visible;
}

.ops-dashboard--pdf-snapshot .ops-kpi {
  min-height: 9.5rem;
  padding: 1.15rem;
}

.ops-dashboard--pdf-snapshot .ops-kpi__body {
  gap: 0.35rem;
}

.ops-dashboard--pdf-snapshot .ops-kpi__body strong {
  line-height: 1.15 !important;
}

.ops-dashboard--pdf-snapshot .ops-panel {
  padding: 1.15rem;
}

.ops-dashboard--pdf-snapshot .ops-list__item {
  align-items: flex-start;
  padding: 1rem;
}

.ops-dashboard--pdf-snapshot .ops-list__item strong,
.ops-dashboard--pdf-snapshot .ops-list__item small,
.ops-dashboard--pdf-snapshot .ops-workload__row span {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.ops-dashboard--pdf-snapshot .ops-chip,
.ops-dashboard--pdf-snapshot .ops-mini-link {
  flex: 0 0 auto;
}

@media (min-width: 760px) {
  .ops-kpi {
    grid-column: span 6;
  }
}

@media (min-width: 1180px) {
  .ops-kpi {
    grid-column: span 4;
  }

  .ops-panel {
    grid-column: span 4;
  }

  .ops-panel--wide {
    grid-column: span 8;
  }
}

@media (min-width: 1440px) {
  .ops-kpi {
    grid-column: span 4;
  }
}

@media (max-width: 900px) {
  .ops-hero {
    flex-direction: column;
  }

  .ops-hero__actions {
    justify-content: flex-start;
  }

  .ops-workload {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .ops-hero,
  .ops-panel,
  .ops-kpi {
    border-radius: 0.65rem;
    padding: 0.85rem;
  }

  .ops-hero__actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.55rem;
  }

  .ops-hero__actions > * {
    width: 100%;
    justify-content: center;
  }

  .ops-hero__actions .ops-generated,
  .ops-hero__actions .admin-primary-button,
  .ops-hero__actions > button {
    grid-column: 1 / -1;
  }

  .ops-trend {
    overflow-x: auto;
    grid-template-columns: repeat(14, 2.65rem);
    padding-bottom: 0.25rem;
  }

  .ops-list__item {
    align-items: flex-start;
    flex-direction: column;
  }

  .ops-workload__row {
    grid-template-columns: minmax(0, 1fr) 2fr 2rem;
  }
}
</style>

<!-- ─────────────────────────────────────
  Light mode overrides — NOT scoped so
  [data-theme=light] on <html> can reach
  these component elements.
───────────────────────────────────────── -->
<style>
[data-theme="light"] .ops-hero {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(180, 83, 9, 0.15);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.07);
}

[data-theme="light"] .ops-kpi,
[data-theme="light"] .ops-panel {
  background: #ffffff;
  border-color: rgba(180, 83, 9, 0.15);
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.06);
}

[data-theme="light"] .ops-kpi:hover {
  border-color: rgba(180, 83, 9, 0.3);
  background: rgba(180, 83, 9, 0.03);
}

[data-theme="light"] .ops-kpi--cream .ops-kpi__icon { color: #92400e; background: rgba(180, 83, 9, 0.1); }
[data-theme="light"] .ops-kpi--gold .ops-kpi__icon { color: #a16207; background: rgba(202, 138, 4, 0.1); }
[data-theme="light"] .ops-kpi--blue .ops-kpi__icon  { color: #1d4ed8; background: rgba(29, 78, 216, 0.1); }
[data-theme="light"] .ops-kpi--danger .ops-kpi__icon { color: #b91c1c; background: rgba(185, 28, 28, 0.1); }
[data-theme="light"] .ops-kpi--green .ops-kpi__icon  { color: #065f46; background: rgba(6, 95, 70, 0.1); }
[data-theme="light"] .ops-kpi--violet .ops-kpi__icon { color: #6d28d9; background: rgba(109, 40, 217, 0.1); }

[data-theme="light"] .ops-trend__bars {
  background: rgba(15, 23, 42, 0.04);
}

[data-theme="light"] .ops-trend__bar--cases { background: linear-gradient(180deg, #b45309, rgba(180, 83, 9, 0.2)); }
[data-theme="light"] .ops-trend__bar--orders { background: linear-gradient(180deg, #1d4ed8, rgba(29, 78, 216, 0.2)); }

[data-theme="light"] .legend-cases { background: #b45309; }
[data-theme="light"] .legend-orders { background: #1d4ed8; }

[data-theme="light"] .ops-list__item {
  background: #f8fafc;
  border-color: rgba(15, 23, 42, 0.08);
}

[data-theme="light"] .ops-list__item:hover {
  background: rgba(180, 83, 9, 0.04);
  border-color: rgba(180, 83, 9, 0.2);
}

[data-theme="light"] .ops-mini-link {
  color: #b45309;
}

[data-theme="light"] .ops-generated,
[data-theme="light"] .ops-chip {
  background: rgba(15, 23, 42, 0.05);
  border-color: rgba(15, 23, 42, 0.12);
  color: rgba(15, 23, 42, 0.7);
}

[data-theme="light"] .ops-status__track,
[data-theme="light"] .ops-workload__row div {
  background: rgba(15, 23, 42, 0.08);
}

[data-theme="light"] .ops-workload__row i {
  background: linear-gradient(90deg, #b45309, rgba(180, 83, 9, 0.3));
}

[data-theme="light"] .ops-profit__total,
[data-theme="light"] .ops-profit__pending {
  background: rgba(202, 138, 4, 0.06);
  border-color: rgba(202, 138, 4, 0.18);
}

[data-theme="light"] .ops-profit__total strong {
  color: #92400e;
}

[data-theme="light"] .ops-profit__row div {
  background: rgba(15, 23, 42, 0.08);
}

[data-theme="light"] .ops-profit__row i {
  background: linear-gradient(90deg, #ca8a04, rgba(202, 138, 4, 0.28));
}
</style>
