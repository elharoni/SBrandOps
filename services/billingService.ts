import { supabase } from './supabaseClient';
import {
    AdminBillingAuditLog,
    AdminBillingEvent,
    AdminBillingInvoice,
    AdminBillingOverview,
    AdminBillingSubscription,
    SubscriptionPlanAdmin,
} from '../types';
import { PRICING_PLANS, getPricingPlan } from '../config/pricingPlans';

export interface BillingPaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface AdminBillingEventQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'received' | 'processed' | 'failed';
}

export interface AdminBillingSubscriptionQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'inactive';
}

export interface AdminBillingInvoiceQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'draft' | 'open' | 'paid' | 'past_due' | 'failed' | 'refunded';
}

export interface AdminBillingAuditQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    action?: 'all' | string;
}

export interface AdminBillingSnapshotQuery {
    subscription?: AdminBillingSubscriptionQuery;
    invoice?: AdminBillingInvoiceQuery;
    webhook?: AdminBillingEventQuery;
    audit?: AdminBillingAuditQuery;
}

export interface AdminBillingSnapshot {
    overview: AdminBillingOverview;
    plans: SubscriptionPlanAdmin[];
    subscriptions: AdminBillingSubscription[];
    invoices: AdminBillingInvoice[];
    webhookEvents: AdminBillingEvent[];
    auditLogs: AdminBillingAuditLog[];
    subscriptionsPagination: BillingPaginationMeta;
    invoicesPagination: BillingPaginationMeta;
    webhookPagination: BillingPaginationMeta;
    auditPagination: BillingPaginationMeta;
}

const EMPTY_OVERVIEW: AdminBillingOverview = {
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    pastDueSubscriptions: 0,
    scheduledPauses: 0,
    scheduledCancellations: 0,
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
    openInvoices: 0,
    failedWebhooks: 0,
    retriedWebhooks: 0,
    queuedWebhookRetries: 0,
};

const DEFAULT_WEBHOOK_PAGE_SIZE = 10;
const DEFAULT_AUDIT_PAGE_SIZE = 10;
const DEFAULT_SUBSCRIPTION_PAGE_SIZE = 10;
const DEFAULT_INVOICE_PAGE_SIZE = 10;

function normalizePage(value?: number) {
    return Math.max(1, Number(value || 1));
}

function normalizePageSize(value: number | undefined, fallback: number) {
    return Math.min(50, Math.max(1, Number(value || fallback)));
}

function buildPaginationMeta(page: number, pageSize: number, total: number): BillingPaginationMeta {
    return {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
}

function sanitizeSearchTerm(value?: string) {
    return (value || '').trim().replace(/[,%()]/g, ' ');
}

function fallbackPlans(): SubscriptionPlanAdmin[] {
    return PRICING_PLANS.filter(plan => plan.monthlyPrice !== null).map(plan => ({
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        badge: plan.badge,
        highlighted: plan.highlighted,
        currency: plan.currency,
        monthlyPrice: plan.monthlyPrice ?? 0,
        yearlyPrice: plan.yearlyPrice ?? 0,
        trialDays: plan.trialDays,
        userLimit: plan.maxUsers ?? 0,
        brandLimit: plan.maxBrands ?? 0,
        aiTokenLimit: plan.aiTokensMonthly ?? 0,
        features: plan.features,
        paddleMonthlyPriceId: null,
        paddleYearlyPriceId: null,
    }));
}

function normalizePlans(rows: any[] | null | undefined): SubscriptionPlanAdmin[] {
    if (!rows?.length) {
        return fallbackPlans();
    }

    return rows.map(row => {
        const fallbackPlan = getPricingPlan(row.id);
        return {
            id: row.id,
            name: row.name,
            tagline: row.tagline || fallbackPlan?.tagline,
            description: row.description || fallbackPlan?.description,
            badge: row.badge || fallbackPlan?.badge,
            highlighted: row.highlighted ?? fallbackPlan?.highlighted ?? false,
            currency: row.currency || fallbackPlan?.currency || 'USD',
            monthlyPrice: Number(row.price_monthly ?? fallbackPlan?.monthlyPrice ?? 0),
            yearlyPrice: Number(row.price_yearly ?? fallbackPlan?.yearlyPrice ?? 0),
            trialDays: Number(row.trial_days ?? fallbackPlan?.trialDays ?? 14),
            userLimit: row.max_users ?? fallbackPlan?.maxUsers ?? 0,
            brandLimit: row.max_brands ?? fallbackPlan?.maxBrands ?? 0,
            aiTokenLimit: row.ai_tokens_monthly ?? fallbackPlan?.aiTokensMonthly ?? 0,
            features: Array.isArray(row.features) ? row.features : fallbackPlan?.features || [],
            paddleMonthlyPriceId: row.paddle_price_id_monthly ?? null,
            paddleYearlyPriceId: row.paddle_price_id_yearly ?? null,
        };
    });
}

function normalizeSubscriptions(rows: any[] | null | undefined): AdminBillingSubscription[] {
    return (rows || []).map(row => {
        const fallbackPlan = getPricingPlan(row.plan_id);
        const scheduledChangeAction =
            row.metadata?.paddle_scheduled_change?.action === 'pause'
                ? 'pause'
                : row.metadata?.paddle_scheduled_change?.action === 'cancel'
                    ? 'cancel'
                    : row.cancel_at_period_end
                        ? 'cancel'
                        : null;

        return {
            id: row.id,
            tenantId: row.tenant_id,
            tenantName: row.tenants?.name || 'Unknown tenant',
            planId: row.plan_id,
            planName: row.subscription_plans?.name || fallbackPlan?.name || row.plan_id,
            status: row.status || 'inactive',
            billingCycle: row.billing_cycle || 'monthly',
            amount: Number(row.amount || 0),
            currency: row.currency || 'USD',
            customerEmail: row.customer_email || '—',
            paddleSubscriptionId: row.paddle_subscription_id || '—',
            nextBilledAt: row.next_billed_at || null,
            trialEndsAt: row.trial_ends_at || null,
            cancelAtPeriodEnd: scheduledChangeAction === 'cancel',
            scheduledChangeAction,
            pauseReason: row.metadata?.pause_reason || null,
        };
    });
}

function normalizeInvoices(rows: any[] | null | undefined): AdminBillingInvoice[] {
    return (rows || []).map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        tenantName: row.tenants?.name || 'Unknown tenant',
        subscriptionId: row.subscription_id || null,
        amount: Number(row.amount || 0),
        currency: row.currency || 'USD',
        status: row.status || 'draft',
        invoiceNumber: row.invoice_number || null,
        invoiceUrl: row.invoice_url || null,
        billedAt: row.billed_at || row.created_at || null,
        paidAt: row.paid_at || null,
    }));
}

function normalizeEvents(rows: any[] | null | undefined): AdminBillingEvent[] {
    return (rows || []).map(row => ({
        id: row.id,
        eventType: row.event_type,
        source: row.source || 'paddle',
        tenantId: row.tenant_id || null,
        tenantName: row.tenants?.name || '—',
        processingStatus: row.processing_status || 'received',
        occurredAt: row.occurred_at || row.created_at,
        processedAt: row.processed_at || null,
        errorMessage: row.error_message || null,
        retryCount: Number(row.retry_count || 0),
        lastRetryAt: row.last_retry_at || null,
        lastRetryReason: row.last_retry_reason || null,
        nextRetryAt: row.next_retry_at || null,
    }));
}

function normalizeAuditLogs(rows: any[] | null | undefined): AdminBillingAuditLog[] {
    return (rows || []).map(row => ({
        id: row.id,
        tenantId: row.tenant_id || null,
        tenantName: row.tenants?.name || '—',
        subscriptionId: row.subscription_id || null,
        action: row.action,
        actorUserId: row.actor_user_id || null,
        actorScope: row.actor_scope || 'system',
        reason: row.reason || null,
        metadata: row.metadata || {},
        createdAt: row.created_at,
    }));
}

function buildOverview(
    subscriptions: AdminBillingSubscription[],
    counts: {
        openInvoices: number;
        failedWebhooks: number;
        retriedWebhooks: number;
        queuedWebhookRetries: number;
    },
): AdminBillingOverview {
    const activeSubscriptions = subscriptions.filter(item => item.status === 'active').length;
    const trialSubscriptions = subscriptions.filter(item => item.status === 'trialing').length;
    const pastDueSubscriptions = subscriptions.filter(item => item.status === 'past_due').length;
    const scheduledPauses = subscriptions.filter(item => item.scheduledChangeAction === 'pause').length;
    const scheduledCancellations = subscriptions.filter(item => item.scheduledChangeAction === 'cancel').length;
    const monthlyRecurringRevenue = subscriptions
        .filter(item => item.status === 'active' || item.status === 'trialing' || item.status === 'past_due')
        .reduce((sum, item) => sum + (item.billingCycle === 'yearly' ? item.amount / 12 : item.amount), 0);
    const annualRecurringRevenue = monthlyRecurringRevenue * 12;

    return {
        activeSubscriptions,
        trialSubscriptions,
        pastDueSubscriptions,
        scheduledPauses,
        scheduledCancellations,
        monthlyRecurringRevenue,
        annualRecurringRevenue,
        openInvoices: counts.openInvoices,
        failedWebhooks: counts.failedWebhooks,
        retriedWebhooks: counts.retriedWebhooks,
        queuedWebhookRetries: counts.queuedWebhookRetries,
    };
}

export async function getAdminBillingSnapshot(query: AdminBillingSnapshotQuery = {}): Promise<AdminBillingSnapshot> {
    const subscriptionPage = normalizePage(query.subscription?.page);
    const subscriptionPageSize = normalizePageSize(query.subscription?.pageSize, DEFAULT_SUBSCRIPTION_PAGE_SIZE);
    const invoicePage = normalizePage(query.invoice?.page);
    const invoicePageSize = normalizePageSize(query.invoice?.pageSize, DEFAULT_INVOICE_PAGE_SIZE);
    const webhookPage = normalizePage(query.webhook?.page);
    const webhookPageSize = normalizePageSize(query.webhook?.pageSize, DEFAULT_WEBHOOK_PAGE_SIZE);
    const auditPage = normalizePage(query.audit?.page);
    const auditPageSize = normalizePageSize(query.audit?.pageSize, DEFAULT_AUDIT_PAGE_SIZE);
    const subscriptionSearch = sanitizeSearchTerm(query.subscription?.search);
    const invoiceSearch = sanitizeSearchTerm(query.invoice?.search);
    const webhookSearch = sanitizeSearchTerm(query.webhook?.search);
    const auditSearch = sanitizeSearchTerm(query.audit?.search);

    const subscriptionQuery = supabase
        .from('billing_subscriptions')
        .select('id, tenant_id, plan_id, status, billing_cycle, amount, currency, customer_email, paddle_subscription_id, next_billed_at, trial_ends_at, cancel_at_period_end, metadata, tenants(name), subscription_plans(name)', { count: 'exact' })
        .eq('is_current', true)
        .order('updated_at', { ascending: false });

    if (query.subscription?.status && query.subscription.status !== 'all') {
        subscriptionQuery.eq('status', query.subscription.status);
    }

    if (subscriptionSearch) {
        subscriptionQuery.or(`customer_email.ilike.*${subscriptionSearch}*,plan_id.ilike.*${subscriptionSearch}*,paddle_subscription_id.ilike.*${subscriptionSearch}*`);
    }

    const invoiceQuery = supabase
        .from('billing_invoices')
        .select('id, tenant_id, subscription_id, amount, currency, status, invoice_number, invoice_url, billed_at, paid_at, created_at, tenants(name)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (query.invoice?.status && query.invoice.status !== 'all') {
        invoiceQuery.eq('status', query.invoice.status);
    }

    if (invoiceSearch) {
        invoiceQuery.or(`invoice_number.ilike.*${invoiceSearch}*,status.ilike.*${invoiceSearch}*,currency.ilike.*${invoiceSearch}*`);
    }

    const webhookQuery = supabase
        .from('billing_events')
        .select('id, event_type, source, tenant_id, processing_status, occurred_at, processed_at, error_message, retry_count, last_retry_at, last_retry_reason, next_retry_at, created_at, tenants(name)', { count: 'exact' })
        .order('occurred_at', { ascending: false });

    if (query.webhook?.status && query.webhook.status !== 'all') {
        webhookQuery.eq('processing_status', query.webhook.status);
    }

    if (webhookSearch) {
        webhookQuery.or(`event_type.ilike.*${webhookSearch}*,error_message.ilike.*${webhookSearch}*,last_retry_reason.ilike.*${webhookSearch}*`);
    }

    const auditQuery = supabase
        .from('billing_audit_logs')
        .select('id, tenant_id, subscription_id, action, actor_user_id, actor_scope, reason, metadata, created_at, tenants(name)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (query.audit?.action && query.audit.action !== 'all') {
        auditQuery.eq('action', query.audit.action);
    }

    if (auditSearch) {
        auditQuery.or(`action.ilike.*${auditSearch}*,reason.ilike.*${auditSearch}*`);
    }

    const [plansRes, overviewSubscriptionsRes, subscriptionsRes, invoicesRes, eventsRes, auditRes, openInvoicesCountRes, failedWebhooksCountRes, retriedWebhooksCountRes, queuedWebhooksCountRes] = await Promise.allSettled([
        supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
            .from('billing_subscriptions')
            .select('plan_id, status, billing_cycle, amount, cancel_at_period_end, metadata')
            .eq('is_current', true)
            .order('updated_at', { ascending: false }),
        subscriptionQuery.range((subscriptionPage - 1) * subscriptionPageSize, subscriptionPage * subscriptionPageSize - 1),
        invoiceQuery.range((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize - 1),
        webhookQuery.range((webhookPage - 1) * webhookPageSize, webhookPage * webhookPageSize - 1),
        auditQuery.range((auditPage - 1) * auditPageSize, auditPage * auditPageSize - 1),
        supabase.from('billing_invoices').select('*', { count: 'exact', head: true }).in('status', ['open', 'past_due']),
        supabase.from('billing_events').select('*', { count: 'exact', head: true }).eq('processing_status', 'failed'),
        supabase.from('billing_events').select('*', { count: 'exact', head: true }).gt('retry_count', 0),
        supabase.from('billing_events').select('*', { count: 'exact', head: true }).eq('processing_status', 'failed').not('next_retry_at', 'is', null),
    ]);

    const plans = plansRes.status === 'fulfilled' && !plansRes.value.error
        ? normalizePlans(plansRes.value.data)
        : fallbackPlans();

    const subscriptions = subscriptionsRes.status === 'fulfilled' && !subscriptionsRes.value.error
        ? normalizeSubscriptions(subscriptionsRes.value.data)
        : [];

    const overviewSubscriptions = overviewSubscriptionsRes.status === 'fulfilled' && !overviewSubscriptionsRes.value.error
        ? normalizeSubscriptions(overviewSubscriptionsRes.value.data)
        : [];

    const invoices = invoicesRes.status === 'fulfilled' && !invoicesRes.value.error
        ? normalizeInvoices(invoicesRes.value.data)
        : [];

    const webhookEvents = eventsRes.status === 'fulfilled' && !eventsRes.value.error
        ? normalizeEvents(eventsRes.value.data)
        : [];

    const auditLogs = auditRes.status === 'fulfilled' && !auditRes.value.error
        ? normalizeAuditLogs(auditRes.value.data)
        : [];

    const openInvoices = openInvoicesCountRes.status === 'fulfilled' && !openInvoicesCountRes.value.error
        ? Number(openInvoicesCountRes.value.count || 0)
        : 0;

    const failedWebhooks = failedWebhooksCountRes.status === 'fulfilled' && !failedWebhooksCountRes.value.error
        ? Number(failedWebhooksCountRes.value.count || 0)
        : 0;

    const retriedWebhooks = retriedWebhooksCountRes.status === 'fulfilled' && !retriedWebhooksCountRes.value.error
        ? Number(retriedWebhooksCountRes.value.count || 0)
        : 0;

    const queuedWebhookRetries = queuedWebhooksCountRes.status === 'fulfilled' && !queuedWebhooksCountRes.value.error
        ? Number(queuedWebhooksCountRes.value.count || 0)
        : 0;

    const subscriptionTotal = subscriptionsRes.status === 'fulfilled' && !subscriptionsRes.value.error
        ? Number(subscriptionsRes.value.count || 0)
        : 0;

    const invoiceTotal = invoicesRes.status === 'fulfilled' && !invoicesRes.value.error
        ? Number(invoicesRes.value.count || 0)
        : 0;

    const webhookTotal = eventsRes.status === 'fulfilled' && !eventsRes.value.error
        ? Number(eventsRes.value.count || 0)
        : 0;

    const auditTotal = auditRes.status === 'fulfilled' && !auditRes.value.error
        ? Number(auditRes.value.count || 0)
        : 0;

    return {
        overview: overviewSubscriptions.length || invoices.length || webhookEvents.length
            ? buildOverview(overviewSubscriptions, {
                openInvoices,
                failedWebhooks,
                retriedWebhooks,
                queuedWebhookRetries,
            })
            : EMPTY_OVERVIEW,
        plans,
        subscriptions,
        invoices,
        webhookEvents,
        auditLogs,
        subscriptionsPagination: buildPaginationMeta(subscriptionPage, subscriptionPageSize, subscriptionTotal),
        invoicesPagination: buildPaginationMeta(invoicePage, invoicePageSize, invoiceTotal),
        webhookPagination: buildPaginationMeta(webhookPage, webhookPageSize, webhookTotal),
        auditPagination: buildPaginationMeta(auditPage, auditPageSize, auditTotal),
    };
}
