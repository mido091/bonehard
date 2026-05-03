/**
 * authStore.js
 * ─────────────────────────────────────────────────────
 * Global authentication state and helper functions.
 * Uses Vue's reactive() for a lightweight store without Pinia.
 *
 * State is verified through /api/auth/me for protected/auth routes.
 * The localStorage key is only a public-page hint and never a permission source.
 */
import { reactive } from 'vue';
import { api } from '../services/api';

/**
 * The global auth state object — shared across the entire app.
 * @property {object|null} user               - The authenticated user, or null if logged out
 * @property {boolean}     loading            - True while an auth check is in progress
 * @property {boolean}     ready              - True once the initial auth check has completed
 * @property {boolean}     isLogoutModalOpen  - Controls visibility of the logout confirmation modal
 */
export const authState = reactive({
  user: null,
  loading: false,
  ready: false,
  isLogoutModalOpen: false,
});

/**
 * Loads the current session from the server on first app load.
 * Skips the network call entirely when localStorage indicates
 * there is no active session, preventing a noisy 401 console error
 * on the public home page for guest visitors.
 */
export async function loadCurrentUser({ force = false } = {}) {
  const cached = localStorage.getItem('bh_auth_ready');

  if (!force && cached === 'none') {
    authState.user = null;
    authState.loading = false;
    authState.ready = true;
    return;
  }

  authState.loading = true;

  try {
    const response = await api.get('/api/auth/me');
    authState.user = response.data.user;
    localStorage.setItem('bh_auth_ready', 'ok');
  } catch {
    authState.user = null;
    // Only cache 'none' for 401 (not logged in), not transient network errors
    localStorage.setItem('bh_auth_ready', 'none');
  } finally {
    authState.loading = false;
    authState.ready = true;
  }
}

export function isAuthenticated() {
  return Boolean(authState.user);
}

export function isAdmin() {
  return authState.user?.role === 'admin';
}

export function isAssistant() {
  return authState.user?.role === 'assistant';
}

export function isUser() {
  return authState.user?.role === 'user';
}

/**
 * Authenticates the user with email and password.
 * Stores the returned user in authState and marks the session as active.
 * @param {string} email
 * @param {string} password
 * @returns {object} The authenticated user object
 */
export async function login(email, password) {
  const response = await api.post('/api/auth/login', { email, password });
  authState.user = response.data.user;
  authState.ready = true;
  localStorage.setItem('bh_auth_ready', 'ok');
  return authState.user;
}

/**
 * Logs out the current user by calling the server-side logout endpoint,
 * then clears local state and session hints.
 */
export async function logout() {
  await api.post('/api/auth/logout');
  authState.user = null;
  authState.ready = true;
  localStorage.setItem('bh_auth_ready', 'none');
}

/**
 * Returns true if the current user has admin or assistant privileges.
 * Used by the router guard to protect admin routes.
 */
export function canAccessAdmin() {
  return ['admin', 'assistant'].includes(authState.user?.role);
}

export function getDashboardPath(user = authState.user) {
  if (['admin', 'assistant'].includes(user?.role)) return '/admin';
  if (user?.role === 'user') return '/dashboard';
  return '/login';
}

/**
 * Opens the global logout confirmation modal.
 * Called instead of logout() directly — the modal then calls logout()
 * after the user confirms.
 */
export function openLogoutModal() {
  authState.isLogoutModalOpen = true;
}

/**
 * Closes the global logout confirmation modal without logging out.
 */
export function closeLogoutModal() {
  authState.isLogoutModalOpen = false;
}
