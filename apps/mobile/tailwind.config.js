/** @type {import('tailwindcss').Config} */
module.exports = {
  // Incluye los archivos de la app Y del paquete UI compartido.
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [
    require('nativewind/preset'),
    require('@impostor/ui/tailwind-preset'),
  ],
  theme: { extend: {} },
  plugins: [],
};
