import { ref, onMounted } from 'vue';

const getInitialTheme = () => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch (e) {}
  return 'dark'; // Default to dark
};

const theme = ref(getInitialTheme());

export function useTheme() {
  const initTheme = () => {
    theme.value = getInitialTheme();
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
