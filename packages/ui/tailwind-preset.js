/**
 * Preset de diseño compartido para toda la granja de apps.
 * Las apps lo extienden en su tailwind.config.js.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Verde cancha + acentos para el branding del juego.
        pitch: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        impostor: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        surface: {
          DEFAULT: '#0b0f0e',
          soft: '#141a18',
          card: '#1b2421',
          border: '#27332e',
        },
      },
      fontFamily: {
        display: ['Inter_700Bold', 'system-ui', 'sans-serif'],
        body: ['Inter_400Regular', 'system-ui', 'sans-serif'],
      },
    },
  },
};
