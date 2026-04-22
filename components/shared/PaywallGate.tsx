/**
 * components/shared/PaywallGate.tsx
 *
 * Wraps any feature that requires a specific plan.
 * If the user's current plan doesn't include the feature, renders an upgrade prompt.
 *
 * Usage:
 *   <PaywallGate requiredPlan="growth" currentPlan={planId} featureName="Ads Analytics">
 *     <AdsOpsPage />
 *   </PaywallGate>
 *
 *   Or with the guard variant (renders nothing if not allowed):
 *   <PaywallGate requiredPlan="agency" currentPlan={planId} silent>
 *     <TeamRolesSection />
 *   </PaywallGate>
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { BillingPlanId, PRICING_PLANS } from '../../config/pricingPlans';

const PLAN_ORDER: BillingPlanId[] = ['starter', 'growth', 'agency', 'enterprise'];

function planRank(planId: BillingPlanId): number {
    return PLAN_ORDER.indexOf(planId);
}

function meetsRequirement(currentPlan: BillingPlanId, requiredPlan: BillingPlanId): boolean {
    return planRank(currentPlan) >= planRank(requiredPlan);
}

interface PaywallGateProps {
    /** The minimum plan required to access this feature */
    requiredPlan: BillingPlanId;
    /** The user's current plan ID */
    currentPlan: BillingPlanId;
    /** Human-readable feature name shown in the upgrade prompt */
    featureName?: string;
    /** If true, renders nothing when access is denied (no upgrade banner) */
    silent?: boolean;
    children: React.ReactNode;
}

export function PaywallGate({
    requiredPlan,
    currentPlan,
    featureName,
    silent = false,
    children,
}: PaywallGateProps) {
    if (meetsRequirement(currentPlan, requiredPlan)) {
        return <>{children}</>;
    }

    if (silent) return null;

    const requiredPlanDef = PRICING_PLANS.find(p => p.id === requiredPlan);

    return (
        <div className="flex flex-col items-center justify-center min-h-[280px] p-8 rounded-xl bg-surface-high border border-outline-variant/20 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">lock</span>
            </div>
            <div>
                <p className="text-on-surface font-semibold text-lg">
                    {featureName ? `${featureName} غير متاح في باقتك` : 'هذه الميزة تحتاج ترقية'}
                </p>
                <p className="text-on-surface-variant text-sm mt-1">
                    تتوفر هذه الميزة في باقة{' '}
                    <span className="text-primary font-medium">{requiredPlanDef?.name ?? requiredPlan}</span>
                    {' '}وما فوق
                </p>
            </div>
            <Link
                to="/app/billing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary text-sm font-medium hover:opacity-90 transition-opacity"
            >
                <span className="material-symbols-outlined text-base">upgrade</span>
                ترقية الباقة
            </Link>
        </div>
    );
}

/**
 * Inline quota warning badge — shown when usage approaches the limit.
 * Renders nothing if below 80% usage.
 */
interface QuotaWarningProps {
    currentCount: number;
    maxCount: number | null;
    entityName: string; // e.g. "براند" or "مستخدم"
}

export function QuotaWarning({ currentCount, maxCount, entityName }: QuotaWarningProps) {
    if (maxCount === null) return null; // unlimited plan
    const percent = Math.round((currentCount / maxCount) * 100);
    if (percent < 80) return null;

    const isAtLimit = currentCount >= maxCount;

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            isAtLimit
                ? 'bg-error-container/20 text-error'
                : 'bg-warning/10 text-warning'
        }`}>
            <span className="material-symbols-outlined text-base">
                {isAtLimit ? 'block' : 'warning'}
            </span>
            <span>
                {isAtLimit
                    ? `وصلت للحد الأقصى (${maxCount} ${entityName}). `
                    : `${currentCount} من ${maxCount} ${entityName} مستخدم. `}
                <Link to="/app/billing" className="underline font-medium">
                    ترقية الباقة
                </Link>
            </span>
        </div>
    );
}
