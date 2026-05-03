<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { countries, defaultCountryCode } from '../data/countries.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '50 123 4567'
  },
  required: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:modelValue']);

const phoneInputRef = ref(null);
const dropdownContainerRef = ref(null);
const searchInputRef = ref(null);

const isOpen = ref(false);
const searchQuery = ref('');

const selectedDialCode = ref(defaultCountryCode);
const localNumber = ref('');

// Parse initial value
function parseModelValue(val) {
  if (!val) {
    selectedDialCode.value = defaultCountryCode;
    localNumber.value = '';
    return;
  }
  
  // Try to find the matching country code (start with longest codes first)
  const sortedCountries = [...countries].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const matchedCountry = sortedCountries.find(c => val.startsWith(c.dialCode));
  
  if (matchedCountry) {
    selectedDialCode.value = matchedCountry.dialCode;
    localNumber.value = val.substring(matchedCountry.dialCode.length).replace(/^\s+/, '');
  } else {
    // Fallback if no country code matches (e.g. local number typed without code)
    selectedDialCode.value = defaultCountryCode;
    localNumber.value = val.replace(/^\+/, '');
  }
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  const currentFull = selectedDialCode.value + localNumber.value;
  if (newVal !== currentFull) {
    parseModelValue(newVal);
  }
}, { immediate: true });

// Update parent
function updateParent() {
  const cleanNumber = localNumber.value.replace(/[^\d]/g, '');
  if (!cleanNumber) {
    emit('update:modelValue', '');
  } else {
    emit('update:modelValue', selectedDialCode.value + cleanNumber);
  }
}

function handleNumberInput(e) {
  // Allow only digits and spaces
  localNumber.value = e.target.value.replace(/[^\d\s]/g, '');
  updateParent();
}

const filteredCountries = computed(() => {
  if (!searchQuery.value) return countries;
  const q = searchQuery.value.toLowerCase().replace(/^\+/, '');
  return countries.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.dialCode.replace(/^\+/, '').includes(q)
  );
});

const selectedCountry = computed(() => {
  return countries.find(c => c.dialCode === selectedDialCode.value) || countries[0];
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
    setTimeout(() => {
      searchInputRef.value?.focus();
    }, 50);
  }
}

function selectCountry(country) {
  selectedDialCode.value = country.dialCode;
  isOpen.value = false;
  updateParent();
  phoneInputRef.value?.focus();
}

function handleClickOutside(event) {
  if (dropdownContainerRef.value && !dropdownContainerRef.value.contains(event.target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="phone-input-wrapper" ref="dropdownContainerRef">
    
    <!-- Custom Dropdown Button -->
    <button 
      type="button" 
      class="country-selector" 
      @click="toggleDropdown"
      :aria-expanded="isOpen"
      aria-label="Select country code"
    >
      <img :src="`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`" :alt="selectedCountry.name" class="country-flag-img" />
      <span class="country-code">{{ selectedCountry.dialCode }}</span>
      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="country-dropdown custom-scrollbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            ref="searchInputRef"
            v-model="searchQuery" 
            type="text" 
            placeholder="Search country or code..."
            class="search-input"
            @click.stop
          />
        </div>
        <ul class="country-list">
          <li v-if="filteredCountries.length === 0" class="no-results">
            No countries found
          </li>
          <li 
            v-for="country in filteredCountries" 
            :key="country.code"
            class="country-item"
            :class="{ active: country.dialCode === selectedDialCode }"
            @click="selectCountry(country)"
          >
            <img :src="`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`" :alt="country.name" class="item-flag-img" />
            <span class="item-name">{{ country.name }}</span>
            <span class="item-code">{{ country.dialCode }}</span>
          </li>
        </ul>
      </div>
    </Transition>

    <!-- Phone Number Input -->
    <input
      :id="id"
      ref="phoneInputRef"
      v-model="localNumber"
      type="tel"
      class="number-input"
      :placeholder="placeholder"
      :required="required"
      @input="handleNumberInput"
      autocomplete="tel-national"
    />
  </div>
</template>

<style scoped>
.phone-input-wrapper {
  position: relative;
  display: flex;
  align-items: stretch;
  background: rgba(var(--rgb-foreground), 0.04);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 12px;
  transition: all 0.2s;
  width: 100%;
}

.phone-input-wrapper:focus-within {
  border-color: rgba(var(--rgb-accent), 0.5);
  background: rgba(var(--rgb-foreground), 0.06);
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.08);
}

.country-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  background: rgba(var(--rgb-foreground), 0.03);
  border: none;
  border-right: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 12px 0 0 12px;
  cursor: pointer;
  color: var(--color-text-strong);
  transition: background 0.2s;
  flex-shrink: 0;
}

.country-selector:hover {
  background: rgba(var(--rgb-foreground), 0.08);
}

.country-flag-img {
  width: 22px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
}

.country-code {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(var(--rgb-foreground), 0.9);
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  color: rgba(var(--rgb-foreground), 0.5);
  transition: transform 0.2s;
}

.country-selector[aria-expanded="true"] .dropdown-icon {
  transform: rotate(180deg);
}

.number-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-strong);
  font-size: 0.95rem;
  padding: 14px 14px;
  width: 100%;
  box-sizing: border-box;
}

.number-input::placeholder {
  color: rgba(var(--rgb-foreground), 0.3);
}

/* Dropdown Menu */
.country-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 320px;
  max-width: calc(100vw - 2rem);
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--rgb-accent), 0.15);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(var(--rgb-background), 0.5);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-box {
  position: relative;
  padding: 12px;
  border-bottom: 1px solid rgba(var(--rgb-foreground), 0.08);
  background: rgba(var(--rgb-background), 0.2);
}

.search-icon {
  position: absolute;
  left: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: rgba(var(--rgb-foreground), 0.4);
}

.search-input {
  width: 100%;
  background: rgba(var(--rgb-foreground), 0.05);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 8px;
  padding: 10px 10px 10px 36px;
  color: var(--color-text-strong);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: rgba(var(--rgb-accent), 0.4);
  background: rgba(var(--rgb-foreground), 0.08);
}

.search-input::placeholder {
  color: rgba(var(--rgb-foreground), 0.4);
}

.country-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--rgb-foreground),0.1); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--rgb-foreground),0.2); }

.country-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.country-item:hover, .country-item.active {
  background: rgba(var(--rgb-accent), 0.08);
}

.item-flag-img {
  width: 22px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  color: rgba(var(--rgb-foreground), 0.9);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-code {
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.85rem;
  font-weight: 600;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 0.9rem;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

[data-theme="light"] .phone-input-wrapper {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
}

[data-theme="light"] .phone-input-wrapper:focus-within {
  background: #ffffff;
  border-color: #b45309;
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.14);
}

[data-theme="light"] .country-selector {
  background: #f8fafc;
  border-right-color: #e2e8f0;
  color: #0f172a;
}

[data-theme="light"] .country-selector:hover {
  background: #fff7ed;
}

[data-theme="light"] .country-code,
[data-theme="light"] .number-input,
[data-theme="light"] .item-name {
  color: #0f172a;
}

[data-theme="light"] .dropdown-icon,
[data-theme="light"] .item-code,
[data-theme="light"] .no-results {
  color: #64748b;
}

[data-theme="light"] .number-input::placeholder {
  color: #94a3b8;
}

[data-theme="light"] .country-dropdown {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 20px 55px rgba(15, 23, 42, 0.16);
  backdrop-filter: none;
}

[data-theme="light"] .search-box {
  background: #f8fafc;
  border-bottom-color: #e2e8f0;
}

[data-theme="light"] .search-icon {
  color: #64748b;
}

[data-theme="light"] .search-input {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #0f172a;
}

[data-theme="light"] .search-input::placeholder {
  color: #94a3b8;
}

[data-theme="light"] .country-item:hover,
[data-theme="light"] .country-item.active {
  background: #fff7ed;
}
</style>
