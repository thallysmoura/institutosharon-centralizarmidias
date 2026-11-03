import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade Instituto Sharon (tokens centrais; usar sempre estes nomes)
        ink: '#21180D', // marrom profundo
        brown: '#33240F', // marrom institucional
        ivory: '#FBF9F3',
        page: '#FAF7F0', // fundo principal (creme)
        sand: '#F3EFE4', // fundo secundário
        line: '#E8E0D2', // bordas suaves
        muted: '#817A70', // texto secundário (AA sobre creme/branco)
        side: '#21180D',
        gold: { 300: '#E6CC7A', 400: '#D4AF37', 500: '#B88B28', 600: '#9A7721', 700: '#7D5F12' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-roboto)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'var(--font-roboto)', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 14px 36px -26px rgba(33,24,13,.28)', card: '0 1px 8px -4px rgba(33,24,13,.10)' },
      borderRadius: { card: '1rem' },
      screens: { xs: '480px' },
    },
  },
  plugins: [],
};
export default config;
