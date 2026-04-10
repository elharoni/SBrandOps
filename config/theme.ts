/**
 * Design System - Theme Configuration
 * نظام تصميم شامل للتطبيق
 */

export const theme = {
    // Colors
    colors: {
        // Brand Colors
        brand: {
            primary: '#2563EB',
            secondary: '#7c3aed',
            pink: '#e024a3',
            purple: '#7c3aed',
            blue: '#2563eb',
        },

        // Status Colors
        status: {
            success: '#22C55E',
            warning: '#F59E0B',
            danger: '#EF4444',
            info: '#3B82F6',
        },

        // Light Mode
        light: {
            bg: '#F9FAFB',
            bgSecondary: '#F3F4F6',
            card: '#FFFFFF',
            cardHover: '#F9FAFB',
            text: '#111827',
            textSecondary: '#6B7280',
            textTertiary: '#9CA3AF',
            border: '#E5E7EB',
            borderHover: '#D1D5DB',
            shadow: 'rgba(0, 0, 0, 0.1)',
        },

        // Dark Mode
        dark: {
            bg: '#0d1117',
            bgSecondary: '#161b22',
            card: '#161b22',
            cardHover: '#1c2128',
            text: '#e6edf3',
            textSecondary: '#8b949e',
            textTertiary: '#6e7681',
            border: '#30363d',
            borderHover: '#484f58',
            shadow: 'rgba(0, 0, 0, 0.3)',
        },
    },

    // Typography
    typography: {
        fontFamily: {
            sans: "'Tajawal', 'sans-serif'",
            mono: "'Courier New', monospace",
        },
        fontSize: {
            xs: '0.75rem',    // 12px
            sm: '0.875rem',   // 14px
            base: '1rem',     // 16px
            lg: '1.125rem',   // 18px
            xl: '1.25rem',    // 20px
            '2xl': '1.5rem',  // 24px
            '3xl': '1.875rem', // 30px
            '4xl': '2.25rem', // 36px
            '5xl': '3rem',    // 48px
        },
        fontWeight: {
            light: 300,
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            extrabold: 800,
        },
        lineHeight: {
            tight: 1.25,
            normal: 1.5,
            relaxed: 1.75,
        },
    },

    // Spacing
    spacing: {
        0: '0',
        1: '0.25rem',   // 4px
        2: '0.5rem',    // 8px
        3: '0.75rem',   // 12px
        4: '1rem',      // 16px
        5: '1.25rem',   // 20px
        6: '1.5rem',    // 24px
        8: '2rem',      // 32px
        10: '2.5rem',   // 40px
        12: '3rem',     // 48px
        16: '4rem',     // 64px
        20: '5rem',     // 80px
        24: '6rem',     // 96px
    },

    // Border Radius
    borderRadius: {
        none: '0',
        sm: '0.25rem',   // 4px
        md: '0.375rem',  // 6px
        lg: '0.5rem',    // 8px
        xl: '0.75rem',   // 12px
        '2xl': '1rem',   // 16px
        '3xl': '1.5rem', // 24px
        full: '9999px',
    },

    // Shadows
    shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
    },

    // Transitions
    transitions: {
        fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
        base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
        slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
    },

    // Z-Index
    zIndex: {
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modalBackdrop: 1040,
        modal: 1050,
        popover: 1060,
        tooltip: 1070,
    },

    // Breakpoints
    breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
    },
} as const;

export type Theme = typeof theme;

// Helper functions
export const getColor = (path: string, isDark: boolean = false): string => {
    const keys = path.split('.');
    let value: any = theme.colors;

    for (const key of keys) {
        value = value[key];
        if (value === undefined) return '';
    }

    return value;
};

export const getSpacing = (size: keyof typeof theme.spacing): string => {
    return theme.spacing[size];
};

export const getShadow = (size: keyof typeof theme.shadows): string => {
    return theme.shadows[size];
};

export const getTransition = (speed: keyof typeof theme.transitions): string => {
    return theme.transitions[speed];
};
