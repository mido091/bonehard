<script setup>
/**
 * RichTextEditor.vue
 * A reusable rich-text editor component built on Quill.js.
 * Supports: Bold, Italic, Underline, Ordered/Bullet Lists,
 *           Links, Images, Blockquote, Code, Color, and Headings.
 *
 * Uses a custom link handler to avoid Quill's broken built-in tooltip
 * which overflows outside the editor container.
 *
 * Usage: <RichTextEditor v-model="form.description" placeholder="Write here..." />
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Write here...' },
  minHeight: { type: String, default: '140px' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const editorEl = ref(null);
const wrapEl = ref(null);
let quillInstance = null;
let suppressWatch = false;
let toolbarEl = null;
let toolbarMouseDownHandler = null;
let toolbarClickHandler = null;
let documentMouseDownHandler = null;
let colorMouseDownCaptureHandler = null;
let colorClickCaptureHandler = null;

function closeOtherPickers(activePicker) {
  toolbarEl?.querySelectorAll('.ql-picker.ql-expanded').forEach((picker) => {
    if (picker !== activePicker) picker.classList.remove('ql-expanded');
  });
}

function closeColorPicker() {
  toolbarEl?.querySelectorAll('.ql-color-picker.ql-expanded').forEach((picker) => {
    picker.classList.remove('ql-expanded');
  });
}

// Custom link modal state
const showLinkModal = ref(false);
const linkUrl = ref('');
const linkInputEl = ref(null);
let savedRange = null;
let lastSelectionRange = null;

function rememberSelection() {
  if (!quillInstance) return null;
  const range = quillInstance.getSelection();
  if (range) lastSelectionRange = range;
  return range || lastSelectionRange;
}

function restoreSelection() {
  if (!quillInstance) return null;
  const range = rememberSelection() || { index: Math.max(0, quillInstance.getLength() - 1), length: 0 };
  quillInstance.focus();
  quillInstance.setSelection(range, 'silent');
  return range;
}

function clearEditorSelection() {
  if (!quillInstance) return;
  quillInstance.setSelection(null, 'silent');
  window.getSelection?.()?.removeAllRanges();
  toolbarEl?.querySelectorAll('.ql-expanded').forEach((el) => el.classList.remove('ql-expanded'));
}

function applyTextColor(value) {
  if (!quillInstance) return;
  restoreSelection();
  quillInstance.format('color', value || false, 'user');
  closeColorPicker();
}

function openLinkModal() {
  if (!quillInstance) return;
  const range = rememberSelection();
  if (!range) return;

  savedRange = range;
  // Check if there's already a link on the selected text
  const [leaf] = quillInstance.getLeaf(range.index);
  const existingLink = leaf?.parent?.domNode?.closest('a');
  linkUrl.value = existingLink ? existingLink.getAttribute('href') : '';
  showLinkModal.value = true;

  // Focus the input after Vue renders it
  setTimeout(() => linkInputEl.value?.focus(), 50);
}

function applyLink() {
  if (!quillInstance || !savedRange) return;
  quillInstance.setSelection(savedRange);
  if (linkUrl.value.trim()) {
    quillInstance.format('link', linkUrl.value.trim());
  } else {
    quillInstance.format('link', false);
  }
  showLinkModal.value = false;
  linkUrl.value = '';
  savedRange = null;
}

function cancelLink() {
  showLinkModal.value = false;
  linkUrl.value = '';
  if (savedRange && quillInstance) {
    quillInstance.setSelection(savedRange);
  }
  savedRange = null;
}

function removeLink() {
  if (!quillInstance || !savedRange) return;
  quillInstance.setSelection(savedRange);
  quillInstance.format('link', false);
  showLinkModal.value = false;
  linkUrl.value = '';
  savedRange = null;
}

onMounted(async () => {
  const { default: Quill } = await import('quill');

  quillInstance = new Quill(editorEl.value, {
    theme: 'snow',
    placeholder: props.placeholder,
    readOnly: props.disabled,
    modules: {
      toolbar: {
        container: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          [{ header: [1, 2, 3, false] }, { color: [] }],
          ['clean'],
        ],
        handlers: {
          // Override Quill's built-in link handler with our custom modal
          link: () => openLinkModal(),
        },
      },
    },
  });

  // Disable Quill's built-in tooltip entirely so it never appears
  const builtInTooltip = editorEl.value?.parentElement?.querySelector('.ql-tooltip');
  if (builtInTooltip) builtInTooltip.style.display = 'none';

  // Fix color picker: prevent blur on the editor when clicking picker items.
  // We attach to the entire toolbar so any picker interaction is caught.
  toolbarEl = quillInstance.getModule('toolbar').container;
  toolbarMouseDownHandler = (e) => {
    rememberSelection();
    const picker = e.target.closest('.ql-picker-options');
    const pickerLabel = e.target.closest('.ql-picker-label');
    const button = e.target.closest('button');

    // Keep the editor selection alive while the toolbar is being used.
    if (picker || pickerLabel || button) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
  };
  toolbarEl.addEventListener('mousedown', toolbarMouseDownHandler);
  toolbarClickHandler = (e) => {
    const picker = e.target.closest('.ql-picker');
    if (!picker) return;

    e.stopPropagation();

    const pickerLabel = e.target.closest('.ql-picker-label');
    const pickerItem = e.target.closest('.ql-picker-item');

    if (pickerLabel) {
      e.preventDefault();
      const willOpen = !picker.classList.contains('ql-expanded');
      closeOtherPickers(picker);
      picker.classList.toggle('ql-expanded', willOpen);
      e.stopImmediatePropagation?.();
      return;
    }

    if (pickerItem) {
      // Let Quill apply the selected value, then close only this picker.
      window.setTimeout(() => picker.classList.remove('ql-expanded'), 0);
    }
  };
  toolbarEl.addEventListener('click', toolbarClickHandler, true);

  colorMouseDownCaptureHandler = (event) => {
    const colorPicker = event.target.closest?.('.ql-color-picker');
    if (!colorPicker || !wrapEl.value?.contains(colorPicker)) return;

    rememberSelection();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  colorClickCaptureHandler = (event) => {
    const colorPicker = event.target.closest?.('.ql-color-picker');
    if (!colorPicker || !wrapEl.value?.contains(colorPicker)) return;

    const colorLabel = event.target.closest('.ql-picker-label');
    const colorItem = event.target.closest('.ql-picker-item');

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (colorLabel) {
      const willOpen = !colorPicker.classList.contains('ql-expanded');
      closeOtherPickers(colorPicker);
      colorPicker.classList.toggle('ql-expanded', willOpen);
      return;
    }

    if (colorItem) {
      applyTextColor(colorItem.getAttribute('data-value') || false);
    }
  };

  document.addEventListener('mousedown', colorMouseDownCaptureHandler, true);
  document.addEventListener('click', colorClickCaptureHandler, true);

  documentMouseDownHandler = (event) => {
    if (wrapEl.value?.contains(event.target)) return;
    showLinkModal.value = false;
    clearEditorSelection();
  };
  document.addEventListener('mousedown', documentMouseDownHandler);

  // Apply title-based tooltips (hover text) to toolbar buttons
  setTimeout(() => {
    if (!quillInstance) return;
    const tooltips = {
      bold: 'Bold', italic: 'Italic', underline: 'Underline',
      list: { ordered: 'Numbered List', bullet: 'Bulleted List' },
      blockquote: 'Quote', 'code-block': 'Code Block',
      link: 'Insert Link', image: 'Insert Image',
      header: 'Heading Level', color: 'Text Color', clean: 'Clear Formatting',
    };

    toolbarEl.querySelectorAll('button, .ql-picker').forEach(el => {
      for (const className of el.classList) {
        if (!className.startsWith('ql-')) continue;
        const key = className.replace('ql-', '');
        if (!tooltips[key]) continue;
        const tip = key === 'list' && el.value ? tooltips.list[el.value] : tooltips[key];
        if (typeof tip === 'string') el.setAttribute('title', tip);
        break;
      }
    });
  }, 150);

  // Set initial content
  if (props.modelValue) {
    suppressWatch = true;
    quillInstance.root.innerHTML = props.modelValue;
    suppressWatch = false;
  }

  // Emit changes upward when user types
  quillInstance.on('text-change', () => {
    suppressWatch = true;
    const html = quillInstance.root.innerHTML;
    emit('update:modelValue', html === '<p><br></p>' ? '' : html);
    suppressWatch = false;
  });

  quillInstance.on('selection-change', (range) => {
    if (range) lastSelectionRange = range;
  });
});

// Sync when parent changes v-model programmatically
watch(
  () => props.modelValue,
  (newVal) => {
    if (suppressWatch || !quillInstance) return;
    const current = quillInstance.root.innerHTML;
    const incoming = newVal || '';
    if (current !== incoming) {
      suppressWatch = true;
      quillInstance.root.innerHTML = incoming;
      suppressWatch = false;
    }
  },
);

watch(
  () => props.disabled,
  (val) => {
    if (quillInstance) quillInstance.enable(!val);
  },
);

onBeforeUnmount(() => {
  if (toolbarEl && toolbarMouseDownHandler) {
    toolbarEl.removeEventListener('mousedown', toolbarMouseDownHandler);
  }
  if (toolbarEl && toolbarClickHandler) {
    toolbarEl.removeEventListener('click', toolbarClickHandler, true);
  }
  if (documentMouseDownHandler) {
    document.removeEventListener('mousedown', documentMouseDownHandler);
  }
  if (colorMouseDownCaptureHandler) {
    document.removeEventListener('mousedown', colorMouseDownCaptureHandler, true);
  }
  if (colorClickCaptureHandler) {
    document.removeEventListener('click', colorClickCaptureHandler, true);
  }
  quillInstance = null;
});
</script>

<template>
  <div ref="wrapEl" class="rte-wrap" :class="{ 'rte-wrap--disabled': disabled }">
    <div ref="editorEl" class="rte-editor" :style="{ minHeight }"></div>

    <!-- Custom Link Modal (rendered inside the editor wrapper) -->
    <Transition name="rte-modal">
      <div v-if="showLinkModal" class="rte-link-overlay" @click.self="cancelLink">
        <div class="rte-link-modal">
          <div class="rte-link-modal__header">
            <span>Insert Link</span>
            <button type="button" class="rte-link-modal__close" @click="cancelLink">&times;</button>
          </div>
          <input
            ref="linkInputEl"
            v-model="linkUrl"
            type="url"
            class="rte-link-modal__input"
            placeholder="https://example.com"
            @keydown.enter.prevent="applyLink"
            @keydown.esc="cancelLink"
          />
          <div class="rte-link-modal__actions">
            <button type="button" class="rte-link-modal__btn rte-link-modal__btn--danger" @click="removeLink">Remove</button>
            <button type="button" class="rte-link-modal__btn rte-link-modal__btn--primary" @click="applyLink">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
/* ── Import Quill snow theme ─────────────────────────────────────────── */
@import 'quill/dist/quill.snow.css';

/* ── Override Quill styles to match dark admin identity ─────────────── */
.rte-wrap {
  position: relative;
  border-radius: 8px;
  border: 1px solid var(--border, #2a2a3a);
  background: var(--surface, #1a1a2e);
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;
}

.rte-wrap:focus-within {
  border-color: var(--accent, #7c6af7);
  box-shadow: 0 0 0 3px rgba(124, 106, 247, 0.12);
}

.rte-wrap--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Toolbar */
.rte-wrap .ql-toolbar {
  border: none;
  border-bottom: 1px solid var(--border, #2a2a3a);
  background: var(--surface-raised, #22223a);
  padding: 6px 8px;
  flex-wrap: wrap;
  border-radius: 8px 8px 0 0;
}

.rte-wrap .ql-toolbar .ql-stroke {
  stroke: var(--text-muted, #8888aa);
}

.rte-wrap .ql-toolbar .ql-fill {
  fill: var(--text-muted, #8888aa);
}

.rte-wrap .ql-toolbar button:hover .ql-stroke,
.rte-wrap .ql-toolbar button.ql-active .ql-stroke {
  stroke: var(--accent, #7c6af7);
}

.rte-wrap .ql-toolbar button:hover .ql-fill,
.rte-wrap .ql-toolbar button.ql-active .ql-fill {
  fill: var(--accent, #7c6af7);
}

.rte-wrap .ql-toolbar .ql-picker-label {
  color: var(--text-muted, #8888aa);
}

.rte-wrap .ql-toolbar .ql-picker-options {
  background: var(--surface-raised, #22223a);
  border: 1px solid var(--border, #2a2a3a);
  border-radius: 6px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(var(--rgb-background), 0.4);
}

.rte-wrap .ql-toolbar .ql-picker-item:hover,
.rte-wrap .ql-toolbar .ql-picker-item.ql-selected {
  color: var(--accent, #7c6af7);
}

/* Color picker dropdown */
.rte-wrap .ql-snow .ql-color-picker .ql-picker-options {
  padding: 6px;
  width: 176px;
}

.rte-wrap .ql-snow .ql-color-picker .ql-picker-item {
  border-radius: 3px;
  width: 18px;
  height: 18px;
}

/* Editor body */
.rte-wrap .ql-container {
  border: none;
  font-family: inherit;
  font-size: 0.9rem;
}

.rte-wrap .ql-editor {
  color: var(--text, #e5e5f0);
  caret-color: var(--accent, #7c6af7);
  line-height: 1.6;
  padding: 10px 14px;
}

.rte-wrap .ql-editor p,
.rte-wrap .ql-editor li {
  color: var(--text, #e5e5f0);
}

.rte-wrap .ql-editor.ql-blank::before {
  color: var(--text-muted, #6666aa);
  font-style: normal;
  left: 14px;
}

/* Blockquote */
.rte-wrap .ql-editor blockquote {
  border-left: 3px solid var(--accent, #7c6af7);
  color: var(--text-muted, #8888aa);
  background: rgba(124, 106, 247, 0.06);
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 0 6px 6px 0;
}

/* Code block */
.rte-wrap .ql-editor pre.ql-syntax {
  background: rgba(var(--rgb-background), 0.3);
  color: #a5f3c4;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  padding: 10px 14px;
}

/* Hide Quill's built-in tooltip completely (we use our own modal) */
.rte-wrap .ql-snow .ql-tooltip {
  display: none !important;
}

/* ── Custom Link Modal ──────────────────────────────────────────────── */
.rte-link-overlay {
  position: absolute;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rgb-background), 0.45);
  border-radius: 8px;
}

.rte-link-modal {
  background: #1e1e32;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 10px;
  padding: 16px;
  width: 340px;
  max-width: 90%;
  box-shadow: 0 12px 40px rgba(var(--rgb-background), 0.5);
}

.rte-link-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: var(--color-text-strong);
  font-weight: 600;
  font-size: 0.92rem;
}

.rte-link-modal__close {
  background: none;
  border: none;
  color: rgba(var(--rgb-foreground), 0.5);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.rte-link-modal__close:hover {
  color: var(--color-text-strong);
}

.rte-link-modal__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(var(--rgb-foreground), 0.12);
  border-radius: 6px;
  background: rgba(var(--rgb-background), 0.25);
  color: var(--color-text-strong);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s;
}

.rte-link-modal__input:focus {
  border-color: rgba(124, 106, 247, 0.6);
  box-shadow: 0 0 0 2px rgba(124, 106, 247, 0.15);
}

.rte-link-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.rte-link-modal__btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.rte-link-modal__btn--primary {
  background: #7c6af7;
  color: var(--color-text-strong);
}

.rte-link-modal__btn--primary:hover {
  background: #6a56e0;
}

.rte-link-modal__btn--danger {
  background: rgba(255, 100, 100, 0.15);
  color: #ff8a8a;
}

.rte-link-modal__btn--danger:hover {
  background: rgba(255, 100, 100, 0.25);
}

:global([data-theme="light"]) .rte-wrap .ql-toolbar .ql-picker-options {
  border-color: #cbd5e1;
  background: #ffffff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14);
}

:global([data-theme="light"]) .rte-wrap .ql-toolbar .ql-picker-label,
:global([data-theme="light"]) .rte-wrap .ql-toolbar .ql-picker-item {
  color: #475569;
}

:global([data-theme="light"]) .rte-wrap .ql-toolbar .ql-picker-item:hover,
:global([data-theme="light"]) .rte-wrap .ql-toolbar .ql-picker-item.ql-selected {
  color: #b45309;
}

:global([data-theme="light"]) .rte-link-overlay {
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(8px);
}

:global([data-theme="light"]) .rte-link-modal {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

:global([data-theme="light"]) .rte-link-modal__header {
  color: #0f172a;
}

:global([data-theme="light"]) .rte-link-modal__close {
  color: #64748b;
}

:global([data-theme="light"]) .rte-link-modal__close:hover {
  color: #0f172a;
}

:global([data-theme="light"]) .rte-link-modal__input {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

:global([data-theme="light"]) .rte-link-modal__input:focus {
  border-color: #b45309;
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.12);
}

:global([data-theme="light"]) .rte-link-modal__btn--primary {
  background: #b45309;
  color: #ffffff;
}

:global([data-theme="light"]) .rte-link-modal__btn--primary:hover {
  background: #92400e;
}

:global([data-theme="light"]) .rte-link-modal__btn--danger {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

:global([data-theme="light"]) .rte-link-modal__btn--danger:hover {
  background: #fee2e2;
  color: #991b1b;
}

/* Modal transition */
.rte-modal-enter-active,
.rte-modal-leave-active {
  transition: opacity 0.15s ease;
}

.rte-modal-enter-from,
.rte-modal-leave-to {
  opacity: 0;
}
</style>
