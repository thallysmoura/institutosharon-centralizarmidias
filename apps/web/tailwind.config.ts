import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14110a',
        ivory: '#fbf8f1',
        page: '#faf8f4',
        sand: '#f3ede0',
        line: '#e9e3d6',
        side: '#171512',
        gold: { 300: '#e6cc7a', 400: '#d4af37', 500: '#b8902f', 600: '#9a7721', 700: '#7d5f12' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 18px 44px -28px rgba(20,17,10,.35)', card: '0 2px 14px -6px rgba(20,17,10,.12)' },
    },
  },
  plugins: [],
};
export default config;
