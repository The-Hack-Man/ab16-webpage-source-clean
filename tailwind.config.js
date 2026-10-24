/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jet: '#080808',
        ink: '#0B0B0C',
        charcoal: '#181818',
        slate: {
          950: '#0E0E10',
          900: '#141416',
          800: '#1C1C1F',
          700: '#26262A',
          600: '#34343A',
          500: '#4A4A52',
          400: '#6B6B75',
          300: '#85858F',
          200: '#B4B4BC',
          100: '#D8D8DC',
        },
        bone: '#F5F2EC',
        paper: '#FAF8F3',
        accent: {
          DEFAULT: '#315DFF',
          50: '#EEF2FF',
          100: '#DCE3FF',
          200: '#B9C7FF',
          300: '#8FA6FF',
          400: '#5E7EFF',
          500: '#315DFF',
          600: '#2748CC',
          700: '#1E3699',
          800: '#162466',
          900: '#0F1233',
        },
        studio: {
          bg: '#0a0b0f',
          surface: '#12141c',
          surfaceLight: '#1a1d28',
          border: '#252836',
          accent: '#3b82f6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          text: '#e8eaf0',
          textMuted: '#7a7f94',
        },
      },
      fontFamily: {
        display: ['"Archivo"', '"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['clamp(3rem, 8vw, 7rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-xl': ['clamp(2.25rem, 6vw, 5rem)', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(1.75rem, 4vw, 3.25rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '38': '9.5rem',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scroll-indicator': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(14px)', opacity: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(-4px)', opacity: '0.3' },
          '50%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.6s ease both',
        'scroll-indicator': 'scroll-indicator 1.6s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        bounce: 'bounce 1.4s ease-in-out 3 both',
      },
    },
  },
  plugins: [],
};
