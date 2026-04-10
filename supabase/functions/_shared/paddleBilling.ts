import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const billingSupabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export type PaddleWebhookEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id?: string;
  data: Record<string, any>;
};

type BillingCycle = 'monthly' | 'yearly';

type AuditLogInput = {
  tenantId?: string | null;
  subscriptionId?: string | null;
  actorUserId?: string | null;
  actorScope?: 'brand' | 'tenant' | 'system';
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type StoredBillingEventRecord = {
  id: string;
  paddle_event_id: string;
  tenant_id?: string | null;
  subscription_id?: string | null;
  event_type: string;
  payload: PaddleWebhookEvent | null;
  retry_count?: number | null;
  processing_status?: string | null;
  next_retry_at?: string | null;
};

const RETRY_DELAYS_MINUTES = [5, 30, 120];
export const MAX_BILLING_RETRY_ATTEMPTS = RETRY_DELAYS_MINUTES.length;

function toAmount(value: unknown): number {
  if (value == null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric / 100;
}

function inferBillingCycle(data: Record<string, any>): BillingCycle {
  const explicitCycle = data?.custom_data?.billing_cycle;
  if (explicitCycle === 'yearly' || explicitCycle === 'monthly') {
    return explicitCycle;
  }

  const interval = String(
    data?.billing_cycle?.interval ??
    data?.billing_cycle?.unit ??
    data?.billing_cycle?.frequency ??
    '',
  ).toLowerCase();

  return interval.includes('year') ? 'yearly' : 'monthly';
}

function inferSubscriptionAmount(data: Record<string, any>) {
  const item = data?.items?.[0];
  return toAmount(
    item?.price?.unit_price?.amount ??
    item?.price?.billing_cycle?.amount ??
    item?.totals?.total ??
    0,
  );
}

function inferTransactionAmount(data: Record<string, any>) {
  return toAmount(
    data?.details?.totals?.total ??
    data?.totals?.total ??
    data?.items?.[0]?.totals?.total ??
    0,
  );
}

async function findTenantByCustomer(customerId?: string | null) {
  if (!customerId) return null;

  const { data } = await billingSupabase
    .from('billing_customers')
    .select('tenant_id')
    .eq('paddle_customer_id', customerId)
    .maybeSingle();

  return data?.tenant_id ?? null;
}

async function findTenantBySubscription(subscriptionId?: string | null) {
  if (!subscriptionId) return null;

  const { data } = await billingSupabase
    .from('billing_subscriptions')
    .select('tenant_id')
    .eq('paddle_subscription_id', subscriptionId)
    .maybeSingle();

  return data?.tenant_id ?? null;
}

async function findPlanByPriceId(priceId?: string | null) {
  if (!priceId) return null;

  const { data } = await billingSupabase
    .from('subscription_plans')
    .select('id')
    .or(`paddle_price_id_monthly.eq.${priceId},paddle_price_id_yearly.eq.${priceId}`)
    .maybeSingle();

  return data?.id ?? null;
}

export async function resolveTenantId(event: PaddleWebhookEvent) {
  const explicitTenantId = event.data?.custom_data?.tenant_id;
  if (explicitTenantId) {
    return explicitTenantId as string;
  }

  return (
    await findTenantBySubscription(event.data?.subscription_id) ??
    await findTenantByCustomer(event.data?.customer_id) ??
    null
  );
}

export async function resolvePlanId(event: PaddleWebhookEvent) {
  const explicitPlanId = event.data?.custom_data?.plan_id;
  if (explicitPlanId) {
    return explicitPlanId as string;
  }

  const priceId =
    event.data?.items?.[0]?.price?.id ??
    event.data?.details?.line_items?.[0]?.price?.id ??
    null;

  return (await findPlanByPriceId(priceId)) ?? 'starter';
}

export async function recordBillingAuditLog(input: AuditLogInput) {
  await billingSupabase
    .from('billing_audit_logs')
    .insert({
      tenant_id: input.tenantId ?? null,
      subscription_id: input.subscriptionId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_scope: input.actorScope ?? 'system',
      action: input.action,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });
}

export function getNextRetryAt(retryCount: number) {
  const delayMinutes = RETRY_DELAYS_MINUTES[retryCount] ?? null;
  if (delayMinutes == null) {
    return null;
  }

  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

type RetryStoredBillingEventInput = {
  billingEvent: StoredBillingEventRecord;
  actorUserId?: string | null;
  actorScope?: 'brand' | 'tenant' | 'system';
  reason?: string | null;
  mode: 'manual' | 'automatic';
};

type RetryStoredBillingEventResult = {
  ok: boolean;
  billingEventId: string;
  eventId: string;
  eventType: string;
  tenantId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  retryCount: number;
  nextRetryAt?: string | null;
  error?: string | null;
};

async function upsertBillingCustomer(event: PaddleWebhookEvent, tenantId: string | null) {
  const customerId = event.data?.customer_id;
  if (!tenantId || !customerId) {
    return null;
  }

  const payload = {
    tenant_id: tenantId,
    paddle_customer_id: customerId,
    email: event.data?.customer?.email ?? event.data?.email ?? event.data?.custom_data?.email ?? null,
    full_name: event.data?.customer?.name ?? event.data?.name ?? null,
    country_code: event.data?.address?.country_code ?? null,
    metadata: event.data?.custom_data ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await billingSupabase
    .from('billing_customers')
    .upsert(payload, { onConflict: 'tenant_id' })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

async function syncTenantStatus(tenantId: string, planId: string, status: string) {
  const tenantStatus =
    status === 'active' ? 'active' :
    status === 'trialing' ? 'trial' :
    status === 'past_due' ? 'past_due' :
    status === 'paused' ? 'suspended' :
    status === 'canceled' ? 'cancelled' :
    'active';

  await billingSupabase
    .from('tenants')
    .update({
      plan_id: planId,
      status: tenantStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);
}

async function handleSubscriptionEvent(event: PaddleWebhookEvent, tenantId: string | null, planId: string) {
  if (!tenantId) {
    return null;
  }

  const customerRecordId = await upsertBillingCustomer(event, tenantId);
  const status = event.data?.status || 'active';
  const scheduledChange = event.data?.scheduled_change ?? null;

  const payload = {
    tenant_id: tenantId,
    customer_id: customerRecordId,
    plan_id: planId,
    paddle_subscription_id: event.data?.id,
    paddle_customer_id: event.data?.customer_id ?? null,
    customer_email: event.data?.customer?.email ?? event.data?.custom_data?.email ?? null,
    status,
    billing_cycle: inferBillingCycle(event.data),
    currency: event.data?.currency_code ?? 'USD',
    amount: inferSubscriptionAmount(event.data),
    quantity: event.data?.items?.[0]?.quantity ?? 1,
    trial_ends_at: event.data?.status === 'trialing' ? (event.data?.next_billed_at ?? null) : null,
    started_at: event.data?.started_at ?? null,
    current_period_starts_at: event.data?.current_billing_period?.starts_at ?? null,
    current_period_ends_at: event.data?.current_billing_period?.ends_at ?? null,
    next_billed_at: event.data?.next_billed_at ?? null,
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    canceled_at: event.data?.canceled_at ?? null,
    paused_at: event.data?.paused_at ?? null,
    is_current: true,
    metadata: {
      ...(event.data?.custom_data ?? {}),
      paddle_scheduled_change: scheduledChange,
      scheduled_change_action: scheduledChange?.action ?? null,
      pause_reason: event.data?.custom_data?.pause_reason ?? null,
    },
    updated_at: new Date().toISOString(),
  };

  await billingSupabase
    .from('billing_subscriptions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .neq('paddle_subscription_id', event.data?.id);

  const { data, error } = await billingSupabase
    .from('billing_subscriptions')
    .upsert(payload, { onConflict: 'paddle_subscription_id' })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  await syncTenantStatus(tenantId, planId, status);
  return data?.id ?? null;
}

async function handleTransactionEvent(
  event: PaddleWebhookEvent,
  tenantId: string | null,
  planId: string,
  subscriptionRowId: string | null,
) {
  if (!tenantId) {
    return null;
  }

  const status = event.data?.status || 'draft';
  const amount = inferTransactionAmount(event.data);
  const invoicePayload = {
    tenant_id: tenantId,
    subscription_id: subscriptionRowId,
    paddle_transaction_id: event.data?.id,
    invoice_number: event.data?.invoice_number ?? null,
    invoice_url: event.data?.invoice_url ?? null,
    amount,
    currency: event.data?.currency_code ?? 'USD',
    status,
    billed_at: event.data?.billed_at ?? event.occurred_at,
    paid_at: status === 'paid' || status === 'completed' ? (event.data?.updated_at ?? event.occurred_at) : null,
    refunded_at: status === 'refunded' ? (event.data?.updated_at ?? event.occurred_at) : null,
    payload: event.data ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await billingSupabase
    .from('billing_invoices')
    .upsert(invoicePayload, { onConflict: 'paddle_transaction_id' })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  await billingSupabase
    .from('billing_checkout_sessions')
    .update({
      status:
        status === 'completed' || status === 'paid' ? 'completed' :
        status === 'past_due' ? 'past_due' :
        status === 'canceled' ? 'cancelled' :
        'open',
      completed_at: status === 'completed' || status === 'paid' ? (event.data?.updated_at ?? event.occurred_at) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_transaction_id', event.data?.id);

  if (status === 'paid' || status === 'completed') {
    await billingSupabase
      .from('payment_records')
      .insert({
        tenant_id: tenantId,
        amount,
        currency: event.data?.currency_code ?? 'USD',
        status: 'paid',
        invoice_url: event.data?.invoice_url ?? null,
        paid_at: event.data?.updated_at ?? event.occurred_at,
        created_at: event.occurred_at,
      });

    await syncTenantStatus(tenantId, planId, 'active');
  }

  if (status === 'past_due') {
    await syncTenantStatus(tenantId, planId, 'past_due');
  }

  return data?.id ?? null;
}

export async function processBillingWebhookEvent(event: PaddleWebhookEvent) {
  const tenantId = await resolveTenantId(event);
  const planId = await resolvePlanId(event);

  let subscriptionRowId: string | null = null;
  let invoiceRowId: string | null = null;

  if (event.event_type.startsWith('subscription.')) {
    subscriptionRowId = await handleSubscriptionEvent(event, tenantId, planId);
  }

  if (event.event_type.startsWith('transaction.')) {
    const resolvedSubscriptionId = event.data?.subscription_id
      ? await billingSupabase
        .from('billing_subscriptions')
        .select('id')
        .eq('paddle_subscription_id', event.data.subscription_id)
        .maybeSingle()
      : { data: null };

    subscriptionRowId = subscriptionRowId ?? resolvedSubscriptionId.data?.id ?? null;
    invoiceRowId = await handleTransactionEvent(event, tenantId, planId, subscriptionRowId);
  }

  return {
    tenantId,
    planId,
    subscriptionRowId,
    invoiceRowId,
  };
}

export async function markBillingEventProcessed(eventId: string, updates: Record<string, unknown>) {
  await billingSupabase
    .from('billing_events')
    .update({
      ...updates,
      processed_at: new Date().toISOString(),
    })
    .eq('paddle_event_id', eventId);
}

export async function retryStoredBillingEvent({
  billingEvent,
  actorUserId = null,
  actorScope = 'system',
  reason = null,
  mode,
}: RetryStoredBillingEventInput): Promise<RetryStoredBillingEventResult> {
  const eventPayload = billingEvent.payload as PaddleWebhookEvent | null;
  if (!eventPayload?.event_id || !eventPayload?.event_type) {
    throw new Error('Billing event payload is incomplete');
  }

  const retryCount = Number(billingEvent.retry_count || 0) + 1;
  const retryTimestamp = new Date().toISOString();

  await billingSupabase
    .from('billing_events')
    .update({
      processing_status: 'received',
      error_message: null,
      retry_count: retryCount,
      last_retry_at: retryTimestamp,
      last_retry_by: actorUserId,
      last_retry_reason: reason,
      next_retry_at: null,
      processed_at: null,
    })
    .eq('id', billingEvent.id);

  try {
    const result = await processBillingWebhookEvent(eventPayload);

    await markBillingEventProcessed(eventPayload.event_id, {
      processing_status: 'processed',
      tenant_id: result.tenantId,
      subscription_id: result.subscriptionRowId,
      invoice_id: result.invoiceRowId,
      error_message: null,
      next_retry_at: null,
    });

    await recordBillingAuditLog({
      tenantId: result.tenantId,
      subscriptionId: result.subscriptionRowId ?? billingEvent.subscription_id,
      actorUserId,
      actorScope,
      action: mode === 'automatic' ? 'webhook_auto_retry' : 'webhook_retry',
      reason,
      metadata: {
        billing_event_id: billingEvent.id,
        paddle_event_id: eventPayload.event_id,
        event_type: eventPayload.event_type,
        retry_count: retryCount,
      },
    });

    return {
      ok: true,
      billingEventId: billingEvent.id,
      eventId: eventPayload.event_id,
      eventType: eventPayload.event_type,
      tenantId: result.tenantId,
      subscriptionId: result.subscriptionRowId ?? billingEvent.subscription_id,
      invoiceId: result.invoiceRowId,
      retryCount,
      nextRetryAt: null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook retry failed';
    const nextRetryAt = retryCount < MAX_BILLING_RETRY_ATTEMPTS ? getNextRetryAt(retryCount) : null;

    await markBillingEventProcessed(eventPayload.event_id, {
      processing_status: 'failed',
      tenant_id: billingEvent.tenant_id,
      subscription_id: billingEvent.subscription_id,
      error_message: message,
      next_retry_at: nextRetryAt,
    });

    await recordBillingAuditLog({
      tenantId: billingEvent.tenant_id,
      subscriptionId: billingEvent.subscription_id,
      actorUserId,
      actorScope,
      action: mode === 'automatic' ? 'webhook_auto_retry_failed' : 'webhook_retry_failed',
      reason,
      metadata: {
        billing_event_id: billingEvent.id,
        paddle_event_id: eventPayload.event_id,
        event_type: eventPayload.event_type,
        retry_count: retryCount,
        next_retry_at: nextRetryAt,
        error: message,
      },
    });

    return {
      ok: false,
      billingEventId: billingEvent.id,
      eventId: eventPayload.event_id,
      eventType: eventPayload.event_type,
      tenantId: billingEvent.tenant_id,
      subscriptionId: billingEvent.subscription_id,
      retryCount,
      nextRetryAt,
      error: message,
    };
  }
}
