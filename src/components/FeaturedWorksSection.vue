<script setup>
import { ref } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
});

const currentIndex = ref(0);

function nextSlide() {
  if (currentIndex.value < props.items.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
}

function prevSlide() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = props.items.length - 1;
  }
}
</script>

<template>
  <section id="featured-works" class="featured-works-section">
    <h2 class="featured-works-title">FEATURED WORKS</h2>
    
    <div class="featured-works-slider-container">
      <button class="slider-arrow slider-arrow--left" @click="prevSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div class="featured-works-viewport">
        <div 
          class="featured-works-track" 
          :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
        >
          <div
            v-for="item in items"
            :key="item.src"
            class="featured-works-slide"
          >
            <div class="featured-works-card">
              <video
                class="featured-works-video"
                :src="item.src"
                autoplay
                muted
                loop
                playsinline
              ></video>
              <div class="featured-works-label">{{ item.title }}</div>
            </div>
          </div>
        </div>
      </div>

      <button class="slider-arrow slider-arrow--right" @click="nextSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </section>
</template>
