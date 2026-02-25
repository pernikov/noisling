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
    { pattern: /^text-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-400$/ },
    { pattern: /^bg-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-500$/ },
    { pattern: /^border-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-400$/ },
    { pattern: /^ring-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-400$/ },
    { pattern: /^bg-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-400$/, variants: ['group-hover'] },
    { pattern: /^ring-(rose|amber|yellow|emerald|teal|sky|indigo|violet|slate)-400$/, variants: ['focus-visible'] },
  ],
};
