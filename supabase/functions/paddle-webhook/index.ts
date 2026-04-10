import {
  getNextRetryAt,
  PaddleWebhookEvent,
  billingSupabase,
  markBillingEventProcessed,
  processBillingWebhookEvent,
  resolvePlanId,
  resolveTenantId,
} from '../_shared/paddleBilling.ts';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function parseSignatureHeader(header: string) {
  const pairs = header.split(';').map(item => item.trim()).filter(Boolean);
  const timestamp = pairs.find(item => item.startsWith('ts='))?.split('=')[1];
  const signatures = pairs
    .filter(item => item.startsWith('h1='))
    .map(item => item.split('=')[1]);

  return { timestamp, signatures };
}

function hexToBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = parseInt(value.substring(i, i + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

  return mismatch === 0;
}

async function computeSignature(secret: string, signedPayload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(rawBody: string, signatureHeader: string | null) {
  const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!webhookSecret || !signatureHeader) {
    return false;
  }

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampAge = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (timestampAge > 5 * 60 * 1000) {
    return false;
  }

  const signedPayload = `${timestamp}:${rawBody}`;
  const expectedSignature = await computeSignature(webhookSecret, signedPayload);
  const expectedBytes = hexToBytes(expectedSignature);

  return signatures.some(signature => constantTimeEqual(hexToBytes(signature), expectedBytes));
}

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const correlationId = crypto.randomUUID();
  const rawBody = await request.text();
  const isVerified = await verifySignature(rawBody, request.headers.get('Paddle-Signature'));

  if (!isVerified) {
    return json({ error: 'Invalid webhook signature' }, 401, { 'X-Correlation-Id': correlationId });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, { 'X-Correlation-Id': correlationId });
  }

  const tenantId = await resolveTenantId(event);
  const planId = await resolvePlanId(event);
  const { data: existingEvent } = await billingSupabase
    .from('billing_events')
    .select('id, processing_status, retry_count')
    .eq('paddle_event_id', event.event_id)
    .maybeSingle();

  if (existingEvent?.processing_status === 'processed') {
    return json({ ok: true, duplicate: true }, 200, { 'X-Correlation-Id': correlationId });
  }

  await billingSupabase
    .from('billing_events')
    .upsert({
      paddle_event_id: event.event_id,
      source: 'paddle',
      event_type: event.event_type,
      tenant_id: tenantId,
      processing_status: 'received',
      payload: event,
      occurred_at: event.occurred_at,
      next_retry_at: null,
    }, { onConflict: 'paddle_event_id' });

  try {
    const result = await processBillingWebhookEvent(event);

    await markBillingEventProcessed(event.event_id, {
      processing_status: 'processed',
      tenant_id: result.tenantId,
      subscription_id: result.subscriptionRowId,
      invoice_id: result.invoiceRowId,
      error_message: null,
      next_retry_at: null,
    });

    console.info(JSON.stringify({ correlationId, eventId: event.event_id, eventType: event.event_type, tenantId: result.tenantId, planId, status: 'processed' }));
    return json({ ok: true }, 200, { 'X-Correlation-Id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';

    await markBillingEventProcessed(event.event_id, {
      processing_status: 'failed',
      tenant_id: tenantId,
      error_message: message,
      next_retry_at: getNextRetryAt(Number(existingEvent?.retry_count || 0)),
    });

    console.error(JSON.stringify({ correlationId, eventId: event.event_id, eventType: event.event_type, tenantId, planId, status: 'failed', error: message }));
    return json({ error: message }, 500, { 'X-Correlation-Id': correlationId });
  }
});
