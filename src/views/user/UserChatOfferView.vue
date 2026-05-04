<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '../../composables/useToast';
import { api } from '../../services/api';

const router = useRouter();
const { showToast } = useToast();

const loading = ref(true);
const submitting = ref(false);
const modalOpen = ref(false);
const error = ref('');
const proofFile = ref(null);
const state = ref({
  settings: { paymentEnabled: false, planPrice: 0, walletNumber: '', instapayHandle: '' },
  chatEnabled: false,
  latestSubmission: null,
});

const form = reactive({
  transferPhone: '',
});

const settings = computed(() => state.value.settings || {});
const latestSubmission = computed(() => state.value.latestSubmission);
const isPending = computed(() => latestSubmission.value?.status === 'pending');
const isRejected = computed(() => latestSubmission.value?.status === 'rejected');
const paidEnabled = computed(() => settings.value.paymentEnabled);
const canStartChat = computed(() => !paidEnabled.value || state.value.chatEnabled);

function formatMoney(value) {
  return `EGP ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

async function loadOffer() {
  loading.value = true;
  try {
    const response = await api.get('/api/user/chat-offer');
    state.value = response.data;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function startNow() {
  if (canStartChat.value) {
    router.push('/dashboard/chats');
    return;
  }
  modalOpen.value = true;
}

async function submitPayment() {
  if (!proofFile.value) {
    showToast('Payment proof is required', 'error');
    return;
  }

  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('transferPhone', form.transferPhone);
    formData.append('files', proofFile.value);
    const response = await api.upload('/api/user/chat-payment-submissions', formData);
    state.value.latestSubmission = response.data;
    modalOpen.value = false;
    proofFile.value = null;
    form.transferPhone = '';
    showToast('Please wait while your payment is reviewed.', 'success');
    await loadOffer();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadOffer);
</script>

<template>
  <section class="chat-offer-page">
    <p v-if="loading" class="admin-loading">Loading chat plan...</p>
    <p v-else-if="error" class="admin-error">{{ error }}</p>

    <template v-else>
      <div class="chat-offer-hero">
        <div>
          <p class="admin-kicker">New Service</p>
          <h2>Quick Free Consultations</h2>
          <p>Quick consultations with the BoneHard team for order questions and follow-up.</p>
        </div>
        <span class="chat-offer-badge">{{ paidEnabled ? 'Paid Plan' : 'Limited Time' }}</span>
      </div>

      <div class="chat-plan-card">
        <div class="chat-plan-card__header">
          <div>
            <p class="admin-kicker">Starter access</p>
            <h3>Team Chat</h3>
          </div>
          <div class="chat-plan-price">
            <small v-if="!paidEnabled && Number(settings.planPrice || 0) > 0">{{ formatMoney(settings.planPrice) }}</small>
            <strong>{{ paidEnabled ? formatMoney(settings.planPrice) : 'EGP 0' }}</strong>
          </div>
        </div>

        <p class="chat-plan-card__copy">
          Start a direct chat with a BoneHard team member for quick inquiries before or during the preparation of your order.
        </p>

        <ul class="chat-plan-card__features" aria-label="Chat service benefits">
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>Direct communication with admin or assistant only</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{{ paidEnabled ? 'Payment review required before chat access' : 'No cost during the promotional period' }}</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>Suitable for quick questions and following up on details</li>
        </ul>

        <div v-if="isPending" class="chat-offer-state">
          Payment under review. Please wait while your payment is reviewed.
        </div>
        <div v-else-if="isRejected" class="chat-offer-state chat-offer-state--rejected">
          Your previous payment was rejected. You can submit new payment details.
        </div>
        <div v-else-if="paidEnabled && state.chatEnabled" class="chat-offer-state chat-offer-state--approved">
          Chat access is active.
        </div>

        <button class="admin-primary-button chat-plan-card__cta" type="button" :disabled="isPending" @click="startNow">
          {{ canStartChat ? 'Start Now' : isRejected ? 'Submit Again' : 'Choose Plan' }}
        </button>
      </div>
    </template>

    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="modalOpen" class="payment-modal-backdrop" @click.self="modalOpen = false">
          <form class="payment-modal" @submit.prevent="submitPayment">
            <header class="payment-modal__header">
              <div>
                <p class="admin-kicker">Payment Review</p>
                <h3>Submit Chat Plan Payment</h3>
              </div>
              <button type="button" class="users-modal__close" @click="modalOpen = false">×</button>
            </header>

            <div class="payment-destinations">
              <div>
                <span>Wallet Number</span>
                <strong>{{ settings.walletNumber || 'Not configured' }}</strong>
              </div>
              <div>
                <span>Instapay Account / Number</span>
                <strong>{{ settings.instapayHandle || 'Not configured' }}</strong>
              </div>
            </div>

            <label class="admin-field">
              <span>Transfer Phone / Account Number</span>
              <input v-model="form.transferPhone" required maxlength="60" placeholder="Number used for transfer" />
            </label>

            <label class="admin-field">
              <span>Payment Proof</span>
              <input required type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" @change="proofFile = $event.target.files?.[0] || null" />
            </label>

            <footer class="payment-modal__footer">
              <button class="admin-link-button" type="button" :disabled="submitting" @click="modalOpen = false">Cancel</button>
              <button class="admin-primary-button" type="submit" :disabled="submitting">
                {{ submitting ? 'Submitting...' : 'Submit Payment for Review' }}
              </button>
            </footer>
          </form>
        </div>
      </transition>
    </Teleport>
  </section>
</template>

<style scoped>
.chat-offer-page { display: grid; gap: 1rem; }
.chat-offer-hero,
.chat-plan-card {
  border: 1px solid rgba(var(--rgb-accent), 0.12);
  border-radius: 0.75rem;
  background: radial-gradient(circle at top right, rgba(248, 217, 170, 0.11), transparent 36%), rgba(var(--rgb-foreground), 0.03);
  box-shadow: 0 16px 44px rgba(var(--rgb-background), 0.26);
}
.chat-offer-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem; }
.chat-offer-hero h2,
.chat-plan-card h3 { margin: 0; color: var(--color-text-strong); }
.chat-offer-hero h2 { font-size: clamp(1.65rem, 4vw, 2.6rem); }
.chat-offer-hero p:not(.admin-kicker),
.chat-plan-card__copy { max-width: 42rem; margin: 0.5rem 0 0; color: rgba(var(--rgb-foreground), 0.64); line-height: 1.7; }
.chat-offer-badge { flex: 0 0 auto; padding: 0.42rem 0.7rem; border: 1px solid rgba(52, 211, 153, 0.28); border-radius: 999px; color: #34d399; background: rgba(52, 211, 153, 0.1); font-size: 0.74rem; font-weight: 900; text-transform: uppercase; }
.chat-plan-card { display: grid; gap: 1.15rem; max-width: 46rem; padding: 1.25rem; }
.chat-plan-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.chat-plan-price {
  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  text-align: right;
}
.chat-plan-price small {
  display: block;
  color: rgba(var(--rgb-foreground), 0.42);
  font-size: 0.86rem;
  font-weight: 900;
  line-height: 1;
  text-decoration: line-through;
  text-decoration-thickness: 0.12em;
  text-decoration-color: rgba(var(--rgb-foreground), 0.55);
  white-space: nowrap;
}
.chat-plan-price strong {
  display: block;
  color: #f8d9aa;
  font-size: clamp(2.1rem, 7vw, 4rem);
  line-height: 0.95;
  white-space: nowrap;
}
.chat-plan-card__features { display: grid; gap: 0.65rem; margin: 0; padding: 0; list-style: none; }
.chat-plan-card__features li { display: flex; align-items: center; gap: 0.65rem; color: rgba(var(--rgb-foreground), 0.78); line-height: 1.55; }
.chat-plan-card__features svg { width: 1rem; height: 1rem; flex: 0 0 auto; fill: none; stroke: #34d399; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.chat-plan-card__cta { justify-self: start; }
.chat-offer-state { padding: 0.8rem; border: 1px solid rgba(248, 217, 170, 0.18); border-radius: 0.65rem; color: #f8d9aa; background: rgba(248, 217, 170, 0.08); font-weight: 800; }
.chat-offer-state--approved { border-color: rgba(52, 211, 153, 0.22); color: #34d399; background: rgba(52, 211, 153, 0.08); }
.chat-offer-state--rejected { border-color: rgba(248, 113, 113, 0.22); color: #f87171; background: rgba(248, 113, 113, 0.08); }
.payment-modal-backdrop { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(var(--rgb-background), 0.74); backdrop-filter: blur(10px); }
.payment-modal { width: min(100%, 34rem); max-height: calc(100dvh - 2rem); overflow-y: auto; display: grid; gap: 1rem; padding: 1.2rem; border: 1px solid rgba(var(--rgb-accent), 0.18); border-radius: 0.9rem; background: #111; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46); }
.payment-modal__header,
.payment-modal__footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.payment-modal__header h3 { margin: 0; color: var(--color-text-strong); }
.payment-destinations { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.payment-destinations div { display: grid; gap: 0.3rem; padding: 0.8rem; border-radius: 0.65rem; background: rgba(var(--rgb-foreground), 0.04); }
.payment-destinations span { color: rgba(var(--rgb-foreground), 0.55); font-size: 0.72rem; font-weight: 900; text-transform: uppercase; }
.payment-destinations strong { overflow-wrap: anywhere; color: var(--color-text-strong); }
@media (max-width: 720px) {
  .chat-offer-hero,
  .chat-plan-card__header,
  .payment-modal__footer { flex-direction: column; align-items: stretch; }
  .chat-plan-price { align-items: flex-start; min-width: 0; text-align: left; }
  .chat-plan-card__cta,
  .payment-modal__footer button { width: 100%; }
  .payment-destinations { grid-template-columns: 1fr; }
}

:global([data-theme="light"]) .chat-offer-hero,
:global([data-theme="light"]) .chat-plan-card {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

:global([data-theme="light"]) .chat-offer-hero p:not(.admin-kicker),
:global([data-theme="light"]) .chat-plan-card__copy,
:global([data-theme="light"]) .chat-plan-card__features li {
  color: #475569;
}

:global([data-theme="light"]) .chat-plan-price strong {
  color: #b45309;
}

:global([data-theme="light"]) .payment-modal-backdrop {
  background: rgba(15, 23, 42, 0.38);
}

:global([data-theme="light"]) .payment-modal {
  border-color: #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

:global([data-theme="light"]) .payment-modal__header h3 {
  color: #0f172a;
}

:global([data-theme="light"]) .payment-destinations div {
  background: #f8fafc;
}

:global([data-theme="light"]) .payment-destinations span {
  color: #64748b;
}

:global([data-theme="light"]) .payment-destinations strong {
  color: #0f172a;
}
</style>
