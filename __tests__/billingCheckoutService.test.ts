import { describe, expect, it, vi } from 'vitest';
import * as supa from '../services/supabaseClient';
import { startBillingCheckout } from '../services/billingCheckoutService';

vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe('billingCheckoutService.startBillingCheckout', () => {
  it('sends the expected payload to paddle-checkout', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        mode: 'checkout',
        checkoutUrl: 'https://checkout.paddle.test',
        transactionId: 'txn_123',
        tenantId: 'tenant_123',
        message: 'Hosted checkout created',
      },
      error: null,
    });

    const result = await startBillingCheckout({
      planId: 'growth',
      billingCycle: 'yearly',
      brandId: 'brand_1',
      brandName: 'Acme',
    });

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-checkout', {
      body: {
        plan_id: 'growth',
        billing_cycle: 'yearly',
        brand_id: 'brand_1',
        brand_name: 'Acme',
        return_url: window.location.href,
      },
    });

    expect(result.mode).toBe('checkout');
    expect(result.checkoutUrl).toBe('https://checkout.paddle.test');
  });
});
