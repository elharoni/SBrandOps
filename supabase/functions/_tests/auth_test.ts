/**
 * Tests for pure helper functions in _shared/auth.ts.
 * Only tests getAllowedOrigins and buildCorsHeaders — both are pure functions
 * that use Deno.env at call time, no DB or network required.
 */

import { assertEquals } from 'jsr:@std/assert';
import { getAllowedOrigins, buildCorsHeaders } from '../_shared/auth.ts';

// Helper: run a test with FRONTEND_ORIGIN set, then clean up.
function withOriginEnv(value: string | null, fn: () => void) {
  if (value === null) {
    Deno.env.delete('FRONTEND_ORIGIN');
  } else {
    Deno.env.set('FRONTEND_ORIGIN', value);
  }
  try {
    fn();
  } finally {
    Deno.env.delete('FRONTEND_ORIGIN');
  }
}

// ── getAllowedOrigins ────────────────────────────────────────────────────────

Deno.test('getAllowedOrigins — returns empty set when env var is absent', () => {
  withOriginEnv(null, () => {
    assertEquals(getAllowedOrigins().size, 0);
  });
});

Deno.test('getAllowedOrigins — returns single origin', () => {
  withOriginEnv('https://app.example.com', () => {
    const allowed = getAllowedOrigins();
    assertEquals(allowed.has('https://app.example.com'), true);
    assertEquals(allowed.size, 1);
  });
});

Deno.test('getAllowedOrigins — parses comma-separated origins', () => {
  withOriginEnv('https://app.example.com,http://localhost:5173', () => {
    const allowed = getAllowedOrigins();
    assertEquals(allowed.has('https://app.example.com'), true);
    assertEquals(allowed.has('http://localhost:5173'), true);
    assertEquals(allowed.size, 2);
  });
});

Deno.test('getAllowedOrigins — trims whitespace around commas', () => {
  withOriginEnv(' https://app.example.com , http://localhost:5173 ', () => {
    const allowed = getAllowedOrigins();
    assertEquals(allowed.has('https://app.example.com'), true);
    assertEquals(allowed.has('http://localhost:5173'), true);
  });
});

// ── buildCorsHeaders ─────────────────────────────────────────────────────────

Deno.test('buildCorsHeaders — echoes an allowed request origin', () => {
  withOriginEnv('https://app.example.com', () => {
    const headers = buildCorsHeaders('https://app.example.com');
    assertEquals(headers['Access-Control-Allow-Origin'], 'https://app.example.com');
  });
});

Deno.test('buildCorsHeaders — returns first allowed origin for non-allowed request', () => {
  withOriginEnv('https://app.example.com,https://beta.example.com', () => {
    const headers = buildCorsHeaders('https://attacker.com');
    assertEquals(headers['Access-Control-Allow-Origin'], 'https://app.example.com');
  });
});

Deno.test('buildCorsHeaders — returns * when no FRONTEND_ORIGIN and no request origin', () => {
  withOriginEnv(null, () => {
    const headers = buildCorsHeaders(null);
    assertEquals(headers['Access-Control-Allow-Origin'], '*');
  });
});

Deno.test('buildCorsHeaders — echoes request origin in permissive mode (no env var)', () => {
  withOriginEnv(null, () => {
    const headers = buildCorsHeaders('https://any-origin.com');
    assertEquals(headers['Access-Control-Allow-Origin'], 'https://any-origin.com');
  });
});

Deno.test('buildCorsHeaders — includes required CORS headers', () => {
  withOriginEnv(null, () => {
    const headers = buildCorsHeaders(null);
    assertEquals(typeof headers['Access-Control-Allow-Headers'], 'string');
    assertEquals(typeof headers['Access-Control-Allow-Methods'], 'string');
    assertEquals(headers['Access-Control-Max-Age'], '86400');
  });
});
