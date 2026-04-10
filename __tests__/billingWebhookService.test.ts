import { describe, expect, it, vi } from 'vitest';
import * as supa from '../services/supabaseClient';
import { retryBillingWebhook, retryBillingWebhooks } from '../services/billingWebhookService';

vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe('billingWebhookService', () => {
  it('sends retry payload to paddle-webhook-retry', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: { ok: true, message: 'Webhook retried successfully' },
      error: null,
    });

    const result = await retryBillingWebhook('event_123', 'Manual retry after config fix');

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-webhook-retry', {
      body: {
        billing_event_id: 'event_123',
        reason: 'Manual retry after config fix',
      },
    });

    expect(result.ok).toBe(true);
  });

  it('sends bulk retry payload to paddle-webhook-retry', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: { ok: true, processed: 2, succeeded: 2, failed: 0 },
      error: null,
    });

    const result = await retryBillingWebhooks({
      retryFailed: true,
      limit: 10,
      reason: 'Replay failed events after endpoint fix',
    });

    expect((supa as any).supabase.functions.invoke).toHaveBeenCalledWith('paddle-webhook-retry', {
      body: {
        retry_failed: true,
        limit: 10,
        reason: 'Replay failed events after endpoint fix',
      },
    });

    expect(result.processed).toBe(2);
  });
});
