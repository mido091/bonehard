<script setup>
import { ref } from 'vue';

defineProps({
  links: { type: Array, default: () => [] },
});

const copied = ref('');

async function copyLink(link) {
  await navigator.clipboard.writeText(link.url);
  copied.value = link.id || link.url;
  window.setTimeout(() => {
    if (copied.value === (link.id || link.url)) copied.value = '';
  }, 1500);
}
</script>

<template>
  <div v-if="links?.length" class="reference-list">
    <a v-for="link in links" :key="link.id || link.url" :href="link.url" target="_blank" rel="noopener" class="reference-list__item">
      <span>{{ link.label || link.url }}</span>
      <button type="button" @click.prevent="copyLink(link)">
        {{ copied === (link.id || link.url) ? 'Copied' : 'Copy' }}
      </button>
    </a>
  </div>
</template>

<style scoped>
.reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.reference-list__item {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 0.55rem;
  border: 1px solid rgba(var(--rgb-accent), 0.24);
  border-radius: 999px;
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-accent, #f8d9aa);
  padding: 0.42rem 0.48rem 0.42rem 0.72rem;
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;
}

.reference-list__item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference-list__item button {
  border: 0;
  border-radius: 999px;
  background: rgba(var(--rgb-foreground), 0.1);
  color: inherit;
  padding: 0.25rem 0.5rem;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

:global([data-theme="light"]) .reference-list__item {
  background: rgba(124, 74, 3, 0.08);
  border-color: rgba(124, 74, 3, 0.18);
  color: #7c4a03;
}
</style>
