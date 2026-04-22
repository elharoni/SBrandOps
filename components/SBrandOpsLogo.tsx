import React, { useId } from 'react';

// ─── Size tokens ─────────────────────────────────────────────────────────────
type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<LogoSize, { px: number; sw: number; dot: number; text: string }> = {
    xs: { px: 20,  sw: 11,  dot: 6,   text: 'text-sm'   },
    sm: { px: 28,  sw: 10,  dot: 5.5, text: 'text-base' },
    md: { px: 40,  sw: 9.5, dot: 5,   text: 'text-xl'   },
    lg: { px: 56,  sw: 9,   dot: 4.8, text: 'text-3xl'  },
    xl: { px: 72,  sw: 8.5, dot: 4.5, text: 'text-4xl'  },
};

// ─── S path (viewBox 0 0 100 100) ───────────────────────────────────────────
// Carefully constructed to stay fully within the viewBox with generous padding.
// Upper bowl: starts at top-right, arcs left
// Lower bowl: ends at bottom-left, arcs right
// Inflection (crossover) at exactly (50, 52) where the teal dot sits.
//
// Control points derived from the brand reference images.
const S_PATH = [
    'M 67 14',            // start: top-right of upper bowl
    'C 80 14 82 26 78 34', // outer upper right arc
    'C 73 42 28 42 24 50', // inner cross from upper-right to lower-left (inflection ≈ y50)
    'C 20 58 20 72 32 78', // inner lower arc
    'C 40 84 55 84 62 78', // end: bottom-right of lower bowl
].join(' ');

interface SMarkProps {
    px: number;
    sw?: number;
    dot?: number;
    className?: string;
}

export const SBrandMark: React.FC<SMarkProps> = ({
    px,
    sw = 9,
    dot = 5,
    className = '',
}) => {
    const uid = useId().replace(/:/g, '');
    const filterId = `sbglow-${uid}`;

    return (
        <svg
            width={px}
            height={px}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
        >
            <defs>
                <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* S stroke – brand purple #7C6FE0 */}
            <path
                d={S_PATH}
                stroke="#7C6FE0"
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${filterId})`}
            />

            {/* Teal accent dot at inflection point */}
            <circle cx="51" cy="50" r={dot} fill="#00C9B1" />
        </svg>
    );
};

// ─── Full wordmark ────────────────────────────────────────────────────────────
interface SBrandOpsLogoProps {
    size?: LogoSize;
    layout?: 'stacked' | 'inline';
    iconOnly?: boolean;
    className?: string;
}

export const SBrandOpsLogo: React.FC<SBrandOpsLogoProps> = ({
    size = 'md',
    layout = 'inline',
    iconOnly = false,
    className = '',
}) => {
    const cfg = SIZE_MAP[size];

    if (iconOnly) {
        return <SBrandMark px={cfg.px} sw={cfg.sw} dot={cfg.dot} className={className} />;
    }

    const stacked = layout === 'stacked';

    return (
        <div
            className={`flex ${stacked ? 'flex-col items-center' : 'flex-row items-center'} gap-2 ${className}`}
        >
            <SBrandMark px={cfg.px} sw={cfg.sw} dot={cfg.dot} />
            <span
                className={`font-bold leading-none tracking-tight select-none text-light-text dark:text-dark-text ${cfg.text}`}
                aria-label="SBrandOps"
            >
                SBrand<span className="text-[#7C6FE0]">Ops</span>
            </span>
        </div>
    );
};
