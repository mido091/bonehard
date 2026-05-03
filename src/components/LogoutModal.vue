<!--
  LogoutModal.vue
  ─────────────────────────────────────────────────────
  Global logout confirmation modal — mounted once at the root App level.
  Visibility is controlled by authState.isLogoutModalOpen, which any
  component can toggle via openLogoutModal() / closeLogoutModal() from
  the authStore without needing to pass props or emit events.

  On confirm: calls logout() then redirects to the home page.
  On cancel:  calls closeLogoutModal() — no state change.
-->
<script setup>
import { useRouter } from 'vue-router';
import { authState, closeLogoutModal, logout } from '../stores/authStore';

const router = useRouter();

async function handleConfirm() {
  await logout();
  closeLogoutModal();
  router.push('/');
}
</script>

<template>
  <transition name="modal-fade">
    <div v-if="authState.isLogoutModalOpen" class="logout-modal-overlay">
      <div class="logout-modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <h2 id="logout-title" class="logout-modal-title">Confirm Logout</h2>
        <p class="logout-modal-copy">
          Are you sure you want to log out of your account?
        </p>
        <div class="logout-modal-actions">
          <button class="admin-link-button" type="button" @click="closeLogoutModal">
            Cancel
          </button>
          <button class="admin-danger-button" type="button" @click="handleConfirm">
            Logout
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.logout-modal-overlay {
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

.logout-modal-card {
  width: min(100%, 26rem);
  padding: 1.5rem;
  border: 1px solid rgba(var(--rgb-accent), 0.16);
  border-radius: 0.9rem;
  background: #121212;
  box-shadow: 0 24px 80px rgba(var(--rgb-background), 0.5);
}

.logout-modal-title {
  margin: 0 0 0.7rem;
  color: var(--color-text-strong);
  font-size: 1.35rem;
  line-height: 1.15;
  text-align: center;
}

.logout-modal-copy {
  margin: 0 0 1.5rem;
  color: rgba(var(--rgb-foreground), 0.66);
  line-height: 1.55;
  text-align: center;
}

.logout-modal-actions {
  display: flex;
  gap: 1rem;
}

.logout-modal-actions button {
  flex: 1;
}
</style>
