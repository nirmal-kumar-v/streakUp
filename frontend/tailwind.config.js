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
        dark: {
          bg: '#09090b',         // deep warm titanium zinc
          surface: '#131316',    // elevated panel surface
          card: '#18181c',       // card background
          hover: '#222228',      // hover state
          border: '#27272f',     // borders & dividers
          muted: '#8e8ea0',      // secondary text
          text: '#f4f4f6',       // high-contrast primary text
        },
        flame: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',        // primary vibrant streak amber
          600: '#d97706',
          700: '#b45309',
          glow: 'rgba(245, 158, 11, 0.22)',
        },
        sage: {
          500: '#10b981',        // clean emerald for completions
          600: '#059669',
          glow: 'rgba(16, 185, 129, 0.2)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-flame': '0 0 20px -3px rgba(245, 158, 11, 0.3)',
        'glow-sage': '0 0 20px -3px rgba(16, 185, 129, 0.25)',
        'panel': '0 4px 24px -2px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
