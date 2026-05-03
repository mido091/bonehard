<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import SectionTitle from './SectionTitle.vue';

const props = defineProps({
  filters: {
    type: Array,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
});

const activeFilter = ref('All');
const currentPage = ref(1);
const itemsPerPage = ref(6);

function syncItemsPerPage() {
  const width = window.innerWidth;
  if (width <= 520) {
    itemsPerPage.value = 1;
  } else if (width <= 1024) {
    itemsPerPage.value = 2;
  } else {
    itemsPerPage.value = 6;
  }
  currentPage.value = Math.min(currentPage.value, totalPages.value || 1);
}

const filteredItems = computed(() => {
  if (activeFilter.value === 'All') {
    return props.items;
  }
  return props.items.filter((item) => item.category === activeFilter.value);
});

const totalPages = computed(() => Math.max(Math.ceil(filteredItems.value.length / itemsPerPage.value), 1));

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredItems.value.slice(start, end);
});

// Reset page when filter changes
watch(activeFilter, () => {
  currentPage.value = 1;
});

function setFilter(filter) {
  activeFilter.value = filter;
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

onMounted(() => {
  syncItemsPerPage();
  window.addEventListener('resize', syncItemsPerPage, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('resize', syncItemsPerPage);
});
</script>

<template>
  <section id="showreel" class="content-section showreel">
    <SectionTitle title="ShowReel" />

    <div class="showreel__filters" role="tablist" aria-label="Showreel categories">
      <button
        v-for="filter in filters"
        :key="filter"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === filter }"
        type="button"
        role="tab"
        :aria-selected="activeFilter === filter"
        @click="setFilter(filter)"
      >
        {{ filter }}
      </button>
    </div>

    <div class="showreel__container">
      <button 
        class="showreel__arrow showreel__arrow--prev" 
        @click="prevPage" 
        :disabled="currentPage === 1"
        aria-label="Previous page"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <transition name="showreel-fade" mode="out-in">
        <div class="showreel__grid" :key="currentPage + activeFilter">
          <article
            v-for="item in paginatedItems"
            :key="`${item.title}-${item.image}`"
            class="showreel-card"
          >
            <img
              class="showreel-card__image"
              :src="item.image"
              :alt="`${item.title} showcase`"
              loading="lazy"
              decoding="async"
            />
            <div class="showreel-card__label">{{ item.title }}</div>
          </article>
        </div>
      </transition>

      <button 
        class="showreel__arrow showreel__arrow--next" 
        @click="nextPage" 
        :disabled="currentPage === totalPages"
        aria-label="Next page"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <div class="showreel__pagination" v-if="totalPages > 1">
      <span 
        v-for="page in totalPages" 
        :key="page"
        class="showreel__dot"
        :class="{ 'showreel__dot--active': page === currentPage }"
        @click="currentPage = page"
      ></span>
    </div>
  </section>
</template>
