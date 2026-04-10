import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type WebhookStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'ignored';

type ProviderWebhookPayload = {
  brand_id?: string;
  connection_id?: string | null;
  provider?: string;
  event_type?: string;
  external_id?: string | null;
  payload?: Record<string, unknown>;
  status?: WebhookStatus;
  processed_at?: string | null;
  error?: string | null;
};

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

Deno.serve(async request => {
  const correlationId = crypto.randomUUID();

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { 'X-Correlation-Id': correlationId });
  }

  let body: ProviderWebhookPayload;
  try {
    body = await request.json() as ProviderWebhookPayload;
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, { 'X-Correlation-Id': correlationId });
  }

  if (!body.brand_id || !body.provider || !body.event_type) {
    return json({
      error: 'brand_id, provider, and event_type are required',
    }, 400, { 'X-Correlation-Id': correlationId });
  }

  const now = new Date().toISOString();
  const payload = body.payload ?? body;
  const rawHeaders = Object.fromEntries(request.headers.entries());
  const status = body.status ?? (body.error ? 'failed' : 'pending');

  const row = {
    brand_id: body.brand_id,
    connection_id: body.connection_id ?? null,
    provider: body.provider,
    event_type: body.event_type,
    external_id: body.external_id ?? null,
    payload,
    raw_headers: rawHeaders,
    status,
    processed_at: body.processed_at ?? (status === 'processed' ? now : null),
    error: body.error ?? null,
    received_at: now,
  };

  const query = body.external_id
    ? supabase.from('webhook_events').upsert(row, { onConflict: 'provider,external_id' })
    : supabase.from('webhook_events').insert(row);

  const { data, error } = await query.select('id').single();
  if (error) {
    return json({ error: error.message }, 500, { 'X-Correlation-Id': correlationId });
  }

  if (body.connection_id) {
    await supabase
      .from('brand_connections')
      .update({
        last_sync_at: now,
        last_error: body.error ?? null,
        last_error_at: body.error ? now : null,
        sync_health: body.error ? 'degraded' : 'healthy',
        status: body.error ? 'error' : 'connected',
        updated_at: now,
      })
      .eq('id', body.connection_id);
  }

  return json({
    ok: true,
    webhook_event_id: data?.id ?? null,
  }, 200, { 'X-Correlation-Id': correlationId });
});
