// config/design-tokens.ts

// This file serves as the single source of truth for the design system.
// Its values are translated into the tailwind.config.js in index.html.

export const colors = {
  // System-level colors
  primary: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Light Mode UI Colors
  light: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
  },

  // Dark Mode UI Colors
  dark: {
    background: '#0d1117',
    card: '#161b22',
    text: '#e6edf3',
    textSecondary: '#8b949e',
    border: '#30363d',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export const typography = {
  fontFamily: "'Tajawal', sans-serif",
  h1: '2.25rem', // 36px
  h2: '1.875rem', // 30px
  h3: '1.5rem', // 24px
  body: '1rem', // 16px
  small: '0.875rem', // 14px
};

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
};
