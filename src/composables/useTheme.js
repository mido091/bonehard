import { ref, watch, onMounted } from 'vue';

const theme = ref('dark'); // Default to dark as requested

export function useTheme() {
  const initTheme = () => {
    const stored = localStorage.getItem('theme');
    if (stored) {
      theme.value = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme.value = 'light';
    } else {
      theme.value = 'dark';
    }
    applyTheme(theme.value);
  };

  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    applyTheme(theme.value);
    localStorage.setItem('theme', theme.value);
  };

  const applyTheme = (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  onMounted(() => {
    initTheme();
  });

  return {
    theme,
    toggleTheme
  };
}
