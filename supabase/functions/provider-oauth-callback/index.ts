import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type CallbackPayload = {
  brand_id?: string;
  provider?: string;
  connection_id?: string | null;
  external_account_id?: string;
  external_account_name?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scopes?: string[] | null;
  metadata?: Record<string, unknown>;
  ad_account_id?: string | null;
  analytics_property_id?: string | null;
  search_console_property_id?: string | null;
  website_id?: string | null;
  status?: 'connected' | 'expired' | 'needs_reauth' | 'paused' | 'error' | 'disconnected';
  sync_health?: 'healthy' | 'degraded' | 'failing' | 'unknown';
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

  let body: CallbackPayload;
  try {
    body = await request.json() as CallbackPayload;
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, { 'X-Correlation-Id': correlationId });
  }

  if (!body.brand_id || !body.provider || !body.external_account_id) {
    return json({
      error: 'brand_id, provider, and external_account_id are required',
    }, 400, { 'X-Correlation-Id': correlationId });
  }

  const now = new Date().toISOString();
  const status = body.error ? 'error' : (body.status ?? 'connected');

  const existing = body.connection_id
    ? await supabase
        .from('brand_connections')
        .select('*')
        .eq('id', body.connection_id)
        .maybeSingle()
    : await supabase
        .from('brand_connections')
        .select('*')
        .eq('brand_id', body.brand_id)
        .eq('provider', body.provider)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

  if (existing.error) {
    return json({ error: existing.error.message }, 500, { 'X-Correlation-Id': correlationId });
  }

  const current = Array.isArray(existing.data) ? existing.data[0] : existing.data;
  const nextMetadata = {
    ...(current?.metadata ?? {}),
    ...(body.metadata ?? {}),
    external_account_id: body.external_account_id,
    display_name: body.external_account_name ?? current?.external_account_name ?? null,
    oauth_callback_received_at: now,
    oauth_callback_error: body.error ?? null,
  };

  const row = {
    brand_id: body.brand_id,
    provider: body.provider,
    provider_version: current?.provider_version ?? 'v1',
    external_account_id: body.external_account_id,
    external_account_name: body.external_account_name ?? current?.external_account_name ?? null,
    access_token: body.access_token ?? current?.access_token ?? null,
    refresh_token: body.refresh_token ?? current?.refresh_token ?? null,
    token_expires_at: body.token_expires_at ?? current?.token_expires_at ?? null,
    scopes: body.scopes ?? current?.scopes ?? null,
    status,
    sync_health: body.sync_health ?? (body.error ? 'degraded' : 'healthy'),
    last_error: body.error ?? null,
    last_error_at: body.error ? now : null,
    error_count: body.error ? Number(current?.error_count ?? 0) + 1 : 0,
    last_sync_at: now,
    last_successful_sync_at: body.error ? current?.last_successful_sync_at ?? null : now,
    metadata: nextMetadata,
    updated_at: now,
    ad_account_id: body.ad_account_id ?? current?.ad_account_id ?? null,
    analytics_property_id: body.analytics_property_id ?? current?.analytics_property_id ?? null,
    search_console_property_id: body.search_console_property_id ?? current?.search_console_property_id ?? null,
    website_id: body.website_id ?? current?.website_id ?? null,
  };

  const persistQuery = current?.id
    ? supabase.from('brand_connections').update(row).eq('id', current.id)
    : supabase.from('brand_connections').insert(row);

  const { data, error } = await persistQuery.select('*').single();
  if (error) {
    return json({ error: error.message }, 500, { 'X-Correlation-Id': correlationId });
  }

  await supabase
    .from('brand_connections')
    .update({
      status: 'disconnected',
      updated_at: now,
    })
    .eq('brand_id', body.brand_id)
    .eq('provider', body.provider)
    .neq('id', data.id)
    .neq('status', 'disconnected');

  return json({
    ok: true,
    connection_id: data.id,
    provider: data.provider,
    status: data.status,
  }, 200, { 'X-Correlation-Id': correlationId });
});
