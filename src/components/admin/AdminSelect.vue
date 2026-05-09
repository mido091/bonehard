<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean, Array], default: '' },
  options: { type: Array, required: true },
  placeholder: { type: String, default: 'Make a selection' },
  multiple: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  teleport: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const selectRef = ref(null);
const dropdownRef = ref(null);
const dropdownStyle = ref({});

// Normalize options to always be objects with { label, value }
const normalizedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        ...opt,
        label: opt.label !== undefined ? opt.label : opt.name !== undefined ? opt.name : opt.value, 
        value: opt.value !== undefined ? opt.value : opt.id 
      };
    }
    return { label: opt, value: opt };
  });
});

const updateDropdownPosition = () => {
  if (!props.teleport || !selectRef.value || !isOpen.value) return;
  const rect = selectRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 2000,
  };
};

const toggleOpen = async () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  await nextTick();
  updateDropdownPosition();
};

const close = (e) => {
  const clickedSelect = selectRef.value?.contains(e.target);
  const clickedDropdown = dropdownRef.value?.contains(e.target);
  if (!clickedSelect && !clickedDropdown) {
    isOpen.value = false;
  }
};

const handleViewportChange = () => updateDropdownPosition();

onMounted(() => {
  document.addEventListener('click', close);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', close);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});

const selectOption = (opt) => {
  if (props.multiple) {
    let arr = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    if (arr.includes(opt.value)) {
      arr = arr.filter(v => v !== opt.value);
    } else {
      arr.push(opt.value);
    }
    emit('update:modelValue', arr);
    emit('change', arr);
  } else {
    emit('update:modelValue', opt.value);
    emit('change', opt.value);
    isOpen.value = false;
  }
};

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  updateDropdownPosition();
});

const displayLabel = computed(() => {
  if (props.multiple) {
    const arr = Array.isArray(props.modelValue) ? props.modelValue : [];
    if (!arr.length) return props.placeholder;
    return arr.map(v => normalizedOptions.value.find(o => o.value === v)?.label || v).join(', ');
  }
  
  // Single select
  if (props.modelValue === '' || props.modelValue === null || props.modelValue === undefined) {
    return props.placeholder;
  }
  
  const selected = normalizedOptions.value.find(o => String(o.value) === String(props.modelValue));
  return selected ? selected.label : props.placeholder;
});

// For forms that require native validation, we include a hidden select that mimics the state
const hiddenSelectRef = ref(null);
watch(() => props.modelValue, (val) => {
  if (hiddenSelectRef.value) {
    // Custom validity could be set here if needed, but native required works well
  }
});
</script>

<template>
  <div class="admin-select-wrapper" ref="selectRef" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
    <!-- Native hidden select to support HTML5 'required' validation -->
    <select 
      v-if="!multiple"
      class="admin-select-hidden" 
      :value="modelValue" 
      :required="required"
      @change="(e) => $emit('update:modelValue', e.target.value)"
    >
      <option value="" disabled selected v-if="!modelValue"></option>
      <option v-for="opt in normalizedOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    
    <select 
      v-else
      multiple
      class="admin-select-hidden" 
      :required="required"
    >
      <option v-for="opt in normalizedOptions" :key="opt.value" :value="opt.value" :selected="modelValue && modelValue.includes(opt.value)">{{ opt.label }}</option>
    </select>

    <div class="admin-select-display" @click="toggleOpen">
      <span class="admin-select-text" :class="{ 'is-placeholder': !modelValue || (multiple && !modelValue.length) || displayLabel === placeholder }">
        {{ displayLabel }}
      </span>
      <span class="admin-select-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </span>
    </div>
    
    <Transition name="fade-down">
      <div v-if="isOpen && !teleport" ref="dropdownRef" class="admin-select-dropdown">
        <div v-if="normalizedOptions.length === 0" class="admin-select-empty">No options available</div>
        
        <!-- Placeholder option to allow clearing selection in single-select mode (optional, only if not required or explicitly wanted) -->
        <div 
          v-if="!multiple && !required" 
          class="admin-select-item admin-select-item--clear"
          :class="{ 'is-selected': modelValue === '' || modelValue === null }"
          @click="selectOption({ value: '', label: placeholder })"
        >
          {{ placeholder }}
        </div>

        <div 
          v-for="opt in normalizedOptions" 
          :key="opt.value" 
          class="admin-select-item"
          :class="{ 'is-selected': multiple ? (modelValue && modelValue.includes(opt.value)) : String(modelValue) === String(opt.value) }"
          @click="selectOption(opt)"
        >
          <div style="display: flex; align-items: center; width: 100%;">
            <slot name="option" :option="opt">
              {{ opt.label }}
            </slot>
          </div>
          <span v-if="multiple && modelValue && modelValue.includes(opt.value)" class="admin-select-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        </div>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="fade-down">
        <div
          v-if="isOpen && teleport"
          ref="dropdownRef"
          class="admin-select-dropdown admin-select-dropdown--teleported"
          :style="dropdownStyle"
        >
          <div v-if="normalizedOptions.length === 0" class="admin-select-empty">No options available</div>
          <div
            v-if="!multiple && !required"
            class="admin-select-item admin-select-item--clear"
            :class="{ 'is-selected': modelValue === '' || modelValue === null }"
            @click="selectOption({ value: '', label: placeholder })"
          >
            {{ placeholder }}
          </div>
          <div
            v-for="opt in normalizedOptions"
            :key="opt.value"
            class="admin-select-item"
            :class="{ 'is-selected': multiple ? (modelValue && modelValue.includes(opt.value)) : String(modelValue) === String(opt.value) }"
            @click="selectOption(opt)"
          >
            <div style="display: flex; align-items: center; width: 100%;">
              <slot name="option" :option="opt">
                {{ opt.label }}
              </slot>
            </div>
            <span v-if="multiple && modelValue && modelValue.includes(opt.value)" class="admin-select-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.admin-select-wrapper {
  position: relative;
  width: 100%;
  font-family: inherit;
}

/* Visually hide the native select but keep it focusable for forms */
.admin-select-hidden {
  position: absolute !important;
  bottom: 0;
  left: 50%;
  width: 1px !important;
  height: 1px !important;
  min-width: 1px !important;
  padding: 0 !important;
  border: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  appearance: none !important;
  overflow: hidden !important;
}

.admin-select-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 2.8rem;
  gap: 0.75rem;
  padding: 0.62rem 0.95rem;
  background: linear-gradient(135deg, rgba(var(--rgb-accent), 0.08), rgba(var(--rgb-foreground), 0.025));
  border: 1px solid var(--admin-border, rgba(var(--rgb-accent), 0.14));
  border-radius: 0.72rem;
  color: var(--admin-text, var(--color-text-strong));
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  user-select: none;
}

.admin-select-wrapper:hover:not(.is-disabled) .admin-select-display {
  border-color: rgba(var(--rgb-accent), 0.34);
  background: linear-gradient(135deg, rgba(var(--rgb-accent), 0.12), rgba(var(--rgb-foreground), 0.04));
}

.admin-select-wrapper.is-open .admin-select-display {
  border-color: rgba(var(--rgb-accent), 0.72);
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.11), 0 14px 34px rgba(var(--rgb-background), 0.34);
  background: linear-gradient(135deg, rgba(var(--rgb-accent), 0.12), rgba(var(--rgb-foreground), 0.04));
}

.admin-select-wrapper.is-disabled .admin-select-display {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

.admin-select-text {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1rem;
  font-size: 0.95rem;
  font-weight: 850;
}

.admin-select-text.is-placeholder {
  color: rgba(var(--rgb-foreground), 0.4);
}

.admin-select-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: rgba(var(--rgb-accent), 0.76);
  transition: transform 0.2s ease;
}

.admin-select-wrapper.is-open .admin-select-icon {
  transform: rotate(180deg);
  color: var(--color-text);
}

.admin-select-icon svg {
  width: 100%;
  height: 100%;
}

.admin-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  max-height: 280px;
  overflow-y: auto;
  background: rgba(var(--rgb-background), 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 0.78rem;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
  z-index: 100;
  padding: 0.4rem;
  scrollbar-width: thin;
}

.admin-select-dropdown--teleported {
  top: auto;
  left: auto;
  z-index: 3000 !important;
}

.admin-select-dropdown::-webkit-scrollbar {
  width: 6px;
}

.admin-select-dropdown::-webkit-scrollbar-thumb {
  background: rgba(var(--rgb-accent), 0.24);
  border-radius: 10px;
}

.admin-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.4rem;
  padding: 0.62rem 0.75rem;
  border-radius: 0.58rem;
  color: rgba(var(--rgb-foreground), 0.88);
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
  font-size: 0.95rem;
  font-weight: 800;
}

.admin-select-item:hover {
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-text);
}

.admin-select-item.is-selected {
  background: rgba(var(--rgb-accent), 0.16);
  color: var(--color-text);
  font-weight: 600;
}

.admin-select-item--clear {
  color: rgba(var(--rgb-foreground), 0.4);
  font-style: italic;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.05);
  margin-bottom: 0.25rem;
  padding-bottom: 0.5rem;
}

.admin-select-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.admin-select-check svg {
  width: 100%;
  height: 100%;
}

.admin-select-empty {
  padding: 1rem;
  text-align: center;
  color: rgba(var(--rgb-foreground), 0.52);
  font-size: 0.9rem;
  font-weight: 750;
}

/* Transitions */
.fade-down-enter-active,
.fade-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fade-down-enter-from,
.fade-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

<style>
[data-theme="light"] .admin-select-display {
  background: rgba(15, 23, 42, 0.04);
  border-color: rgba(15, 23, 42, 0.2);
  color: #0f172a;
}
[data-theme="light"] .admin-select-wrapper:hover:not(.is-disabled) .admin-select-display {
  border-color: rgba(180, 83, 9, 0.35);
  background: rgba(15, 23, 42, 0.06);
}
[data-theme="light"] .admin-select-wrapper.is-open .admin-select-display {
  border-color: rgba(180, 83, 9, 0.6);
  background: rgba(15, 23, 42, 0.06);
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.1);
}
[data-theme="light"] .admin-select-item {
  color: #1e293b;
}
[data-theme="light"] .admin-select-item:hover {
  background: rgba(180, 83, 9, 0.07);
  color: #b45309;
}
[data-theme="light"] .admin-select-item.is-selected {
  background: rgba(180, 83, 9, 0.1);
  color: #b45309;
}
</style>
