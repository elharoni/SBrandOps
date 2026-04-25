/**
 * manage-social-account Edge Function
 * Handles non-read account operations without exposing the base table to clients.
 *
 * Security:
 * - Requires valid Supabase JWT (Authorization: Bearer <token>)
 * - Verifies that the account belongs to a brand the caller owns
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertAccountOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Payload = {
  action: 'disconnect' | 'update_status';
  account_id: string;
  status?: string;
};

function json(body: unknown, status: number, corsHeaders: Record<string, string>, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId, ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const userOrError = await verifyJWT(req, correlationId, corsHeaders);
  if (userOrError instanceof Response) return userOrError;

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders, correlationId);
    }

    const body = await req.json() as Payload;
    if (!body.account_id || !body.action) {
      return json({ error: 'Invalid payload' }, 400, corsHeaders, correlationId);
    }

    // ── Account ownership check ───────────────────────────────────────────
    const ownershipError = await assertAccountOwnership(supabase, userOrError.id, body.account_id, correlationId);
    if (ownershipError) return ownershipError;

    if (body.action === 'disconnect') {
      const { error } = await supabase.from('social_accounts').delete().eq('id', body.account_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('social_accounts')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.account_id);
      if (error) throw error;
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'manage-social-account',
      action: body.action,
      accountId: body.account_id,
      userId: userOrError.id,
    }));

    return json({ ok: true }, 200, corsHeaders, correlationId);
  } catch (error) {
    console.error(JSON.stringify({
      correlationId,
      event: 'manage-social-account-error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));

    return json({ error: error instanceof Error ? error.message : 'Server error' }, 500, corsHeaders, correlationId);
  }
});
