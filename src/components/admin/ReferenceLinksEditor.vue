<script setup>
const links = defineModel({ type: Array, default: () => [] });

function addLink() {
  links.value = [...links.value, { url: '' }];
}

function removeLink(index) {
  links.value = links.value.filter((_, itemIndex) => itemIndex !== index);
}
</script>

<template>
  <section class="reference-editor">
    <div class="reference-editor__header">
      <div>
        <span>Reference Links</span>
        <p>Add useful URLs for this record. Links are clickable and copyable in details.</p>
      </div>
      <button class="admin-link-button" type="button" @click="addLink">+ Add link</button>
    </div>

    <div v-for="(link, index) in links" :key="index" class="reference-editor__row">
      <label>
        <span>URL</span>
        <input v-model.trim="link.url" type="url" maxlength="1000" placeholder="https://example.com" />
      </label>
      <button class="reference-editor__remove" type="button" @click="removeLink(index)">Remove</button>
    </div>

    <p v-if="!links.length" class="reference-editor__empty">No reference links added.</p>
  </section>
</template>

<style scoped>
.reference-editor {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 0.9rem;
  background: rgba(var(--rgb-foreground), 0.035);
}

.reference-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.reference-editor__header span,
.reference-editor__row span {
  display: block;
  color: rgba(var(--rgb-foreground), 0.62);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reference-editor__header p,
.reference-editor__empty {
  margin: 0.3rem 0 0;
  color: rgba(var(--rgb-foreground), 0.58);
}

.reference-editor__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.65rem;
  align-items: end;
}

.reference-editor__row label {
  display: grid;
  gap: 0.35rem;
}

.reference-editor__remove {
  min-height: 2.8rem;
  border: 1px solid rgba(239, 68, 68, 0.24);
  border-radius: 0.7rem;
  background: rgba(239, 68, 68, 0.08);
  color: #fca5a5;
  font-weight: 900;
  cursor: pointer;
}

.reference-editor__row input {
  width: 100%;
  min-height: 2.8rem;
  border: 1px solid rgba(var(--rgb-foreground), 0.15);
  border-radius: 0.7rem;
  background: rgba(var(--rgb-foreground), 0.05);
  color: var(--color-text-strong);
  padding: 0.5rem 0.8rem;
  font: inherit;
  font-weight: 600;
  transition: all 0.2s ease;
}

.reference-editor__row input:focus {
  outline: none;
  border-color: rgba(var(--rgb-accent), 0.5);
  background: rgba(var(--rgb-background), 0.8);
}

:global([data-theme="light"]) .reference-editor {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.12);
}

:global([data-theme="light"]) .reference-editor__remove {
  color: #b91c1c;
}

:global([data-theme="light"]) .reference-editor__row input {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.16);
  color: #0f172a;
}

:global([data-theme="light"]) .reference-editor__row input:focus {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

@media (max-width: 760px) {
  .reference-editor__header,
  .reference-editor__row {
    grid-template-columns: 1fr;
  }

  .reference-editor__header {
    flex-direction: column;
  }
}
</style>
