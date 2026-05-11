<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { authState, openLogoutModal } from '../stores/authStore';
import NotificationBell from '../components/notifications/NotificationBell.vue';
import { useSiteSettings } from '../composables/useSiteSettings';
import { useTheme } from '../composables/useTheme';

const route = useRoute();
const sidebarOpen = ref(false);
const { hero, loadSiteSettings } = useSiteSettings();

const pageTitle = computed(() => {
  if (route.path === '/dashboard/orders/files') return 'Files';
  if (route.path === '/dashboard/orders/notes') return 'Notes';
  if (route.path.includes('/orders/new')) return 'Add Order';
  if (route.path.includes('/orders/')) return 'Order Details';
  if (route.path.includes('/orders')) return 'Orders';
  return 'Dashboard';
});

const isDashboardActive = computed(() => route.path === '/dashboard');
const isOrdersActive = computed(() => route.path.startsWith('/dashboard/orders'));
const isFilesActive = computed(() => route.path === '/dashboard/orders/files');
const isNotesActive = computed(() => route.path === '/dashboard/orders/notes');

function closeSidebar() {
  sidebarOpen.value = false;
}

const { theme, toggleTheme } = useTheme();

onMounted(loadSiteSettings);
</script>

<template>
  <div class="admin-shell user-admin-shell">
    <button
      v-if="sidebarOpen"
      class="admin-sidebar-backdrop"
      type="button"
      aria-label="Close navigation"
      @click="closeSidebar"
    ></button>

    <aside class="admin-sidebar" :class="{ 'admin-sidebar--open': sidebarOpen }">
      <RouterLink class="admin-brand" to="/dashboard" @click="closeSidebar">
        <img :src="hero.logo" :alt="hero.title" />
        <span class="admin-brand__text">User</span>
      </RouterLink>

      <nav class="admin-nav" aria-label="User navigation">
        <div class="admin-nav__group">
          <span class="admin-nav__title">Workspace</span>
          <RouterLink
            to="/dashboard"
            class="admin-nav__link"
            :class="{ 'admin-nav__link--active': isDashboardActive }"
            active-class="admin-nav__link--inactive"
            exact-active-class="admin-nav__link--active"
            @click="closeSidebar"
          >
            <svg class="admin-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4h7v7H4V4Z" />
              <path d="M13 4h7v5h-7V4Z" />
              <path d="M13 11h7v9h-7v-9Z" />
              <path d="M4 13h7v7H4v-7Z" />
            </svg>
            <span class="admin-nav__link-text">Dashboard</span>
          </RouterLink>

          <RouterLink
            to="/dashboard/orders"
            class="admin-nav__link"
            :class="{ 'admin-nav__link--active': isOrdersActive && !isFilesActive && !isNotesActive }"
            active-class="admin-nav__link--inactive"
            @click="closeSidebar"
          >
            <svg class="admin-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h9l3 3v15H6V3Z" />
              <path d="M14 3v4h4" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            <span class="admin-nav__link-text">Orders</span>
          </RouterLink>

          <RouterLink
            to="/dashboard/orders/files"
            class="admin-nav__link"
            :class="{ 'admin-nav__link--active': isFilesActive }"
            active-class="admin-nav__link--inactive"
            @click="closeSidebar"
          >
            <svg class="admin-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z" />
              <path d="M8 12h8" />
              <path d="M8 15h5" />
            </svg>
            <span class="admin-nav__link-text">Files</span>
          </RouterLink>

          <RouterLink
            to="/dashboard/orders/notes"
            class="admin-nav__link"
            :class="{ 'admin-nav__link--active': isNotesActive }"
            active-class="admin-nav__link--inactive"
            @click="closeSidebar"
          >
            <svg class="admin-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h9l3 3v15H6V3Z" />
              <path d="M14 3v4h4" />
              <path d="M9 12h6" />
              <path d="M9 16h4" />
            </svg>
            <span class="admin-nav__link-text">Notes</span>
          </RouterLink>
        </div>
      </nav>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <button class="admin-menu-button" type="button" aria-label="Open navigation" @click="sidebarOpen = !sidebarOpen">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="admin-topbar__title">
            <p class="admin-kicker">{{ hero.title }} Account</p>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>

        <div class="admin-topbar__actions">
          <span class="admin-user">{{ authState.user?.name }}</span>
          <div class="admin-topbar__buttons">
            <button
              class="admin-topbar-action-btn admin-topbar-action-btn--light theme-toggle"
              type="button"
              :title="theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
              :aria-label="theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
              @click="toggleTheme"
            >
              <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <span class="action-text">{{ theme === 'light' ? 'Light Mode' : 'Dark Mode' }}</span>
            </button>
            <NotificationBell />
            <RouterLink class="admin-topbar-action-btn admin-topbar-action-btn--light" to="/" title="Back to Site">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 19l-7-7 7-7"></path>
                <path d="M21 12H3"></path>
              </svg>
              <span class="action-text">Site</span>
            </RouterLink>
            <button class="admin-topbar-action-btn admin-topbar-action-btn--danger" type="button" title="Logout" @click="openLogoutModal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span class="action-text">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main class="admin-content">
        <RouterView v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
