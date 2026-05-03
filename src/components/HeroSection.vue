<script setup>
defineProps({
  content: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['navigate']);
</script>

<template>
  <section :id="content.id" class="hero-section">
    <video
      class="hero-section__video"
      :src="content.backgroundVideo"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      aria-hidden="true"
    ></video>
    <div class="hero-section__noise"></div>
    <div class="hero-section__overlay"></div>

    <div class="hero-section__content">
      <button
        class="primary-cta"
        type="button"
        @click="emit('navigate', content.cta)"
      >
        <span>{{ content.cta.label }}</span>
        <svg
          class="primary-cta__arrow"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9 5.5L16 12L9 18.5V5.5Z" />
        </svg>
      </button>
    </div>
  </section>
</template>
