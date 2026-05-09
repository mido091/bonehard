<!--
  LoginView.vue  (Route: /login)
  ─────────────────────────────────────────────────────
  The public login page with glassmorphic UI.
  Includes the shared site header and footer for visual consistency.

  Features:
  • Email + password fields with inline SVG icons
  • Show/hide password toggle
  • Redirects to /admin (or the requested redirect path) on success
  • Displays inline error message on failed login
-->
<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// ── Shared Components ───────────────────────────────
import MobileMenu from '../../components/MobileMenu.vue';
import PublicHeader from '../../components/PublicHeader.vue';
import StatsFooterSection from '../../components/StatsFooterSection.vue';
import { useSiteSettings } from '../../composables/useSiteSettings';

// ── Auth Store ───────────────────────────────────────
import { getDashboardPath, login } from '../../stores/authStore';
import { isServicesNavigationItem, routeServicesNavigation, safeDashboardRedirect } from '../../utils/publicNavigation';

// ── Static Site Content ─────────────────────────────
import { authItems, navItems } from '../../data/siteContent';

// ── State ────────────────────────────────────────────
const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const showPassword = ref(false); // Toggles password field visibility
const isMenuOpen = ref(false);
const activeNotice = ref('');
const { hero, footer, loadSiteSettings } = useSiteSettings();

loadSiteSettings();

function resolveLoginRedirect(user) {
  const redirect = route.query.redirect;
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return getDashboardPath(user);
  }

  if (user.role === 'user') return safeDashboardRedirect(redirect) || '/dashboard';
  if (user.role === 'assistant' && (redirect.startsWith('/admin/users') || redirect.startsWith('/admin/cases/settings') || redirect.startsWith('/admin/settings'))) {
    return '/admin';
  }

  return ['admin', 'assistant'].includes(user.role) && redirect.startsWith('/admin') ? redirect : getDashboardPath(user);
}

// ── Menu Helpers ─────────────────────────────────────
function closeMenu() {
  isMenuOpen.value = false;
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

/**
 * Handles navigation events from the shared header and footer.
 * Section-type items push a hash route; route items use router.push.
 */
async function handleNavigation(item) {
  closeMenu();

  if (isServicesNavigationItem(item)) {
    await routeServicesNavigation(router);
    return;
  }

  if (item.type === 'section') {
    router.push('/' + item.target);
    return;
  }

  if (item.type === 'route') {
    router.push(item.target);
    return;
  }

  // Show a temporary toast for placeholder items
  activeNotice.value = `${item.label} will be connected in the next delivery.`;
  window.clearTimeout(window.__boneHardNoticeTimer);
  window.__boneHardNoticeTimer = window.setTimeout(() => {
    activeNotice.value = '';
  }, 2600);
}

// ── Login Submission ─────────────────────────────────
/**
 * Attempts authentication via the authStore login function.
 * On success, redirects to /admin (or the originally requested route
 * if the user was redirected here from a protected page).
 */
async function submitLogin() {
  loading.value = true;
  error.value = '';

  try {
    const user = await login(email.value, password.value);
    router.push(resolveLoginRedirect(user));
  } catch (err) {
    error.value = err.message || 'Unable to sign in';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="site-shell">
    <!-- Shared site header -->
    <PublicHeader
      :nav-items="navItems"
      :auth-items="authItems"
      :logo="hero.logo"
      :is-menu-open="isMenuOpen"
      @navigate="handleNavigation"
      @toggle-menu="toggleMenu"
    />

    <!-- Mobile slide-in menu -->
    <MobileMenu
      :open="isMenuOpen"
      :nav-items="navItems"
      :auth-items="authItems"
      :logo="hero.logo"
      @close="closeMenu"
      @navigate="handleNavigation"
    />

    <!-- LOGIN FORM — glassmorphic card on tech-grid background -->
    <main id="main-content" class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <!-- Card Header with logo -->
        <div class="auth-card__header">
          <img
            class="auth-card__logo"
            :src="hero.logo"
            :alt="hero.title"
            width="180"
            height="70"
          />
          <h1 id="login-title" class="auth-title">SECURE LOGIN</h1>
        </div>

        <!-- Login Form -->
        <form class="auth-form" @submit.prevent="submitLogin">
          <!-- Email field with envelope icon -->
          <label class="auth-field">
            <span class="auth-label">Email</span>
            <div class="auth-input-wrapper">
              <svg class="auth-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                class="auth-input"
                v-model="email"
                type="email"
                placeholder="Enter your email here"
                autocomplete="email"
                required
              />
            </div>
          </label>

          <!-- Password field with lock icon and show/hide toggle -->
          <label class="auth-field">
            <span class="auth-label">Password</span>
            <div class="auth-input-wrapper">
              <svg class="auth-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                class="auth-input"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                required
                minlength="8"
              />
              <!-- Eye icon: toggle password visibility -->
              <svg
                class="auth-icon-right"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-label="Toggle password visibility"
                role="button"
                tabindex="0"
                @click="showPassword = !showPassword"
                @keydown.enter.prevent="showPassword = !showPassword"
              >
                <path v-if="!showPassword" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle v-if="!showPassword" cx="12" cy="12" r="3" />
                <path v-if="showPassword" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line v-if="showPassword" x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </div>
          </label>

          <!-- Inline error message on failed login -->
          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

          <button class="auth-submit" type="submit" :disabled="loading">
            {{ loading ? 'Signing in...' : 'LOGIN' }}
          </button>
        </form>

        <!-- Footer links inside the card -->
        <div class="auth-links">
          <RouterLink to="/forgot-password">Forgot password?</RouterLink>
          <div>
            Don't have an account?
            <a href="#" @click.prevent="router.push('/register')">Sign Up</a>
          </div>
        </div>
      </section>
    </main>

    <!-- Site Footer (stats hidden on this page) -->
    <StatsFooterSection :content="footer" :hide-stats="true" @navigate="handleNavigation" />

    <!-- "Coming Soon" floating toast notification -->
    <div v-if="activeNotice" class="floating-notice" role="status" aria-live="polite">
      {{ activeNotice }}
    </div>
  </div>
</template>
