// services/brandDesignUtils.ts
// Shared utilities for injecting brand identity into design generation
import { Brand, BrandHubProfile } from '../types';

// ── Color Extraction ──────────────────────────────────────────────────────────

export function extractBrandColors(styleGuidelines?: string[]): string[] {
    if (!styleGuidelines?.length) return [];
    const hexPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
    const seen = new Set<string>();
    const colors: string[] = [];

    for (const g of styleGuidelines) {
        const hexMatches = g.match(hexPattern);
        if (hexMatches) {
            hexMatches.forEach(c => { if (!seen.has(c)) { seen.add(c); colors.push(c); } });
        } else if (
            g.toLowerCase().includes('color') ||
            g.toLowerCase().includes('لون') ||
            g.toLowerCase().includes('colour')
        ) {
            const clean = g.trim();
            if (!seen.has(clean)) { seen.add(clean); colors.push(clean); }
        }
    }
    return colors;
}

// ── Brand Prompt Context ──────────────────────────────────────────────────────

export function buildBrandPromptContext(
    brand: Brand | null | undefined,
    brandProfile: BrandHubProfile | null | undefined
): string {
    const parts: string[] = [];

    const name = brandProfile?.brandName || brand?.name;
    if (name) parts.push(`Brand name: "${name}"`);

    const colors = extractBrandColors(brandProfile?.styleGuidelines);
    if (colors.length) parts.push(`Brand colors: ${colors.slice(0, 5).join(', ')}`);

    if (brandProfile?.values?.length) {
        parts.push(`Brand values: ${brandProfile.values.slice(0, 3).join(', ')}`);
    }

    if (brandProfile?.keySellingPoints?.length) {
        parts.push(`Brand pillars: ${brandProfile.keySellingPoints.slice(0, 2).join(', ')}`);
    }

    const tone = brandProfile?.brandVoice?.toneDescription?.slice(0, 3).join(', ');
    if (tone) parts.push(`Visual tone: ${tone}`);

    return parts.join('. ');
}

// ── Logo Overlay (Canvas) ─────────────────────────────────────────────────────

/**
 * Composites the brand logo onto the bottom-right corner of a generated image.
 * Uses the browser Canvas API — must run client-side.
 * Gracefully falls back to the original URL on any error (CORS, load failure, etc.)
 */
export async function overlayLogoOnCanvas(
    imageUrl: string,
    logoUrl: string
): Promise<string> {
    if (!logoUrl) return imageUrl;

    return new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(imageUrl); return; }

            canvas.width  = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const logo = new Image();
            logo.crossOrigin = 'anonymous';

            logo.onload = () => {
                // Scale logo to 14% of image width, capped at 130px
                const logoW  = Math.min(img.width * 0.14, 130);
                const logoH  = logo.height * (logoW / logo.width);
                const pad    = Math.max(12, Math.round(img.width * 0.025));
                const x      = img.width  - logoW - pad;
                const y      = img.height - logoH - pad;

                // Draw rounded-rect background
                const bgPad = 8;
                const bx = x - bgPad;
                const by = y - bgPad;
                const bw = logoW + bgPad * 2;
                const bh = logoH + bgPad * 2;
                const r  = 10;

                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.18)';
                ctx.shadowBlur  = 10;
                ctx.fillStyle   = 'rgba(255,255,255,0.92)';
                ctx.beginPath();
                ctx.moveTo(bx + r, by);
                ctx.lineTo(bx + bw - r, by);
                ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
                ctx.lineTo(bx + bw, by + bh - r);
                ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
                ctx.lineTo(bx + r, by + bh);
                ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
                ctx.lineTo(bx, by + r);
                ctx.quadraticCurveTo(bx, by, bx + r, by);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                ctx.drawImage(logo, x, y, logoW, logoH);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            };

            logo.onerror = () => resolve(imageUrl);
            logo.src     = logoUrl;
        };

        img.onerror = () => resolve(imageUrl);
        img.src     = imageUrl;
    });
}
