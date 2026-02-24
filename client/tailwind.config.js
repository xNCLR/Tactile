/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf4f3',
          100: '#fce8e4',
          200: '#fad4ce',
          300: '#f5b3a8',
          400: '#ed8674',
          500: '#e05e48',
          600: '#cc432b',
          700: '#ab3621',
          800: '#8d2f1f',
          900: '#752c20',
        },
      },
    },
  },
  plugins: [],
};
