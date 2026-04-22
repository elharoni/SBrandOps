// services/tenantService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { Tenant, SubscriptionPlanAdmin } from '../types';
import { PRICING_PLANS, getPricingPlan } from '../config/pricingPlans';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToTenant(row: any): Tenant {
    const planBrandLimit = row.subscription_plans?.max_brands ?? null;
    const planUserLimit  = row.subscription_plans?.max_users  ?? null;
    const planAiLimit    = row.subscription_plans?.ai_tokens_monthly ?? 1_000_000;

    return {
        id: row.id,
        name: row.name,
        billingEmail: row.billing_email || '',
        status: row.status || 'inactive',
        plan: row.plan_id || 'starter',
        planName: row.subscription_plans?.name || row.plan_id || 'starter',
        usersCount: row.users_count || 0,
        brandsCount: row.brands_count || 0,
        aiTokenUsage: row.ai_tokens_used || 0,
        // Plan defaults
        aiTokenLimit: row.override_ai_tokens ?? planAiLimit,
        userLimit: planUserLimit,
        brandLimit: planBrandLimit,
        // Per-tenant overrides
        customBrandLimit: row.override_brand_limit ?? null,
        customUserLimit: row.override_user_limit ?? null,
        customAiTokenLimit: row.override_ai_tokens ?? null,
        createdAt: row.created_at,
        trialEndsAt: row.trial_ends_at ?? null,
        notes: row.notes ?? null,
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
        .select('*, subscription_plans(name, ai_tokens_monthly, max_users, max_brands)')
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

export async function createTenant(
    name: string,
    billingEmail: string,
    planId: string
): Promise<Tenant> {
    const { data, error } = await supabase
        .from('tenants')
        .insert({
            name,
            billing_email: billingEmail,
            plan_id: planId,
            status: 'trial',
            ai_tokens_used: 0,
            brands_count: 0,
            users_count: 0,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select('*, subscription_plans(name, ai_tokens_monthly, max_users, max_brands)')
        .single();

    if (error) throw new Error(error.message);
    return mapRowToTenant(data);
}

export async function deleteTenant(tenantId: string): Promise<void> {
    const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

    if (error) throw new Error(error.message);
}

// ── Brand-level accounts (actual user workspaces) ─────────────────────────────

export interface BrandAccount {
    id: string;
    name: string;
    ownerEmail: string;
    membersCount: number;
    createdAt: string;
    status: 'active' | 'inactive';
}

export interface BrandMember {
    id: string;
    name: string;
    email: string;
    role: string;
    joinedAt: string;
    isOwner: boolean;
}

export async function getBrandsForAdmin(): Promise<BrandAccount[]> {
    const { data, error } = await supabase
        .from('brands')
        .select(`
            id,
            name,
            created_at,
            user_id,
            team_members(count)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('[tenantService] getBrandsForAdmin error:', error.message);
        return [];
    }

    // Get owner emails from auth.users via a separate query on team_members (Owner role)
    return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || 'Unknown',
        ownerEmail: '',
        membersCount: Array.isArray(row.team_members) ? row.team_members.length : (row.team_members?.[0]?.count ?? 0),
        createdAt: row.created_at,
        status: 'active' as const,
    }));
}

export async function getBrandMembers(brandId: string): Promise<BrandMember[]> {
    const { data, error } = await supabase
        .from('team_members')
        .select('id, name, invited_email, role, invited_at, user_id')
        .eq('brand_id', brandId)
        .order('invited_at', { ascending: true });

    if (error) {
        console.warn('[tenantService] getBrandMembers error:', error.message);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || row.invited_email?.split('@')[0] || 'Unknown',
        email: row.invited_email || '',
        role: row.role || 'Member',
        joinedAt: row.invited_at,
        isOwner: row.role === 'Owner',
    }));
}

export async function removeBrandMember(memberId: string): Promise<void> {
    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

    if (error) throw new Error(error.message);
}

export async function updateBrandMemberRole(memberId: string, role: string): Promise<void> {
    const { error } = await supabase
        .from('team_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', memberId);

    if (error) throw new Error(error.message);
}

export async function updateSubscriptionPlan(
    planId: string,
    updates: Partial<{
        name: string;
        tagline: string;
        description: string;
        badge: string;
        highlighted: boolean;
        price_monthly: number;
        price_yearly: number;
        trial_days: number;
        max_brands: number;
        max_users: number;
        ai_tokens_monthly: number;
        features: string[];
        is_active: boolean;
    }>
): Promise<void> {
    const payload: Record<string, any> = { ...updates };

    const { error } = await supabase
        .from('subscription_plans')
        .update(payload)
        .eq('id', planId);

    if (error) throw new Error(error.message);
}

export async function resetTenantAIUsage(tenantId: string): Promise<void> {
    const { error } = await supabase
        .from('tenants')
        .update({ ai_tokens_used: 0, updated_at: new Date().toISOString() })
        .eq('id', tenantId);

    if (error) throw new Error(error.message);
}

export async function updateTenantDetails(
    tenantId: string,
    updates: {
        name?: string;
        billingEmail?: string;
        trialEndsAt?: string | null;
        notes?: string | null;
        customBrandLimit?: number | null;
        customUserLimit?: number | null;
        customAiTokenLimit?: number | null;
    }
): Promise<void> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name              !== undefined) payload.name                 = updates.name;
    if (updates.billingEmail      !== undefined) payload.billing_email        = updates.billingEmail;
    if (updates.trialEndsAt       !== undefined) payload.trial_ends_at        = updates.trialEndsAt;
    if (updates.notes             !== undefined) payload.notes                = updates.notes;
    if (updates.customBrandLimit  !== undefined) payload.override_brand_limit = updates.customBrandLimit;
    if (updates.customUserLimit   !== undefined) payload.override_user_limit  = updates.customUserLimit;
    if (updates.customAiTokenLimit !== undefined) payload.override_ai_tokens  = updates.customAiTokenLimit;

    const { error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', tenantId);

    if (error) throw new Error(error.message);
}
