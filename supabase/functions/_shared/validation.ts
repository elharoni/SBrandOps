/**
 * _shared/validation.ts
 * Pure input validation helpers shared across Edge Functions.
 * Extracted here so they can be unit-tested without a running Deno server.
 */

/**
 * Throws if any URL is a blob: URL.
 * Blob URLs are local to the browser and cannot be fetched server-side.
 */
export function validateMediaUrls(mediaUrls?: string[]): void {
  if (!mediaUrls?.length) return;
  if (mediaUrls.some(url => url.startsWith('blob:'))) {
    throw new Error('Blob URLs are not supported. Upload media to storage first.');
  }
}

/**
 * Throws if the platforms array exceeds the allowed maximum.
 */
export function validatePlatformsLength(platforms: string[], max: number): void {
  if (platforms.length > max) {
    throw new Error(`platforms array must not exceed ${max} items`);
  }
}
