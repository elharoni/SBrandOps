/**
 * components/pages/UserBillingPage.tsx
 *
 * User-facing subscription management page.
 * Shows current plan, usage metrics, and upgrade options.
 */

import React from 'react';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { PRICING_PLANS } from '../../config/pricingPlans';
import { useLanguage } from '../../context/LanguageContext';
import { PageScaffold, PageSection } from '../shared/PageScaffold';

interface UserBillingPageProps {
    brandCount: number;
    userCount: number;
}

function UsageBar({ used, max, label }: { used: number; max: number | null; label: string }) {
    const pct = max === null ? 0 : Math.min(100, Math.round((used / max) * 100));
    const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-primary';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-light-text dark:text-dark-text">{label}</span>
                <span className="text-light-text-secondary dark:text-dark-text-secondary">
                    {used} / {max === null ? '∞' : max}
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                {max !== null && (
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                    />
                )}
            </div>
        </div>
    );
}

export const UserBillingPage: React.FC<UserBillingPageProps> = ({ brandCount, userCount }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const { planId, planName, limits, isLoading } = usePlanLimits();

    const currentPlan = PRICING_PLANS.find(p => p.id === planId);
    const upgradePlans = PRICING_PLANS.filter(p => {
        const order = ['starter', 'growth', 'agency', 'enterprise'];
        return order.indexOf(p.id) > order.indexOf(planId);
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <PageScaffold
            kicker={ar ? 'الإدارة والإعدادات' : 'Settings'}
            title={ar ? 'الباقة والاشتراك' : 'Plan & Billing'}
            description={ar ? 'باقتك الحالية، استخدامك، وخيارات الترقية.' : 'Your current plan, usage, and upgrade options.'}
        >
            {/* Current plan card */}
            <PageSection>
                <div className="surface-panel rounded-[1.75rem] p-6 md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                                <i className="fas fa-check-circle" />
                                {ar ? 'الباقة الحالية' : 'Current plan'}
                            </span>
                            <h2 className="mt-3 text-3xl font-black text-light-text dark:text-dark-text">
                                {planName}
                            </h2>
                            {currentPlan && (
                                <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    {currentPlan.tagline}
                                </p>
                            )}
                            {currentPlan?.monthlyPrice && (
                                <p className="mt-3 text-2xl font-bold text-light-text dark:text-dark-text">
                                    ${currentPlan.monthlyPrice}
                                    <span className="text-sm font-normal text-light-text-secondary dark:text-dark-text-secondary">
                                        /{ar ? 'شهر' : 'mo'}
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 md:items-end">
                            <a
                                href="/pricing"
                                className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-primary-glow hover:opacity-90 transition-opacity"
                            >
                                <i className="fas fa-arrow-up text-xs" />
                                {ar ? 'ترقية الباقة' : 'Upgrade plan'}
                            </a>
                            <button className="inline-flex items-center gap-2 rounded-2xl border border-light-border px-5 py-2.5 text-sm font-medium text-light-text-secondary hover:text-light-text transition-colors dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                                <i className="fas fa-external-link-alt text-xs" />
                                {ar ? 'إدارة الاشتراك' : 'Manage subscription'}
                            </button>
                        </div>
                    </div>

                    {currentPlan && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {currentPlan.features.map(f => (
                                <span key={f} className="inline-flex items-center gap-1.5 rounded-xl bg-light-bg px-3 py-1.5 text-xs text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                    <i className="fas fa-check text-[10px] text-emerald-500" />
                                    {f}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </PageSection>

            {/* Usage */}
            <PageSection title={ar ? 'استخدامك الحالي' : 'Current usage'}>
                <div className="surface-panel rounded-[1.75rem] p-6 space-y-5">
                    <UsageBar
                        used={brandCount}
                        max={limits.maxBrands}
                        label={ar ? 'البراندات' : 'Brands'}
                    />
                    <UsageBar
                        used={userCount}
                        max={limits.maxUsers}
                        label={ar ? 'أعضاء الفريق' : 'Team members'}
                    />
                    <UsageBar
                        used={0}
                        max={limits.aiTokensMonthly}
                        label={ar ? 'رصيد الذكاء الاصطناعي (شهري)' : 'AI credits (monthly)'}
                    />
                </div>
            </PageSection>

            {/* Upgrade options */}
            {upgradePlans.length > 0 && (
                <PageSection title={ar ? 'باقات أعلى' : 'Higher plans'}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {upgradePlans.map(plan => (
                            <div
                                key={plan.id}
                                className={`surface-panel rounded-[1.75rem] p-5 flex flex-col gap-4 ${plan.highlighted ? 'ring-2 ring-brand-primary' : ''}`}
                            >
                                {plan.badge && (
                                    <span className="self-start rounded-full bg-brand-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
                                        {plan.badge}
                                    </span>
                                )}
                                <div>
                                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{plan.name}</h3>
                                    <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">{plan.tagline}</p>
                                </div>
                                {plan.monthlyPrice !== null ? (
                                    <p className="text-2xl font-black text-light-text dark:text-dark-text">
                                        ${plan.monthlyPrice}
                                        <span className="text-sm font-normal text-light-text-secondary dark:text-dark-text-secondary">/{ar ? 'شهر' : 'mo'}</span>
                                    </p>
                                ) : (
                                    <p className="text-lg font-bold text-brand-primary">{ar ? 'تواصل معنا' : 'Contact us'}</p>
                                )}
                                <ul className="flex-1 space-y-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {plan.features.slice(0, 4).map(f => (
                                        <li key={f} className="flex items-start gap-1.5">
                                            <i className="fas fa-check text-emerald-500 mt-0.5 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href="/pricing"
                                    className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-brand-primary/10 px-4 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary hover:text-white transition-colors"
                                >
                                    {plan.ctaLabel}
                                </a>
                            </div>
                        ))}
                    </div>
                </PageSection>
            )}
        </PageScaffold>
    );
};
