/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',   // ← activates dark: utilities via .dark class on <html>
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /(bg|text|border|ring)-(orange|purple|blue|green|red|yellow|gray|zinc)-(50|100|200|300|400|500|600|700|800|900|950)/,
    },
    'border-primary',
    'bg-primary',
    'bg-success',
    'bg-warning',
    'bg-error',
    'text-primary',
    'text-success',
    'text-warning',
    'text-error',
    'bg-breakfast',
    'bg-lunch',
    'bg-snacks',
    'bg-dinner',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent)  / <alpha-value>)',
        page: 'rgb(var(--color-page)    / <alpha-value>)',
        card: 'rgb(var(--color-card)    / <alpha-value>)',
        dark: 'rgb(var(--color-dark)    / <alpha-value>)',
        mid: 'rgb(var(--color-mid)     / <alpha-value>)',
        light: 'rgb(var(--color-light)   / <alpha-value>)',
        border: 'rgb(var(--color-border)  / <alpha-value>)',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        // Semantic brand colours — directly accessible
        'med-blue': '#0057FF',
        'nik-yellow': '#D4F000',
        breakfast: '#FEF3C7',
        lunch: '#DCFCE7',
        snacks: '#FEE2E2',
        dinner: '#EDE9FE',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'card-xl': '20px',
        'pill': '9999px',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-accent)) 100%)',
        'gradient-hero': 'linear-gradient(135deg, rgb(var(--color-primary) / 0.08) 0%, rgb(var(--color-accent) / 0.05) 100%)',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(0,0,0,0.06)',
        'card-md': '0 4px 20px rgba(0,0,0,0.10)',
        'card-dark': '0 4px 24px rgba(0,0,0,0.50)',
        'blue-glow': '0 0 20px rgba(0, 87, 255, 0.25)',
        'nik-glow': '0 0 24px rgba(212, 240, 0, 0.35)',
        'nik-btn': '0 4px 16px rgba(212, 240, 0, 0.25)',
      },
    },
  },
  plugins: [],
}