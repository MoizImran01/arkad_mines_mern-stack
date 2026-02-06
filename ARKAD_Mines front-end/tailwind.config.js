/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#536438',
          light: '#6b8248',
          dark: '#3a471f',
        },
        stone: {
          dark: '#1f2937',
          light: '#f3f4f6',
          gray: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
