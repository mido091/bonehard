<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { authState, openLogoutModal } from '../stores/authStore';
import ConfirmDialog from '../components/admin/ConfirmDialog.vue';
import NotificationBell from '../components/notifications/NotificationBell.vue';
import { useSiteSettings } from '../composables/useSiteSettings';
import { useTheme } from '../composables/useTheme';

const route = useRoute();
const sidebarOpen = ref(false);
const canManageUsersAndSettings = computed(() => authState.user?.role === 'admin');
const { hero, loadSiteSettings } = useSiteSettings();

const navIcons = {
  dashboard: [
    'M3 13h8V3H3v10Z',
    'M13 21h8V11h-8v10Z',
    'M13 3v6h8V3h-8Z',
    'M3 21h8v-6H3v6Z',
  ],
  analytics: ['M4 19V5', 'M4 19h16', 'M8 16v-5', 'M12 16V8', 'M16 16v-8'],
  cases: ['M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z'],
  requests: ['M6 3h9l3 3v15H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  orders: ['M6 7h12l-1 14H7L6 7Z', 'M9 7a3 3 0 0 1 6 0'],
  chats: ['M4 5h16v10H8l-4 4V5Z', 'M8 9h8', 'M8 12h5'],
  clientTalk: ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
  messages: ['M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z'],
  payments: ['M3 7h18v10H3V7Z', 'M7 11h4', 'M16 13h1', 'M6 17v2h12v-2'],
  files: ['M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z', 'M8 12h8', 'M8 15h5'],
  notes: ['M6 3h9l3 3v15H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h4'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  settings: ['M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.07a2 2 0 1 1-2.83 2.83l-.07-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.07.06a2 2 0 1 1-2.83-2.83l.06-.07A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.8a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4 9.2a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.07a2 2 0 1 1 2.83-2.83l.07.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.8a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.07-.06a2 2 0 1 1 2.83 2.83l-.06.07A1.7 1.7 0 0 0 19.4 9c.24.38.6.74 1 1 .33.22.7.35 1.1.4h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.1.6Z'],
};

const navGroups = computed(() => [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/admin', icon: 'dashboard', exact: true },
    ],
  },
  {
    title: 'Cases & Orders',
    items: [
      {
        label: 'Cases',
        to: '/admin/cases',
        icon: 'cases',
        isActive: route.path === '/admin/cases' || (route.path.startsWith('/admin/cases/') && !route.path.includes('/files') && !route.path.includes('/notes')),
      },
      {
        label: 'Orders',
        to: '/admin/user-orders',
        icon: 'orders',
        isActive: route.path.startsWith('/admin/user-orders'),
      },
      {
        label: 'Files',
        to: '/admin/cases/files',
        icon: 'files',
        isActive: route.path === '/admin/cases/files',
      },
      {
        label: 'Notes',
        to: '/admin/cases/notes',
        icon: 'notes',
        isActive: route.path === '/admin/cases/notes',
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Chats', to: '/admin/chats', icon: 'chats' },
      { label: 'Messages', to: '/admin/messages', icon: 'messages' },
      canManageUsersAndSettings.value ? { label: 'Client Talk', to: '/admin/client-talk', icon: 'clientTalk', isActive: route.path.startsWith('/admin/client-talk') } : null,
    ].filter(Boolean),
  },
  {
    title: 'Management',
    items: [
      canManageUsersAndSettings.value ? { label: 'Users', to: '/admin/users', icon: 'users' } : null,
      canManageUsersAndSettings.value ? { label: 'Settings', to: '/admin/settings', icon: 'settings' } : null,
    ].filter(Boolean),
  },
].filter((group) => group.items.length));

const pageTitle = computed(() => {
  if (route.path.includes('/user-orders')) return 'Orders';
  if (route.path.includes('/orders')) return 'Order Requests';
  if (route.path.includes('/cases')) return 'Cases';
  if (route.path.includes('/chats')) return 'Chats';
  if (route.path.includes('/users')) return 'Users';
  if (route.path.includes('/assistants')) return 'Assistants';
  if (route.path.includes('/messages')) return 'Messages';
  if (route.path.includes('/payments')) return 'Payments';
  if (route.path.includes('/settings')) return 'Settings';
  if (route.path.includes('/client-talk')) return 'Client Talk';
  return 'Dashboard';
});

function handleLogout() {
  openLogoutModal();
}

const { theme, toggleTheme } = useTheme();

// Load unread notification count on mount to show badge in sidebar
onMounted(loadSiteSettings);
</script>

<template>
  <div class="admin-shell">
    <button
      v-if="sidebarOpen"
      class="admin-sidebar-backdrop"
      type="button"
      aria-label="Close navigation"
      @click="sidebarOpen = false"
    ></button>

    <aside class="admin-sidebar" :class="{ 'admin-sidebar--open': sidebarOpen }">
      <RouterLink class="admin-brand" to="/admin" @click="sidebarOpen = false">
        <img :src="hero.logo" :alt="hero.title" />
        <span class="admin-brand__text">Admin</span>
      </RouterLink>

      <nav class="admin-nav" aria-label="Admin navigation">
        <div v-for="group in navGroups" :key="group.title" class="admin-nav__group">
          <span class="admin-nav__title">{{ group.title }}</span>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :title="item.label"
            :active-class="item.exact ? 'admin-nav__link--inactive' : 'admin-nav__link--active'"
            exact-active-class="admin-nav__link--active"
            class="admin-nav__link"
            :class="{ 'admin-nav__link--active': item.isActive }"
            @click="sidebarOpen = false"
          >
            <svg class="admin-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                v-for="path in navIcons[item.icon]"
                :key="path"
                :d="path"
              />
            </svg>
            <span class="admin-nav__link-text">{{ item.label }}</span>
            <span v-if="item.badge > 0" class="admin-nav__badge">{{ item.badge }}</span>
          </RouterLink>
        </div>
      </nav>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <button class="admin-menu-button" type="button" @click="sidebarOpen = !sidebarOpen">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="admin-topbar__title">
            <p class="admin-kicker">{{ hero.title }} Operations</p>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 19l-7-7 7-7"></path><path d="M21 12H3"></path></svg>
              <span class="action-text">Site</span>
            </RouterLink>
            <button class="admin-topbar-action-btn admin-topbar-action-btn--danger" type="button" @click="handleLogout" title="Logout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
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
    <ConfirmDialog />
  </div>
</template>
