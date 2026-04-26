import React from 'react';
import { SBrandOpsLogo } from '../SBrandOpsLogo';

/**
 * AuthShell — premium branded wrapper for all auth screens.
 * Background: deep navy (#070B1F) with subtle gradient orbs.
 * Uses official SBrandOps identity (v4).
 */
export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
    style={{ background: 'linear-gradient(135deg, #070B1F 0%, #0D1329 55%, #161B33 100%)' }}
  >
    {/* Background glow orbs */}
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '45vw',
          height: '45vw',
          maxWidth: 560,
          maxHeight: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-8%',
          left: '-5%',
          width: '40vw',
          height: '40vw',
          maxWidth: 480,
          maxHeight: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '30%',
          width: '30vw',
          height: '30vw',
          maxWidth: 360,
          maxHeight: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>

    {/* Content */}
    <div className="relative z-10 w-full flex flex-col items-center">
      {children}
    </div>
  </div>
);

/**
 * AuthLogoBlock — the centered logo + tagline shown above the auth card.
 * Uses gradient variant (primary digital use per brand guidelines).
 */
export const AuthLogoBlock: React.FC<{ subtitle?: string }> = ({
  subtitle = 'One System. Smarter Growth.',
}) => (
  <div className="text-center mb-8 flex flex-col items-center">
    <SBrandOpsLogo
      variant="gradient"
      layout="stacked"
      size="xl"
      alt="SBrandOps"
    />
    <p
      className="mt-3 text-sm font-medium tracking-wide"
      style={{ color: '#A8B0C3' }}
    >
      {subtitle}
    </p>
  </div>
);
