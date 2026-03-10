/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./display/**/*.html",
    "./info/**/*.html",
    "./global/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        nvidia: {
          DEFAULT: '#76b900',
          light: '#84cc16',
          dark: '#65a30d'
        },
        amd: {
          DEFAULT: '#ed1c24',
          light: '#f43f5e',
          dark: '#dc2626'
        },
        intel: {
          DEFAULT: '#0071c5',
          light: '#0ea5e9',
          dark: '#0369a1'
        }
      },
      boxShadow: {
        'glow-nvidia': '0 0 25px rgba(118, 185, 0, 0.4)',
        'glow-amd': '0 0 25px rgba(237, 28, 36, 0.4)',
        'glow-intel': '0 0 25px rgba(0, 113, 197, 0.4)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    }
  },
  plugins: []
}
