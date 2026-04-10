/**
 * hooks/usePlanLimits.ts
 *
 * Provides plan-aware limit checks for the current user.
 *
 * Data source priority:
 *   1. user.user_metadata.plan_id  (set by Paddle webhook after payment)
 *   2. Fallback: 'starter'
 *
 * Usage:
 *   const { canAddBrand, canAddUser, planId, limits } = usePlanLimits(brandCount);
 *   if (!canAddBrand) { show <PaywallGate /> }
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { PRICING_PLANS, type BillingPlanId } from '../config/pricingPlans';

export interface PlanLimits {
    maxBrands: number | null;   // null = unlimited (enterprise)
    maxUsers: number | null;
    aiTokensMonthly: number | null;
}

interface UsePlanLimitsResult {
    planId: BillingPlanId;
    planName: string;
    limits: PlanLimits;
    /** True if the user can add another brand given their current count */
    canAddBrand: (currentBrandCount: number) => boolean;
    /** True if the user can add another team member given their current count */
    canAddUser: (currentUserCount: number) => boolean;
    /** Percentage of brand quota used (0-100), null if unlimited */
    brandUsagePercent: (currentBrandCount: number) => number | null;
    /** True while plan data is being resolved */
    isLoading: boolean;
}

const FALLBACK_PLAN_ID: BillingPlanId = 'starter';

function getPlanLimits(planId: BillingPlanId): PlanLimits {
    const plan = PRICING_PLANS.find(p => p.id === planId);
    return {
        maxBrands: plan?.maxBrands ?? 1,
        maxUsers: plan?.maxUsers ?? 2,
        aiTokensMonthly: plan?.aiTokensMonthly ?? 1_000_000,
    };
}

export function usePlanLimits(): UsePlanLimitsResult {
    const [planId, setPlanId] = useState<BillingPlanId>(FALLBACK_PLAN_ID);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function resolvePlan() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (cancelled) return;

                const metaPlanId = user?.user_metadata?.plan_id as BillingPlanId | undefined;
                const validIds = PRICING_PLANS.map(p => p.id) as BillingPlanId[];

                if (metaPlanId && validIds.includes(metaPlanId)) {
                    setPlanId(metaPlanId);
                } else {
                    // Fallback: try fetching from tenants table (admin can read it)
                    // For regular users this will return empty — gracefully fall back
                    const { data: tenant } = await supabase
                        .from('tenants')
                        .select('plan_id')
                        .maybeSingle();

                    if (cancelled) return;

                    const tenantPlanId = tenant?.plan_id as BillingPlanId | undefined;
                    if (tenantPlanId && validIds.includes(tenantPlanId)) {
                        setPlanId(tenantPlanId);
                    }
                    // else: keep FALLBACK_PLAN_ID — most restrictive, safe default
                }
            } catch (err) {
                console.warn('[usePlanLimits] Could not resolve plan, using fallback:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        resolvePlan();
        return () => { cancelled = true; };
    }, []);

    const limits = getPlanLimits(planId);
    const plan = PRICING_PLANS.find(p => p.id === planId);

    return {
        planId,
        planName: plan?.name ?? 'Starter',
        limits,
        isLoading,

        canAddBrand: (currentCount: number) => {
            if (limits.maxBrands === null) return true; // unlimited
            return currentCount < limits.maxBrands;
        },

        canAddUser: (currentCount: number) => {
            if (limits.maxUsers === null) return true; // unlimited
            return currentCount < limits.maxUsers;
        },

        brandUsagePercent: (currentCount: number) => {
            if (limits.maxBrands === null) return null;
            return Math.min(100, Math.round((currentCount / limits.maxBrands) * 100));
        },
    };
}
