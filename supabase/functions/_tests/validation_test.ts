import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { validateMediaUrls, validatePlatformsLength } from '../_shared/validation.ts';

// ── validateMediaUrls ────────────────────────────────────────────────────────

Deno.test('validateMediaUrls — passes for undefined', () => {
  validateMediaUrls(undefined); // must not throw
});

Deno.test('validateMediaUrls — passes for empty array', () => {
  validateMediaUrls([]); // must not throw
});

Deno.test('validateMediaUrls — passes for valid https URLs', () => {
  validateMediaUrls([
    'https://cdn.example.com/image.jpg',
    'https://storage.supabase.co/bucket/file.png',
  ]);
});

Deno.test('validateMediaUrls — throws for blob URL', () => {
  assertThrows(
    () => validateMediaUrls(['blob:https://localhost/1234-5678']),
    Error,
    'Blob URLs are not supported',
  );
});

Deno.test('validateMediaUrls — throws when blob URL is mixed with valid URLs', () => {
  assertThrows(
    () => validateMediaUrls(['https://cdn.example.com/img.jpg', 'blob:https://localhost/xyz']),
    Error,
    'Blob URLs are not supported',
  );
});

// ── validatePlatformsLength ──────────────────────────────────────────────────

Deno.test('validatePlatformsLength — passes when within limit', () => {
  validatePlatformsLength(['Facebook', 'Instagram', 'X'], 10); // must not throw
});

Deno.test('validatePlatformsLength — passes at exact limit', () => {
  validatePlatformsLength(Array(10).fill('Facebook'), 10); // must not throw
});

Deno.test('validatePlatformsLength — throws when one over limit', () => {
  assertThrows(
    () => validatePlatformsLength(Array(11).fill('Facebook'), 10),
    Error,
    'platforms array must not exceed 10 items',
  );
});

Deno.test('validatePlatformsLength — passes for empty array', () => {
  validatePlatformsLength([], 10); // must not throw
});

Deno.test('validatePlatformsLength — uses the max param from caller', () => {
  assertThrows(
    () => validatePlatformsLength(['A', 'B', 'C'], 2),
    Error,
    'platforms array must not exceed 2 items',
  );
});
