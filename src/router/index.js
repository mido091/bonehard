/**
 * router/index.js
 * ─────────────────────────────────────────────────────
 * Vue Router configuration for the BoneHard application.
 *
 * Route groups:
 *   Public   — '/', '/connect'
 *   Auth     — '/login', '/register'  (publicOnly: redirects to dashboard if already logged in)
 *   Admin    — '/admin/**'            (requiresAdmin: guards with role check)
 *
 * Navigation guard runs before every route change to:
 *   1. Set the page <title> and robots meta tag
 *   2. Load the current user from the server if not yet checked
 *   3. Enforce admin-only and guest-only route restrictions
 *
 * All admin routes use lazy-loading (dynamic import) to keep the
 * initial bundle small — admin views are only downloaded when accessed.
 */
import { createRouter, createWebHistory } from 'vue-router';
import {
  canAccessAdmin,
  getDashboardPath,
  isAdmin,
  isAuthenticated,
  isUser,
  loadCurrentUser,
} from '../stores/authStore';

// ── Eagerly loaded views (always needed on first visit) ──
import PublicHome from '../views/public/PublicHome.vue';
import LoginView from '../views/auth/LoginView.vue';
import RegisterView from '../views/auth/RegisterView.vue';
import ForgotPasswordView from '../views/auth/ForgotPasswordView.vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import UserLayout from '../layouts/UserLayout.vue';

// ── Lazily loaded admin views (split into separate chunks) ──
const DashboardView    = () => import('../views/admin/DashboardView.vue');
const CasesListView    = () => import('../views/admin/CasesListView.vue');
const CaseFormView     = () => import('../views/admin/CaseFormView.vue');
const CaseDetailView   = () => import('../views/admin/CaseDetailView.vue');
const CaseTasksView    = () => import('../views/admin/CaseTasksView.vue');
const CaseKanbanView   = () => import('../views/admin/CaseKanbanView.vue');
const CasePhasesView   = () => import('../views/admin/CasePhasesView.vue');
const CaseCalendarView = () => import('../views/admin/CaseCalendarView.vue');
const CaseResourceView = () => import('../views/admin/CaseResourceView.vue');
const CasesWorkspaceView = () => import('../views/admin/CasesWorkspaceView.vue');
const ChatsView        = () => import('../views/admin/ChatsView.vue');
const ChatDirectoryView = () => import('../views/admin/ChatDirectoryView.vue');
const UsersView        = () => import('../views/admin/UsersView.vue');
const AssistantsView   = () => import('../views/admin/AssistantsView.vue');
const OrdersView       = () => import('../views/admin/OrdersView.vue');
const OrdersManageView = () => import('../views/admin/OrdersManageView.vue');
const UserOrdersManageView = () => import('../views/admin/UserOrdersManageView.vue');
const AdminUserOrderDetailView = () => import('../views/admin/AdminUserOrderDetailView.vue');
const TemplatesView    = () => import('../views/admin/TemplatesView.vue');
const SettingsView     = () => import('../views/admin/SettingsView.vue');
const MessagesView     = () => import('../views/admin/MessagesView.vue');
const UserReportsView  = () => import('../views/admin/UserReportsView.vue');
const PaymentsView     = () => import('../views/admin/PaymentsView.vue');
const ConnectUsView    = () => import('../views/public/ConnectUsView.vue');
const UserDashboardView = () => import('../views/user/UserDashboardView.vue');
const UserOrdersView   = () => import('../views/user/UserOrdersView.vue');
const UserOrderFormView = () => import('../views/user/UserOrderFormView.vue');
const UserOrderDetailView = () => import('../views/user/UserOrderDetailView.vue');
const UserOrderLibraryView = () => import('../views/user/UserOrderLibraryView.vue');
const UserChatOfferView = () => import('../views/user/UserChatOfferView.vue');


const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Public Routes ─────────────────────────────────
    {
      path: '/',
      name: 'home',
      component: PublicHome,
      meta: {
        title: 'BoneHard | Digital Surgical Guides and Prosthetics',
        description: 'BoneHard delivers precision digital surgical guides and custom prosthetics for dental professionals in Dubai, UAE and across the GCC.',
      },
    },
    {
      path: '/connect',
      name: 'connect',
      component: ConnectUsView,
      meta: {
        title: 'Connect With Us | BoneHard',
        description: 'Upload your case and connect with the BoneHard team. We specialize in surgical guides, prosthetics, and more.',
      },
    },

    // ── Auth Routes (redirect to dashboard if already logged in) ──
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        publicOnly: true,
        title: 'Login | BoneHard',
        description: 'Sign in to your BoneHard account.',
      },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: {
        publicOnly: true,
        title: 'Create Account | BoneHard',
        description: 'Create a new BoneHard account to manage your cases.',
      },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: {
        publicOnly: true,
        title: 'Reset Password | BoneHard',
        description: 'Reset your BoneHard account password via email OTP.',
      },
    },

    {
      path: '/dashboard',
      name: 'user-dashboard',
      component: UserLayout,
      meta: {
        requiresUser: true,
        title: 'Dashboard | BoneHard',
        description: 'Your BoneHard account dashboard.',
      },
      children: [
        { path: '', name: 'user-dashboard-home', component: UserDashboardView },
        {
          path: 'orders',
          name: 'user-orders',
          component: UserOrdersView,
          meta: {
            title: 'Orders | BoneHard',
            description: 'View your BoneHard orders.',
          },
        },
        {
          path: 'orders/files',
          name: 'user-order-files',
          component: UserOrderLibraryView,
          meta: {
            title: 'Order Files | BoneHard',
            description: 'View files attached to your BoneHard orders.',
          },
        },
        {
          path: 'orders/notes',
          name: 'user-order-notes',
          component: UserOrderLibraryView,
          meta: {
            title: 'Order Notes | BoneHard',
            description: 'View notes attached to your BoneHard orders.',
          },
        },
        {
          path: 'orders/new',
          name: 'user-order-new',
          component: UserOrderFormView,
          meta: {
            title: 'Add Order | BoneHard',
            description: 'Submit a new BoneHard order.',
          },
        },
        {
          path: 'orders/:id',
          name: 'user-order-detail',
          component: UserOrderDetailView,
          meta: {
            title: 'Order Details | BoneHard',
            description: 'View your BoneHard order details.',
          },
        },
        {
          path: 'orders/:id/edit',
          name: 'user-order-edit',
          component: UserOrderFormView,
          meta: {
            title: 'Edit Order | BoneHard',
            description: 'Edit your BoneHard order.',
          },
        },
        {
          path: 'chats/offer',
          name: 'user-chat-offer',
          component: UserChatOfferView,
          meta: {
            title: 'Quick Free Consultations | BoneHard',
            description: 'Start a free limited-time consultation with the BoneHard team.',
          },
        },
        {
          path: 'chats',
          name: 'user-chats',
          component: ChatsView,
          meta: {
            title: 'Chats | BoneHard',
            description: 'Chat with the BoneHard team.',
          },
        },
      ],
    },

    // ── Admin Routes (requires admin or assistant role) ──
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAdmin: true, title: 'BoneHard Admin' },
      children: [
        { path: '', name: 'admin-dashboard', component: DashboardView },

        // Cases — static sub-routes MUST come before dynamic :id routes
        { path: 'cases', name: 'cases-list', component: CasesListView },
        { path: 'cases/new', name: 'cases-new', component: CaseFormView },
        { path: 'cases/tasks/my', name: 'cases-my-tasks', component: CasesWorkspaceView, meta: { workspace: 'myTasks' } },
        { path: 'cases/tasks/all', name: 'cases-all-tasks', component: CasesWorkspaceView, meta: { workspace: 'allTasks' } },
        { path: 'cases/generators', name: 'cases-generators', component: CasesWorkspaceView, meta: { workspace: 'generators' } },
        { path: 'cases/calendar', name: 'cases-calendar-global', component: CasesWorkspaceView, meta: { workspace: 'calendar' } },
        { path: 'cases/orders', name: 'case-orders', component: OrdersView },
        { path: 'cases/files', name: 'cases-files-global', component: CasesWorkspaceView, meta: { workspace: 'files' } },
        { path: 'cases/notes', name: 'cases-notes-global', component: CasesWorkspaceView, meta: { workspace: 'notes' } },
        { path: 'cases/timers', name: 'cases-timers-global', component: CasesWorkspaceView, meta: { workspace: 'timers' } },
        { path: 'cases/archive', name: 'cases-archive', component: CasesWorkspaceView, meta: { workspace: 'archive' } },
        { path: 'cases/notes-export', name: 'cases-notes-export-global', component: CasesWorkspaceView, meta: { workspace: 'notesExport' } },
        { path: 'cases/templates', name: 'case-templates', component: TemplatesView },
        { path: 'settings', name: 'admin-settings', component: SettingsView, meta: { adminOnly: true } },
        { path: 'cases/settings', redirect: '/admin/settings' },
        { path: 'user-orders', name: 'admin-user-orders', component: UserOrdersManageView },
        { path: 'user-orders/:id', name: 'admin-user-order-detail', component: AdminUserOrderDetailView, props: true },

        // Cases — dynamic :id routes (must be after static routes)
        { path: 'cases/:id', name: 'case-detail', component: CaseDetailView, props: true },
        { path: 'cases/:id/edit', name: 'case-edit', component: CaseFormView, props: true },
        { path: 'cases/:id/tasks', name: 'case-tasks', component: CaseTasksView, props: true },
        { path: 'cases/:id/kanban', name: 'case-kanban', component: CaseKanbanView, props: true },
        { path: 'cases/:id/phases', name: 'case-phases', component: CasePhasesView, props: true },
        { path: 'cases/:id/calendar', name: 'case-calendar', component: CaseCalendarView, props: true },
        { path: 'cases/:id/timers', name: 'case-timers', component: CaseResourceView, props: true, meta: { resource: 'timers' } },
        { path: 'cases/:id/files', name: 'case-files', component: CaseResourceView, props: true, meta: { resource: 'files' } },
        { path: 'cases/:id/notes', name: 'case-notes', component: CaseResourceView, props: true, meta: { resource: 'notes' } },
        { path: 'cases/:id/general-notes', name: 'case-general-notes', component: CaseResourceView, props: true, meta: { resource: 'generalNotes' } },
        { path: 'cases/:id/notes-export', name: 'case-notes-export', component: CaseResourceView, props: true, meta: { resource: 'notesExport' } },
        { path: 'cases/:id/client-talk', name: 'case-client-talk', component: CaseResourceView, props: true, meta: { resource: 'clientTalk' } },
        { path: 'cases/:id/settings', name: 'case-settings', component: CaseResourceView, props: true, meta: { resource: 'settings', adminOnly: true } },

        // Other admin sections
        { path: 'chats', name: 'admin-chats', component: ChatsView },
        { path: 'chats/users', name: 'admin-chat-users', component: ChatDirectoryView },
        { path: 'chats/assistants', name: 'admin-chat-assistants', component: ChatDirectoryView },
        { path: 'chats/groups', name: 'admin-chat-groups', component: ChatDirectoryView },
        { path: 'users', name: 'admin-users', component: UsersView, meta: { adminOnly: true } },
        { path: 'users/:id/reports', name: 'user-reports', component: UserReportsView, props: true, meta: { adminOnly: true } },
        { path: 'assistants', name: 'admin-assistants', component: AssistantsView, meta: { adminOnly: true } },
        { path: 'notifications', redirect: '/admin' },
        { path: 'messages', name: 'admin-messages', component: MessagesView },
        { path: 'payments', name: 'admin-payments', component: PaymentsView },
        { path: 'orders', name: 'admin-orders-manage', component: OrdersManageView },
      ],

    },

    // ── Catch-all — redirect unknown paths to home ──
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],

  // Always scroll to top on route change
  scrollBehavior() {
    return { top: 0 };
  },
});

// ── Helpers ───────────────────────────────────────────
/**
 * Sets or updates the <meta name="robots"> tag in the document head.
 * Admin and auth pages are excluded from search engine indexing.
 */
function setRobotsMeta(content) {
  let tag = document.querySelector('meta[name="robots"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'robots');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Sets or updates the <meta name="description"> tag in the document head.
 * Called per-route to ensure each page has a unique, relevant description.
 */
function setDescriptionMeta(content) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function isSafeInternalRedirect(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

function canUseRedirect(path) {
  if (!isSafeInternalRedirect(path)) return false;
  if (isUser()) return path.startsWith('/dashboard');
  if (!isAdmin() && (path.startsWith('/admin/users') || path.startsWith('/admin/cases/settings') || path.startsWith('/admin/settings'))) {
    return false;
  }
  return canAccessAdmin() ? path.startsWith('/admin') || path === '/' : false;
}

function resolveAuthRedirect(to) {
  const redirect = to.query.redirect;
  return canUseRedirect(redirect) ? redirect : getDashboardPath();
}

// ── Global Navigation Guard ───────────────────────────
router.beforeEach(async (to) => {
  const isAdminRoute = to.path.startsWith('/admin');
  const isUserRoute = to.path.startsWith('/dashboard');
  const isAuthRoute  = to.path.startsWith('/login') || to.path.startsWith('/register') || to.path.startsWith('/forgot-password');
  const isPrivate    = isAdminRoute || isUserRoute || isAuthRoute;

  // Update page title from route meta, with a safe fallback
  document.title = to.meta.title || 'BoneHard';

  // Update meta description if defined on the route
  if (to.meta.description) {
    setDescriptionMeta(to.meta.description);
  }

  // Prevent search engines from indexing admin and auth pages
  setRobotsMeta(isPrivate ? 'noindex,nofollow' : 'index,follow');

  // Auth/private routes verify the server cookie instead of trusting a local hint.
  if (isPrivate) {
    await loadCurrentUser({ force: true });
  } else if (!isAuthenticated()) {
    await loadCurrentUser();
  }

  // Block access to admin routes if the user doesn't have a valid role
  if (to.meta.requiresAdmin && !canAccessAdmin()) {
    return isAuthenticated() ? getDashboardPath() : { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.adminOnly && !isAdmin()) {
    return isAuthenticated() ? { name: 'admin-dashboard' } : { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresUser && !isUser()) {
    return isAuthenticated() ? getDashboardPath() : { name: 'login', query: { redirect: to.fullPath } };
  }

  // Redirect already-authenticated users away from login/register
  if (to.meta.publicOnly && isAuthenticated()) {
    return resolveAuthRedirect(to);
  }

  return true;
});

export default router;
