import { supabase } from './supabaseClient';
import { BillingCycle } from '../types';

export interface BillingCheckoutRequest {
    planId: string;
    billingCycle: BillingCycle;
    brandId?: string;
    brandName?: string;
}

export interface BillingCheckoutResponse {
    mode: 'checkout' | 'updated' | 'already_active';
    checkoutUrl: string | null;
    transactionId: string | null;
    tenantId: string;
    message: string;
}

export async function startBillingCheckout(request: BillingCheckoutRequest): Promise<BillingCheckoutResponse> {
    const { data, error } = await supabase.functions.invoke('paddle-checkout', {
        body: {
            plan_id: request.planId,
            billing_cycle: request.billingCycle,
            brand_id: request.brandId,
            brand_name: request.brandName,
            return_url: window.location.href,
        },
    });

    if (error) {
        throw new Error((error as any).message || 'Failed to start billing checkout');
    }

    return data as BillingCheckoutResponse;
}

export async function openBillingCheckout(request: BillingCheckoutRequest): Promise<BillingCheckoutResponse> {
    const result = await startBillingCheckout(request);

    if (result.mode === 'checkout' && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
    }

    return result;
}
