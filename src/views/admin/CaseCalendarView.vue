<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api';

const route = useRoute();
const tasks = ref([]);
const loading = ref(true);
const error = ref('');

// Calendar state
const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-indexed

const monthName = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
);

const calendarDays = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const last = new Date(viewYear.value, viewMonth.value + 1, 0);
  const days = [];

  // Padding before first day (0=Sun)
  for (let i = 0; i < first.getDay(); i++) {
    days.push({ date: null, tasks: [] });
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dateStr = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTasks = tasks.value.filter(t => t.dueDate && t.dueDate.startsWith(dateStr));
    days.push({ date: d, dateStr, tasks: dayTasks });
  }

  return days;
});

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
  else viewMonth.value--;
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
  else viewMonth.value++;
}

function isToday(d) {
  return d === today.getDate() && viewMonth.value === today.getMonth() && viewYear.value === today.getFullYear();
}

async function loadTasks() {
  loading.value = true;
  try {
    const res = await api.get(`/api/cases/${route.params.id}/tasks`);
    tasks.value = res.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadTasks);
</script>

<template>
  <section class="admin-page-stack">
    <div class="admin-panel">
    <div class="admin-panel-header admin-panel-header--compact">
      <strong class="admin-month-title">{{ monthName }}</strong>
      <div class="admin-actions">
        <button class="admin-link-button" type="button" @click="prevMonth">‹ Prev</button>
        <button class="admin-link-button" type="button" @click="nextMonth">Next ›</button>
      </div>
    </div>

    <p v-if="loading" class="admin-loading">Loading calendar...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <div v-else class="cal-grid">
      <div class="cal-weekdays">
        <span v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</span>
      </div>
      <div class="cal-days">
        <div
          v-for="(cell, i) in calendarDays"
          :key="i"
          class="cal-day"
          :class="{
            'cal-day--empty': !cell.date,
            'cal-day--today': cell.date && isToday(cell.date),
            'cal-day--has-tasks': cell.tasks.length > 0,
          }"
        >
          <span v-if="cell.date" class="cal-day__num">{{ cell.date }}</span>
          <div class="cal-day__tasks">
            <div
              v-for="task in cell.tasks.slice(0, 3)"
              :key="task.id"
              class="cal-task-chip"
            >
              {{ task.title }}
            </div>
            <div v-if="cell.tasks.length > 3" class="cal-task-chip cal-task-chip--more">
              +{{ cell.tasks.length - 3 }} more
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </section>
</template>
