<script setup>
import { computed, ref, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  inputClass: {
    type: [String, Array, Object],
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();
const visible = ref(false);

const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

function toggleVisibility() {
  visible.value = !visible.value;
}
</script>

<template>
  <div class="password-input" :class="{ 'password-input--with-icon': $slots.icon }">
    <slot name="icon" />
    <input
      v-bind="inputAttrs"
      :class="['password-input__control', inputClass]"
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button
      class="password-input__toggle"
      type="button"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      :title="visible ? 'Hide password' : 'Show password'"
      @click="toggleVisibility"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <template v-if="!visible">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </template>
        <template v-else>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
          <path d="M9.4 5.4A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a16.7 16.7 0 0 1-2.8 3.7" />
          <path d="M6.1 6.1C3.5 7.8 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.4 4.1-1" />
        </template>
      </svg>
    </button>
  </div>
</template>
