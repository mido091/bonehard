<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    default: 'h2',
  },
});
</script>

<template>
  <component :is="level" class="section-title">
    {{ title }}
  </component>
</template>
