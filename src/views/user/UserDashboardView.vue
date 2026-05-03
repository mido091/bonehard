<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../services/api';

const dashboard = ref(null);
const loading = ref(false);
const error = ref('');

const summary = computed(() => dashboard.value?.summary || {});
const recentOrders = computed(() => dashboard.value?.lists?.recentOrders || []);
const trend = computed(() => dashboard.value?.charts?.ordersTrend || []);
const maxTrendValue = computed(() => Math.max(1, ...trend.value.map((item) => Number(item.total || 0))));
const completionRatio = computed(() => {
  const total = Number(summary.value.totalOrders || 0);
  if (!total) return 0;
  return Math.round((Number(summary.value.completeContact || 0) / total) * 100);
});

const icons = {
  orders: ['M6 3h9l3 3v15H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  files: ['M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z', 'M13 2v7h7'],
  contact: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.45-1.17a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92Z'],
  time: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
};

const kpis = computed(() => [
  {
    label: 'Total Orders',
    value: summary.value.totalOrders || 0,
    sub: `${summary.value.submitted14d || 0} submitted in 14 days`,
    tone: 'cream',
    icon: 'orders',
  },
  {
    label: 'Attached Files',
    value: summary.value.totalFiles || 0,
    sub: `${summary.value.withFiles || 0} orders include files`,
    tone: 'blue',
    icon: 'files',
  },
  {
    label: 'Ready Contact',
    value: `${completionRatio.value}%`,
    sub: `${summary.value.completeContact || 0} orders with phone and email`,
    tone: 'green',
    icon: 'contact',
  },
  {
    label: 'Target Time',
    value: summary.value.withTargetTime || 0,
    sub: 'orders include expected timing',
    tone: 'violet',
    icon: 'time',
  },
]);

function formatDate(value) {
  if (!value) return 'Not Provided';
  return new Intl.DateTimeFormat('en-GB').format(new Date(value));
}

function shortDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit' }).format(new Date(value));
}

function trendHeight(value) {
  return `${Math.max(8, Math.round((Number(value || 0) / maxTrendValue.value) * 100))}%`;
}

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/api/user/orders/dashboard');
    dashboard.value = response.data || null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <section class="admin-page-stack user-dashboard-page">
    <div class="user-dashboard-panel">
      <div class="user-dashboard-hero">
        <div>
          <p class="admin-kicker">BoneHard Account</p>
          <h2>Dashboard</h2>
          <p>Your submitted orders, files, and recent activity in one place.</p>
        </div>
        <div class="user-dashboard-actions">
          <RouterLink class="admin-link-button" to="/dashboard/orders">View Orders</RouterLink>
          <RouterLink class="admin-primary-button" to="/dashboard/orders/new">+ Add Order</RouterLink>
        </div>
      </div>

      <p v-if="loading" class="admin-loading">Loading dashboard...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="user-dashboard-grid">
        <RouterLink
          v-for="item in kpis"
          :key="item.label"
          class="user-stat-card"
          :class="`user-stat-card--${item.tone}`"
          to="/dashboard/orders"
        >
          <span class="user-stat-card__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path v-for="path in icons[item.icon]" :key="path" :d="path" />
            </svg>
          </span>
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.sub }}</small>
        </RouterLink>

        <div class="user-chart-card">
          <div class="user-section-head">
            <div>
              <p class="admin-kicker">7-Day Activity</p>
              <h3>Order submissions</h3>
            </div>
            <span>{{ summary.submitted14d || 0 }} in 14 days</span>
          </div>
          <div class="user-trend" aria-label="Orders submitted during the last seven days">
            <div v-for="item in trend" :key="item.date" class="user-trend__day">
              <div class="user-trend__bar-wrap">
                <span class="user-trend__bar" :style="{ height: trendHeight(item.total) }"></span>
              </div>
              <small>{{ shortDate(item.date) }}</small>
            </div>
          </div>
        </div>

        <div class="user-recent-card">
          <div class="user-section-head">
            <div>
              <p class="admin-kicker">Latest</p>
              <h3>Recent orders</h3>
            </div>
            <RouterLink class="user-mini-link" to="/dashboard/orders">View all</RouterLink>
          </div>

          <div class="user-recent-list">
            <RouterLink
              v-for="order in recentOrders"
              :key="order.id"
              class="user-recent-list__item"
              :to="`/dashboard/orders/${order.id}`"
            >
              <span>
                <strong>{{ order.name }}</strong>
                <small>{{ formatDate(order.startDate || order.createdAt) }} - {{ order.targetTime || 'No target time' }}</small>
              </span>
              <em>{{ order.fileCount }} files</em>
            </RouterLink>
            <p v-if="!recentOrders.length" class="admin-empty">No orders submitted yet.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.user-dashboard-panel {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid rgba(var(--rgb-accent), 0.12);
  border-radius: 0.75rem;
  background: radial-gradient(circle at top right, rgba(248, 217, 170, 0.09), transparent 34%),
    rgba(var(--rgb-foreground), 0.03);
  box-shadow: 0 16px 44px rgba(var(--rgb-background), 0.26);
}

.user-dashboard-hero,
.user-section-head,
.user-dashboard-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.user-dashboard-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.user-dashboard-hero h2,
.user-section-head h3 {
  margin: 0;
  color: var(--color-text-strong);
}

.user-dashboard-hero h2 {
  font-size: clamp(1.55rem, 3vw, 2.35rem);
}

.user-dashboard-hero p:not(.admin-kicker) {
  max-width: 42rem;
  margin: 0.45rem 0 0;
  color: rgba(var(--rgb-foreground), 0.62);
  line-height: 1.55;
}

.user-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.85rem;
}

.user-stat-card,
.user-chart-card,
.user-recent-card {
  border: 1px solid rgba(var(--rgb-accent), 0.1);
  border-radius: 0.65rem;
  background: rgba(var(--rgb-background), 0.18);
}

.user-stat-card {
  grid-column: span 12;
  display: grid;
  gap: 0.3rem;
  min-height: 8.4rem;
  padding: 1rem;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.user-stat-card:hover {
  border-color: rgba(248, 217, 170, 0.28);
  background: rgba(248, 217, 170, 0.045);
  transform: translateY(-2px);
}

.user-stat-card__icon {
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: 0.6rem;
  background: currentColor;
}

.user-stat-card__icon svg {
  width: 1.35rem;
  height: 1.35rem;
  fill: none;
  stroke: #050505;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.user-stat-card > span:not(.user-stat-card__icon) {
  color: rgba(var(--rgb-foreground), 0.58);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.user-stat-card strong {
  color: var(--color-text-strong);
  font-size: 2.25rem;
  line-height: 1.08;
}

.user-stat-card small,
.user-section-head span,
.user-recent-list__item small {
  color: rgba(var(--rgb-foreground), 0.55);
  line-height: 1.45;
}

.user-stat-card--cream { color: #f8d9aa; }
.user-stat-card--blue { color: #60a5fa; }
.user-stat-card--green { color: #34d399; }
.user-stat-card--violet { color: #a78bfa; }

.user-chart-card,
.user-recent-card {
  grid-column: span 12;
  min-width: 0;
  padding: 1rem;
}

.user-mini-link {
  color: #f8d9aa;
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;
}

.user-trend {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.55rem;
  min-height: 11rem;
  margin-top: 1rem;
}

.user-trend__day {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0.45rem;
  min-width: 0;
}

.user-trend__bar-wrap {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 8.5rem;
  padding: 0.4rem;
  border-radius: 0.5rem;
  background: rgba(var(--rgb-foreground), 0.025);
}

.user-trend__bar {
  display: block;
  width: 44%;
  min-height: 0.45rem;
  border-radius: 999px 999px 0.25rem 0.25rem;
  background: linear-gradient(180deg, #f8d9aa, rgba(248, 217, 170, 0.16));
}

.user-trend__day small {
  color: rgba(var(--rgb-foreground), 0.45);
  font-size: 0.68rem;
  text-align: center;
}

.user-recent-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 1rem;
}

.user-recent-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.06);
  border-radius: 0.55rem;
  background: rgba(var(--rgb-foreground), 0.025);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.user-recent-list__item:hover {
  border-color: rgba(248, 217, 170, 0.28);
  background: rgba(248, 217, 170, 0.045);
}

.user-recent-list__item strong {
  display: block;
  color: var(--color-text-strong);
}

.user-recent-list__item em {
  flex: 0 0 auto;
  color: #f8d9aa;
  font-size: 0.78rem;
  font-style: normal;
  font-weight: 900;
}

@media (min-width: 760px) {
  .user-stat-card {
    grid-column: span 6;
  }
}

@media (min-width: 1120px) {
  .user-stat-card {
    grid-column: span 3;
  }

  .user-chart-card {
    grid-column: span 7;
  }

  .user-recent-card {
    grid-column: span 5;
  }
}

@media (max-width: 720px) {
  .user-dashboard-panel {
    padding: 0.9rem;
  }

  .user-dashboard-hero,
  .user-section-head,
  .user-recent-list__item {
    flex-direction: column;
  }

  .user-dashboard-actions,
  .user-dashboard-actions > * {
    width: 100%;
  }
}
</style>
