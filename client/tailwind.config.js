/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      zIndex: {
        60: '60',
      },
    },
  },
  plugins: [],
  safelist: [
    { pattern: /^text-(violet|sky|rose|amber|emerald|indigo)-400$/ },
    { pattern: /^bg-(violet|sky|rose|amber|emerald|indigo)-500$/ },
    { pattern: /^border-(violet|sky|rose|amber|emerald|indigo)-400$/ },
    { pattern: /^ring-(violet|sky|rose|amber|emerald|indigo)-400$/ },
    { pattern: /^bg-(violet|sky|rose|amber|emerald|indigo)-400$/, variants: ['group-hover'] },
    { pattern: /^ring-(violet|sky|rose|amber|emerald|indigo)-400$/, variants: ['focus-visible'] },
  ],
};
