/**
 * manage-social-account Edge Function
 * Handles non-read account operations without exposing the base table to clients.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Payload = {
  action: 'disconnect' | 'update_status';
  account_id: string;
  status?: string;
};

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await req.json() as Payload;
    if (!body.account_id || !body.action) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

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

    console.log(JSON.stringify({ correlationId, event: 'manage-social-account', action: body.action, accountId: body.account_id }));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  } catch (error) {
    console.error(JSON.stringify({
      correlationId,
      event: 'manage-social-account-error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  }
});
