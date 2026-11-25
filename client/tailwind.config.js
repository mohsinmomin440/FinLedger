/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        canvas: '#0B0D12',
        sidebar: '#11141C',
        card: '#171B25',
        border: '#1F2533',
        brand: {
          DEFAULT: '#8B7CFF',
          hover: '#7A68FF',
        },
      },
    },
  },
  plugins: [],
};
