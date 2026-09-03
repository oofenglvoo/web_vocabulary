/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#edf4ee',
          100: '#dce9df',
          200: '#c1d8c7',
          300: '#9fc0aa',
          400: '#6e9f84',
          500: '#2f6b5c',
          600: '#245749',
          700: '#1f493f',
          800: '#1b3d35',
          900: '#16332d',
        },
        accent: {
          50: '#fff1ec',
          100: '#ffe1d7',
          300: '#efad98',
          400: '#e08d74',
          500: '#d8785d',
          600: '#c4654d',
        },
        success: {
          50: '#edf7f0',
          100: '#d6eadb',
          500: '#5f9b78',
          600: '#477f61',
        },
        warn: {
          50: '#fffbeb',
          100: '#fef3c7',
          300: '#fcd34d',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(25 53 47 / 0.06), 0 1px 2px -1px rgb(25 53 47 / 0.04)',
        card: '0 4px 16px -4px rgb(31 81 71 / 0.09), 0 1px 4px -1px rgb(25 53 47 / 0.05)',
        glow: '0 8px 24px -8px rgb(31 81 71 / 0.3)',
      },
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(135deg, #1f5147 0%, #2f6b5c 55%, #6e9f84 100%)',
        'gradient-card':
          'linear-gradient(135deg, #edf4ee 0%, #f3f7ef 50%, #fff1ec 100%)',
        'gradient-success': 'linear-gradient(135deg, #2f6b5c 0%, #6e9f84 100%)',
        'gradient-warn': 'linear-gradient(135deg, #c89236 0%, #e0b15b 100%)',
        'gradient-accent': 'linear-gradient(135deg, #c4654d 0%, #e08d74 100%)',
        'gradient-mesh':
          'radial-gradient(at 0% 0%, rgb(47 107 92 / 0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgb(216 120 93 / 0.10) 0px, transparent 50%), radial-gradient(at 50% 100%, rgb(110 159 132 / 0.10) 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
