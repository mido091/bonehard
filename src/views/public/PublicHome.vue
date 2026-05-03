<!--
  PublicHome.vue
  ─────────────────────────────────────────────────────
  The main landing page of the BoneHard public website.
  Renders all content sections in sequence:
    Hero → Featured Works → Show Reel → Stats & Footer

  Navigation is handled via a unified handleNavigation function
  that supports section scrolling, route pushes, and "coming soon"
  placeholder notices.
-->
<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// ── Section Components ──────────────────────────────
import FeaturedWorksSection from '../../components/FeaturedWorksSection.vue';
import HeroSection from '../../components/HeroSection.vue';
import MobileMenu from '../../components/MobileMenu.vue';
import PublicHeader from '../../components/PublicHeader.vue';
import ShowReelSection from '../../components/ShowReelSection.vue';
import StatsFooterSection from '../../components/StatsFooterSection.vue';
import { useSiteSettings } from '../../composables/useSiteSettings';

// ── Static Site Content ─────────────────────────────
import {
  authItems,
  featuredWorks,
  heroContent,
  navItems,
  showreelFilters,
  showreelItems,
  statsContent,
} from '../../data/siteContent';

// ── State ────────────────────────────────────────────
const isMenuOpen = ref(false);
const activeNotice = ref(''); // Text shown in the floating "coming soon" toast
const router = useRouter();
const { hero, footer, loadSiteSettings } = useSiteSettings();

// ── Menu Helpers ─────────────────────────────────────
function closeMenu() {
  isMenuOpen.value = false;
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

/**
 * Smooth-scroll to a CSS selector target.
 * Falls back to instant scroll if behavior is 'auto'.
 */
function scrollToTarget(target, behavior = 'smooth') {
  const element = document.querySelector(target);
  if (!element) return;
  element.scrollIntoView({ behavior, block: 'start' });
}

/**
 * Central navigation handler for all nav/auth/footer link items.
 * Supports three item types:
 *   'section'     — smooth scroll to an in-page anchor
 *   'route'       — Vue Router push to a named route path
 *   'placeholder' — shows a temporary "coming soon" toast notice
 */
function handleNavigation(item) {
  if (item.type === 'section') {
    scrollToTarget(item.target);
    closeMenu();
    return;
  }

  if (item.type === 'route') {
    closeMenu();
    router.push(item.target);
    return;
  }

  // Placeholder items show a temporary notice and auto-dismiss after 2.6s
  activeNotice.value = `${item.label} will be connected in the next delivery.`;
  closeMenu();
  window.clearTimeout(window.__boneHardNoticeTimer);
  window.__boneHardNoticeTimer = window.setTimeout(() => {
    activeNotice.value = '';
  }, 2600);
}

// ── Lifecycle ────────────────────────────────────────
onMounted(async () => {
  await loadSiteSettings();
  await nextTick();
  // Handle initial hash navigation after Vue mounts the section anchor targets
  if (window.location.hash) {
    scrollToTarget(window.location.hash, 'auto');
  }
});
</script>

<template>
  <div class="site-shell">
    <!-- Scroll anchor targets used by the in-page navigation -->
    <a id="top" class="scroll-anchor" href="#hero" aria-hidden="true"></a>
    <div id="order-coming-soon" class="scroll-anchor" aria-hidden="true"></div>
    <div id="social-coming-soon" class="scroll-anchor" aria-hidden="true"></div>

    <!-- Shared site header (extracted from 4 duplicate copies) -->
    <PublicHeader
      :nav-items="navItems"
      :auth-items="authItems"
      :logo="hero.logo"
      :is-menu-open="isMenuOpen"
      @navigate="handleNavigation"
      @toggle-menu="toggleMenu"
    />

    <!-- Mobile slide-in menu (shown on screens < 1024px) -->
    <MobileMenu
      :open="isMenuOpen"
      :nav-items="navItems"
      :auth-items="authItems"
      :logo="hero.logo"
      @close="closeMenu"
      @navigate="handleNavigation"
    />

    <!-- Page Content Sections -->
    <main id="main-content">
      <HeroSection :content="hero" @navigate="handleNavigation" />
      <FeaturedWorksSection :items="featuredWorks" />
      <ShowReelSection :filters="showreelFilters" :items="showreelItems" />
      <StatsFooterSection :content="footer" @navigate="handleNavigation" />
    </main>

    <!-- "Coming Soon" floating toast notification -->
    <div
      v-if="activeNotice"
      class="floating-notice"
      role="status"
      aria-live="polite"
    >
      {{ activeNotice }}
    </div>
  </div>
</template>
