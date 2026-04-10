import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type BillingCycle = 'monthly' | 'yearly';
type CheckoutMode = 'checkout' | 'updated' | 'already_active';

type CheckoutPayload = {
  plan_id: string;
  billing_cycle: BillingCycle;
  brand_id?: string;
  brand_name?: string;
  return_url?: string;
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

function buildTenantName(user: { email?: string | null; user_metadata?: Record<string, any> }, payload: CheckoutPayload) {
  return (
    payload.brand_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'SBrandOps Workspace'
  );
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

async function getOrCreateTenant(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }, payload: CheckoutPayload) {
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id, name, owner_id, plan_id, status')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingTenant) {
    return existingTenant;
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: buildTenantName(user, payload),
      owner_id: user.id,
      plan_id: 'starter',
      status: 'trial',
      trial_ends_at: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString(),
    })
    .select('id, name, owner_id, plan_id, status')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create tenant');
  }

  return data;
}

async function getCurrentSubscription(tenantId: string) {
  const { data } = await supabase
    .from('billing_subscriptions')
    .select('id, plan_id, billing_cycle, status, paddle_subscription_id')
    .eq('tenant_id', tenantId)
    .eq('is_current', true)
    .in('status', ['trialing', 'active', 'past_due', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function getOrCreatePaddleCustomer(
  tenantId: string,
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> },
) {
  const { data: existing } = await supabase
    .from('billing_customers')
    .select('id, paddle_customer_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing?.paddle_customer_id) {
    return existing.paddle_customer_id;
  }

  if (!user.email) {
    throw new Error('User email is required for Paddle customer creation');
  }

  const response = await fetch('https://api.paddle.com/customers', {
    method: 'POST',
    headers: paddleApiHeaders,
    body: JSON.stringify({
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
      custom_data: {
        supabase_user_id: user.id,
        tenant_id: tenantId,
      },
    }),
  });

  const result = await response.json();
  if (!response.ok || !result?.data?.id) {
    throw new Error(result?.error?.detail || result?.error?.message || 'Failed to create Paddle customer');
  }

  await supabase
    .from('billing_customers')
    .upsert({
      tenant_id: tenantId,
      paddle_customer_id: result.data.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? null,
      metadata: { supabase_user_id: user.id },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

  return result.data.id as string;
}

async function createCheckoutTransaction(
  tenantId: string,
  user: { id: string; email?: string | null },
  payload: CheckoutPayload,
  priceId: string,
) {
  const customerId = await getOrCreatePaddleCustomer(tenantId, user);

  const response = await fetch('https://api.paddle.com/transactions?include=checkout', {
    method: 'POST',
    headers: paddleApiHeaders,
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      customer_id: customerId,
      collection_mode: 'automatic',
      custom_data: {
        tenant_id: tenantId,
        plan_id: payload.plan_id,
        billing_cycle: payload.billing_cycle,
        brand_id: payload.brand_id ?? null,
        user_id: user.id,
      },
    }),
  });

  const result = await response.json();
  if (!response.ok || !result?.data?.id) {
    throw new Error(result?.error?.detail || result?.error?.message || 'Failed to create Paddle checkout transaction');
  }

  await supabase
    .from('billing_checkout_sessions')
    .insert({
      tenant_id: tenantId,
      plan_id: payload.plan_id,
      billing_cycle: payload.billing_cycle,
      status: 'open',
      paddle_transaction_id: result.data.id,
      checkout_url: result.data.checkout?.url ?? null,
      custom_data: result.data.custom_data ?? {},
      expires_at: result.data.checkout?.expires_at ?? null,
    });

  return {
    mode: 'checkout' as CheckoutMode,
    checkoutUrl: result.data.checkout?.url ?? null,
    transactionId: result.data.id as string,
    message: 'Hosted checkout created',
  };
}

async function updateExistingSubscription(
  subscriptionId: string,
  payload: CheckoutPayload,
  priceId: string,
  currentStatus: string,
) {
  const prorationMode = currentStatus === 'trialing' ? 'do_not_bill' : 'prorated_immediately';

  const response = await fetch(`https://api.paddle.com/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: paddleApiHeaders,
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: {
        plan_id: payload.plan_id,
        billing_cycle: payload.billing_cycle,
      },
      proration_billing_mode: prorationMode,
      on_payment_failure: 'prevent_change',
    }),
  });

  const result = await response.json();
  if (!response.ok || !result?.data?.id) {
    throw new Error(result?.error?.detail || result?.error?.message || 'Failed to update Paddle subscription');
  }

  return {
    mode: 'updated' as CheckoutMode,
    checkoutUrl: null,
    transactionId: null,
    message: 'Subscription updated successfully',
  };
}

Deno.serve(async req => {
  const correlationId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { 'X-Correlation-Id': correlationId });
    }

    const user = await getAuthenticatedUser(req);
    const payload = await req.json() as CheckoutPayload;

    if (!payload.plan_id || !payload.billing_cycle) {
      return json({ error: 'plan_id and billing_cycle are required' }, 400, { 'X-Correlation-Id': correlationId });
    }

    const priceId = getPriceId(payload.plan_id, payload.billing_cycle);
    if (!priceId) {
      return json({ error: 'Missing Paddle price ID for selected plan' }, 400, { 'X-Correlation-Id': correlationId });
    }

    const tenant = await getOrCreateTenant(user, payload);
    const currentSubscription = await getCurrentSubscription(tenant.id);

    if (
      currentSubscription &&
      currentSubscription.plan_id === payload.plan_id &&
      currentSubscription.billing_cycle === payload.billing_cycle &&
      ['trialing', 'active'].includes(currentSubscription.status)
    ) {
      return json({
        mode: 'already_active',
        checkoutUrl: null,
        transactionId: null,
        tenantId: tenant.id,
        message: 'Selected plan is already active for this tenant',
      }, 200, { 'X-Correlation-Id': correlationId });
    }

    const result = currentSubscription?.paddle_subscription_id
      ? await updateExistingSubscription(
        currentSubscription.paddle_subscription_id,
        payload,
        priceId,
        currentSubscription.status,
      )
      : await createCheckoutTransaction(tenant.id, user, payload, priceId);

    console.info(JSON.stringify({
      correlationId,
      event: 'paddle-checkout',
      tenantId: tenant.id,
      planId: payload.plan_id,
      billingCycle: payload.billing_cycle,
      mode: result.mode,
    }));

    return json({
      ...result,
      tenantId: tenant.id,
    }, 200, { 'X-Correlation-Id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout error';

    console.error(JSON.stringify({
      correlationId,
      event: 'paddle-checkout-error',
      error: message,
    }));

    return json({ error: message }, 500, { 'X-Correlation-Id': correlationId });
  }
});
