<script setup>
import { onMounted, reactive, ref, computed } from 'vue';
import { useToast } from '../../composables/useToast';
import { api } from '../../services/api';

const { showToast } = useToast();

const loading = ref(true);
const submissions = ref([]);
const submissionMeta = ref(null);
const submissionFilters = reactive({ status: '' });

async function loadSubmissions() {
  loading.value = true;
  try {
    const query = new URLSearchParams({ page: '1', perPage: '100' });
    const response = await api.get(`/api/admin/contact-submissions?${query}`);
    // The server returns the array in response.data directly
    submissions.value = response.data || [];
    submissionMeta.value = response.meta || null;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loading.value = false;
  }
}

const filteredSubmissions = computed(() => {
  if (!submissionFilters.status) return submissions.value;
  if (submissionFilters.status === 'new') {
    return submissions.value.filter(s => s.status?.toLowerCase() !== 'reviewed');
  }
  if (submissionFilters.status === 'reviewed') {
    return submissions.value.filter(s => s.status?.toLowerCase() === 'reviewed');
  }
  return submissions.value;
});

function setFilter(status) {
  submissionFilters.status = status;
}

async function markAsReviewed(id) {
  try {
    const response = await api.patch(`/api/admin/contact-submissions/${id}`, {
      status: 'reviewed'
    });
    const index = submissions.value.findIndex(s => s.id === id);
    if (index !== -1) submissions.value[index] = response.data;
    showToast('Message marked as reviewed', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSubmission(id) {
  if (!confirm('Delete this message?')) return;
  try {
    await api.delete(`/api/admin/contact-submissions/${id}`);
    submissions.value = submissions.value.filter(s => s.id !== id);
    showToast('Deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function formatUrl(url) {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

onMounted(loadSubmissions);
</script>

<template>
  <section class="admin-page-stack messages-page">
    <header class="admin-page-header">
      <div class="admin-container">
        <div class="header-content">
          <div class="title-group">
            <span class="admin-badge">Communication</span>
            <h1>Messages</h1>
          </div>
          
          <div class="filter-pills">
            <button 
              class="pill-btn" 
              :class="{ 'pill-btn--active': submissionFilters.status === '' }"
              @click="setFilter('')"
            >All</button>
            <button 
              class="pill-btn" 
              :class="{ 'pill-btn--active': submissionFilters.status === 'new' }"
              @click="setFilter('new')"
            >New</button>
            <button 
              class="pill-btn" 
              :class="{ 'pill-btn--active': submissionFilters.status === 'reviewed' }"
              @click="setFilter('reviewed')"
            >Reviewed</button>
          </div>
        </div>
      </div>
    </header>

    <div class="admin-container">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
      </div>

      <transition-group name="msg-fade" tag="div" v-else class="messages-grid">
        <article 
          v-for="msg in filteredSubmissions" 
          :key="msg.id" 
          class="msg-card"
          :class="{ 'msg-card--new': msg.status?.toLowerCase() !== 'reviewed', 'msg-card--reviewed': msg.status?.toLowerCase() === 'reviewed' }"
        >
          <div class="msg-card-top">
            <div class="sender-info">
              <div class="sender-avatar">
                {{ msg.contactName.charAt(0).toUpperCase() }}
              </div>
              <div>
                <h3 class="sender-name">{{ msg.contactName }}</h3>
                <span class="msg-date">{{ new Date(msg.createdAt).toLocaleDateString() }}</span>
              </div>
            </div>
            <div class="status-indicator">
              <span v-if="msg.status?.toLowerCase() === 'reviewed'" class="status-label status-label--reviewed">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Reviewed
              </span>
              <span v-else class="status-label status-label--new">New</span>
            </div>
          </div>

          <div class="msg-contact-bar">
            <div class="contact-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {{ msg.contactEmail }}
            </div>
            <div class="contact-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {{ msg.contactNumber }}
            </div>
          </div>

          <div class="msg-content-area">
            <div class="scope-tag">
              <strong>Scope:</strong> {{ msg.scopeOfWork }}
            </div>
            <div class="message-text">
              {{ msg.message || 'No additional message provided.' }}
            </div>
            <div v-if="msg.fileLink && msg.fileLink.trim()" class="file-attachment">
              <a :href="formatUrl(msg.fileLink)" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                View Swiss Transfer Files
              </a>
            </div>
            <div v-else class="no-file-text">
              No files attached.
            </div>
          </div>

          <div class="msg-card-footer">
            <div class="footer-actions">
              <div class="left-actions">
                <button 
                  v-if="msg.status?.toLowerCase() !== 'reviewed'" 
                  class="btn-reviewed" 
                  @click="markAsReviewed(msg.id)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Reviewed
                </button>
                <div v-else class="reviewed-status-text">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Reviewed
                </div>
              </div>
              <button class="btn-delete" @click="deleteSubmission(msg.id)">Delete</button>
            </div>
          </div>
        </article>
      </transition-group>

      <div v-if="!loading && !filteredSubmissions.length" class="empty-state">
        <p>No messages found.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.messages-page {
  padding-bottom: 3rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 2rem;
}

.filter-pills {
  display: flex;
  gap: 0.5rem;
  background: rgba(var(--rgb-foreground), 0.03);
  padding: 0.4rem;
  border-radius: 14px;
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
}

.pill-btn {
  padding: 0.6rem 1.25rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--rgb-foreground), 0.5);
  transition: all 0.25s ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.pill-btn--active {
  background: #FFEDD4;
  color: #000;
  box-shadow: 0 4px 15px rgba(var(--rgb-accent), 0.25);
}

.messages-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1100px) {
  .messages-grid {
    grid-template-columns: 1fr;
  }
}

/* Animations */
.msg-fade-move,
.msg-fade-enter-active,
.msg-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.msg-fade-enter-from,
.msg-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.msg-fade-leave-active {
  position: absolute;
  z-index: 0;
}

.msg-card {
  background: rgba(25, 25, 25, 0.4);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 20px;
  backdrop-filter: blur(12px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.msg-card:hover {
  background: rgba(25, 25, 25, 0.5);
  border-color: rgba(var(--rgb-foreground), 0.15);
}

.msg-card--new {
  border-left: 4px solid #FFEDD4;
}

.msg-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.sender-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.sender-avatar {
  width: 44px;
  height: 44px;
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-text);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.2rem;
  border: 1px solid rgba(var(--rgb-accent), 0.15);
}

.sender-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-strong);
}

.msg-date {
  font-size: 0.75rem;
  color: rgba(var(--rgb-foreground), 0.4);
}

.status-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  letter-spacing: 0.5px;
}

.status-label--reviewed {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.status-label--new {
  background: rgba(var(--rgb-accent), 0.1);
  color: var(--color-text);
  border: 1px solid rgba(var(--rgb-accent), 0.2);
}

.msg-contact-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--rgb-background), 0.2);
  border-radius: 14px;
}

.contact-item {
  font-size: 0.85rem;
  color: rgba(var(--rgb-foreground), 0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.msg-content-area {
  flex: 1;
}

.scope-tag {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  color: rgba(var(--rgb-foreground), 0.5);
}

.message-text {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(var(--rgb-foreground), 0.85);
  white-space: pre-wrap;
  margin-bottom: 1.5rem;
}

.file-attachment a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  padding: 0.6rem 1rem;
  background: rgba(var(--rgb-accent), 0.1);
  border-radius: 8px;
  border: 1px solid rgba(var(--rgb-accent), 0.15);
  transition: all 0.2s;
}

.file-attachment a:hover {
  background: rgba(var(--rgb-accent), 0.2);
}

.no-file-text {
  font-size: 0.85rem;
  color: rgba(var(--rgb-foreground), 0.4);
  font-style: italic;
}

.msg-card-footer {
  margin-top: auto;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(var(--rgb-foreground), 0.05);
}

.footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-actions {
  display: flex;
  gap: 0.75rem;
}

.reviewed-status-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #4ade80;
  font-weight: 700;
  font-size: 0.9rem;
}

.btn-reviewed {
  background: #FFEDD4;
  color: #000;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s;
}

.btn-reviewed:hover {
  transform: scale(1.02);
}

.btn-delete {
  background: transparent;
  color: rgba(239, 68, 68, 0.6);
  border: none;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}

.btn-delete:hover {
  color: #f87171;
}

.loading-overlay {
  display: flex;
  justify-content: center;
  padding: 5rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(var(--rgb-accent), 0.1);
  border-top-color: var(--color-text);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: 5rem;
  color: rgba(var(--rgb-foreground), 0.3);
}

@media (max-width: 768px) {
  .header-content { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>

<style>
[data-theme="light"] .messages-page .admin-page-header {
  background: transparent;
}

[data-theme="light"] .messages-page .admin-badge {
  color: #475569;
}

[data-theme="light"] .messages-page .filter-pills {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

[data-theme="light"] .messages-page .pill-btn {
  color: #64748b;
}

[data-theme="light"] .messages-page .pill-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

[data-theme="light"] .messages-page .pill-btn--active {
  background: #ffedd5;
  color: #7c2d12;
  box-shadow: 0 8px 20px rgba(180, 83, 9, 0.14);
}

[data-theme="light"] .messages-page .msg-card {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  backdrop-filter: none;
}

[data-theme="light"] .messages-page .msg-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 22px 55px rgba(15, 23, 42, 0.11);
}

[data-theme="light"] .messages-page .msg-card--new {
  border-left-color: #d97706;
}

[data-theme="light"] .messages-page .sender-avatar {
  background: #fff7ed;
  color: #b45309;
  border-color: #fed7aa;
}

[data-theme="light"] .messages-page .sender-name,
[data-theme="light"] .messages-page .message-text {
  color: #0f172a;
}

[data-theme="light"] .messages-page .msg-date,
[data-theme="light"] .messages-page .scope-tag,
[data-theme="light"] .messages-page .no-file-text {
  color: #64748b;
}

[data-theme="light"] .messages-page .msg-contact-bar {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

[data-theme="light"] .messages-page .contact-item {
  color: #475569;
}

[data-theme="light"] .messages-page .status-label--new {
  background: #fff7ed;
  color: #b45309;
  border-color: #fed7aa;
}

[data-theme="light"] .messages-page .status-label--reviewed {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

[data-theme="light"] .messages-page .file-attachment a {
  background: #fff7ed;
  color: #b45309;
  border-color: #fed7aa;
}

[data-theme="light"] .messages-page .file-attachment a:hover {
  background: #ffedd5;
  color: #7c2d12;
}

[data-theme="light"] .messages-page .msg-card-footer {
  border-top-color: #e2e8f0;
}

[data-theme="light"] .messages-page .btn-reviewed {
  background: #ffedd5;
  color: #111827;
  border: 1px solid #fed7aa;
}

[data-theme="light"] .messages-page .reviewed-status-text {
  color: #047857;
}

[data-theme="light"] .messages-page .btn-delete {
  color: #dc2626;
}

[data-theme="light"] .messages-page .btn-delete:hover {
  color: #991b1b;
}

[data-theme="light"] .messages-page .empty-state,
[data-theme="light"] .messages-page .loading-overlay {
  color: #64748b;
}
</style>
