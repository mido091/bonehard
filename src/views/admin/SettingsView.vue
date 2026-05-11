<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AdminSelect from '../../components/admin/AdminSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { useToast } from '../../composables/useToast';
import { api } from '../../services/api';

const { showConfirm } = useConfirmDialog();
const { showToast } = useToast();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const activeSection = ref('brand');
const logoFile = ref(null);
const faviconFile = ref(null);
const socialIconFile = ref(null);

const logoPreview = computed(() => {
  return logoFile.value ? URL.createObjectURL(logoFile.value) : settings.logoUrl;
});

const faviconPreview = computed(() => {
  return faviconFile.value ? URL.createObjectURL(faviconFile.value) : settings.faviconUrl;
});

const settings = reactive({
  siteName: 'BoneHard',
  addressCity: '',
  mapTitle: '',
  mapEmbedUrl: '',
  copyrightText: '',
  logoUrl: '/assets/logo/new_logo.webp',
  faviconUrl: '/assets/logo/new_logo.webp',
});

const socialForm = reactive({
  id: null,
  label: '',
  type: 'url',
  target: '',
  sortOrder: 0,
  isActive: true,
});

const recipientForm = reactive({
  id: null,
  email: '',
  isActive: true,
});

const socialLinks = ref([]);
const recipients = ref([]);

const sections = [
  { key: 'brand', label: 'Brand' },
  { key: 'social', label: 'Social Links' },
  { key: 'recipients', label: 'Connect Emails' },
];

const socialTypeOptions = [
  { value: 'url', label: 'URL' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const socialPlatformOptions = [
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'X (Twitter)', label: 'X (Twitter)' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Website', label: 'Website' },
];

function handlePlatformChange() {
  if (socialForm.label === 'WhatsApp') {
    socialForm.type = 'whatsapp';
  } else {
    socialForm.type = 'url';
  }
}



function copySettings(payload) {
  const data = payload.settings || payload;
  settings.siteName = data.siteName || 'BoneHard';
  settings.logoUrl = data.logo?.url || '/assets/logo/new_logo.webp';
  settings.faviconUrl = data.favicon?.url || settings.logoUrl;
  settings.addressCity = data.address?.city || '';
  settings.mapTitle = data.address?.mapTitle || '';
  settings.mapEmbedUrl = data.address?.mapEmbed || '';
  settings.copyrightText = data.copyright || '';
}

function normalizeWhatsappTarget(type, target) {
  if (type !== 'whatsapp') return target;
  if (/^https?:\/\//i.test(target)) return target;
  const phone = target.replace(/[^\d]/g, '');
  return `https://wa.me/${phone}`;
}

function appendFormData(formData, payload) {
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value ?? '');
  });
}

function resetSocialForm() {
  Object.assign(socialForm, { id: null, label: 'Facebook', type: 'url', target: '', sortOrder: socialLinks.value.length, isActive: true });
}

function resetRecipientForm() {
  Object.assign(recipientForm, { id: null, email: '', isActive: true });
}

async function loadSettings() {
  loading.value = true;
  try {
    const response = await api.get('/api/admin/site-settings');
    copySettings(response.data);
    socialLinks.value = response.data.socialLinks || [];
    recipients.value = response.data.recipients || [];
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function resetBrandToDefault() {
  const confirmed = await showConfirm({
    title: 'Reset to Defaults',
    message: 'Are you sure you want to reset Brand settings to their defaults? This will overwrite your current unsaved changes.',
    confirmText: 'Yes, Reset',
    type: 'danger',
  });
  
  if (!confirmed) return;

  settings.siteName = 'BoneHard';
  settings.addressCity = 'Dubai - UAE';
  settings.mapTitle = 'BoneHard Dubai Location';
  settings.mapEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14441.53127814421!2d55.20138978500201!3d25.1058204642436!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f6b86abce0411%3A0xb30b534e35183864!2sNadd%20Hessa%20-%20Dubai%20-%20United%20Arab%20Emirates!5e0!3m2!1sen!2seg!4v1714400000000!5m2!1sen!2seg';
  settings.copyrightText = '© BoneHard. UAE - Dubai';
  settings.logoUrl = '/assets/logo/new_logo.webp';
  settings.faviconUrl = '/assets/logo/new_logo.webp';
  logoFile.value = null;
  faviconFile.value = null;
}

async function saveBrand() {
  saving.value = true;
  try {
    const formData = new FormData();
    formData.append('siteName', settings.siteName);
    formData.append('addressCity', settings.addressCity);
    formData.append('mapTitle', settings.mapTitle);
    formData.append('mapEmbedUrl', settings.mapEmbedUrl);
    formData.append('copyrightText', settings.copyrightText);

    if (logoFile.value) {
      formData.append('logo', logoFile.value);
    } else if (settings.logoUrl === '/assets/logo/new_logo.webp') {
      formData.append('clearLogo', 'true');
    }

    if (faviconFile.value) {
      formData.append('favicon', faviconFile.value);
    } else if (settings.faviconUrl === '/assets/logo/new_logo.webp') {
      formData.append('clearFavicon', 'true');
    }

    const response = await api.upload('/api/admin/site-settings', formData, { method: 'PATCH' });
    copySettings(response.data);
    logoFile.value = null;
    faviconFile.value = null;
    showToast('Site settings saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saving.value = false;
  }
}

async function saveSocial() {
  const formData = new FormData();
  appendFormData(formData, {
    label: socialForm.label,
    type: socialForm.type,
    target: normalizeWhatsappTarget(socialForm.type, socialForm.target),
    sortOrder: socialForm.sortOrder,
    isActive: socialForm.isActive,
  });

  const path = socialForm.id
    ? `/api/admin/site-settings/social-links/${socialForm.id}`
    : '/api/admin/site-settings/social-links';
  const response = await api.upload(path, formData, { method: socialForm.id ? 'PATCH' : 'POST' });
  socialLinks.value = response.data || [];
  resetSocialForm();
  showToast('Social link saved', 'success');
}

function editSocial(link) {
  Object.assign(socialForm, {
    id: link.id,
    label: link.label,
    type: link.type,
    target: link.target,
    sortOrder: link.sortOrder,
    isActive: link.isActive,
  });
  activeSection.value = 'social';
}

async function deleteSocial(id) {
  const response = await api.delete(`/api/admin/site-settings/social-links/${id}`);
  socialLinks.value = response.data || [];
  showToast('Social link deleted', 'success');
}

async function saveRecipient() {
  // Send only the fields the backend expects — avoids undefined bind errors
  const payload = {
    email: recipientForm.email,
    isActive: recipientForm.isActive,
  };
  const response = recipientForm.id
    ? await api.patch(`/api/admin/site-settings/contact-recipients/${recipientForm.id}`, payload)
    : await api.post('/api/admin/site-settings/contact-recipients', payload);
  recipients.value = response.data || [];
  resetRecipientForm();
  showToast('Recipient saved', 'success');
}

function editRecipient(recipient) {
  Object.assign(recipientForm, recipient);
  activeSection.value = 'recipients';
}

async function deleteRecipient(id) {
  const response = await api.delete(`/api/admin/site-settings/contact-recipients/${id}`);
  recipients.value = response.data || [];
  showToast('Recipient deleted', 'success');
}

onMounted(loadSettings);
</script>

<template>
  <section class="admin-page-stack site-settings-page">
    <div class="admin-panel">
      <header class="admin-panel-header">
        <div>
          <p class="admin-kicker">Site Control</p>
          <h2>Settings</h2>
          <span class="admin-muted">Manage brand identity, social links, and Connect Us submissions.</span>
        </div>
      </header>

      <p v-if="loading" class="admin-loading">Loading settings...</p>
      <p v-else-if="error" class="admin-error">{{ error }}</p>

      <div v-else class="settings-layout">
        <nav class="settings-sidebar">
          <button
            v-for="section in sections"
            :key="section.key"
            class="settings-sidebar__item"
            :class="{ 'settings-sidebar__item--active': activeSection === section.key }"
            type="button"
            @click="activeSection = section.key"
          >
            {{ section.label }}
          </button>
        </nav>

        <div class="settings-content">
          <form v-if="activeSection === 'brand'" class="admin-form admin-form-section" @submit.prevent="saveBrand">
            <div class="site-settings-preview">
              <img :src="settings.logoUrl" alt="Current logo" />
              <span>{{ settings.siteName }}</span>
            </div>
            <label class="admin-field admin-field--wide">
              <span>Site Name</span>
              <input v-model="settings.siteName" required maxlength="160" />
            </label>
            <div class="admin-field-group">
              <label class="admin-field admin-field--image">
                <span>Logo</span>
                <div class="image-upload-box">
                  <img v-if="logoPreview" :src="logoPreview" alt="Logo Preview" />
                  <div class="image-upload-overlay">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Change Logo</span>
                  </div>
                </div>
                <input type="file" class="visually-hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" @change="logoFile = $event.target.files?.[0] || null" />
              </label>

              <label class="admin-field admin-field--image">
                <span>Favorite Icon</span>
                <div class="image-upload-box">
                  <img v-if="faviconPreview" :src="faviconPreview" alt="Favicon Preview" class="favicon-preview" />
                  <div class="image-upload-overlay">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Change Favicon</span>
                  </div>
                </div>
                <input type="file" class="visually-hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" @change="faviconFile = $event.target.files?.[0] || null" />
              </label>
            </div>
            <label class="admin-field">
              <span>Address</span>
              <input v-model="settings.addressCity" maxlength="190" />
            </label>
            <label class="admin-field">
              <span>Map Title</span>
              <input v-model="settings.mapTitle" maxlength="190" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Map Embed URL</span>
              <input v-model="settings.mapEmbedUrl" type="url" maxlength="700" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Copyright</span>
              <input v-model="settings.copyrightText" maxlength="190" />
            </label>
            <div class="admin-form-actions">
              <button class="admin-primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save Brand' }}</button>
              <button class="admin-danger-button" type="button" @click="resetBrandToDefault" :disabled="saving">Reset Default</button>
            </div>
          </form>

          <div v-else-if="activeSection === 'social'" class="settings-subsection">
            <form class="admin-form admin-form-section" @submit.prevent="saveSocial">
              <label class="admin-field">
                <span>Icons</span>
                <AdminSelect v-model="socialForm.label" :options="socialPlatformOptions" required @change="handlePlatformChange" />
              </label>
              <label class="admin-field" style="grid-column: span 2;">
                <span>URL / WhatsApp Number</span>
                <input v-model="socialForm.target" required maxlength="700" :placeholder="socialForm.label === 'WhatsApp' ? '+971 50 000 0000' : 'https://...'" />
              </label>
              <label class="admin-field">
                <span>Sort Order</span>
                <input type="number" v-model="socialForm.sortOrder" />
              </label>
              <label class="admin-field admin-check" style="justify-content: center; margin-top: 1.5rem;">
                <input type="checkbox" v-model="socialForm.isActive" /> Active
              </label>
              <div style="display: flex; gap: 1rem; align-items: flex-end;">
                <button class="admin-primary-button" type="submit" style="flex: 1;">{{ socialForm.id ? 'Update' : 'Add' }} Link</button>
                <button v-if="socialForm.id" class="admin-link-button" type="button" @click="resetSocialForm">Cancel</button>
              </div>
            </form>

            <div class="admin-list-grid">
              <article v-for="link in socialLinks" :key="link.id" class="admin-card compact-card">
                <h3>{{ link.label }}</h3>
                <p>{{ link.type }} · {{ link.target }}</p>
                <div class="admin-actions admin-actions--spaced">
                  <span class="admin-muted">{{ link.isActive ? 'Active' : 'Hidden' }}</span>
                  <button class="admin-link-button" type="button" @click="editSocial(link)">Edit</button>
                  <button class="admin-danger-button" type="button" @click="deleteSocial(link.id)">Delete</button>
                </div>
              </article>
            </div>
          </div>

          <div v-else-if="activeSection === 'recipients'" class="settings-subsection">
            <form class="admin-form admin-form-section" @submit.prevent="saveRecipient">
              <label class="admin-field" style="grid-column: span 2;">
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 1.25rem; height: 1.25rem; color: #ef4444;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline stroke-linecap="round" stroke-linejoin="round" points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Connect Email
                </span>
                <input v-model="recipientForm.email" required type="email" maxlength="190" placeholder="user@gmail.com" />
              </label>
              <button class="admin-primary-button" type="submit">{{ recipientForm.id ? 'Update Recipient' : 'Add Recipient' }}</button>
              <button v-if="recipientForm.id" class="admin-link-button" type="button" @click="resetRecipientForm">Cancel</button>
            </form>

            <div class="admin-list-grid">
              <article v-for="recipient in recipients" :key="recipient.id" class="admin-card compact-card">
                <h3 style="display: flex; align-items: center; gap: 0.5rem; word-break: break-all;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 1.25rem; height: 1.25rem; color: #ef4444;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline stroke-linecap="round" stroke-linejoin="round" points="22,6 12,13 2,6"></polyline>
                  </svg>
                  {{ recipient.email }}
                </h3>
                <div class="admin-actions admin-actions--spaced">
                  <button class="admin-link-button" type="button" @click="editRecipient(recipient)">Edit</button>
                  <button class="admin-danger-button" type="button" @click="deleteRecipient(recipient.id)">Delete</button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-form-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
}

.admin-field-group {
  grid-column: 1 / -1;
  display: flex;
  gap: 2rem;
  margin-bottom: 0.5rem;
}

.admin-field--image {
  flex: 1;
}

.image-upload-box {
  position: relative;
  width: 100%;
  height: 140px;
  border: 2px dashed rgba(var(--rgb-accent), 0.2);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rgb-background), 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-upload-box:hover {
  border-color: rgba(var(--rgb-accent), 0.6);
  background: rgba(var(--rgb-background), 0.6);
}

.image-upload-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: opacity 0.3s ease;
  padding: 1rem;
}

.favicon-preview {
  max-width: 80px !important;
  max-height: 80px !important;
}

.image-upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rgb-background), 0.6);
  color: white;
  opacity: 0;
  transition: opacity 0.3s ease;
  backdrop-filter: blur(2px);
  gap: 0.5rem;
}

.image-upload-overlay svg {
  width: 28px;
  height: 28px;
}

.image-upload-overlay span {
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 0;
}

.image-upload-box:hover .image-upload-overlay {
  opacity: 1;
}

.site-settings-preview {
  display: none;
}

.billing-settings-hero {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(var(--rgb-accent), 0.16);
  border-radius: 0.75rem;
  background: rgba(var(--rgb-foreground), 0.035);
}

.billing-settings-hero h3 {
  margin: 0;
  color: var(--color-text-strong);
}

.billing-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(var(--rgb-accent), 0.18);
  border-radius: 999px;
  color: var(--color-text-strong);
  font-weight: 900;
  cursor: pointer;
}

.billing-toggle input {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: #f8d9aa;
}

@media (max-width: 720px) {
  .billing-settings-hero {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
