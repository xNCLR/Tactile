/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // brand-600 is the primary accent (terracotta).
        // Only values actually used in the codebase are kept.
        brand: {
          600: '#CC6B4D',  // terracotta — primary accent
          700: '#B55A3E',  // darker terracotta (hover states)
          800: '#8C4A32',  // deep rust (active states)
        },
        bark: '#4D3830',
        charcoal: '#2E2926',
        stone: '#8C8078',
        clay: '#B8947A',
        rust: '#BF8061',
        terracotta: '#CC6B4D',
        sand: '#D9C7AD',
        blush: '#EDDFD1',
        paper: '#F5F0E6',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Work Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
