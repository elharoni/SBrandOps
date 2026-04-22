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
import { useLanguage } from '../../context/LanguageContext';
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

/**
 * Modal shown when the user has hit a hard quota limit (users, brands, etc.).
 * Displays current vs max usage with a progress bar and an upgrade CTA.
 */
interface QuotaLimitModalProps {
    /** e.g. "أعضاء فريق" or "براندات" */
    entityName: string;
    currentCount: number;
    maxCount: number;
    onClose: () => void;
}

export function QuotaLimitModal({ entityName, currentCount, maxCount, onClose }: QuotaLimitModalProps) {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const percent = Math.min(100, Math.round((currentCount / maxCount) * 100));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-light-border bg-light-card shadow-2xl dark:border-dark-border dark:bg-dark-card">
                <div className="flex items-start justify-between gap-4 border-b border-light-border px-6 py-5 dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-error-container/20">
                            <i className="fas fa-ban text-error text-lg" />
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {ar ? 'وصلت للحد الأقصى' : 'Quota reached'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-xl p-2 text-light-text-secondary transition hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text"
                    >
                        <i className="fas fa-times" />
                    </button>
                </div>
                <div className="px-6 py-5 space-y-5">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? `باقتك الحالية تسمح بـ ${maxCount} ${entityName} فقط. قم بالترقية لإضافة المزيد.`
                            : `Your current plan allows up to ${maxCount} ${entityName}. Upgrade to add more.`}
                    </p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                            <span>{ar ? `${currentCount} / ${maxCount} ${entityName}` : `${currentCount} / ${maxCount} ${entityName}`}</span>
                            <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                            <div
                                className="h-full rounded-full bg-error transition-all"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-light-border px-6 py-4 dark:border-dark-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text transition hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg"
                    >
                        {ar ? 'لاحقاً' : 'Later'}
                    </button>
                    <Link
                        to="/app/billing"
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                        onClick={onClose}
                    >
                        <i className="fas fa-arrow-up text-xs" />
                        {ar ? 'ترقية الباقة' : 'Upgrade plan'}
                    </Link>
                </div>
            </div>
        </div>
    );
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
