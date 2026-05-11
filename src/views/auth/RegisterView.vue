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
const showPrivacyModal = ref(false);
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

          <label class="auth-checkbox">
            <input type="checkbox" required />
            <span>
              I agree to the processing of my data according to BoneHard's 
              <button type="button" class="auth-text-link" @click.prevent="showPrivacyModal = true">privacy policy</button>.
            </span>
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

    <!-- Privacy Policy Modal -->
    <Teleport to="body">
      <div v-if="showPrivacyModal" class="modal-backdrop" @click.self="showPrivacyModal = false">
        <div class="modal custom-modal-content privacy-modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <h3>Privacy Policy</h3>
            <button class="auth-close-button" type="button" @click="showPrivacyModal = false">Close</button>
          </header>
          <div class="modal__body privacy-modal-body">
            <h4>1. Clinical Responsibility & Treatment Planning</h4>
            <p>The prescribing clinician maintains sole and absolute responsibility for the comprehensive treatment plan. This includes, but is not limited to:</p>
            <ul>
              <li>The final determination of implant positions, depths, and angulations.</li>
              <li>The diagnosis and suitability of the patient for the proposed surgical intervention.</li>
              <li>The verification of the guide’s fit and accuracy against the patient’s clinical presentation prior to use.</li>
            </ul>

            <h4>2. Limitation of Liability</h4>
            <p>Bone Hard Inc. serves as a manufacturer following clinician-approved specifications. Consequently:</p>
            <ul>
              <li><strong>Outcome Disclaimer:</strong> Bone Hard Inc. disclaims all liability for clinical outcomes, complications, or suboptimal results arising from the surgical procedure.</li>
              <li><strong>Manufacturing Warranty:</strong> Our liability is strictly limited to ensuring the guide is manufactured in accordance with the treatment plan approved by the clinician.</li>
              <li><strong>Component Selection:</strong> Responsibility for the selection, quality, and performance of the dental implants used rests exclusively with the clinician and their chosen implant supplier.</li>
            </ul>

            <h4>3. Professional Discretion & Freehand Proficiency</h4>
            <p>While the surgical guide is a high-precision instrument designed to enhance accuracy, it is not a substitute for clinical judgment.</p>
            <ul>
              <li><strong>Freehand Contingency:</strong> It is strongly recommended that clinicians are proficient in freehand implant surgery. The clinician may, at any point during the procedure, elect to deviate from or abandon the use of the guide based on their professional judgment.</li>
              <li><strong>Custom Product Billing:</strong> Because the surgical guide is a bespoke, patient-specific product manufactured to unique specifications, all service and production fees remain fully billable regardless of whether the guide is utilized during the final surgery.</li>
            </ul>

            <h4>4. Indemnification</h4>
            <p>By utilizing this custom surgical guide, the practitioner agrees to indemnify, defend, and hold Bone Hard Inc. harmless from any claims, damages, liabilities, or legal expenses resulting from the clinical application of the guide or the associated surgical procedure.</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.auth-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 1.5rem 0;
  text-align: left;
  cursor: pointer;
}

.auth-checkbox input {
  margin-top: 0.25rem;
  width: 1.1rem;
  height: 1.1rem;
  accent-color: #f8d9aa;
  cursor: pointer;
}

.auth-checkbox span {
  font-size: 0.85rem;
  color: rgba(var(--rgb-foreground), 0.8);
  line-height: 1.5;
}

.auth-text-link {
  background: none;
  border: none;
  padding: 0;
  color: #f8d9aa;
  text-decoration: underline;
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
}

.auth-text-link:hover {
  color: #fbbf24;
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--rgb-background), 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  z-index: 9999;
  padding: 1rem;
}

.custom-modal-content {
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border, #333);
  border-radius: 14px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  position: relative;
  margin: auto;
  flex-shrink: 0;
}

.modal__header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border, #333);
  flex-shrink: 0;
}

.modal__header h3 {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 1.25rem;
  line-height: 1.3;
}

.auth-close-button {
  background: rgba(var(--rgb-foreground), 0.05);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  color: var(--color-text-strong);
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.auth-close-button:hover {
  background: rgba(var(--rgb-foreground), 0.1);
  border-color: rgba(var(--rgb-foreground), 0.2);
}

.privacy-modal {
  max-width: 700px;
  width: 100%;
}

.privacy-modal-body {
  padding: 1.5rem;
  text-align: left;
  line-height: 1.6;
  max-height: 65vh;
  overflow-y: auto;
  color: rgba(var(--rgb-foreground), 0.85);
}

.privacy-modal-body h4 {
  margin: 1.5rem 0 0.5rem;
  color: var(--color-text-strong);
  font-size: 1.05rem;
}

.privacy-modal-body h4:first-child {
  margin-top: 0;
}

.privacy-modal-body ul {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.privacy-modal-body li {
  margin-bottom: 0.4rem;
}
</style>
