<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();

const tabs = computed(() => [
  { label: 'MY TASKS', to: '/admin/cases/tasks/my', active: route.path === '/admin/cases/tasks/my' },
  { label: 'ALL TASKS', to: '/admin/cases/tasks/all', active: route.path === '/admin/cases/tasks/all' },
  { label: 'CASES', to: '/admin/cases', active: route.path === '/admin/cases' },
  { label: 'GENERATORS', to: '/admin/cases/generators', active: route.path === '/admin/cases/generators' },
  { label: 'TEMPLATES', to: '/admin/cases/templates', active: route.path === '/admin/cases/templates' },
  { label: 'CALENDAR', to: '/admin/cases/calendar', active: route.path === '/admin/cases/calendar' },
  { label: 'ORDERS', to: '/admin/cases/orders', active: route.path === '/admin/cases/orders' },
  { label: 'TIMERS', to: '/admin/cases/timers', active: route.path === '/admin/cases/timers' },
  { label: 'ARCHIVE', to: '/admin/cases/archive', active: route.path === '/admin/cases/archive' },
  { label: 'NOTES EXPORT', to: '/admin/cases/notes-export', active: route.path === '/admin/cases/notes-export' },
  { label: 'SETTINGS', to: '/admin/cases/settings', active: route.path === '/admin/cases/settings' },
]);
</script>

<template>
  <div class="cases-tabs" aria-label="Cases navigation">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.label"
      :to="tab.to"
      class="cases-tabs__link"
      :class="{ 'cases-tabs__active': tab.active }"
    >
      {{ tab.label }}
    </RouterLink>
  </div>
</template>
