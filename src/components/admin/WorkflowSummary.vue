<script setup>
defineProps({
  implantSystem: { type: String, default: '' },
  implantSystemOther: { type: String, default: '' },
  servicesNeeded: { type: Array, default: () => [] },
  servicesNeededOther: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <section class="workflow-summary" :class="{ 'workflow-summary--compact': compact }">
    <div class="workflow-summary__block">
      <span class="workflow-summary__label">Implant System</span>
      <strong>{{ implantSystem || 'Not provided' }}</strong>
      <p v-if="implantSystem === 'Other' && implantSystemOther">{{ implantSystemOther }}</p>
    </div>

    <div class="workflow-summary__block workflow-summary__block--wide">
      <span class="workflow-summary__label">Services Needed</span>
      <div v-if="servicesNeeded.length" class="workflow-summary__chips">
        <span v-for="service in servicesNeeded" :key="service" class="workflow-summary__chip">{{ service }}</span>
      </div>
      <strong v-else>Not provided</strong>
      <p v-if="servicesNeeded.includes('Other') && servicesNeededOther">{{ servicesNeededOther }}</p>
    </div>
  </section>
</template>

<style scoped>
.workflow-summary {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 1rem;
}

.workflow-summary--compact {
  grid-template-columns: 1fr;
}

.workflow-summary__block {
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 0.85rem;
  background: rgba(var(--rgb-foreground), 0.03);
}

.workflow-summary__label {
  display: block;
  margin-bottom: 0.45rem;
  color: rgba(var(--rgb-foreground), 0.48);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.workflow-summary strong {
  color: var(--color-text-strong);
  font-weight: 850;
}

.workflow-summary p {
  margin: 0.55rem 0 0;
  color: rgba(var(--rgb-foreground), 0.68);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.workflow-summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.workflow-summary__chip {
  max-width: 100%;
  padding: 0.38rem 0.62rem;
  border: 1px solid rgba(var(--rgb-accent), 0.22);
  border-radius: 999px;
  background: rgba(var(--rgb-accent), 0.09);
  color: var(--color-text-strong);
  font-size: 0.78rem;
  font-weight: 850;
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .workflow-summary {
    grid-template-columns: 1fr;
  }
}

:global([data-theme="light"]) .workflow-summary__block {
  background: rgba(15, 23, 42, 0.035);
  border-color: rgba(15, 23, 42, 0.1);
}
</style>
