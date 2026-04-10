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

function isSuperAdmin(user: Record<string, any>) {
  const role =
    user?.user_metadata?.role ??
    user?.app_metadata?.role ??
    user?.raw_user_meta_data?.role ??
    null;

  return role === 'super_admin';
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Missing authorization token');
  }

  const { data, error } = await billingSupabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid or expired session');
  }

  return data.user;
}

type RetryRequestPayload = {
  billing_event_id?: string;
  billing_event_ids?: string[];
  retry_failed?: boolean;
  reason?: string;
  limit?: number;
};

async function loadTargetBillingEvents(payload: RetryRequestPayload) {
  if (payload.billing_event_id) {
    const { data, error } = await billingSupabase
      .from('billing_events')
      .select('id, paddle_event_id, tenant_id, subscription_id, event_type, payload, retry_count, processing_status, next_retry_at')
      .eq('id', payload.billing_event_id)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Billing event not found');
    }

    return [data as StoredBillingEventRecord];
  }

  if (payload.billing_event_ids?.length) {
    const sanitizedIds = Array.from(new Set(payload.billing_event_ids.filter(Boolean))).slice(0, 50);
    if (sanitizedIds.length === 0) {
      throw new Error('billing_event_ids must contain at least one id');
    }

    const { data, error } = await billingSupabase
      .from('billing_events')
      .select('id, paddle_event_id, tenant_id, subscription_id, event_type, payload, retry_count, processing_status, next_retry_at')
      .in('id', sanitizedIds);

    if (error) {
      throw error;
    }

    return (data || []) as StoredBillingEventRecord[];
  }

  if (payload.retry_failed) {
    const limit = Math.min(Math.max(Number(payload.limit || 20), 1), 50);
    const { data, error } = await billingSupabase
      .from('billing_events')
      .select('id, paddle_event_id, tenant_id, subscription_id, event_type, payload, retry_count, processing_status, next_retry_at')
      .eq('processing_status', 'failed')
      .order('occurred_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as StoredBillingEventRecord[];
  }

  throw new Error('Provide billing_event_id, billing_event_ids, or retry_failed');
}

Deno.serve(async request => {
  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { 'X-Correlation-Id': correlationId });
    }

    const user = await getAuthenticatedUser(request);
    if (!isSuperAdmin(user)) {
      return json({ error: 'Only super admins can retry billing webhooks' }, 403, { 'X-Correlation-Id': correlationId });
    }

    const payload = await request.json() as RetryRequestPayload;
    const events = await loadTargetBillingEvents(payload);
    if (events.length === 0) {
      return json({ error: 'No billing events matched the retry criteria' }, 404, { 'X-Correlation-Id': correlationId });
    }

    const results = [];
    for (const billingEvent of events) {
      const result = await retryStoredBillingEvent({
        billingEvent,
        actorUserId: user.id,
        actorScope: 'tenant',
        reason: payload.reason ?? null,
        mode: 'manual',
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
    const exhausted = results.filter(item => !item.ok && !item.next_retry_at && item.retry_count >= MAX_BILLING_RETRY_ATTEMPTS).length;

    return json({
      ok: failed === 0,
      message:
        results.length === 1
          ? succeeded === 1
            ? 'Webhook retried successfully'
            : 'Webhook retry failed'
          : `Retried ${results.length} webhook events: ${succeeded} succeeded, ${failed} failed`,
      processed: results.length,
      succeeded,
      failed,
      exhausted,
      results,
    }, failed > 0 && succeeded === 0 ? 500 : 200, { 'X-Correlation-Id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook retry error';
    return json({ error: message }, 500, { 'X-Correlation-Id': correlationId });
  }
});
