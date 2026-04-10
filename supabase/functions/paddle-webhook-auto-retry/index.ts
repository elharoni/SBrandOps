import {
  MAX_BILLING_RETRY_ATTEMPTS,
  StoredBillingEventRecord,
  billingSupabase,
  retryStoredBillingEvent,
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

function isAuthorized(request: Request) {
  const expectedSecret = Deno.env.get('BILLING_RETRY_CRON_SECRET');
  if (!expectedSecret) {
    return false;
  }

  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');
  const directSecret = request.headers.get('X-Cron-Secret');

  return bearerToken === expectedSecret || directSecret === expectedSecret;
}

Deno.serve(async request => {
  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { 'X-Correlation-Id': correlationId });
    }

    if (!isAuthorized(request)) {
      return json({ error: 'Unauthorized' }, 401, { 'X-Correlation-Id': correlationId });
    }

    const { data, error } = await billingSupabase
      .from('billing_events')
      .select('id, paddle_event_id, tenant_id, subscription_id, event_type, payload, retry_count, processing_status, next_retry_at')
      .eq('processing_status', 'failed')
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', MAX_BILLING_RETRY_ATTEMPTS)
      .order('next_retry_at', { ascending: true })
      .limit(20);

    if (error) {
      throw error;
    }

    const events = (data || []) as StoredBillingEventRecord[];
    const results = [];

    for (const billingEvent of events) {
      const result = await retryStoredBillingEvent({
        billingEvent,
        actorUserId: null,
        actorScope: 'system',
        reason: 'Automatic retry policy',
        mode: 'automatic',
      });

      results.push({
        billing_event_id: billingEvent.id,
        paddle_event_id: result.eventId,
        event_type: result.eventType,
        ok: result.ok,
        retry_count: result.retryCount,
        next_retry_at: result.nextRetryAt,
        error: result.error ?? null,
      });
    }

    const succeeded = results.filter(item => item.ok).length;
    const failed = results.length - succeeded;

    console.info(JSON.stringify({
      correlationId,
      event: 'billing_auto_retry_batch',
      processed: results.length,
      succeeded,
      failed,
    }));

    return json({
      ok: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    }, 200, { 'X-Correlation-Id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Billing auto retry failed';
    console.error(JSON.stringify({ correlationId, event: 'billing_auto_retry_failed', error: message }));
    return json({ error: message }, 500, { 'X-Correlation-Id': correlationId });
  }
});
