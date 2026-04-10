// services/tenantService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { Tenant, SubscriptionPlanAdmin } from '../types';
import { PRICING_PLANS, getPricingPlan } from '../config/pricingPlans';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToTenant(row: any): Tenant {
    return {
        id: row.id,
        name: row.name,
        status: row.status || 'inactive',
        plan: row.plan_id || 'starter',
        usersCount: row.users_count || 0,
        brandsCount: row.brands_count || 0,
        aiTokenUsage: row.ai_tokens_used || 0,
        aiTokenLimit: row.subscription_plans?.ai_tokens_monthly || 1_000_000,
    };
}

function mapRowToPlan(row: any): SubscriptionPlanAdmin {
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
        userLimit: row.max_users,
        brandLimit: row.max_brands,
        aiTokenLimit: row.ai_tokens_monthly,
        features: Array.isArray(row.features) ? row.features : fallbackPlan?.features || [],
        paddleMonthlyPriceId: row.paddle_price_id_monthly,
        paddleYearlyPriceId: row.paddle_price_id_yearly,
    };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getTenants(): Promise<Tenant[]> {
    const { data, error } = await supabase
        .from('tenants')
        .select('*, subscription_plans(ai_tokens_monthly)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('getTenants error:', error);
        return [];
    }
    return (data || []).map(mapRowToTenant);
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlanAdmin[]> {
    const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false });

    if (error || !data?.length) {
        console.error('getSubscriptionPlans error:', error);
        return PRICING_PLANS
            .filter(plan => plan.monthlyPrice !== null)
            .map(plan => ({
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
    return (data || []).map(mapRowToPlan);
}

// ── Tenant CRUD ───────────────────────────────────────────────────────────────

export async function updateTenantStatus(
    tenantId: string,
    status: 'active' | 'suspended' | 'cancelled'
): Promise<void> {
    const { error } = await supabase
        .from('tenants')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', tenantId);

    if (error) throw new Error(error.message);
}

export async function updateTenantPlan(tenantId: string, planId: string): Promise<void> {
    const { error } = await supabase
        .from('tenants')
        .update({ plan_id: planId, updated_at: new Date().toISOString() })
        .eq('id', tenantId);

    if (error) throw new Error(error.message);
}
