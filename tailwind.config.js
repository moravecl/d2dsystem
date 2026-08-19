/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#0A1328',
          900: '#0F1F3F',
          800: '#132647',
          750: '#163050',
          700: '#1B3A6B',
          650: '#1F4278',
          600: '#244B85',
          500: '#2D5A9E',
          400: '#4A7DFF',
          300: '#6B9AFF',
          200: '#9CBDFF',
          100: '#C8DAFE',
          50:  '#E8F0FF',
        },
      },
    },
  },
  plugins: [],
};
