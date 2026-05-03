<!--
  PublicHeader.vue
  ─────────────────────────────────────────────────────
  Shared site header used across all public-facing pages:
  Home, Connect Us, Login, and Register.

  This component was extracted to eliminate duplication — the
  header markup was previously copy-pasted into 4 different views.

  Props:
  • navItems   – array of nav link items from siteContent.js
  • authItems  – array of auth button items (Login / Sign Up)
  • logo       – string path to the brand logo image

  Emits:
  • navigate(item)   – propagated up when any nav/auth item is clicked
  • toggle-menu      – propagated up when the hamburger button is clicked
-->
<script setup>
import { useRouter } from 'vue-router';
import { authState, getDashboardPath, openLogoutModal } from '../stores/authStore';
import { useTheme } from '../composables/useTheme';

const props = defineProps({
  /** Navigation items shown in the desktop/mobile nav */
  navItems: {
    type: Array,
    required: true,
  },
  /** Auth action items (Login / Sign Up) shown when the user is a guest */
  authItems: {
    type: Array,
    required: true,
  },
  /** Absolute or relative path to the brand logo */
  logo: {
    type: String,
    required: true,
  },
  /** Whether the mobile menu is currently open (controls aria-expanded) */
  isMenuOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['navigate', 'toggle-menu']);
const router = useRouter();
const { theme, toggleTheme } = useTheme();

/** Delegate navigation events upward to the parent page view */
function handleNavigate(item) {
  emit('navigate', item);
}

/** Open the global logout confirmation modal instead of logging out immediately */
function handleLogout() {
  openLogoutModal();
}

function openDashboard() {
  router.push(getDashboardPath());
}
</script>

<template>
  <header class="floating-header">
    <!-- Brand logo — clicking it navigates home -->
    <button class="brand-badge" type="button" @click="router.push('/')">
      <img :src="props.logo" alt="BoneHard logo" width="144" height="56" />
    </button>

    <!-- Desktop navigation links -->
    <nav class="desktop-nav" aria-label="Site navigation">
      <button
        v-for="item in props.navItems"
        :key="item.label"
        class="desktop-nav__link"
        type="button"
        @click="handleNavigate(item)"
      >
        {{ item.label }}
      </button>
    </nav>

    <!-- Desktop auth actions + hamburger -->
    <div class="header-actions">
      <button class="theme-toggle-btn" type="button" aria-label="Toggle theme" @click="toggleTheme">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>

      <div class="desktop-nav__auth">
        <!-- Guest state: show Login + Sign Up -->
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

        <!-- Authenticated state: show Dashboard + Logout -->
        <template v-else-if="authState.ready && authState.user">
          <button
            class="auth-button"
            type="button"
            @click="openDashboard"
          >
            Dashboard
          </button>
          <button
            class="auth-button auth-button--primary"
            type="button"
            @click="handleLogout"
          >
            Logout
          </button>
        </template>
      </div>

      <!-- Hamburger toggle — visible on mobile only -->
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="props.isMenuOpen"
        aria-controls="bonehard-menu"
        aria-label="Open navigation menu"
        @click="emit('toggle-menu')"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>
</template>
