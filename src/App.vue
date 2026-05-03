<script setup>
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import LogoutModal from './components/LogoutModal.vue';
import ToastNotification from './components/admin/ToastNotification.vue';
import { useTheme } from './composables/useTheme';

useTheme(); // Initializes theme from localStorage/system preference
</script>

<template>
  <RouterView v-slot="{ Component }">
    <transition name="page-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
  <LogoutModal />
  <ToastNotification />
</template>
