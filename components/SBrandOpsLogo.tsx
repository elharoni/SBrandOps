import React from 'react';

/**
 * SBrandOps Official Logo Component
 * Source: SBrandOps_Professional_Identity_Pack_v4_EXACT
 *
 * Usage rules (per brand guidelines):
 * - variant="white"    → dark backgrounds (sidebar, dark header)
 * - variant="gradient" → primary digital use, auth pages, splash
 * - variant="blue"     → alternative for app interfaces, light/neutral bg
 * - variant="black"    → light backgrounds, print, monochrome
 *
 * Never distort, recolor, crop, or rotate the logo.
 */

export type LogoVariant = 'white' | 'gradient' | 'blue' | 'black';
export type LogoLayout  = 'mark' | 'horizontal' | 'stacked';

interface LogoAssets {
  mark:       string;
  horizontal: string;
  stacked:    string;
}

const ASSETS: Record<LogoVariant, LogoAssets> = {
  white: {
    mark:       '/brand/logo/mark-white.png',
    horizontal: '/brand/logo/horizontal-white.png',
    stacked:    '/brand/logo/stacked-white.png',
  },
  gradient: {
    mark:       '/brand/logo/mark-gradient.png',
    horizontal: '/brand/logo/horizontal-gradient.png',
    stacked:    '/brand/logo/stacked-gradient.png',
  },
  blue: {
    mark:       '/brand/logo/mark-blue.png',
    horizontal: '/brand/logo/horizontal-blue.png',
    stacked:    '/brand/logo/stacked-blue.png',
  },
  black: {
    mark:       '/brand/logo/mark-black.png',
    horizontal: '/brand/logo/horizontal-black.png',
    stacked:    '/brand/logo/stacked-black.png',
  },
};

// Height tokens per size (horizontal lockup uses height, stacked/mark uses width)
const HEIGHT_MAP = {
  xs:  { mark: 24,  lockup: 20  },
  sm:  { mark: 32,  lockup: 28  },
  md:  { mark: 40,  lockup: 36  },
  lg:  { mark: 52,  lockup: 44  },
  xl:  { mark: 68,  lockup: 56  },
  '2xl': { mark: 88, lockup: 72 },
};

export type LogoSize = keyof typeof HEIGHT_MAP;

interface SBrandOpsLogoProps {
  variant?: LogoVariant;
  layout?:  LogoLayout;
  size?:    LogoSize;
  className?: string;
  /** Accessible label — defaults to "SBrandOps" */
  alt?: string;
  style?: React.CSSProperties;
}

export const SBrandOpsLogo: React.FC<SBrandOpsLogoProps> = ({
  variant   = 'white',
  layout    = 'horizontal',
  size      = 'md',
  className = '',
  alt       = 'SBrandOps',
  style,
}) => {
  const src    = ASSETS[variant][layout];
  const sizing = HEIGHT_MAP[size];
  const h      = layout === 'mark' ? sizing.mark : sizing.lockup;

  const imgStyle: React.CSSProperties =
    layout === 'mark'
      ? { width: h, height: h, objectFit: 'contain', flexShrink: 0, display: 'block', ...style }
      : { height: h, width: 'auto', objectFit: 'contain', flexShrink: 0, display: 'block', ...style };

  return (
    <img
      src={src}
      alt={alt}
      style={imgStyle}
      className={className}
      draggable={false}
    />
  );
};

/**
 * SBrandMark — icon-only logo mark.
 * Kept as an alias for backwards compatibility with existing callers.
 */
export const SBrandMark: React.FC<{
  px?: number;
  variant?: LogoVariant;
  className?: string;
}> = ({ px = 40, variant = 'white', className = '' }) => (
  <SBrandOpsLogo
    variant={variant}
    layout="mark"
    className={className}
    style={{ width: px, height: px }}
    size="md"
  />
);
