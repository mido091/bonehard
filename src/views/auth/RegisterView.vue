<!--
  RegisterView.vue  (Route: /register)
  ─────────────────────────────────────────────────────
  The public account registration page with glassmorphic UI.
  Includes the shared site header and footer for visual consistency.

  Fields: name, email, password, phone, address
  On success, sets the user in authState and redirects to the home page.
-->
<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// ── Shared Components ───────────────────────────────
import MobileMenu from '../../components/MobileMenu.vue';
import PublicHeader from '../../components/PublicHeader.vue';
import StatsFooterSection from '../../components/StatsFooterSection.vue';
import { useSiteSettings } from '../../composables/useSiteSettings';
import PhoneInput from '../../components/PhoneInput.vue';
import PasswordInput from '../../components/PasswordInput.vue';

// ── Services & Stores ───────────────────────────────
import { api } from '../../services/api';
import { authState, getDashboardPath } from '../../stores/authStore';
import { isServicesNavigationItem, routeServicesNavigation, safeDashboardRedirect } from '../../utils/publicNavigation';

// ── Static Site Content ─────────────────────────────
import { authItems, navItems } from '../../data/siteContent';

// ── State ────────────────────────────────────────────
const router = useRouter();
const route = useRoute();
const loading = ref(false);
const error = ref('');
const isMenuOpen = ref(false);
const activeNotice = ref('');
const { hero, footer, loadSiteSettings } = useSiteSettings();

loadSiteSettings();

/** Form data model for the registration fields */
const form = reactive({
  name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
});

// ── Menu Helpers ─────────────────────────────────────
function closeMenu() {
  isMenuOpen.value = false;
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

/**
 * Handles navigation events from the shared header and footer.
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

  // Show a temporary "coming soon" toast for placeholder items
  activeNotice.value = `${item.label} will be connected in the next delivery.`;
  window.clearTimeout(window.__boneHardNoticeTimer);
  window.__boneHardNoticeTimer = window.setTimeout(() => {
    activeNotice.value = '';
  }, 2600);
}

// ── Registration Submission ──────────────────────────
/**
 * Registers a new user via the API, then sets the authState
 * and redirects to the home page on success.
 */
async function submitRegister() {
  loading.value = true;
  error.value = '';

  try {
    const response = await api.post('/api/auth/register', form);
    authState.user = response.data.user;
    authState.ready = true;
    localStorage.setItem('bh_auth_ready', 'ok');
    const redirect = safeDashboardRedirect(route.query.redirect);
    router.push(redirect || getDashboardPath(response.data.user));
  } catch (err) {
    error.value = err.message || 'Unable to create account';
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

    <!-- SIGN UP FORM — glassmorphic card on tech-grid background -->
    <main id="main-content" class="auth-page">
      <section class="auth-card" aria-labelledby="register-title">
        <!-- Card Header -->
        <div class="auth-card__header" style="text-align: left; margin-bottom: 1.5rem;">
          <span class="auth-kicker">CREATE ACCOUNT</span>
          <h1 id="register-title" class="auth-title">Sign Up</h1>
        </div>

        <!-- Registration Form -->
        <form class="auth-form" @submit.prevent="submitRegister">
          <label class="auth-field">
            <span class="auth-label">Name</span>
            <input
              class="auth-input auth-input--plain"
              v-model="form.name"
              placeholder="Name"
              autocomplete="name"
              required
              maxlength="160"
            />
          </label>

          <label class="auth-field">
            <span class="auth-label">Email</span>
            <input
              class="auth-input auth-input--plain"
              v-model="form.email"
              type="email"
              placeholder="Email"
              autocomplete="email"
              required
            />
          </label>

          <label class="auth-field">
            <span class="auth-label">Password</span>
            <PasswordInput
              v-model="form.password"
              input-class="auth-input auth-input--plain"
              placeholder="Password"
              autocomplete="new-password"
              required
              minlength="8"
            />
            <p class="auth-muted">Password must include uppercase, lowercase, and a number.</p>
          </label>

          <div class="auth-field">
            <span class="auth-label">Phone</span>
            <PhoneInput
              v-model="form.phone"
              placeholder="50 123 4567"
              id="register-phone"
            />
          </div>

          <label class="auth-field">
            <span class="auth-label">Address</span>
            <input
              class="auth-input auth-input--plain"
              v-model="form.address"
              placeholder="Address"
              autocomplete="street-address"
              maxlength="255"
            />
          </label>

          <!-- Inline error message on failed registration -->
          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

          <button class="auth-submit" type="submit" :disabled="loading">
            {{ loading ? 'Creating account...' : 'Sign Up' }}
          </button>
        </form>

        <!-- Footer link inside the card -->
        <div class="auth-links" style="margin-top: 1rem;">
          <div>
            Already have an account?
            <a href="#" @click.prevent="router.push('/login')">Login</a>
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
