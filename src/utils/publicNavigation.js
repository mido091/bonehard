import { authState, isAuthenticated, loadCurrentUser } from '../stores/authStore';

export const DASHBOARD_ORDER_PATH = '/dashboard/orders/new';

export function isServicesNavigationItem(item) {
  return item?.label === 'Services';
}

export async function routeServicesNavigation(router) {
  if (!authState.ready || !authState.user) {
    await loadCurrentUser({ force: true });
  }

  if (isAuthenticated()) {
    await router.push(DASHBOARD_ORDER_PATH);
    return;
  }

  await router.push({ name: 'register', query: { redirect: DASHBOARD_ORDER_PATH } });
}

export function safeDashboardRedirect(redirect) {
  return typeof redirect === 'string'
    && redirect.startsWith('/dashboard')
    && !redirect.startsWith('//')
    ? redirect
    : '';
}
