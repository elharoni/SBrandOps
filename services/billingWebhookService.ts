import { supabase } from './supabaseClient';

export async function retryBillingWebhook(billingEventId: string, reason?: string) {
    const body: Record<string, unknown> = { billing_event_id: billingEventId };

    if (reason) {
        body.reason = reason;
    }

    const { data, error } = await supabase.functions.invoke('paddle-webhook-retry', {
        body,
    });

    if (error) {
        throw new Error((error as { message?: string })?.message || 'Failed to retry webhook');
    }

    return data as { ok?: boolean; message?: string };
}

export async function retryBillingWebhooks(options: {
    billingEventIds?: string[];
    retryFailed?: boolean;
    reason?: string;
    limit?: number;
}) {
    const body: Record<string, unknown> = {};

    if (options.billingEventIds?.length) {
        body.billing_event_ids = options.billingEventIds;
    }

    if (options.retryFailed) {
        body.retry_failed = true;
    }

    if (typeof options.limit === 'number') {
        body.limit = options.limit;
    }

    if (options.reason) {
        body.reason = options.reason;
    }

    const { data, error } = await supabase.functions.invoke('paddle-webhook-retry', {
        body,
    });

    if (error) {
        throw new Error((error as { message?: string })?.message || 'Failed to retry webhook batch');
    }

    return data as {
        ok?: boolean;
        message?: string;
        processed?: number;
        succeeded?: number;
        failed?: number;
        exhausted?: number;
        results?: Array<{
            billing_event_id: string;
            ok: boolean;
            retry_count: number;
            next_retry_at?: string | null;
            error?: string | null;
        }>;
    };
}
