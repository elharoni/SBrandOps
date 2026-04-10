import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type BillingCycle = 'monthly' | 'yearly';
type ManageAction = 'overview' | 'portal' | 'pause' | 'cancel' | 'resume' | 'change_billing_cycle';
type ScheduledChangeAction = 'pause' | 'cancel' | null;

type ManagePayload = {
  action: ManageAction;
  brand_id?: string;
  tenant_id?: string;
  billing_cycle?: BillingCycle;
  reason?: string;
  return_url?: string;
};

type PortalLinks = {
  overview: string | null;
  cancel: string | null;
  updatePaymentMethod: string | null;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const paddleApiHeaders = {
  Authorization: `Bearer ${Deno.env.get('PADDLE_API_KEY')}`,
  'Content-Type': 'application/json',
  'Paddle-Version': '1',
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

function getPriceId(planId: string, cycle: BillingCycle) {
  const suffix = cycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const specificKey = `PADDLE_${planId.toUpperCase()}_${suffix}_PRICE_ID`;
  const legacyKey = `VITE_PADDLE_${planId.toUpperCase()}_${suffix}_PRICE_ID`;
  return Deno.env.get(specificKey) ?? Deno.env.get(legacyKey) ?? null;
}

async function paddleRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.paddle.com${path}`, {
    ...init,
    headers: {
      ...paddleApiHeaders,
      ...(init.headers || {}),
    },
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.detail || result?.error?.message || `Paddle request failed: ${path}`);
  }

  return result?.data ?? null;
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Missing authorization token');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid or expired session');
  }

  return data.user;
}

function isSuperAdmin(user: Record<string, any>) {
  const role =
    user?.user_metadata?.role ??
    user?.app_metadata?.role ??
    user?.raw_user_meta_data?.role ??
    null;

  return role === 'super_admin';
}

async function assertBrandAccess(userId: string, brandId: string) {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('id, name, user_id, tenant_id')
    .eq('id', brandId)
    .maybeSingle();

  if (error || !brand) {
    throw new Error('Brand not found');
  }

  if (brand.user_id === userId) {
    return brand;
  }

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    throw new Error('You do not have access to this brand');
  }

  return brand;
}

async function getTenantById(tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, owner_id, plan_id, status, trial_ends_at, users_count, brands_count, ai_tokens_used, billing_email')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant) {
    throw new Error('Tenant not found');
  }

  return tenant;
}

async function recordBillingAuditLog(input: {
  tenantId?: string | null;
  subscriptionId?: string | null;
  actorUserId?: string | null;
  actorScope?: 'brand' | 'tenant' | 'system';
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabase
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

async function updateSubscriptionMetadata(subscriptionId: string, metadata: Record<string, unknown>) {
  const { data: current } = await supabase
    .from('billing_subscriptions')
    .select('metadata')
    .eq('id', subscriptionId)
    .maybeSingle();

  await supabase
    .from('billing_subscriptions')
    .update({
      metadata: {
        ...(current?.metadata ?? {}),
        ...metadata,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
}

async function resolveTenantForBrand(brand: { id: string; user_id: string; tenant_id: string | null }) {
  let tenant = null;

  if (brand.tenant_id) {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, owner_id, plan_id, status, trial_ends_at, users_count, brands_count, ai_tokens_used, billing_email')
      .eq('id', brand.tenant_id)
      .maybeSingle();
    tenant = data;
  }

  if (!tenant) {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, owner_id, plan_id, status, trial_ends_at, users_count, brands_count, ai_tokens_used, billing_email')
      .eq('owner_id', brand.user_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    tenant = data;
  }

  if (tenant && !brand.tenant_id) {
    await supabase
      .from('brands')
      .update({ tenant_id: tenant.id })
      .eq('id', brand.id);
  }

  return tenant;
}

async function resolveAccessContext(user: Record<string, any>, payload: ManagePayload) {
  if (payload.tenant_id) {
    if (!isSuperAdmin(user)) {
      throw new Error('Only super admins can manage billing by tenant');
    }

    const tenant = await getTenantById(payload.tenant_id);
    return {
      tenant,
      brand: null,
      scope: 'tenant' as const,
    };
  }

  if (!payload.brand_id) {
    throw new Error('brand_id or tenant_id is required');
  }

  const brand = await assertBrandAccess(user.id, payload.brand_id);
  const tenant = await resolveTenantForBrand(brand);

  return {
    tenant,
    brand,
    scope: 'brand' as const,
  };
}

async function getPlanRow(planId: string) {
  const { data } = await supabase
    .from('subscription_plans')
    .select('id, name, currency, price_monthly, price_yearly, max_brands, max_users, ai_tokens_monthly')
    .eq('id', planId)
    .maybeSingle();

  return data;
}

async function getTenantUsage(tenantId: string) {
  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('tenant_usage')
    .select('users_used, brands_used, ai_tokens_used')
    .eq('tenant_id', tenantId)
    .eq('period_month', currentMonth.toISOString().slice(0, 10))
    .maybeSingle();

  return data;
}

async function getCurrentSubscription(tenantId: string) {
  const { data } = await supabase
    .from('billing_subscriptions')
    .select(`
      id,
      tenant_id,
      customer_id,
      plan_id,
      paddle_subscription_id,
      paddle_customer_id,
      customer_email,
      status,
      billing_cycle,
      currency,
      amount,
      quantity,
      trial_ends_at,
      started_at,
      current_period_starts_at,
      current_period_ends_at,
      next_billed_at,
      cancel_at_period_end,
      canceled_at,
      paused_at,
      metadata,
      subscription_plans (
        id,
        name,
        currency,
        price_monthly,
        price_yearly,
        max_brands,
        max_users,
        ai_tokens_monthly
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('is_current', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function getPaymentHistory(tenantId: string) {
  const { data } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, invoice_url, amount, currency, status, billed_at, paid_at, refunded_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(12);

  return (data || []).map((invoice: Record<string, unknown>) => ({
    id: String(invoice.id),
    date: new Date(String(invoice.paid_at || invoice.refunded_at || invoice.billed_at || invoice.created_at)),
    amount: Number(invoice.amount || 0),
    currency: String(invoice.currency || 'USD'),
    status: invoice.status === 'paid'
      ? 'Paid'
      : invoice.status === 'refunded'
        ? 'Refunded'
        : invoice.status === 'open' || invoice.status === 'draft' || invoice.status === 'past_due'
          ? 'Open'
          : 'Failed',
    invoiceUrl: String(invoice.invoice_url || '#'),
    invoiceNumber: typeof invoice.invoice_number === 'string' ? invoice.invoice_number : null,
  }));
}

function inferBillingCycle(entity: Record<string, any>, fallback: BillingCycle = 'monthly'): BillingCycle {
  const value =
    entity?.custom_data?.billing_cycle ??
    entity?.billing_cycle?.interval ??
    entity?.billing_cycle?.unit ??
    entity?.billing_cycle?.frequency ??
    entity?.items?.[0]?.price?.billing_cycle?.interval ??
    entity?.items?.[0]?.price?.billing_cycle?.frequency ??
    fallback;

  return String(value).toLowerCase().includes('year') ? 'yearly' : 'monthly';
}

function inferAmount(entity: Record<string, any>, fallback = 0) {
  const item = entity?.items?.[0];
  const rawAmount =
    item?.price?.unit_price?.amount ??
    item?.price?.unit_totals?.total ??
    item?.price?.unit_totals?.subtotal ??
    item?.price?.amount ??
    fallback;

  return Number(rawAmount || fallback);
}

function getScheduledChangeAction(entity: Record<string, any> | null | undefined, fallback: Record<string, any> | null | undefined): ScheduledChangeAction {
  const action =
    entity?.scheduled_change?.action ??
    fallback?.metadata?.paddle_scheduled_change?.action ??
    fallback?.metadata?.scheduled_change_action ??
    (fallback?.cancel_at_period_end ? 'cancel' : null);

  return action === 'pause' || action === 'cancel' ? action : null;
}

async function updateLocalSubscriptionRow(
  currentSubscription: Record<string, any>,
  entity: Record<string, any>,
  fallbackPlanId: string,
) {
  const scheduledChangeAction = getScheduledChangeAction(entity, currentSubscription);
  const payload = {
    plan_id: entity?.custom_data?.plan_id ?? fallbackPlanId,
    status: entity?.status ?? currentSubscription.status,
    billing_cycle: inferBillingCycle(entity, currentSubscription.billing_cycle),
    currency: entity?.currency_code ?? currentSubscription.currency,
    amount: inferAmount(entity, currentSubscription.amount),
    quantity: entity?.items?.[0]?.quantity ?? currentSubscription.quantity ?? 1,
    trial_ends_at: entity?.status === 'trialing'
      ? (entity?.next_billed_at ?? currentSubscription.trial_ends_at ?? null)
      : null,
    started_at: entity?.started_at ?? currentSubscription.started_at ?? null,
    current_period_starts_at: entity?.current_billing_period?.starts_at ?? currentSubscription.current_period_starts_at ?? null,
    current_period_ends_at: entity?.current_billing_period?.ends_at ?? currentSubscription.current_period_ends_at ?? null,
    next_billed_at: entity?.next_billed_at ?? currentSubscription.next_billed_at ?? null,
    cancel_at_period_end: scheduledChangeAction === 'cancel',
    canceled_at: entity?.canceled_at ?? null,
    paused_at: entity?.paused_at ?? null,
    metadata: {
      ...(currentSubscription?.metadata ?? {}),
      ...(entity?.custom_data ?? {}),
      scheduled_change_action: scheduledChangeAction,
      paddle_scheduled_change: entity?.scheduled_change ?? null,
    },
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('billing_subscriptions')
    .update(payload)
    .eq('id', currentSubscription.id);
}

async function createPortalLinks(paddleCustomerId: string, paddleSubscriptionId?: string | null): Promise<PortalLinks> {
  const body: Record<string, unknown> = {};

  if (paddleSubscriptionId) {
    body.subscription_ids = [paddleSubscriptionId];
  }

  const data = await paddleRequest(`/customers/${paddleCustomerId}/portal-sessions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const subscriptionLinks = Array.isArray(data?.urls?.subscriptions)
    ? data.urls.subscriptions.find((item: Record<string, unknown>) =>
      item?.id === paddleSubscriptionId || item?.subscription_id === paddleSubscriptionId,
    ) ?? data.urls.subscriptions[0]
    : null;

  return {
    overview: data?.urls?.general?.overview ?? subscriptionLinks?.overview ?? null,
    cancel: subscriptionLinks?.cancel ?? subscriptionLinks?.cancel_subscription ?? null,
    updatePaymentMethod: subscriptionLinks?.update_payment_method ?? subscriptionLinks?.update_subscription_payment_method ?? null,
  };
}

function buildSubscriptionSnapshot(
  tenant: Record<string, any> | null,
  currentSubscription: Record<string, any> | null,
  planRow: Record<string, any> | null,
  usageRow: Record<string, any> | null,
  portalLinks: PortalLinks,
) {
  const fallbackPlanId = currentSubscription?.plan_id ?? tenant?.plan_id ?? 'starter';
  const billingCycle = (currentSubscription?.billing_cycle === 'yearly' ? 'yearly' : 'monthly') as BillingCycle;
  const scheduledChangeAction = getScheduledChangeAction(currentSubscription, currentSubscription);
  const isPauseScheduled = scheduledChangeAction === 'pause' && currentSubscription?.status !== 'paused';
  const isCancelScheduled = scheduledChangeAction === 'cancel';
  const canManage = Boolean(currentSubscription?.paddle_subscription_id);
  const limits = {
    users: Number(planRow?.max_users ?? 2),
    brands: Number(planRow?.max_brands ?? 1),
    aiTokens: Number(planRow?.ai_tokens_monthly ?? 1_000_000),
  };

  const usage = {
    users: Number(usageRow?.users_used ?? tenant?.users_count ?? 0),
    brands: Number(usageRow?.brands_used ?? tenant?.brands_count ?? 0),
    aiTokens: Number(usageRow?.ai_tokens_used ?? tenant?.ai_tokens_used ?? 0),
  };

  const status = currentSubscription?.status ?? tenant?.status ?? 'trial';
  const nextBillingDate = new Date(
    currentSubscription?.next_billed_at ??
    tenant?.trial_ends_at ??
    (Date.now() + (14 * 24 * 60 * 60 * 1000)),
  );

  return {
    id: currentSubscription?.id ?? null,
    tenantId: tenant?.id ?? null,
    planId: fallbackPlanId,
    name: planRow?.name ?? 'Starter',
    price: Number(
      currentSubscription?.amount ??
      (billingCycle === 'yearly' ? planRow?.price_yearly : planRow?.price_monthly) ??
      0,
    ),
    currency: currentSubscription?.currency ?? planRow?.currency ?? 'USD',
    nextBillingDate,
    status,
    billingCycle,
    trialEndsAt: currentSubscription?.status === 'trialing'
      ? (currentSubscription?.trial_ends_at ?? tenant?.trial_ends_at ?? null)
      : tenant?.status === 'trial'
        ? tenant?.trial_ends_at ?? null
        : null,
    cancelAtPeriodEnd: isCancelScheduled,
    scheduledChangeAction,
    pauseReason: currentSubscription?.metadata?.pause_reason ?? null,
    portalUrl: portalLinks.overview,
    updatePaymentMethodUrl: portalLinks.updatePaymentMethod,
    canManage,
    canPause: canManage && ['active', 'trialing', 'past_due'].includes(status) && !isCancelScheduled && !isPauseScheduled,
    canCancel: canManage && ['active', 'trialing', 'past_due'].includes(status) && !isCancelScheduled && !isPauseScheduled,
    canResume: canManage && (status === 'paused' || isCancelScheduled || isPauseScheduled),
    canChangeBillingCycle: canManage && ['active', 'trialing', 'past_due', 'paused'].includes(status) && !isPauseScheduled,
    limits,
    usage,
  };
}

Deno.serve(async req => {
  const correlationId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { 'X-Correlation-Id': correlationId });
    }

    const user = await getAuthenticatedUser(req);
    const payload = await req.json() as ManagePayload;

    if ((!payload.brand_id && !payload.tenant_id) || !payload.action) {
      return json({ error: 'brand_id or tenant_id and action are required' }, 400, { 'X-Correlation-Id': correlationId });
    }

    const { tenant, brand, scope } = await resolveAccessContext(user, payload);

    if (!tenant) {
      const planRow = await getPlanRow('starter');
      return json({
        action: payload.action,
        message: 'No billing tenant exists yet for this workspace',
        portalUrl: null,
        updatePaymentMethodUrl: null,
        subscription: buildSubscriptionSnapshot(null, null, planRow, null, {
          overview: null,
          cancel: null,
          updatePaymentMethod: null,
        }),
        paymentHistory: [],
      }, 200, { 'X-Correlation-Id': correlationId });
    }

    const currentSubscription = await getCurrentSubscription(tenant.id);
    const currentPlanId = currentSubscription?.plan_id ?? tenant.plan_id ?? 'starter';
    const planRow = currentSubscription?.subscription_plans ?? await getPlanRow(currentPlanId);

    if (payload.action !== 'overview' && !currentSubscription?.paddle_subscription_id) {
      return json({ error: 'No active Paddle subscription found for this tenant' }, 400, { 'X-Correlation-Id': correlationId });
    }

    let portalLinks: PortalLinks = {
      overview: null,
      cancel: null,
      updatePaymentMethod: null,
    };

    if (payload.action === 'portal' && currentSubscription?.paddle_customer_id) {
      portalLinks = await createPortalLinks(
        currentSubscription.paddle_customer_id,
        currentSubscription.paddle_subscription_id,
      );
    }

    const scheduledChangeAction = getScheduledChangeAction(currentSubscription, currentSubscription);
    const hasScheduledCancel = scheduledChangeAction === 'cancel';
    const hasScheduledPause = scheduledChangeAction === 'pause' && currentSubscription?.status !== 'paused';

    if (payload.action === 'pause') {
      if (currentSubscription?.status === 'paused' || hasScheduledPause) {
        return json({ error: 'Subscription is already paused or scheduled to pause' }, 400, { 'X-Correlation-Id': correlationId });
      }

      if (hasScheduledCancel) {
        return json({ error: 'Remove the scheduled cancellation before pausing this subscription' }, 400, { 'X-Correlation-Id': correlationId });
      }

      const entity = await paddleRequest(`/subscriptions/${currentSubscription!.paddle_subscription_id}/pause`, {
        method: 'POST',
        body: JSON.stringify({
          effective_from: 'next_billing_period',
        }),
      });

      await updateLocalSubscriptionRow(currentSubscription!, entity, currentPlanId);
      if (payload.reason) {
        await updateSubscriptionMetadata(currentSubscription!.id, { pause_reason: payload.reason });
      }
    }

    if (payload.action === 'cancel') {
      if (hasScheduledCancel) {
        return json({ error: 'Subscription is already scheduled to cancel' }, 400, { 'X-Correlation-Id': correlationId });
      }

      if (hasScheduledPause) {
        return json({ error: 'Remove the scheduled pause before canceling this subscription' }, 400, { 'X-Correlation-Id': correlationId });
      }

      const entity = await paddleRequest(`/subscriptions/${currentSubscription!.paddle_subscription_id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          effective_from: 'next_billing_period',
        }),
      });

      await updateLocalSubscriptionRow(currentSubscription!, entity, currentPlanId);
      if (payload.reason) {
        await updateSubscriptionMetadata(currentSubscription!.id, { cancellation_reason: payload.reason });
      }
    }

    if (payload.action === 'resume') {
      if (currentSubscription?.status === 'paused') {
        const entity = await paddleRequest(`/subscriptions/${currentSubscription.paddle_subscription_id}/resume`, {
          method: 'POST',
          body: JSON.stringify({
            effective_from: 'immediately',
            on_resume: 'continue_existing_billing_period',
          }),
        });

        await updateLocalSubscriptionRow(currentSubscription, entity, currentPlanId);
      } else if (hasScheduledCancel || hasScheduledPause) {
        const entity = await paddleRequest(`/subscriptions/${currentSubscription.paddle_subscription_id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            scheduled_change: null,
          }),
        });

        await updateLocalSubscriptionRow(currentSubscription, entity, currentPlanId);
      } else {
        return json({ error: 'Subscription is not paused or scheduled for a change' }, 400, { 'X-Correlation-Id': correlationId });
      }
    }

    if (payload.action === 'change_billing_cycle') {
      if (!payload.billing_cycle) {
        return json({ error: 'billing_cycle is required for change_billing_cycle' }, 400, { 'X-Correlation-Id': correlationId });
      }

      if (payload.billing_cycle === currentSubscription?.billing_cycle) {
        return json({ error: 'Selected billing cycle is already active' }, 400, { 'X-Correlation-Id': correlationId });
      }

      const priceId = getPriceId(currentPlanId, payload.billing_cycle);
      if (!priceId) {
        return json({ error: 'Missing Paddle price ID for requested billing cycle' }, 400, { 'X-Correlation-Id': correlationId });
      }

      const entity = await paddleRequest(`/subscriptions/${currentSubscription!.paddle_subscription_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: currentSubscription?.quantity ?? 1 }],
          custom_data: {
            ...(currentSubscription?.metadata ?? {}),
            plan_id: currentPlanId,
            billing_cycle: payload.billing_cycle,
          },
          proration_billing_mode: 'do_not_bill',
          on_payment_failure: 'prevent_change',
        }),
      });

      await updateLocalSubscriptionRow(currentSubscription!, entity, currentPlanId);
    }

    const refreshedSubscription = await getCurrentSubscription(tenant.id);
    const refreshedPlanId = refreshedSubscription?.plan_id ?? tenant.plan_id ?? 'starter';
    const refreshedPlan = refreshedSubscription?.subscription_plans ?? await getPlanRow(refreshedPlanId);
    const usageRow = await getTenantUsage(tenant.id);
    const paymentHistory = await getPaymentHistory(tenant.id);

    const subscription = buildSubscriptionSnapshot(
      tenant,
      refreshedSubscription,
      refreshedPlan,
      usageRow,
      portalLinks,
    );

    const messageMap: Record<ManageAction, string> = {
      overview: 'Billing overview loaded',
      portal: 'Customer portal link created',
      pause: refreshedSubscription?.status === 'paused' ? 'Subscription paused successfully' : 'Subscription will pause at period end',
      cancel: 'Subscription will cancel at period end',
      resume: currentSubscription?.status === 'paused'
        ? 'Subscription resumed successfully'
        : hasScheduledPause
          ? 'Scheduled pause removed'
          : 'Scheduled cancellation removed',
      change_billing_cycle: 'Billing cycle updated successfully',
    };

    console.info(JSON.stringify({
      correlationId,
      event: 'paddle-billing-manage',
      action: payload.action,
      tenantId: tenant.id,
      brandId: brand?.id ?? null,
      scope,
    }));

    if (payload.action !== 'overview' && payload.action !== 'portal') {
      await recordBillingAuditLog({
        tenantId: tenant.id,
        subscriptionId: refreshedSubscription?.id ?? currentSubscription?.id ?? null,
        actorUserId: user.id,
        actorScope: scope,
        action: payload.action,
        reason: payload.reason ?? null,
        metadata: {
          brand_id: brand?.id ?? null,
          billing_cycle: payload.billing_cycle ?? null,
          scheduled_change_action: subscription.scheduledChangeAction ?? null,
          correlation_id: correlationId,
        },
      });
    }

    return json({
      action: payload.action,
      message: messageMap[payload.action],
      portalUrl: portalLinks.overview,
      updatePaymentMethodUrl: portalLinks.updatePaymentMethod,
      subscription,
      paymentHistory,
    }, 200, { 'X-Correlation-Id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Billing management error';

    console.error(JSON.stringify({
      correlationId,
      event: 'paddle-billing-manage-error',
      error: message,
    }));

    return json({ error: message }, 500, { 'X-Correlation-Id': correlationId });
  }
});
