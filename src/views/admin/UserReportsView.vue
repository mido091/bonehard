<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../../services/api';

const route  = useRoute();
const router = useRouter();

const report  = ref(null);
const loading = ref(true);
const error   = ref('');

async function loadReport() {
  loading.value = true;
  try {
    const res = await api.get(`/api/admin/users/${route.params.id}/report`);
    report.value = res.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

/** Format seconds to HH:MM:SS */
function formatProgress(completed, total) {
  if (!total) return '—';
  return `${completed} / ${total} (${Math.round((completed / total) * 100)}%)`;
}

onMounted(loadReport);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">

      <!-- Toolbar -->
      <div class="admin-toolbar admin-toolbar--end">
        <RouterLink class="admin-link-button" to="/admin/users">← Back to Users</RouterLink>
      </div>

      <p v-if="loading" class="admin-loading">Loading report...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <template v-else-if="report">

        <!-- User Profile Card -->
        <div class="admin-panel-header">
          <div>
            <p class="admin-kicker">User Report</p>
            <h2>{{ report.user.name }}</h2>
            <p class="admin-muted">{{ report.user.email }}</p>
          </div>
          <span class="case-status case-status--blue">{{ report.user.role?.toUpperCase() }}</span>
        </div>

        <!-- Task Stats -->
        <div class="admin-stats-grid" style="margin-bottom: 1.5rem;">
          <article class="admin-stat-card">
            <div><span>Total Assigned Tasks</span><strong>{{ report.taskStats.totalTasks }}</strong></div>
          </article>
          <article class="admin-stat-card">
            <div><span>Completed</span><strong>{{ report.taskStats.completedTasks }}</strong></div>
          </article>
          <article class="admin-stat-card">
            <div><span>In Progress</span><strong>{{ report.taskStats.inProgressTasks }}</strong></div>
          </article>
          <article class="admin-stat-card">
            <div><span>Open</span><strong>{{ report.taskStats.openTasks }}</strong></div>
          </article>
        </div>

        <!-- Cases Table -->
        <h3 style="margin-bottom: 0.75rem;">Cases ({{ report.cases.length }})</h3>
        <div class="admin-table-wrap">
          <table class="admin-table responsive-table">
            <thead>
              <tr>
                <th>Case Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in report.cases" :key="c.id" :class="{ 'admin-table-row--muted': c.isArchived }">
                <td data-label="Case Name">
                  <RouterLink class="admin-link-button" :to="`/admin/cases/${c.id}`">
                    {{ c.name }}
                  </RouterLink>
                  <span v-if="c.customUid" class="admin-muted" style="margin-left:0.5rem; font-size:0.75rem;">#{{ c.customUid }}</span>
                  <span v-if="c.isArchived" class="case-status case-status--neutral" style="margin-left:0.5rem;">ARCHIVED</span>
                </td>
                <td data-label="Status">
                  <span class="case-status" :style="{ '--status-color': c.statusColor }">{{ c.statusName }}</span>
                </td>
                <td data-label="Progress">{{ formatProgress(c.completedTasks, c.totalTasks) }}</td>
                <td data-label="Due Date">{{ c.estimatedCompletionDate ? new Date(c.estimatedCompletionDate).toLocaleDateString('en-US') : '—' }}</td>
                <td data-label="Actions">
                  <RouterLink class="admin-link-button" :to="`/admin/cases/${c.id}`">View</RouterLink>
                  <RouterLink class="admin-link-button" :to="`/admin/cases/${c.id}/tasks`">Tasks</RouterLink>
                </td>
              </tr>
              <tr v-if="!report.cases.length">
                <td colspan="5" class="admin-muted admin-table-empty">No cases found for this user.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- User Details -->
        <div class="admin-card" style="margin-top:1.5rem; padding:1rem;">
          <h3 style="margin-bottom:0.75rem;">User Info</h3>
          <p v-if="report.user.phone"><strong>Phone:</strong> {{ report.user.phone }}</p>
          <p v-if="report.user.address"><strong>Address:</strong> {{ report.user.address }}</p>
          <p><strong>Joined:</strong> {{ new Date(report.user.createdAt).toLocaleDateString('en-US') }}</p>
        </div>

      </template>
    </div>
  </section>
</template>
