/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./astro/src/**/*.{astro,html,js,jsx,ts,tsx}",
    "./astro/public/global/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
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
        },
        cyberyellow: {
          DEFAULT: '#FFE600',
          dark: '#D9C200'
        }
      },
      boxShadow: {
        'glow-nvidia': '0 0 25px rgba(118, 185, 0, 0.4)',
        'glow-amd': '0 0 25px rgba(237, 28, 36, 0.4)',
        'glow-intel': '0 0 25px rgba(0, 113, 197, 0.4)',
        'neo-flat': '4px 4px 0px 0px rgba(0, 0, 0, 1)',
        'neo-flat-dark': '4px 4px 0px 0px rgba(255, 255, 255, 1)',
        'neo-flat-nvidia': '4px 4px 0px 0px #76b900',
        'neo-flat-amd': '4px 4px 0px 0px #ed1c24',
        'neo-flat-intel': '4px 4px 0px 0px #0071c5',
        'neo-flat-hover': '7px 7px 0px 0px rgba(0, 0, 0, 1)',
        'neo-flat-hover-dark': '7px 7px 0px 0px rgba(255, 255, 255, 1)',
        'neo-flat-hover-nvidia': '7px 7px 0px 0px #76b900',
        'neo-flat-hover-amd': '7px 7px 0px 0px #ed1c24',
        'neo-flat-hover-intel': '7px 7px 0px 0px #0071c5'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
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
