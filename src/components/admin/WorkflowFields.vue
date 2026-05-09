<script setup>
import { computed } from 'vue';
import AdminSelect from './AdminSelect.vue';
import { IMPLANT_SYSTEM_OPTIONS, SERVICES_NEEDED_OPTIONS } from '../../constants/workflowOptions';

const props = defineProps({
  implantSystem: { type: String, default: '' },
  implantSystemOther: { type: String, default: '' },
  servicesNeeded: { type: Array, default: () => [] },
  servicesNeededOther: { type: String, default: '' },
});

const emit = defineEmits([
  'update:implantSystem',
  'update:implantSystemOther',
  'update:servicesNeeded',
  'update:servicesNeededOther',
]);

const implantOptions = computed(() => IMPLANT_SYSTEM_OPTIONS.map((value) => ({ label: value, value })));
const showImplantOther = computed(() => props.implantSystem === 'Other');
const showServicesOther = computed(() => props.servicesNeeded.includes('Other'));

function updateImplantSystem(value) {
  emit('update:implantSystem', value);
  if (value !== 'Other') emit('update:implantSystemOther', '');
}

function toggleService(service) {
  const next = props.servicesNeeded.includes(service)
    ? props.servicesNeeded.filter((item) => item !== service)
    : [...props.servicesNeeded, service];
  emit('update:servicesNeeded', next);
  if (!next.includes('Other')) emit('update:servicesNeededOther', '');
}
</script>

<template>
  <div class="workflow-fields">
    <label class="admin-field workflow-fields__implant">
      <span>Implant System</span>
      <AdminSelect
        :model-value="implantSystem"
        :options="implantOptions"
        placeholder="Select implant system"
        @update:model-value="updateImplantSystem"
      />
    </label>

    <Transition name="workflow-field-reveal">
      <label v-if="showImplantOther" class="admin-field workflow-fields__other">
        <span>Implant System Details</span>
        <input
          :value="implantSystemOther"
          maxlength="190"
          placeholder="Type the implant system details..."
          @input="$emit('update:implantSystemOther', $event.target.value)"
        />
      </label>
    </Transition>

    <div class="admin-field admin-field--wide workflow-fields__services">
      <span>Services Needed</span>
      <div class="workflow-service-grid">
        <button
          v-for="service in SERVICES_NEEDED_OPTIONS"
          :key="service"
          type="button"
          class="workflow-service-card"
          :class="{ 'workflow-service-card--active': servicesNeeded.includes(service) }"
          @click="toggleService(service)"
        >
          <span class="workflow-service-card__check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span>{{ service }}</span>
        </button>
      </div>
    </div>

    <Transition name="workflow-field-reveal">
      <label v-if="showServicesOther" class="admin-field admin-field--wide workflow-fields__other">
        <span>Other Service Details</span>
        <input
          :value="servicesNeededOther"
          maxlength="255"
          placeholder="Type the service details..."
          @input="$emit('update:servicesNeededOther', $event.target.value)"
        />
      </label>
    </Transition>
  </div>
</template>

<style scoped>
.workflow-fields {
  display: contents;
}

.workflow-fields__implant,
.workflow-fields__other,
.workflow-fields__services {
  min-width: 0;
}

.workflow-service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.workflow-service-card {
  min-height: 4.2rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.78rem;
  background: linear-gradient(135deg, rgba(var(--rgb-foreground), 0.035), rgba(var(--rgb-accent), 0.045));
  color: rgba(var(--rgb-foreground), 0.78);
  cursor: pointer;
  font: inherit;
  font-weight: 850;
  line-height: 1.35;
  text-align: left;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
}

.workflow-service-card:hover {
  border-color: rgba(var(--rgb-accent), 0.34);
  color: var(--color-text-strong);
  transform: translateY(-1px);
}

.workflow-service-card--active {
  border-color: rgba(var(--rgb-accent), 0.62);
  background: linear-gradient(135deg, rgba(var(--rgb-accent), 0.18), rgba(var(--rgb-foreground), 0.045));
  color: var(--color-text-strong);
}

.workflow-service-card__check {
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(var(--rgb-foreground), 0.18);
  border-radius: 0.42rem;
  color: transparent;
  background: rgba(var(--rgb-background), 0.28);
}

.workflow-service-card__check svg {
  width: 0.8rem;
  height: 0.8rem;
}

.workflow-service-card--active .workflow-service-card__check {
  border-color: rgba(var(--rgb-accent), 0.68);
  background: rgba(var(--rgb-accent), 0.18);
  color: var(--color-accent);
}

.workflow-field-reveal-enter-active,
.workflow-field-reveal-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.workflow-field-reveal-enter-from,
.workflow-field-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 640px) {
  .workflow-service-grid {
    grid-template-columns: 1fr;
  }

  .workflow-service-card {
    min-height: 3.6rem;
  }
}

:global([data-theme="light"]) .workflow-service-card {
  background: rgba(15, 23, 42, 0.035);
  border-color: rgba(15, 23, 42, 0.12);
  color: #334155;
}

:global([data-theme="light"]) .workflow-service-card--active {
  background: rgba(180, 83, 9, 0.1);
  border-color: rgba(180, 83, 9, 0.32);
  color: #0f172a;
}
</style>
