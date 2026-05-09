<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../services/api';
import { getPusherClient, disconnectPusherClient } from '../../services/pusherClient';
import { authState } from '../../stores/authStore';

const router = useRouter();

// ── State ─────────────────────────────────────────────────────────────────
const conversations = ref([]);
const messages = ref([]);
const activeConversation = ref(null);
const messageBody = ref('');
const loading = ref(true);
const sending = ref(false);
const error = ref('');
const search = ref('');
const activeType = ref('all');
const messagesEl = ref(null);

// Mobile specific state
const showSidebarOnMobile = ref(true);

// New chat modal
const showNewChat = ref(false);
const newChatType = ref('direct');
const newGroupName = ref('');
const allUsers = ref([]);
const selectedUserIds = ref([]);
const loadingUsers = ref(false);
const creating = ref(false);

// Delete chat modal
const showDeleteModal = ref(false);
const conversationToDelete = ref(null);
const deleting = ref(false);

let activeChannel = null;
let pusher = null;

// ── Computed ──────────────────────────────────────────────────────────────
const filteredConversations = computed(() => {
  let list = conversations.value;
  if (activeType.value !== 'all') list = list.filter(c => c.type === activeType.value);
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(c => c.name?.toLowerCase().includes(q));
  }
  return list;
});

const activeTitle = computed(() => activeConversation.value?.name || 'Select a conversation');
const isUserChat = computed(() => authState.user?.role === 'user');
const availableTabs = computed(() => (isUserChat.value ? ['all', 'direct'] : ['all', 'direct', 'group']));
const activeTypeLabel = computed(() => {
  if (isUserChat.value) return 'BoneHard Team';
  return activeConversation.value?.type === 'direct' ? 'Direct Message' : activeConversation.value?.type === 'group' ? 'Group Chat' : '';
});
const currentUserId = computed(() => authState.user?.id);

// ── Helpers ───────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  });
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function isMyMessage(msg) {
  return Number(msg.senderId) === Number(currentUserId.value);
}

// ── Data Loading ──────────────────────────────────────────────────────────
async function loadConversations() {
  const response = await api.get('/api/chats/conversations?page=1&perPage=50');
  conversations.value = response.data || [];
}

async function openConversation(conversation) {
  activeConversation.value = conversation;

  // Unsubscribe from previous channel
  if (activeChannel && pusher) {
    activeChannel.unbind_all();
    pusher.unsubscribe(activeChannel.name);
    activeChannel = null;
  }

  const response = await api.get(`/api/chats/${conversation.id}/messages?page=1&perPage=80`);
  messages.value = response.data || [];
  scrollToBottom();

  // Hide sidebar on mobile when a chat is opened
  showSidebarOnMobile.value = false;

  // Mark read
  api.patch(`/api/chats/${conversation.id}/read`).catch(() => {});
  conversation.unreadCount = 0;

  // Subscribe to Pusher channel
  pusher = await getPusherClient();
  activeChannel = pusher.subscribe(`presence-chat-group-${conversation.id}`);

  activeChannel.bind('message.created', (msg) => {
    if (Number(msg.groupId) === Number(activeConversation.value?.id)) {
      if (!messages.value.some(m => m.id === msg.id)) {
        messages.value = [...messages.value, msg];
        scrollToBottom();
      }
      api.patch(`/api/chats/${activeConversation.value.id}/read`).catch(() => {});
    }
  });

  activeChannel.bind('conversation.deleted', ({ conversationId }) => {
    if (Number(conversationId) === Number(activeConversation.value?.id)) {
      conversations.value = conversations.value.filter(c => c.id !== conversationId);
      activeConversation.value = null;
      messages.value = [];
    }
  });
}

async function sendMessage() {
  const body = messageBody.value.trim();
  if (!body || !activeConversation.value || sending.value) return;
  sending.value = true;
  try {
    const response = await api.post(`/api/chats/${activeConversation.value.id}/messages`, { body });
    if (!messages.value.some(m => m.id === response.data.id)) {
      messages.value = [...messages.value, response.data];
      scrollToBottom();
    }
    messageBody.value = '';
  } finally {
    sending.value = false;
    nextTick(() => {
       const textarea = document.querySelector('.chat-compose__input');
       if (textarea) textarea.focus();
    });
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function backToList() {
  activeConversation.value = null;
  messages.value = [];
  showSidebarOnMobile.value = true;
}

function confirmDelete(conv) {
  conversationToDelete.value = conv;
  showDeleteModal.value = true;
}

function cancelDelete() {
  showDeleteModal.value = false;
  conversationToDelete.value = null;
}

async function executeDelete() {
  if (!conversationToDelete.value) return;
  const conv = conversationToDelete.value;
  deleting.value = true;
  try {
    await api.delete(`/api/chats/${conv.id}`);
    conversations.value = conversations.value.filter(c => c.id !== conv.id);
    if (activeConversation.value?.id === conv.id) {
      activeConversation.value = null;
      messages.value = [];
    }
    showDeleteModal.value = false;
    conversationToDelete.value = null;
  } finally {
    deleting.value = false;
  }
}

// ── New Chat Modal ────────────────────────────────────────────────────────
async function openNewChat() {
  showNewChat.value = true;
  newChatType.value = 'direct';
  newGroupName.value = '';
  selectedUserIds.value = [];
  loadingUsers.value = true;
  try {
    const r = await api.get('/api/chats/contacts');
    // Filter out the current user so they don't chat with themselves
    allUsers.value = (r.data || []).filter(u => Number(u.id) !== Number(currentUserId.value));
  } catch(err) {
    allUsers.value = [];
  } finally {
    loadingUsers.value = false;
  }
}

function toggleUser(id) {
  if (isUserChat.value || newChatType.value === 'direct') {
     selectedUserIds.value = [id]; // Only one selection for direct
  } else {
     const idx = selectedUserIds.value.indexOf(id);
     if (idx === -1) selectedUserIds.value.push(id);
     else selectedUserIds.value.splice(idx, 1);
  }
}

function closeModal() {
  showNewChat.value = false;
}

async function createChat() {
  if (!selectedUserIds.value.length) return;
  if (newChatType.value === 'group' && !newGroupName.value.trim()) return;
  creating.value = true;
  try {
    const response = await api.post('/api/chats/conversations', {
      type: isUserChat.value ? 'direct' : newChatType.value,
      name: isUserChat.value ? undefined : newGroupName.value.trim() || undefined,
      memberIds: selectedUserIds.value,
    });
    showNewChat.value = false;
    await loadConversations();
    const created = conversations.value.find(c => c.id === response.data.id);
    if (created) await openConversation(created);
  } finally {
    creating.value = false;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    await loadConversations();
    if (conversations.value[0]) await openConversation(conversations.value[0]);
  } catch (err) {
    if (authState.user?.role === 'user' && err.status === 403) {
      router.replace('/dashboard/chats/offer');
      return;
    }
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (activeChannel && pusher) {
    activeChannel.unbind_all();
    pusher.unsubscribe(activeChannel.name);
  }
});
</script>

<template>
  <div class="chat-container">
    
    <div v-if="loading" class="chat-loader">
      <div class="spinner"></div>
      <p>Connecting to Chat...</p>
    </div>

    <div v-else-if="error" class="chat-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>{{ error }}</p>
    </div>

    <div v-else class="chat-wrapper glass-panel" :class="{ 'chat-mobile-chat-open': !showSidebarOnMobile }">
      
      <!-- ── SIDEBAR ── -->
      <aside class="chat-sidebar">
        <!-- Sidebar Header -->
        <div class="sidebar-header">
          <h2>Messages</h2>
          <button class="btn-new-chat" @click="openNewChat" title="New Conversation">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="sidebar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>
          <input v-model="search" type="text" placeholder="Search conversations..." />
        </div>

        <!-- Tabs -->
        <div class="sidebar-tabs">
          <button v-for="tab in availableTabs" :key="tab"
            class="tab-btn" :class="{ active: activeType === tab }"
            @click="activeType = tab">
            {{ tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Groups' }}
          </button>
        </div>

        <!-- Conversation List -->
        <div class="sidebar-list custom-scrollbar">
          <div v-if="!filteredConversations.length" class="empty-list">
             {{ search ? 'No matching conversations' : 'No conversations yet' }}
          </div>
          
          <button 
            v-for="conv in filteredConversations" :key="conv.id"
            class="conv-item"
            :class="{ active: activeConversation?.id === conv.id }"
            @click="openConversation(conv)"
          >
            <div class="conv-avatar" :class="conv.type">
               {{ getInitials(conv.name) }}
            </div>
            <div class="conv-info">
               <div class="conv-info-top">
                 <span class="conv-name">{{ conv.name }}</span>
                 <span class="conv-time">{{ formatDate(conv.lastMessageAt) }}</span>
               </div>
               <div class="conv-info-bottom">
                 <span class="conv-preview">{{ conv.type === 'direct' ? 'Direct Message' : 'Group Chat' }}</span>
                 <span v-if="conv.unreadCount" class="badge-unread">{{ conv.unreadCount }}</span>
               </div>
            </div>
          </button>
        </div>
      </aside>

      <!-- ── MAIN CHAT AREA ── -->
      <main class="chat-main">
        <template v-if="activeConversation">
          
          <!-- Chat Header -->
          <header class="main-header">
            <div class="header-info">
               <button class="btn-back-mobile" @click="backToList" title="Back to list">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
               </button>
               <div class="header-avatar" :class="activeConversation.type">
                 {{ getInitials(activeTitle) }}
               </div>
               <div>
                 <h3 class="header-title">{{ activeTitle }}</h3>
                 <span class="header-subtitle">{{ activeTypeLabel }}</span>
               </div>
            </div>
            <button v-if="!isUserChat && activeConversation.canDelete" class="btn-delete" @click="confirmDelete(activeConversation)" title="Delete Conversation">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </header>

          <!-- Messages List -->
          <div class="main-messages custom-scrollbar" ref="messagesEl">
            <div v-if="!messages.length" class="empty-messages">
               <div class="empty-icon">👋</div>
               <p>No messages here yet.<br>Send a message to start the conversation!</p>
            </div>

            <div 
              v-for="msg in messages" 
              :key="msg.id" 
              class="message-wrapper"
              :class="{ 'message-mine': isMyMessage(msg), 'message-other': !isMyMessage(msg) }"
            >
               <div class="message-avatar" v-if="!isMyMessage(msg)">
                 {{ getInitials(msg.senderName) }}
               </div>
               <div class="message-content">
                  <div class="message-meta" v-if="!isMyMessage(msg)">
                    <span class="sender-name">{{ msg.senderName || 'System' }}</span>
                    <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
                  </div>
                  <div class="message-bubble">
                     {{ msg.body }}
                  </div>
                  <div class="message-meta meta-right" v-if="isMyMessage(msg)">
                    <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
                  </div>
               </div>
            </div>
          </div>

          <!-- Composer -->
          <form class="main-composer" @submit.prevent="sendMessage">
            <div class="composer-inner">
               <textarea
                 v-model="messageBody"
                 rows="1"
                 placeholder="Type your message..."
                 class="composer-input custom-scrollbar"
                 @keydown="handleKeydown"
               ></textarea>
               <button type="submit" class="btn-send" :disabled="!messageBody.trim() || sending">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
               </button>
            </div>
          </form>

        </template>

        <!-- No Selection State -->
        <div v-else class="chat-unselected">
           <div class="unselected-icon">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
           </div>
           <h3>Your Messages</h3>
           <p>Select a conversation from the sidebar or start a new one to begin chatting.</p>
           <button class="btn-primary" @click="openNewChat">
             Start New Conversation
           </button>
        </div>
      </main>

    </div>

    <!-- ── NEW CHAT MODAL (FIXED OVERLAY) ── -->
    <Transition name="fade">
      <div v-if="showNewChat" class="fixed-modal-overlay" @mousedown.self="closeModal">
        <div class="fixed-modal-content">
          
          <header class="modal-header">
             <h3>New Conversation</h3>
             <button class="btn-close" @click="closeModal">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>
          </header>

          <div class="modal-body">
             <div v-if="!isUserChat" class="type-selector">
                <button :class="{ active: newChatType === 'direct' }" @click="newChatType = 'direct'; selectedUserIds = []">
                  Direct Message
                </button>
                <button :class="{ active: newChatType === 'group' }" @click="newChatType = 'group'; selectedUserIds = []">
                  Group Chat
                </button>
             </div>

             <div v-if="!isUserChat && newChatType === 'group'" class="form-group">
                <label>Group Name</label>
                <input v-model="newGroupName" type="text" placeholder="e.g. Design Team Sync" class="glass-input" />
             </div>

             <div class="form-group">
                <label>{{ isUserChat ? 'Select a team member' : newChatType === 'direct' ? 'Select a user' : 'Select members' }}</label>
                
                <div v-if="loadingUsers" class="users-loader">Loading users...</div>
                
                <div v-else class="users-list custom-scrollbar">
                   <div v-if="!allUsers.length" class="empty-list">No users available</div>
                   
                   <button 
                     v-for="user in allUsers" :key="user.id"
                     class="user-item"
                     :class="{ selected: selectedUserIds.includes(user.id) }"
                     @click="toggleUser(user.id)"
                   >
                     <div class="user-avatar">{{ getInitials(user.name) }}</div>
                     <div class="user-info">
                        <strong>{{ user.name }}</strong>
                        <span v-if="!isUserChat">{{ user.role }} - {{ user.email }}</span>
                     </div>
                     <div class="user-check">
                        <svg v-if="selectedUserIds.includes(user.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                     </div>
                   </button>
                </div>
             </div>
          </div>

          <footer class="modal-footer">
             <button class="btn-secondary" @click="closeModal">Cancel</button>
             <button class="btn-primary" :disabled="!selectedUserIds.length || creating || (newChatType==='group' && !newGroupName.trim())" @click="createChat">
               {{ creating ? 'Creating...' : 'Start Chat' }}
             </button>
          </footer>

        </div>
      </div>
    </Transition>

    <!-- ── DELETE CONFIRMATION MODAL ── -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="system-modal-overlay" @mousedown.self="cancelDelete">
        <div class="system-modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <h2 id="delete-title" class="system-modal-title">Delete Conversation</h2>
          <p class="system-modal-copy">
            Are you sure you want to delete the conversation <strong>"{{ conversationToDelete?.name }}"</strong>?<br>
            This action is permanent and cannot be undone.
          </p>
          <div class="system-modal-actions">
            <button class="admin-link-button" type="button" @click="cancelDelete" :disabled="deleting">
              Cancel
            </button>
            <button class="admin-danger-button" type="button" @click="executeDelete" :disabled="deleting">
              {{ deleting ? 'Deleting...' : 'Yes, Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ── BASE & VARIABLES ── */
.chat-container {
  height: calc(100vh - 5rem);
  padding: 1.5rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--rgb-foreground), 0.08);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(var(--rgb-background), 0.2);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--rgb-foreground),0.1); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--rgb-foreground),0.2); }

/* ── LAYOUT ── */
.chat-wrapper {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── SIDEBAR ── */
.chat-sidebar {
  width: 340px;
  min-width: 340px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(var(--rgb-foreground), 0.08);
  background: rgba(var(--rgb-background), 0.2);
  transition: transform 0.3s ease, width 0.3s ease;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
}
.sidebar-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text, #FFEDD4);
}
.btn-new-chat {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: none;
  background: var(--color-text, #FFEDD4);
  color: var(--color-bg, #000);
  display: grid; place-items: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(var(--rgb-accent), 0.15);
  transition: all 0.2s ease;
}
.btn-new-chat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(var(--rgb-accent), 0.25);
}
.btn-new-chat svg { width: 18px; height: 18px; }

.sidebar-search {
  margin: 0 1.5rem 1rem;
  position: relative;
}
.sidebar-search svg {
  position: absolute;
  left: 12px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; color: #94a3b8;
}
.sidebar-search input {
  width: 100%;
  background: rgba(var(--rgb-foreground),0.04);
  border: 1px solid rgba(var(--rgb-foreground),0.08);
  border-radius: 10px;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  color: white; font-size: 0.9rem;
  transition: all 0.2s;
  box-sizing: border-box;
}
.sidebar-search input:focus {
  border-color: var(--color-text, #FFEDD4);
  background: rgba(var(--rgb-foreground),0.08);
  outline: none;
}

.sidebar-tabs {
  display: flex;
  margin: 0 1.5rem 1rem;
  background: rgba(var(--rgb-foreground),0.05);
  padding: 4px;
  border-radius: 8px;
}
.tab-btn {
  flex: 1; padding: 6px 0;
  border: none; background: transparent;
  color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); font-size: 0.8rem; font-weight: 500;
  border-radius: 6px; cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: rgba(var(--rgb-accent),0.1);
  color: var(--color-text, #FFEDD4);
  box-shadow: 0 2px 4px rgba(var(--rgb-background),0.2);
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1rem;
  display: flex; flex-direction: column; gap: 4px;
}
.conv-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer; text-align: left;
  transition: all 0.2s;
}
.conv-item:hover {
  background: rgba(var(--rgb-accent),0.04);
}
.conv-item.active {
  background: rgba(var(--rgb-accent),0.08);
  border-color: rgba(var(--rgb-accent),0.15);
}

.conv-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center;
  font-weight: 700; font-size: 1rem; flex-shrink: 0;
  background: rgba(var(--rgb-accent),0.1);
  color: var(--color-text, #FFEDD4);
}

.conv-info { flex: 1; min-width: 0; }
.conv-info-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.conv-name { font-size: 0.95rem; font-weight: 600; color: var(--color-text-strong, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-time { font-size: 0.75rem; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); }
.conv-info-bottom { display: flex; justify-content: space-between; align-items: center; }
.conv-preview { font-size: 0.8rem; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge-unread {
  background: var(--color-text, #FFEDD4); color: var(--color-bg, #000);
  font-size: 0.7rem; font-weight: 700;
  padding: 2px 6px; border-radius: 99px;
}

/* ── MAIN CHAT AREA ── */
.chat-main {
  flex: 1;
  display: flex; flex-direction: column;
  position: relative;
}

.main-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid rgba(var(--rgb-foreground),0.08);
  background: rgba(var(--rgb-foreground),0.02);
}
.header-info { display: flex; align-items: center; gap: 16px; }
.btn-back-mobile {
  display: none;
  background: rgba(var(--rgb-foreground),0.05); color: white;
  border: none; width: 40px; height: 40px; border-radius: 10px;
  place-items: center; cursor: pointer; transition: background 0.2s;
}
.btn-back-mobile:hover { background: rgba(var(--rgb-foreground),0.1); }
.btn-back-mobile svg { width: 24px; height: 24px; }
.header-avatar {
  width: 48px; height: 48px; border-radius: 14px;
  display: grid; place-items: center;
  font-weight: 700; font-size: 1.2rem;
  background: rgba(var(--rgb-accent),0.1);
  color: var(--color-text, #FFEDD4);
}
.header-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 4px 0; color: var(--color-text-strong, #fff); }
.header-subtitle { font-size: 0.85rem; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); }
.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444; border: none;
  width: 40px; height: 40px; border-radius: 10px;
  display: grid; place-items: center; cursor: pointer;
  transition: all 0.2s;
}
.btn-delete:hover { background: #ef4444; color: white; }
.btn-delete svg { width: 18px; height: 18px; }

/* Messages */
.main-messages {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 1.5rem;
}

.message-wrapper {
  display: flex; gap: 12px;
  max-width: 80%;
}
.message-mine {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.message-other {
  align-self: flex-start;
}

.message-avatar {
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(var(--rgb-foreground),0.1); color: white;
  display: grid; place-items: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
}

.message-content {
  display: flex; flex-direction: column; gap: 4px;
}
.message-mine .message-content { align-items: flex-end; }
.message-other .message-content { align-items: flex-start; }

.message-meta { display: flex; align-items: center; gap: 8px; margin: 0 4px; }
.sender-name { font-size: 0.8rem; font-weight: 600; color: var(--color-text-strong, #fff); }
.msg-time { font-size: 0.75rem; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); }

.message-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-strong, #fff);
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 4px 6px rgba(var(--rgb-background),0.1);
}

.message-other .message-bubble {
  background: rgba(var(--rgb-foreground),0.05);
  border: 1px solid rgba(var(--rgb-foreground),0.08);
  border-top-left-radius: 4px;
}

.message-mine .message-bubble {
  background: rgba(var(--rgb-accent),0.12);
  border: 1px solid rgba(var(--rgb-accent),0.2);
  border-top-right-radius: 4px;
}

/* Composer */
.main-composer {
  padding: 1.5rem 2rem;
  background: rgba(var(--rgb-background),0.3);
  border-top: 1px solid rgba(var(--rgb-foreground),0.05);
}
.composer-inner {
  display: flex; align-items: flex-end; gap: 12px;
  background: rgba(var(--rgb-foreground),0.03);
  border: 1px solid rgba(var(--rgb-foreground),0.08);
  border-radius: 16px;
  padding: 8px;
  transition: border-color 0.2s;
}
.composer-inner:focus-within { border-color: var(--color-text, #FFEDD4); background: rgba(var(--rgb-foreground),0.05); }

.composer-input {
  flex: 1;
  background: transparent; border: none; outline: none;
  color: var(--color-text-strong, #fff); font-size: 0.95rem;
  padding: 8px 12px;
  resize: none;
  max-height: 120px;
}
.composer-input::placeholder { color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); }

.btn-send {
  width: 44px; height: 44px; border-radius: 12px;
  border: none;
  background: var(--color-text, #FFEDD4);
  color: var(--color-bg, #000); cursor: pointer;
  display: grid; place-items: center; flex-shrink: 0;
  transition: all 0.2s;
}
.btn-send:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 12px rgba(var(--rgb-accent),0.2); }
.btn-send:disabled { background: rgba(var(--rgb-foreground),0.1); color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); cursor: not-allowed; }
.btn-send svg { width: 20px; height: 20px; }


/* Empty States */
.empty-list { text-align: center; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); font-size: 0.85rem; padding: 2rem 0; }
.empty-messages {
  margin: auto; text-align: center; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6));
}
.empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.8; }
.chat-unselected {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 2rem;
}
.unselected-icon {
  width: 80px; height: 80px; border-radius: 50%;
  background: rgba(var(--rgb-accent),0.1); color: var(--color-text, #FFEDD4);
  display: grid; place-items: center; margin-bottom: 1.5rem;
}
.unselected-icon svg { width: 40px; height: 40px; }
.chat-unselected h3 { font-size: 1.5rem; margin: 0 0 0.5rem; color: var(--color-text-strong, #fff); }
.chat-unselected p { color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); margin: 0 0 2rem; max-width: 300px; line-height: 1.5; }
.btn-primary {
  background: var(--color-text, #FFEDD4);
  color: var(--color-bg, #000); border: none; padding: 12px 24px; border-radius: 10px;
  font-weight: 600; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(var(--rgb-accent),0.15);
}
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(var(--rgb-accent),0.25); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Loader & Error */
.chat-loader, .chat-error {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
}
.spinner {
  width: 40px; height: 40px; border: 4px solid rgba(var(--rgb-foreground),0.1);
  border-left-color: var(--color-text, #FFEDD4); border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }


/* ── NEW CHAT MODAL ── */
.fixed-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(var(--rgb-background), 0.6);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}

.fixed-modal-content {
  background: #0f172a;
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(var(--rgb-background), 0.5);
  display: flex; flex-direction: column;
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.5rem; border-bottom: 1px solid rgba(var(--rgb-foreground),0.08);
}
.modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: white; }
.btn-close {
  background: transparent; border: none; color: #64748b; cursor: pointer;
  padding: 4px; transition: color 0.2s;
}
.btn-close:hover { color: white; }

.modal-body {
  padding: 1.5rem;
}

.type-selector {
  display: flex; gap: 8px; margin-bottom: 1.5rem;
  background: rgba(var(--rgb-foreground),0.05); padding: 6px; border-radius: 12px;
}
.type-selector button {
  flex: 1; padding: 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.type-selector button.active {
  background: rgba(var(--rgb-foreground),0.1); color: var(--color-text-strong, #fff); box-shadow: 0 2px 8px rgba(var(--rgb-background),0.2);
}

.form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.5rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-strong, #fff); }

.glass-input {
  background: rgba(var(--rgb-foreground),0.05); border: 1px solid rgba(var(--rgb-foreground),0.1);
  padding: 12px 16px; border-radius: 10px; color: var(--color-text-strong, #fff); outline: none; font-size: 1rem;
  transition: border-color 0.2s;
}
.glass-input:focus { border-color: var(--color-text, #FFEDD4); }

.users-list {
  max-height: 280px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(var(--rgb-background),0.2); border-radius: 12px; padding: 8px;
}
.user-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 10px; border: none; background: transparent;
  color: var(--color-text-strong, #fff); cursor: pointer; text-align: left; transition: all 0.2s;
}
.user-item:hover { background: rgba(var(--rgb-foreground),0.05); }
.user-item.selected { background: rgba(var(--rgb-accent),0.1); box-shadow: inset 0 0 0 1px rgba(var(--rgb-accent),0.3); }

.user-avatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--rgb-foreground),0.1); display: grid; place-items: center; font-weight: 700; flex-shrink: 0; }
.user-info { flex: 1; display: flex; flex-direction: column; }
.user-info strong { font-size: 0.95rem; }
.user-info span { font-size: 0.75rem; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); text-transform: capitalize; }
.user-check { width: 20px; color: var(--color-text, #FFEDD4); }

.modal-footer {
  padding: 1.25rem 1.5rem; border-top: 1px solid rgba(var(--rgb-foreground),0.08);
  display: flex; justify-content: flex-end; gap: 12px; background: rgba(var(--rgb-background),0.2); border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;
}
.btn-secondary {
  background: transparent; color: var(--color-text-muted, rgba(var(--rgb-foreground),0.6)); border: 1px solid rgba(var(--rgb-foreground),0.2);
  padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-secondary:hover { background: rgba(var(--rgb-foreground),0.05); color: var(--color-text-strong, #fff); }

/* System Standard Modal for Deletion */
.system-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(var(--rgb-background), 0.72);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.system-modal-card {
  width: min(100%, 26rem);
  padding: 1.5rem;
  border: 1px solid rgba(var(--rgb-accent), 0.16);
  border-radius: 0.9rem;
  background: #121212;
  box-shadow: 0 24px 80px rgba(var(--rgb-background), 0.5);
}

.system-modal-title {
  margin: 0 0 0.7rem;
  color: var(--color-text-strong);
  font-size: 1.35rem;
  line-height: 1.15;
  text-align: center;
}

.system-modal-copy {
  margin: 0 0 1.5rem;
  color: rgba(var(--rgb-foreground), 0.66);
  line-height: 1.55;
  text-align: center;
}

.system-modal-actions {
  display: flex;
  gap: 1rem;
}

.system-modal-actions button {
  flex: 1;
}

/* ── RESPONSIVE STYLES ── */
@media (max-width: 768px) {
  .chat-container {
    padding: 0;
    height: calc(100vh - 4rem); /* Adjust based on mobile header */
    border-radius: 0;
  }
  
  .glass-panel {
    border-radius: 0;
    border: none;
    border-top: 1px solid rgba(var(--rgb-foreground),0.08);
  }

  /* Sidebar takes full width by default */
  .chat-sidebar {
    width: 100%;
    min-width: 100%;
    border-right: none;
  }

  /* When chat is open, slide sidebar out and show main chat */
  .chat-wrapper.chat-mobile-chat-open .chat-sidebar {
    transform: translateX(-100%);
    width: 0;
    min-width: 0;
    opacity: 0;
  }
  
  .chat-main {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--color-bg, #000); /* hide sidebar behind it */
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }

  .chat-wrapper.chat-mobile-chat-open .chat-main {
    transform: translateX(0);
  }

  .btn-back-mobile {
    display: grid;
  }

  .main-header {
    padding: 1rem;
  }

  .main-messages {
    padding: 1rem;
  }

  .message-wrapper {
    max-width: 90%;
  }

  .main-composer {
    padding: 1rem;
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: scale(0.98); }

/* Light theme overrides live here because this view uses scoped CSS.
   They keep the chat UI crisp without changing chat behavior or layout. */
:global([data-theme="light"]) .chat-container {
  color: #0f172a;
}

:global([data-theme="light"]) .chat-wrapper.glass-panel {
  border-color: #cbd5e1;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.1);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global([data-theme="light"]) .chat-sidebar {
  border-right-color: #e2e8f0;
  background: #f8fafc;
}

:global([data-theme="light"]) .sidebar-header h2,
:global([data-theme="light"]) .header-title,
:global([data-theme="light"]) .conv-name,
:global([data-theme="light"]) .sender-name,
:global([data-theme="light"]) .chat-unselected h3,
:global([data-theme="light"]) .form-group label,
:global([data-theme="light"]) .user-item,
:global([data-theme="light"]) .system-modal-title,
:global([data-theme="light"]) .modal-header h3 {
  color: #0f172a;
}

:global([data-theme="light"]) .header-subtitle,
:global([data-theme="light"]) .conv-time,
:global([data-theme="light"]) .conv-preview,
:global([data-theme="light"]) .msg-time,
:global([data-theme="light"]) .empty-list,
:global([data-theme="light"]) .empty-messages,
:global([data-theme="light"]) .chat-unselected p,
:global([data-theme="light"]) .user-info span,
:global([data-theme="light"]) .system-modal-copy {
  color: #64748b;
}

:global([data-theme="light"]) .btn-new-chat,
:global([data-theme="light"]) .btn-send,
:global([data-theme="light"]) .btn-primary {
  background: #b45309;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(180, 83, 9, 0.18);
}

:global([data-theme="light"]) .btn-send:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  box-shadow: none;
}

:global([data-theme="light"]) .sidebar-search input,
:global([data-theme="light"]) .glass-input,
:global([data-theme="light"]) .composer-inner {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

:global([data-theme="light"]) .sidebar-search input::placeholder,
:global([data-theme="light"]) .composer-input::placeholder,
:global([data-theme="light"]) .glass-input::placeholder {
  color: #94a3b8;
}

:global([data-theme="light"]) .sidebar-search input:focus,
:global([data-theme="light"]) .glass-input:focus,
:global([data-theme="light"]) .composer-inner:focus-within {
  border-color: #b45309;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.12);
}

:global([data-theme="light"]) .sidebar-tabs,
:global([data-theme="light"]) .type-selector,
:global([data-theme="light"]) .users-list {
  background: #eef2f7;
}

:global([data-theme="light"]) .tab-btn,
:global([data-theme="light"]) .type-selector button,
:global([data-theme="light"]) .btn-secondary {
  color: #64748b;
}

:global([data-theme="light"]) .tab-btn.active,
:global([data-theme="light"]) .type-selector button.active {
  background: #ffffff;
  color: #92400e;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

:global([data-theme="light"]) .conv-item:hover,
:global([data-theme="light"]) .user-item:hover {
  background: #f1f5f9;
}

:global([data-theme="light"]) .conv-item.active,
:global([data-theme="light"]) .user-item.selected {
  border-color: #fed7aa;
  background: #fff7ed;
  box-shadow: inset 0 0 0 1px rgba(180, 83, 9, 0.08);
}

:global([data-theme="light"]) .conv-avatar,
:global([data-theme="light"]) .header-avatar,
:global([data-theme="light"]) .unselected-icon {
  background: #ffedd5;
  color: #92400e;
}

:global([data-theme="light"]) .message-avatar,
:global([data-theme="light"]) .user-avatar {
  background: #e2e8f0;
  color: #334155;
}

:global([data-theme="light"]) .chat-main {
  background: #ffffff;
}

:global([data-theme="light"]) .main-header,
:global([data-theme="light"]) .main-composer {
  border-color: #e2e8f0;
  background: #f8fafc;
}

:global([data-theme="light"]) .main-messages {
  background: #ffffff;
}

:global([data-theme="light"]) .btn-back-mobile {
  background: #f1f5f9;
  color: #334155;
}

:global([data-theme="light"]) .btn-back-mobile:hover,
:global([data-theme="light"]) .btn-secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}

:global([data-theme="light"]) .message-bubble {
  color: #0f172a;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

:global([data-theme="light"]) .message-other .message-bubble {
  border-color: #e2e8f0;
  background: #f8fafc;
}

:global([data-theme="light"]) .message-mine .message-bubble {
  border-color: #fed7aa;
  background: #fff7ed;
}

:global([data-theme="light"]) .composer-input {
  color: #0f172a;
}

:global([data-theme="light"]) .fixed-modal-overlay,
:global([data-theme="light"]) .system-modal-overlay {
  background: rgba(15, 23, 42, 0.38);
}

:global([data-theme="light"]) .fixed-modal-content,
:global([data-theme="light"]) .system-modal-card {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

:global([data-theme="light"]) .modal-header,
:global([data-theme="light"]) .modal-footer {
  border-color: #e2e8f0;
  background: #ffffff;
}

:global([data-theme="light"]) .modal-footer {
  background: #f8fafc;
}

:global([data-theme="light"]) .btn-close {
  color: #64748b;
}

:global([data-theme="light"]) .btn-close:hover {
  color: #0f172a;
}

:global([data-theme="light"]) .btn-secondary {
  border-color: #cbd5e1;
  background: #ffffff;
}

:global([data-theme="light"]) .system-modal-actions .admin-link-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #334155;
}

:global([data-theme="light"]) .system-modal-actions .admin-danger-button {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

:global([data-theme="light"]) .system-modal-actions .admin-danger-button:hover {
  background: #fee2e2;
  color: #991b1b;
}
</style>
