import { describe, expect, it, vi } from 'vitest';
import * as supa from '../services/supabaseClient';
import { getBillingOverview, manageBillingSubscription } from '../services/billingManagementService';

vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe('billingManagementService', () => {
  it('sends overview payload to paddle-billing-manage', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        action: 'overview',
        message: 'Billing overview loaded',
        portalUrl: null,
        updatePaymentMethodUrl: null,
        subscription: {
          name: 'Growth',
          price: 99,
          currency: 'USD',
          nextBillingDate: new Date().toISOString(),
          billingCycle: 'monthly',
          limits: { users: 10, brands: 5, aiTokens: 5000000 },
          usage: { users: 3, brands: 2, aiTokens: 1000 },
        },
        paymentHistory: [],
      },
      error: null,
    });

    const result = await getBillingOverview('brand_123');

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-billing-manage', {
      body: {
        action: 'overview',
        brand_id: 'brand_123',
        return_url: window.location.href,
      },
    });

    expect(result.subscription.name).toBe('Growth');
  });

  it('sends billing cycle changes to paddle-billing-manage', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        action: 'change_billing_cycle',
        message: 'Billing cycle updated successfully',
        portalUrl: null,
        updatePaymentMethodUrl: null,
        subscription: {
          name: 'Growth',
          price: 990,
          currency: 'USD',
          nextBillingDate: new Date().toISOString(),
          billingCycle: 'yearly',
          limits: { users: 10, brands: 5, aiTokens: 5000000 },
          usage: { users: 3, brands: 2, aiTokens: 1000 },
        },
        paymentHistory: [],
      },
      error: null,
    });

    const result = await manageBillingSubscription({
      brandId: 'brand_123',
      action: 'change_billing_cycle',
      billingCycle: 'yearly',
    });

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-billing-manage', {
      body: {
        action: 'change_billing_cycle',
        brand_id: 'brand_123',
        billing_cycle: 'yearly',
        return_url: window.location.href,
      },
    });

    expect(result.subscription.billingCycle).toBe('yearly');
  });

  it('sends pause actions to paddle-billing-manage', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        action: 'pause',
        message: 'Subscription will pause at period end',
        portalUrl: null,
        updatePaymentMethodUrl: null,
        subscription: {
          name: 'Growth',
          price: 99,
          currency: 'USD',
          nextBillingDate: new Date().toISOString(),
          billingCycle: 'monthly',
          scheduledChangeAction: 'pause',
          limits: { users: 10, brands: 5, aiTokens: 5000000 },
          usage: { users: 3, brands: 2, aiTokens: 1000 },
        },
        paymentHistory: [],
      },
      error: null,
    });

    await manageBillingSubscription({
      brandId: 'brand_123',
      action: 'pause',
    });

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-billing-manage', {
      body: {
        action: 'pause',
        brand_id: 'brand_123',
        return_url: window.location.href,
      },
    });
  });

  it('supports tenant-scoped admin billing actions', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        action: 'resume',
        message: 'Scheduled cancellation removed',
        portalUrl: null,
        updatePaymentMethodUrl: null,
        subscription: {
          name: 'Agency',
          price: 299,
          currency: 'USD',
          nextBillingDate: new Date().toISOString(),
          billingCycle: 'monthly',
          limits: { users: 50, brands: 20, aiTokens: 20000000 },
          usage: { users: 12, brands: 8, aiTokens: 5000 },
        },
        paymentHistory: [],
      },
      error: null,
    });

    await manageBillingSubscription({
      tenantId: 'tenant_123',
      action: 'resume',
    });

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-billing-manage', {
      body: {
        action: 'resume',
        tenant_id: 'tenant_123',
        return_url: window.location.href,
      },
    });
  });
});
