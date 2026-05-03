<!--
  ForgotPasswordView.vue  (Route: /forgot-password)
  ───────────────────────────────────────────────────────────────────
  3-step password reset flow:
    Step 1 — Email input  → POST /api/auth/forgot-password
    Step 2 — OTP verify   → POST /api/auth/verify-otp
    Step 3 — New password → POST /api/auth/reset-password
-->
<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSiteSettings } from '../../composables/useSiteSettings';
import { api } from '../../services/api';

const router = useRouter();
const { hero, loadSiteSettings } = useSiteSettings();
loadSiteSettings();

// ── State ─────────────────────────────────────────────────────────
const step        = ref(1);   // 1 = email, 2 = otp, 3 = new password
const email       = ref('');
const otp         = ref('');
const resetToken  = ref('');
const newPassword = ref('');
const confirmPass = ref('');
const showPass    = ref(false);
const loading     = ref(false);
const error       = ref('');
const success     = ref('');

// ── Computed ──────────────────────────────────────────────────────
const passwordsMatch = computed(() => newPassword.value === confirmPass.value);
const stepTitle = computed(() => {
  if (step.value === 1) return 'Forgot Password';
  if (step.value === 2) return 'Enter OTP Code';
  return 'Set New Password';
});
const stepSubtitle = computed(() => {
  if (step.value === 1) return 'Enter your email and we\'ll send you a reset code.';
  if (step.value === 2) return `A 6-digit code was sent to ${email.value}`;
  return 'Choose a strong, new password.';
});

// ── OTP Input helper (auto-advance between digit boxes) ───────────
const otpDigits  = ref(['', '', '', '', '', '']);
const otpRefs    = ref([]);

function onOtpInput(index, e) {
  const val = e.target.value.replace(/\D/g, '').slice(-1);
  otpDigits.value[index] = val;
  otp.value = otpDigits.value.join('');
  if (val && index < 5) otpRefs.value[index + 1]?.focus();
}

function onOtpKeydown(index, e) {
  if (e.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpRefs.value[index - 1]?.focus();
  }
}

function onOtpPaste(e) {
  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
  if (!pasted) return;
  e.preventDefault();
  pasted.split('').forEach((d, i) => { otpDigits.value[i] = d; });
  otp.value = otpDigits.value.join('');
}

// ── Step handlers ─────────────────────────────────────────────────

/** Step 1: send OTP email */
async function submitEmail() {
  error.value = '';
  loading.value = true;
  try {
    await api.post('/api/auth/forgot-password', { email: email.value });
    step.value = 2;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Something went wrong.';
  } finally {
    loading.value = false;
  }
}

/** Step 2: verify OTP, receive resetToken */
async function submitOtp() {
  error.value = '';
  if (otp.value.length !== 6) {
    error.value = 'Please enter the full 6-digit code.';
    return;
  }
  loading.value = true;
  try {
    const res = await api.post('/api/auth/verify-otp', { email: email.value, otp: otp.value });
    resetToken.value = res.data.resetToken;
    step.value = 3;
  } catch (err) {
    error.value = err.response?.data?.message || 'Invalid or expired OTP.';
    // Clear OTP boxes on failure
    otpDigits.value = ['', '', '', '', '', ''];
    otp.value = '';
  } finally {
    loading.value = false;
  }
}

/** Step 3: set new password */
async function submitNewPassword() {
  error.value = '';
  if (!passwordsMatch.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  loading.value = true;
  try {
    await api.post('/api/auth/reset-password', {
      email:       email.value,
      resetToken:  resetToken.value,
      newPassword: newPassword.value,
    });
    success.value = 'Password reset successfully! Redirecting to login...';
    setTimeout(() => router.push('/login'), 2500);
  } catch (err) {
    error.value = err.response?.data?.message || 'Reset failed. Please start over.';
  } finally {
    loading.value = false;
  }
}

/** Resend OTP (goes back to step 1 logic but keeps the email) */
async function resendOtp() {
  error.value = '';
  otpDigits.value = ['', '', '', '', '', ''];
  otp.value = '';
  loading.value = true;
  try {
    await api.post('/api/auth/forgot-password', { email: email.value });
    error.value = '';
    success.value = 'A new code has been sent.';
    setTimeout(() => { success.value = ''; }, 3000);
  } catch {
    error.value = 'Failed to resend code. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="fp-shell">
    <!-- Background grid decoration -->
    <div class="fp-bg-grid" aria-hidden="true"></div>
    <div class="fp-glow" aria-hidden="true"></div>

    <main class="fp-card" role="main">

      <!-- Logo -->
      <div class="fp-logo-wrap">
        <img
          v-if="hero.logo"
          :src="hero.logo"
          alt="BoneHard"
          class="fp-logo"
          width="140"
          height="56"
        />
      </div>

      <!-- Step indicator -->
      <div class="fp-steps" aria-label="Progress">
        <span
          v-for="n in 3"
          :key="n"
          class="fp-step-dot"
          :class="{ active: step === n, done: step > n }"
        >
          <svg v-if="step > n" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span v-else>{{ n }}</span>
        </span>
      </div>

      <!-- Heading -->
      <header class="fp-header">
        <h1 class="fp-title">{{ stepTitle }}</h1>
        <p class="fp-subtitle">{{ stepSubtitle }}</p>
      </header>

      <!-- ── STEP 1: Email ── -->
      <form v-if="step === 1" class="fp-form" @submit.prevent="submitEmail" novalidate>
        <div class="fp-field">
          <label class="fp-label" for="fp-email">Email Address</label>
          <div class="fp-input-wrap">
            <svg class="fp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              id="fp-email"
              v-model="email"
              type="email"
              class="fp-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
        </div>

        <p v-if="error" class="fp-error" role="alert">{{ error }}</p>

        <button class="fp-btn" type="submit" :disabled="loading || !email">
          <span v-if="loading" class="fp-spinner" aria-hidden="true"></span>
          {{ loading ? 'Sending...' : 'Send Reset Code' }}
        </button>

        <div class="fp-back">
          <button type="button" class="fp-link" @click="router.push('/login')">
            ← Back to Login
          </button>
        </div>
      </form>

      <!-- ── STEP 2: OTP ── -->
      <form v-else-if="step === 2" class="fp-form" @submit.prevent="submitOtp" novalidate>
        <div class="fp-otp-wrap" @paste="onOtpPaste">
          <input
            v-for="(_, i) in otpDigits"
            :key="i"
            :ref="el => otpRefs[i] = el"
            v-model="otpDigits[i]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="fp-otp-box"
            :aria-label="`Digit ${i + 1}`"
            @input="onOtpInput(i, $event)"
            @keydown="onOtpKeydown(i, $event)"
          />
        </div>

        <p v-if="error" class="fp-error" role="alert">{{ error }}</p>
        <p v-if="success" class="fp-success" role="status">{{ success }}</p>

        <button class="fp-btn" type="submit" :disabled="loading || otp.length < 6">
          <span v-if="loading" class="fp-spinner" aria-hidden="true"></span>
          {{ loading ? 'Verifying...' : 'Verify Code' }}
        </button>

        <div class="fp-back">
          <button type="button" class="fp-link" @click="resendOtp" :disabled="loading">
            Didn't receive it? Resend
          </button>
          <button type="button" class="fp-link" @click="step = 1; error = ''">
            ← Change Email
          </button>
        </div>
      </form>

      <!-- ── STEP 3: New Password ── -->
      <form v-else class="fp-form" @submit.prevent="submitNewPassword" novalidate>
        <div class="fp-field">
          <label class="fp-label" for="fp-newpass">New Password</label>
          <div class="fp-input-wrap">
            <svg class="fp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="fp-newpass"
              v-model="newPassword"
              :type="showPass ? 'text' : 'password'"
              class="fp-input"
              placeholder="Min 8 chars, upper, lower, number"
              autocomplete="new-password"
              minlength="8"
              required
            />
            <button type="button" class="fp-eye" @click="showPass = !showPass" :aria-label="showPass ? 'Hide password' : 'Show password'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <template v-if="!showPass">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </template>
                <template v-else>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </template>
              </svg>
            </button>
          </div>
        </div>

        <div class="fp-field">
          <label class="fp-label" for="fp-confirmpass">Confirm Password</label>
          <div class="fp-input-wrap" :class="{ 'fp-input-wrap--error': confirmPass && !passwordsMatch }">
            <svg class="fp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <input
              id="fp-confirmpass"
              v-model="confirmPass"
              :type="showPass ? 'text' : 'password'"
              class="fp-input"
              placeholder="Repeat your password"
              autocomplete="new-password"
              required
            />
            <button type="button" class="fp-eye" @click="showPass = !showPass" :aria-label="showPass ? 'Hide password' : 'Show password'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <template v-if="!showPass">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </template>
                <template v-else>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </template>
              </svg>
            </button>
          </div>
          <p v-if="confirmPass && !passwordsMatch" class="fp-field-error">Passwords do not match</p>
        </div>

        <p v-if="error" class="fp-error" role="alert">{{ error }}</p>
        <p v-if="success" class="fp-success" role="status">{{ success }}</p>

        <button
          class="fp-btn"
          type="submit"
          :disabled="loading || !passwordsMatch || newPassword.length < 8"
        >
          <span v-if="loading" class="fp-spinner" aria-hidden="true"></span>
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>

    </main>
  </div>
</template>

<style scoped>
/* ── Shell & Background ── */
.fp-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0b0b10;
  position: relative;
  overflow: hidden;
  padding: 2rem 1rem;
}

.fp-bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(var(--rgb-accent), 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--rgb-accent), 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.fp-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--rgb-accent), 0.06) 0%, transparent 70%);
  top: -150px;
  right: -150px;
  pointer-events: none;
}

/* ── Card ── */
.fp-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid rgba(var(--rgb-accent), 0.12);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 64px rgba(var(--rgb-background), 0.5);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Logo ── */
.fp-logo-wrap { text-align: center; }
.fp-logo { max-height: 56px; width: auto; object-fit: contain; }

/* ── Step Dots ── */
.fp-steps {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.fp-step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(var(--rgb-accent), 0.2);
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(var(--rgb-accent), 0.4);
  transition: all 0.3s ease;
}

.fp-step-dot.active {
  border-color: var(--color-text);
  color: var(--color-text);
  background: rgba(var(--rgb-accent), 0.08);
  box-shadow: 0 0 16px rgba(var(--rgb-accent), 0.2);
}

.fp-step-dot.done {
  border-color: #34d399;
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

.fp-step-dot svg {
  width: 14px;
  height: 14px;
  stroke: #34d399;
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ── Header ── */
.fp-header { text-align: center; }
.fp-title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text-strong);
  letter-spacing: 0.5px;
}
.fp-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(var(--rgb-foreground), 0.55);
  line-height: 1.5;
}

/* ── Form ── */
.fp-form { display: flex; flex-direction: column; gap: 1rem; }

.fp-field { display: flex; flex-direction: column; gap: 6px; }
.fp-label { font-size: 0.8rem; font-weight: 600; color: rgba(var(--rgb-foreground), 0.7); text-transform: uppercase; letter-spacing: 0.5px; }

.fp-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(var(--rgb-foreground), 0.04);
  border: 1px solid rgba(var(--rgb-foreground), 0.1);
  border-radius: 12px;
  transition: all 0.2s;
}
.fp-input-wrap:focus-within {
  border-color: rgba(var(--rgb-accent), 0.5);
  background: rgba(var(--rgb-foreground), 0.06);
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.08);
}
.fp-input-wrap--error { border-color: rgba(239, 68, 68, 0.5); }

.fp-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: rgba(var(--rgb-foreground), 0.35);
  flex-shrink: 0;
  pointer-events: none;
}

.fp-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-strong);
  font-size: 0.95rem;
  padding: 14px 14px 14px 44px;
  width: 100%;
  box-sizing: border-box;
}
.fp-input::placeholder { color: rgba(var(--rgb-foreground), 0.3); }

.fp-eye {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(var(--rgb-foreground), 0.4);
  padding: 4px;
  display: grid;
  place-items: center;
  transition: color 0.2s;
}
.fp-eye:hover { color: var(--color-text); }
.fp-eye svg { width: 18px; height: 18px; }

.fp-field-error {
  margin: 0;
  font-size: 0.78rem;
  color: #f87171;
}

/* ── OTP Boxes ── */
.fp-otp-wrap {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.fp-otp-box {
  width: 52px;
  height: 60px;
  text-align: center;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-text);
  background: rgba(var(--rgb-accent), 0.04);
  border: 2px solid rgba(var(--rgb-accent), 0.15);
  border-radius: 12px;
  outline: none;
  caret-color: var(--color-text);
  transition: all 0.2s;
  font-family: 'Courier New', monospace;
}
.fp-otp-box:focus {
  border-color: var(--color-text);
  background: rgba(var(--rgb-accent), 0.08);
  box-shadow: 0 0 0 3px rgba(var(--rgb-accent), 0.1);
}

/* ── Button ── */
.fp-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: #FFEDD4;
  color: #0b0b10;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 0.5rem;
}
.fp-btn:hover:not(:disabled) {
  background: #fff3e0;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(var(--rgb-accent), 0.2);
}
.fp-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* ── Spinner ── */
.fp-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(11, 11, 16, 0.3);
  border-top-color: #0b0b10;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Feedback ── */
.fp-error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  font-size: 0.875rem;
  text-align: center;
}

.fp-success {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.25);
  color: #34d399;
  font-size: 0.875rem;
  text-align: center;
}

/* ── Back / Links row ── */
.fp-back {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.fp-link {
  background: none;
  border: none;
  color: rgba(var(--rgb-accent), 0.6);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.fp-link:hover:not(:disabled) { color: var(--color-text); }
.fp-link:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Responsive ── */
@media (max-width: 480px) {
  .fp-card { padding: 2rem 1.25rem; }
  .fp-otp-box { width: 44px; height: 54px; font-size: 1.4rem; }
}

[data-theme="light"] .fp-shell {
  background: #f8fafc;
}

[data-theme="light"] .fp-bg-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
}

[data-theme="light"] .fp-glow {
  background: radial-gradient(circle, rgba(255, 237, 213, 0.82) 0%, transparent 68%);
}

[data-theme="light"] .fp-card {
  background: rgba(255, 255, 255, 0.94);
  border-color: #e2e8f0;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

[data-theme="light"] .fp-title {
  color: #0f172a;
}

[data-theme="light"] .fp-subtitle,
[data-theme="light"] .fp-label {
  color: #64748b;
}

[data-theme="light"] .fp-step-dot {
  border-color: #cbd5e1;
  color: #64748b;
  background: #ffffff;
}

[data-theme="light"] .fp-step-dot.active {
  border-color: #b45309;
  color: #92400e;
  background: #fff7ed;
  box-shadow: 0 0 0 4px rgba(180, 83, 9, 0.08);
}

[data-theme="light"] .fp-step-dot.done {
  border-color: #86efac;
  background: #ecfdf5;
  color: #047857;
}

[data-theme="light"] .fp-input-wrap {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
}

[data-theme="light"] .fp-input-wrap:focus-within {
  background: #ffffff;
  border-color: #b45309;
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.14);
}

[data-theme="light"] .fp-icon,
[data-theme="light"] .fp-eye {
  color: #64748b;
}

[data-theme="light"] .fp-input {
  color: #0f172a;
}

[data-theme="light"] .fp-input::placeholder {
  color: #94a3b8;
}

[data-theme="light"] .fp-otp-box {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #0f172a;
  caret-color: #b45309;
}

[data-theme="light"] .fp-otp-box:focus {
  border-color: #b45309;
  background: #fff7ed;
  box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.14);
}

[data-theme="light"] .fp-btn {
  background: #ffedd5;
  border: 1px solid #fed7aa;
  color: #111827;
  box-shadow: 0 14px 28px rgba(180, 83, 9, 0.14);
}

[data-theme="light"] .fp-btn:hover:not(:disabled) {
  background: #fed7aa;
  box-shadow: 0 18px 34px rgba(180, 83, 9, 0.18);
}

[data-theme="light"] .fp-link {
  color: #475569;
}

[data-theme="light"] .fp-link:hover:not(:disabled) {
  color: #b45309;
}

[data-theme="light"] .fp-error,
[data-theme="light"] .fp-field-error {
  color: #b91c1c;
}

[data-theme="light"] .fp-error {
  background: #fef2f2;
  border-color: #fecaca;
}

[data-theme="light"] .fp-success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
}
</style>
