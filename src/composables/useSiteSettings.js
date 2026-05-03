import { computed, reactive } from 'vue';
import { api } from '../services/api';
import { heroContent, statsContent } from '../data/siteContent';

const state = reactive({
  loaded: false,
  loading: false,
  error: '',
  settings: {
    siteName: 'BoneHard',
    logo: heroContent.logo,
    favicon: heroContent.logo,
    address: statsContent.address,
    copyright: statsContent.copyright,
    socialAccounts: [],
  },
});

function applyHead(settings) {
  document.title = document.title.replace(/BoneHard/g, settings.siteName || 'BoneHard');
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = settings.favicon || settings.logo || heroContent.logo;
}

export function useSiteSettings() {
  const hero = computed(() => ({
    ...heroContent,
    siteName: state.settings.siteName || 'BoneHard',
    title: state.settings.siteName || 'BoneHard',
    logo: state.settings.logo || heroContent.logo,
  }));

  const footer = computed(() => ({
    ...statsContent,
    siteName: state.settings.siteName || 'BoneHard',
    address: state.settings.address || statsContent.address,
    socialAccounts: state.settings.socialAccounts || [],
    logo: state.settings.logo || statsContent.logo || heroContent.logo,
    copyright: state.settings.copyright || `© ${state.settings.siteName || 'BoneHard'}. UAE - Dubai`,
  }));

  async function loadSiteSettings() {
    if (state.loaded || state.loading) return state.settings;
    state.loading = true;
    try {
      const response = await api.get('/api/site-settings/public');
      state.settings = {
        ...state.settings,
        ...(response.data || {}),
      };
      applyHead(state.settings);
      state.loaded = true;
      state.error = '';
    } catch (error) {
      state.error = error.message;
      state.loaded = true;
    } finally {
      state.loading = false;
    }
    return state.settings;
  }

  return {
    state,
    hero,
    footer,
    loadSiteSettings,
  };
}
