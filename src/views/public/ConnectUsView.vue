<!--
  ConnectUsView.vue  (Route: /connect)
  ─────────────────────────────────────────────────────
  The public case submission form — formerly named OrderView.vue.
  Allows doctors/clients to send a case inquiry with:
    - Contact details (name, phone, email)
    - Scope of work (custom dropdown)
    - File link (Swiss Transfer or similar)

  On success, shows a confirmation state replacing the form.
  On error, displays the server error message inline.
-->
<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

// ── Shared Components ───────────────────────────────
import MobileMenu from '../../components/MobileMenu.vue';
import PublicHeader from '../../components/PublicHeader.vue';
import StatsFooterSection from '../../components/StatsFooterSection.vue';
import { useSiteSettings } from '../../composables/useSiteSettings';
import PhoneInput from '../../components/PhoneInput.vue';

// ── Services & Stores ───────────────────────────────
import { api } from '../../services/api';
import { openLogoutModal } from '../../stores/authStore';
import { isServicesNavigationItem, routeServicesNavigation } from '../../utils/publicNavigation';

// ── Static Site Content ─────────────────────────────
import { authItems, navItems } from '../../data/siteContent';

// ── State ────────────────────────────────────────────
const router = useRouter();
const loading = ref(false);
const success = ref(false);   // Controls form vs. success state display
const errorMsg = ref('');
const isMenuOpen = ref(false);
const activeNotice = ref('');
const isDropdownOpen = ref(false);
const dropdownRef = ref(null); // Used to detect outside-click on the custom dropdown

/** Form data model bound to the submission form */
const form = reactive({
  contactName: '',
  contactNumber: '',
  contactEmail: '',
  scopeOfWork: '',
  message: '',
  fileLink: '',
});
const { hero, footer, loadSiteSettings } = useSiteSettings();

/** Available scope options rendered in the custom dropdown */
const scopeOptions = [
  'Surgical Guides',
  'Prothesis',
  'Education',
  'Other',
];

// ── Dropdown Outside-Click Handler ───────────────────
/**
 * Closes the custom scope dropdown when the user clicks
 * anywhere outside the dropdown element.
 */
function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  loadSiteSettings();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// ── Menu Helpers ─────────────────────────────────────
function closeMenu() {
  isMenuOpen.value = false;
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

/**
 * Handles all navigation events from the header and footer.
 * Section-type items attempt a hash-route push; route items use router.push.
 */
async function handleNavigation(item) {
  closeMenu();

  if (isServicesNavigationItem(item)) {
    await routeServicesNavigation(router);
    return;
  }

  if (item.type === 'section') {
    // Navigate to the home page with the section hash — the home page handles scrolling
    router.push('/' + item.target);
    return;
  }

  if (item.type === 'route') {
    router.push(item.target);
    return;
  }

  // Placeholder items show a temporary "coming soon" toast
  activeNotice.value = `${item.label} will be connected in the next delivery.`;
  window.clearTimeout(window.__boneHardNoticeTimer);
  window.__boneHardNoticeTimer = window.setTimeout(() => {
    activeNotice.value = '';
  }, 2600);
}

// ── Form Submission ──────────────────────────────────
/**
 * Submits the case inquiry form to the backend API.
 * Uses the native fetch API to post form data as JSON.
 * On success, toggles the success display state.
 */
async function handleSubmit() {
  errorMsg.value = '';
  loading.value = true;

  try {
    await api.post('/api/contact-submissions', form);
    success.value = true;
  } catch (err) {
    errorMsg.value = err.message;
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

    <!-- MAIN FORM SECTION -->
    <main id="main-content" class="order-page">
      <div class="order-page__content">
        <div class="order-card">

          <!-- ── Success State ─── -->
          <div v-if="success" class="order-card__success">
            <div class="order-card__success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 class="order-card__success-title">Request Sent!</h2>
            <p class="order-card__success-body">
              We've received your case request and will get back to you shortly.
            </p>
            <button class="order-submit" type="button" @click="router.push('/')">
              Back to Home
            </button>
          </div>

          <!-- ── Form State ─── -->
          <template v-else>
            <div class="order-card__header">
              <h1 class="order-card__title">Upload Your Case</h1>
            </div>

            <form class="order-form" @submit.prevent="handleSubmit" novalidate>
              <!-- Row 1: Name + Phone -->
              <div class="order-form__row">
                <div class="order-form__group">
                  <label class="order-form__label" for="contactName">Contact Name*</label>
                  <input
                    id="contactName"
                    v-model="form.contactName"
                    class="order-form__input"
                    type="text"
                    placeholder="Full Name"
                    required
                    autocomplete="name"
                  />
                </div>

                <div class="order-form__group">
                  <label class="order-form__label" for="contactNumber">Contact Number*</label>
                  <PhoneInput
                    id="contactNumber"
                    v-model="form.contactNumber"
                    placeholder="50 000 0000"
                    :required="true"
                  />
                </div>
              </div>

              <!-- Row 2: Email + Scope of Work Dropdown -->
              <div class="order-form__row">
                <div class="order-form__group">
                  <label class="order-form__label" for="contactEmail">Contact Email*</label>
                  <input
                    id="contactEmail"
                    v-model="form.contactEmail"
                    class="order-form__input"
                    type="email"
                    placeholder="example@email.com"
                    required
                    autocomplete="email"
                  />
                </div>

                <!-- Custom styled dropdown for scope selection -->
                <div class="order-form__group" ref="dropdownRef">
                  <label class="order-form__label" for="scopeOfWork">Scope of work*</label>
                  <div
                    class="order-form__input custom-select"
                    :class="{ 'custom-select--open': isDropdownOpen }"
                    tabindex="0"
                    role="combobox"
                    aria-haspopup="listbox"
                    :aria-expanded="isDropdownOpen"
                    @click="isDropdownOpen = !isDropdownOpen"
                    @keydown.enter.prevent="isDropdownOpen = !isDropdownOpen"
                    @keydown.space.prevent="isDropdownOpen = !isDropdownOpen"
                  >
                    <span :class="{ 'custom-select__placeholder': !form.scopeOfWork }">
                      {{ form.scopeOfWork || 'Scope' }}
                    </span>
                    <svg class="custom-select__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>

                  <transition name="dropdown">
                    <ul v-if="isDropdownOpen" class="custom-select__menu" role="listbox">
                      <li
                        class="custom-select__option"
                        :class="{ 'custom-select__option--selected': form.scopeOfWork === '' }"
                        role="option"
                        :aria-selected="form.scopeOfWork === ''"
                        @click="form.scopeOfWork = ''; isDropdownOpen = false"
                      >
                        Scope
                      </li>
                      <li
                        v-for="opt in scopeOptions"
                        :key="opt"
                        class="custom-select__option"
                        :class="{ 'custom-select__option--selected': form.scopeOfWork === opt }"
                        role="option"
                        :aria-selected="form.scopeOfWork === opt"
                        @click="form.scopeOfWork = opt; isDropdownOpen = false"
                      >
                        {{ opt }}
                      </li>
                    </ul>
                  </transition>
                </div>
              </div>

              <!-- File Link Textarea -->
              <div class="order-form__group">
                <label class="order-form__label" for="message">Message</label>
                <textarea
                  id="message"
                  v-model="form.message"
                  class="order-form__input order-form__textarea"
                  placeholder="Tell us more about your case"
                  rows="3"
                ></textarea>
              </div>

              <div class="order-form__group">
                <label class="order-form__label" for="fileLink">Link For Swiss Transfer Files</label>
                <textarea
                  id="fileLink"
                  v-model="form.fileLink"
                  class="order-form__input order-form__textarea"
                  placeholder="Your Link"
                  rows="3"
                ></textarea>
              </div>

              <!-- Inline error message -->
              <p v-if="errorMsg" class="order-form__error">{{ errorMsg }}</p>

              <!-- Submit button — disabled until required fields are filled -->
              <button
                class="order-submit"
                type="submit"
                :disabled="loading || !form.contactName || !form.contactNumber || !form.contactEmail || !form.scopeOfWork"
              >
                <span v-if="loading" class="order-submit__spinner"></span>
                <span v-else>SEND MESSAGE</span>
              </button>
            </form>
          </template>

        </div>
      </div>
    </main>

    <!-- Site Footer (stats hidden on this page) -->
    <StatsFooterSection :content="footer" :hide-stats="true" @navigate="handleNavigation" />

    <!-- "Coming Soon" floating toast notification -->
    <div v-if="activeNotice" class="floating-notice" role="status" aria-live="polite">
      {{ activeNotice }}
    </div>
  </div>
</template>
