/**
 * _shared/auth.ts
 * Shared JWT verification and brand ownership helpers for Edge Functions.
 *
 * Usage:
 *   import { verifyJWT, assertBrandOwnership } from '../_shared/auth.ts';
 *
 *   const userOrError = await verifyJWT(req);
 *   if (userOrError instanceof Response) return userOrError; // 401
 *
 *   const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brand_id);
 *   if (ownershipError) return ownershipError; // 403
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email?: string;
  role?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

// ── JSON helper (reusable error responses) ───────────────────────────────────

function errorResponse(
  message: string,
  status: number,
  correlationId?: string,
  corsHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      ...(corsHeaders ?? {}),
    },
  });
}

// ── verifyJWT ────────────────────────────────────────────────────────────────

/**
 * Extracts and verifies the Bearer JWT from the Authorization header.
 * Returns the authenticated user on success, or a 401 Response on failure.
 *
 * Uses the SUPABASE_ANON_KEY and SUPABASE_URL env vars to create a
 * per-request client that validates the caller's token.
 */
export async function verifyJWT(
  req: Request,
  correlationId?: string,
  corsHeaders?: Record<string, string>,
): Promise<AuthUser | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Missing or invalid Authorization header', 401, correlationId, corsHeaders);
  }

  const jwt = authHeader.replace('Bearer ', '').trim();

  // Service role client + explicit JWT param — correct server-side validation
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await adminClient.auth.getUser(jwt);

  if (error || !user) {
    return errorResponse('Invalid or expired token', 401, correlationId, corsHeaders);
  }

  return user as AuthUser;
}

// ── assertBrandOwnership ─────────────────────────────────────────────────────

/**
 * Verifies that the authenticated user owns (or is a member of) the given brand.
 * Returns undefined on success, or a 403 Response on failure.
 *
 * @param supabase   Service-role client (for server-side queries)
 * @param userId     The authenticated user's UUID
 * @param brandId    The brand_id from the request payload
 * @param correlationId  Optional for error response headers
 */
export async function assertBrandOwnership(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  correlationId?: string,
): Promise<Response | undefined> {
  if (!brandId) {
    return errorResponse('brand_id is required', 400, correlationId);
  }

  // brands table: owner_id column holds the creator's user UUID.
  // brand_members table (if exists): user_id + brand_id for team members.
  // Try user_id first (common column name), fall back to owner_id
  const { data: brand, error } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return errorResponse('Failed to verify brand ownership', 500, correlationId);
  }

  if (!brand) {
    // Check team membership as fallback
    const { data: member } = await supabase
      .from('brand_members')
      .select('id')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) {
      return errorResponse('Forbidden: you do not have access to this brand', 403, correlationId);
    }
  }

  return undefined; // ownership confirmed
}

// ── assertAccountOwnership ───────────────────────────────────────────────────

/**
 * Verifies that a social_account or oauth_token belongs to a brand the user owns.
 * Returns undefined on success, or a 403 Response on failure.
 */
export async function assertAccountOwnership(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  correlationId?: string,
): Promise<Response | undefined> {
  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('brand_id, brands!inner(owner_id)')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !account) {
    return errorResponse('Account not found', 404, correlationId);
  }

  const ownerIds: string[] = Array.isArray((account as any).brands)
    ? (account as any).brands.map((b: any) => b.owner_id)
    : [(account as any).brands?.owner_id];

  if (!ownerIds.includes(userId)) {
    return errorResponse('Forbidden: you do not own this account', 403, correlationId);
  }

  return undefined;
}

// ── getAllowedOrigins ────────────────────────────────────────────────────────

/**
 * Returns the set of allowed CORS origins from the FRONTEND_ORIGIN env var.
 * Supports comma-separated values for multiple allowed origins.
 * e.g. "https://app.example.com,http://localhost:5173"
 */
export function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get('FRONTEND_ORIGIN') ?? '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

// ── buildCorsHeaders ─────────────────────────────────────────────────────────

/**
 * Returns CORS headers.
 *
 * Origin resolution order:
 *  1. FRONTEND_ORIGIN is set AND request origin is in the allowed list → echo it back
 *  2. FRONTEND_ORIGIN is set AND request origin is NOT in the list     → return first allowed origin
 *     (browser will reject it, which is correct security behaviour)
 *  3. FRONTEND_ORIGIN is NOT set                                        → echo request origin
 *     (permissive mode — fine for dev / early launch; tighten before prod)
 *  4. No request origin at all                                          → '*'
 */
export function buildCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();

  let origin: string;
  if (allowed.size > 0) {
    if (requestOrigin && allowed.has(requestOrigin)) {
      origin = requestOrigin;
    } else {
      origin = [...allowed][0]; // browser will reject — correct security behaviour
    }
  } else {
    origin = requestOrigin ?? '*';
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
