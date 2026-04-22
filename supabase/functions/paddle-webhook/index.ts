import {
  getNextRetryAt,
  PaddleWebhookEvent,
  billingSupabase,
  markBillingEventProcessed,
  processBillingWebhookEvent,
  resolvePlanId,
  resolveTenantId,
} from '../_shared/paddleBilling.ts';
import { verifyPaddleSignature } from '../_shared/webhookSecurity.ts';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

async function verifySignature(rawBody: string, signatureHeader: string | null) {
  return verifyPaddleSignature(rawBody, signatureHeader, Deno.env.get('PADDLE_WEBHOOK_SECRET'));
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
