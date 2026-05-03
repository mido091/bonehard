<script setup>
import { useRouter } from 'vue-router';
import { authState, getDashboardPath, openLogoutModal } from '../stores/authStore';

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  navItems: {
    type: Array,
    required: true,
  },
  authItems: {
    type: Array,
    required: true,
  },
  logo: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['close', 'navigate']);
const router = useRouter();

function handleNavigate(item) {
  emit('navigate', item);
}

function handleLogout() {
  openLogoutModal();
  emit('close');
}

function openDashboard() {
  emit('close');
  router.push(getDashboardPath());
}
</script>

<template>
  <transition name="menu-fade">
    <aside
      v-if="open"
      id="bonehard-menu"
      class="mobile-menu"
      aria-label="Site navigation"
      role="dialog"
      aria-modal="true"
    >
      <div class="mobile-menu__top">
        <img class="mobile-menu__logo" :src="props.logo" alt="BoneHard logo" />
        <button
          class="menu-toggle menu-toggle--close"
          type="button"
          aria-label="Close navigation menu"
          @click="emit('close')"
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <nav class="mobile-menu__nav">
        <button
          v-for="item in props.navItems"
          :key="item.label"
          class="mobile-menu__link"
          type="button"
          @click="handleNavigate(item)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="mobile-menu__actions">
        <template v-if="authState.ready && !authState.user">
          <button
            v-for="item in props.authItems"
            :key="item.label"
            class="auth-button"
            :class="{ 'auth-button--primary': item.primary }"
            type="button"
            @click="handleNavigate(item)"
          >
            {{ item.label }}
          </button>
        </template>
        <template v-else-if="authState.ready && authState.user">
          <button class="auth-button" type="button" @click="openDashboard">Dashboard</button>
          <button class="auth-button auth-button--primary" type="button" @click="handleLogout">Logout</button>
        </template>
      </div>
    </aside>
  </transition>
</template>
