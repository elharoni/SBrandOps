/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
    '!./dist/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Tajawal', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm:    '0.25rem',
        md:    '0.375rem',
        lg:    '0.5rem',
        xl:    '0.75rem',
        '2xl': '1rem',
        full:  '9999px',
      },
      colors: {
        // ── Lumina Axiom: Midnight Surface Hierarchy ──────────────────────
        'surface-lowest':    '#070e1c',
        'surface-low':       '#0c1321',
        'surface':           '#151b2a',
        'surface-container': '#19202e',
        'surface-high':      '#232a39',
        'surface-highest':   '#2e3544',
        'surface-bright':    '#323949',

        // ── On-Surface Text ────────────────────────────────────────────────
        'on-surface':         '#dce2f6',
        'on-surface-variant': '#c3c6d7',
        'outline-variant':    '#434655',

        // ── Primary (Blue) ─────────────────────────────────────────────────
        'primary':              '#b4c5ff',
        'primary-container':    '#2563eb',
        'on-primary':           '#002a78',
        'on-primary-container': '#eeefff',

        // ── Secondary (Cyan) ──────────────────────────────────────────────
        'secondary':           '#4cd7f6',
        'secondary-container': '#03b5d3',
        'on-secondary':        '#003640',

        // ── Tertiary (Green / AI) ─────────────────────────────────────────
        'tertiary':              '#4edea3',
        'tertiary-container':    '#007d55',
        'on-tertiary-container': '#bdffdb',

        // ── Status ────────────────────────────────────────────────────────
        'error':           '#ffb4ab',
        'error-container': '#93000a',
        'success':         '#4edea3',
        'warning':         '#F59E0B',
        'danger':          '#ffb4ab',
        'info':            '#4cd7f6',

        // ── Legacy aliases ────────────────────────────────────────────────
        'brand-primary':   '#2563eb',
        'brand-secondary': '#4cd7f6',
        'brand-pink':      '#4edea3',
        'brand-purple':    '#2563eb',
        'brand-blue':      '#2563eb',
        'primary-color':   '#2563eb',

        // Light theme tokens
        'light-bg':             '#edf2f7',
        'light-card':           '#ffffff',
        'light-text':           '#0f172a',
        'light-text-secondary': '#64748b',
        'light-border':         '#dbe4f0',

        // Dark theme tokens
        'dark-bg':             '#0c1321',
        'dark-card':           '#151b2a',
        'dark-text':           '#dce2f6',
        'dark-text-secondary': '#c3c6d7',
        'dark-border':         '#232a39',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(78, 222, 163, 0.3)' },
          '50%':       { boxShadow: '0 0 25px rgba(78, 222, 163, 0.6)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.35s ease-out forwards',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
      boxShadow: {
        'deep-sea':      '0 20px 40px rgba(0, 0, 0, 0.4)',
        'primary-glow':  '0 0 20px rgba(37, 99, 235, 0.35)',
        'tertiary-glow': '0 0 15px rgba(78, 222, 163, 0.3)',
      },
    },
  },
  plugins: [],
};
