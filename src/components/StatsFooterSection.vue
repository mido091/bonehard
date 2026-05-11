<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import SectionTitle from './SectionTitle.vue';

const props = defineProps({
  content: {
    type: Object,
    required: true,
  },
  hideStats: {
    type: Boolean,
    default: false,
  }
});

const emit = defineEmits(['navigate']);

const statsSection = ref(null);
const animatedStats = ref([]);

function initializeStats() {
  animatedStats.value = props.content.stats.map(stat => ({
    ...stat,
    currentValue: 0,
    targetValue: parseInt(stat.value.replace(/,/g, ''), 10) || 0,
    suffix: stat.value.replace(/[0-9,]/g, ''),
    isCounting: false
  }));
}

// Initialize on component creation
initializeStats();

// Watch for prop changes to re-initialize if content changes
watch(() => props.content.stats, initializeStats, { deep: true });

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

function handleSocialClick(account) {
  if (account.type === 'whatsapp') {
    let url = account.target;
    if (!url.startsWith('http')) {
      const phone = url.replace(/[^\d+]/g, '').replace('+', '');
      url = `https://wa.me/${phone}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (account.type === 'url') {
    window.open(account.target, '_blank', 'noopener,noreferrer');
    return;
  }
  emit('navigate', account);
}

function startCounting() {
  animatedStats.value.forEach(stat => {
    if (stat.isCounting) return;
    stat.isCounting = true;
    
    const duration = 2000;
    const fps = 60;
    const totalFrames = Math.round((duration / 1000) * fps);
    let frame = 0;
    
    const easeOutQuad = t => t * (2 - t);
    
    const counter = setInterval(() => {
      frame++;
      const progress = easeOutQuad(frame / totalFrames);
      stat.currentValue = Math.round(stat.targetValue * progress);
      
      if (frame >= totalFrames) {
        clearInterval(counter);
        stat.currentValue = stat.targetValue;
      }
    }, 1000 / fps);
  });
}

let observer;

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      startCounting();
      observer.disconnect();
    }
  }, { threshold: 0.3 }); // Trigger when 30% of the section is visible
  
  if (statsSection.value) {
    observer.observe(statsSection.value);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<template>
  <section id="numbers" class="content-section stats-footer">
    <template v-if="!hideStats">
      <SectionTitle :title="`${content.siteName || 'BoneHard'} In Numbers`" />

      <div class="stats-footer__stats" aria-label="Company statistics" ref="statsSection">
        <div
          v-for="stat in animatedStats"
          :key="stat.label"
          class="stats-footer__stat"
        >
          <strong class="stats-footer__value">{{ formatNumber(stat.currentValue) }}<span class="stats-footer__suffix">{{ stat.suffix }}</span></strong>
          <span class="stats-footer__text">{{ stat.label }}</span>
        </div>
      </div>
    </template>

    <div class="stats-footer__lower">
      <div class="stats-footer__column stats-footer__column--pages">
        <h3 class="footer-heading">Pages</h3>
        <div class="footer-links">
          <button
            v-for="page in content.pages"
            :key="page.label"
            class="footer-links__item"
            type="button"
            @click="emit('navigate', page)"
          >
            {{ page.label }}
          </button>
        </div>
      </div>

      <div class="stats-footer__column stats-footer__column--center">
        <img
          class="stats-footer__logo"
          :src="content.logo"
          :alt="`${content.siteName || 'BoneHard'} logo`"
          width="360"
          height="198"
          loading="lazy"
        />

        <div v-if="content.socialAccounts && content.socialAccounts.length" class="stats-footer__socials">
          <h3 class="footer-heading">Social Accounts</h3>
          <div class="social-links">
            <button
              v-for="account in content.socialAccounts"
              :key="account.label"
              class="social-links__item"
              type="button"
              :aria-label="account.label"
              @click="handleSocialClick(account)"
            >
              <svg
                v-if="account.label === 'Instagram'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              <svg
                v-else-if="account.label === 'LinkedIn'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
              <svg
                v-else-if="account.label === 'Facebook'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
              <svg
                v-else-if="account.label === 'X (Twitter)'"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <svg
                v-else-if="account.label === 'WhatsApp'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <svg
                v-else-if="account.label === 'YouTube'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
              </svg>
              <svg
                v-else-if="account.label === 'TikTok'"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          </div>
        </div>

      </div>

      <div class="stats-footer__column stats-footer__column--address">
        <h3 class="footer-heading">Address</h3>
        <p class="footer-copy">{{ content.address.city }}</p>
        <div class="map-frame">
          <iframe
            :title="content.address.mapTitle"
            :src="content.address.mapEmbed"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>
    </div>
    
    <div class="footer-bottom">
      <p class="footer-note">{{ content.copyright }}</p>
      <p class="footer-powered">Powered by <a href="https://wa.me/201551683581" target="_blank" rel="noopener noreferrer">Mido</a></p>
    </div>
  </section>
</template>
