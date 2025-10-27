import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Check system preference and localStorage
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem('vouchers-theme') as Theme | null;
  if (stored) return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = create<ThemeStore>((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    set((state) => {
      console.log('[useTheme] Current state:', state.theme);
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      console.log('[useTheme] New theme:', newTheme);

      localStorage.setItem('vouchers-theme', newTheme);
      console.log('[useTheme] Saved to localStorage');

      // Apply or remove dark class on html element
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        console.log('[useTheme] Added "dark" class to html element');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('[useTheme] Removed "dark" class from html element');
      }

      console.log('[useTheme] HTML classes:', document.documentElement.className);

      // Force style recalculation
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';

      return { theme: newTheme };
    });
  },
  setTheme: (theme) => {
    localStorage.setItem('vouchers-theme', theme);

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    set({ theme });
  },
}));

// Initialize theme on load
if (typeof window !== 'undefined') {
  const initialTheme = getInitialTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}
