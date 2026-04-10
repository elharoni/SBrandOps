import { supabase } from './supabaseClient';
import { BillingCycle, PaymentRecord, SubscriptionPlan } from '../types';

export type BillingManagementAction = 'overview' | 'portal' | 'pause' | 'cancel' | 'resume' | 'change_billing_cycle';

export type BillingManagementRequest =
    ({
        brandId: string;
        tenantId?: never;
    } | {
        brandId?: never;
        tenantId: string;
    }) & {
        action: BillingManagementAction;
        billingCycle?: BillingCycle;
        reason?: string;
    };

export interface BillingManagementResponse {
    action: BillingManagementAction;
    message: string;
    portalUrl: string | null;
    updatePaymentMethodUrl: string | null;
    subscription: SubscriptionPlan;
    paymentHistory: PaymentRecord[];
}

function normalizeResponse(data: BillingManagementResponse): BillingManagementResponse {
    return {
        ...data,
        subscription: {
            ...data.subscription,
            nextBillingDate: new Date(data.subscription.nextBillingDate),
            trialEndsAt: data.subscription.trialEndsAt ? new Date(data.subscription.trialEndsAt) : null,
        },
        paymentHistory: data.paymentHistory.map(record => ({
            ...record,
            date: new Date(record.date),
        })),
    };
}

export async function manageBillingSubscription(
    request: BillingManagementRequest,
): Promise<BillingManagementResponse> {
    if (!request.brandId && !request.tenantId) {
        throw new Error('brandId or tenantId is required');
    }

    const body: Record<string, unknown> = {
        action: request.action,
        return_url: window.location.href,
    };

    if (request.brandId) {
        body.brand_id = request.brandId;
    }

    if (request.tenantId) {
        body.tenant_id = request.tenantId;
    }

    if (request.billingCycle) {
        body.billing_cycle = request.billingCycle;
    }

    if (request.reason) {
        body.reason = request.reason;
    }

    const { data, error } = await supabase.functions.invoke('paddle-billing-manage', {
        body,
    });

    if (error) {
        throw new Error((error as { message?: string })?.message || 'Failed to manage subscription');
    }

    return normalizeResponse(data as BillingManagementResponse);
}

export async function getBillingOverview(brandId: string): Promise<Pick<BillingManagementResponse, 'subscription' | 'paymentHistory'>> {
    const result = await manageBillingSubscription({
        brandId,
        action: 'overview',
    });

    return {
        subscription: result.subscription,
        paymentHistory: result.paymentHistory,
    };
}
