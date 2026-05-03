<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api';

const route = useRoute();
const tasks = ref([]);
const loading = ref(true);
const error = ref('');
const draggingId = ref(null);

const COLUMNS = [
  { key: 'open',        label: 'Open',        color: '#22c55e' },
  { key: 'assigned',    label: 'Assigned',     color: '#3b82f6' },
  { key: 'to-do',       label: 'To Do',        color: '#f59e0b' },
  { key: 'in-progress', label: 'In Progress',  color: '#8b5cf6' },
  { key: 'completed',   label: 'Completed',    color: '#10b981' },
];

const priorityColor = { high: '#ef4444', normal: '#f59e0b', low: '#22c55e' };

function columnTasks(key) {
  return tasks.value.filter(t => t.status === key);
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

function onDragStart(taskId) {
  draggingId.value = taskId;
}

function onDragOver(e) {
  e.preventDefault();
}

async function onDrop(newStatus) {
  const id = draggingId.value;
  if (!id) return;
  draggingId.value = null;
  const task = tasks.value.find(t => t.id === id);
  if (!task || task.status === newStatus) return;
  const old = task.status;
  task.status = newStatus;
  try {
    await api.patch(`/api/cases/${route.params.id}/tasks/${id}`, { status: newStatus });
  } catch {
    task.status = old;
  }
}

onMounted(loadTasks);
</script>

<template>
  <section class="admin-panel">

    <p v-if="loading" class="admin-loading">Loading board...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>


    <div v-else class="kanban-board">
      <div
        v-for="col in COLUMNS"
        :key="col.key"
        class="kanban-col"
        @dragover="onDragOver"
        @drop="onDrop(col.key)"
      >
        <div class="kanban-col__header" :style="{ '--col-color': col.color }">
          <span class="kanban-col__dot"></span>
          <span class="kanban-col__label">{{ col.label }}</span>
          <span class="kanban-col__count">{{ columnTasks(col.key).length }}</span>
        </div>

        <div class="kanban-col__cards">
          <div
            v-for="task in columnTasks(col.key)"
            :key="task.id"
            class="kanban-card"
            :class="{ 'kanban-card--dragging': draggingId === task.id }"
            draggable="true"
            @dragstart="onDragStart(task.id)"
          >
            <div class="kanban-card__top">
              <span class="kanban-card__priority" :style="{ background: priorityColor[task.priority] }">
                {{ task.priority?.toUpperCase() }}
              </span>
              <span class="kanban-card__id">#{{ task.id }}</span>
            </div>
            <p class="kanban-card__title">{{ task.title }}</p>
            <div class="kanban-card__footer" v-if="task.assigneeName || task.dueDate">
              <span v-if="task.assigneeName" class="kanban-card__assignee">{{ task.assigneeName }}</span>
              <span v-if="task.dueDate" class="kanban-card__due">{{ new Date(task.dueDate).toLocaleDateString('en-GB') }}</span>
            </div>
          </div>
          <p v-if="!columnTasks(col.key).length" class="kanban-empty">Drop tasks here</p>
        </div>
      </div>
    </div>
  </section>
</template>
