/**
 * components/pages/UserBillingPage.tsx
 *
 * User-facing subscription management page — Premium Redesign (Lumina Axiom v4).
 * Fully responsive for mobile & desktop, with bilingual RTL/LTR support.
 */

import React, { useEffect, useState, useCallback } from 'react';

import { usePlanLimits } from '../../hooks/usePlanLimits';
import { PRICING_PLANS, PricingPlanDefinition } from '../../config/pricingPlans';
import { useLanguage } from '../../context/LanguageContext';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { supabase } from '../../services/supabaseClient';
import { ReferralWidget } from '../ReferralWidget';
import { openBillingCheckout } from '../../services/billingCheckoutService';
import { manageBillingSubscription } from '../../services/billingManagementService';
import type { PaymentRecord, SubscriptionPlan } from '../../types';
import { useBrandStore } from '../../stores/brandStore';

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useMonthlyAIUsage() {
    const [used, setUsed] = useState(0);
    useEffect(() => {
        const start = new Date();
        start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase
                .from('ai_usage_logs')
                .select('input_tokens, output_tokens')
                .eq('user_id', user.id)
                .gte('created_at', start.toISOString())
                .then(({ data }) => {
                    const total = (data ?? []).reduce(
                        (s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0
                    );
                    setUsed(total);
                });
        });
    }, []);
    return used;
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

interface UsageBarProps {
    used: number;
    max: number | null;
    label: string;
    icon: string;
    color: string;
    formatValue?: (n: number) => string;
}

function UsageBar({ used, max, label, icon, color, formatValue }: UsageBarProps) {
    const pct = max === null ? 3 : Math.min(100, Math.round((used / max) * 100));
    const isWarning = pct >= 70 && pct < 90;
    const isDanger = pct >= 90;
    const barColor = isDanger
        ? 'from-rose-500 to-red-400'
        : isWarning
            ? 'from-amber-500 to-yellow-400'
            : color;
    const ringColor = isDanger ? 'ring-rose-500/20' : isWarning ? 'ring-amber-500/20' : 'ring-brand-primary/15';
    const fmt = formatValue ?? ((n: number) => n.toLocaleString());

    return (
        <div className={`group relative rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 overflow-hidden transition-all duration-300 hover:ring-2 hover:shadow-md ${ringColor}`}>
            {/* Decorative background glow */}
            <div className={`absolute -top-6 -end-6 w-20 h-20 rounded-full bg-gradient-to-br ${barColor} opacity-[0.06] blur-xl pointer-events-none`} />

            <div className="relative flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${barColor} flex items-center justify-center shadow-sm`}>
                        <i className={`fas ${icon} text-white text-[11px]`} />
                    </div>
                    <span className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{label}</span>
                </div>
                <div className="flex-shrink-0 text-end">
                    <span className="text-base font-black text-light-text dark:text-dark-text">{fmt(used)}</span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary"> / {max === null ? '∞' : fmt(max)}</span>
                </div>
            </div>

            <div className="relative h-2 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
                    style={{ width: `${Math.max(pct, max === null ? 3 : 0)}%` }}
                />
            </div>

            <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                    {max === null ? '∞ غير محدود' : `${pct}%`}
                </span>
                {isDanger && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                        <i className="fas fa-exclamation-triangle text-[8px]" />
                        قريب من الحد الأقصى
                    </span>
                )}
                {isWarning && !isDanger && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <i className="fas fa-exclamation-circle text-[8px]" />
                        {max === null ? '' : `${max - used} متبقي`}
                    </span>
                )}
            </div>
        </div>
    );
}

interface BillingCycleToggleProps {
    cycle: 'monthly' | 'yearly';
    onChange: (c: 'monthly' | 'yearly') => void;
    ar: boolean;
}

function BillingCycleToggle({ cycle, onChange, ar }: BillingCycleToggleProps) {
    return (
        <div className="inline-flex items-center gap-3 rounded-2xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border p-1.5 shadow-sm">
            <button
                id="cycle-monthly"
                onClick={() => onChange('monthly')}
                className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-250 ${
                    cycle === 'monthly'
                        ? 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                }`}
            >
                {ar ? 'شهري' : 'Monthly'}
            </button>
            <button
                id="cycle-yearly"
                onClick={() => onChange('yearly')}
                className={`relative rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-250 ${
                    cycle === 'yearly'
                        ? 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                }`}
            >
                {ar ? 'سنوي' : 'Yearly'}
                <span className="absolute -top-2 -end-1 inline-flex rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black text-white leading-none">
                    -17%
                </span>
            </button>
        </div>
    );
}

const PLAN_ICON_MAP: Record<string, { icon: string; from: string; to: string }> = {
    starter:    { icon: 'fa-rocket',      from: 'from-blue-500',   to: 'to-indigo-500' },
    growth:     { icon: 'fa-chart-line',  from: 'from-violet-500', to: 'to-purple-600' },
    agency:     { icon: 'fa-briefcase',   from: 'from-rose-500',   to: 'to-pink-600'   },
    enterprise: { icon: 'fa-building',    from: 'from-amber-500',  to: 'to-orange-600' },
};

interface PlanCardProps {
    plan: PricingPlanDefinition;
    isCurrentPlan: boolean;
    cycle: 'monthly' | 'yearly';
    ar: boolean;
    onUpgrade: (plan: PricingPlanDefinition) => void;
    isLoading: boolean;
}

function PlanCard({ plan, isCurrentPlan, cycle, ar, onUpgrade, isLoading }: PlanCardProps) {
    const price = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const monthlyEq = cycle === 'yearly' && plan.yearlyPrice !== null
        ? Math.round(plan.yearlyPrice / 12) : null;
    const meta = PLAN_ICON_MAP[plan.id] ?? PLAN_ICON_MAP.starter;

    return (
        <div
            className={`relative flex flex-col rounded-[1.5rem] border overflow-hidden transition-all duration-300 group ${
                isCurrentPlan
                    ? 'border-brand-primary ring-2 ring-brand-primary/25'
                    : plan.highlighted
                        ? 'border-violet-500/30 hover:ring-2 hover:ring-violet-500/20 hover:-translate-y-1'
                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/30 hover:-translate-y-1'
            } bg-white dark:bg-dark-card shadow-sm hover:shadow-md`}
        >
            {/* Top gradient strip */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${meta.from} ${meta.to}`} />

            {/* Body */}
            <div className="flex flex-col gap-4 p-5 flex-1">
                {/* Icon + Name row */}
                <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br ${meta.from} ${meta.to} flex items-center justify-center shadow-md`}>
                        <i className={`fas ${meta.icon} text-white text-sm`} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-bold text-light-text dark:text-dark-text">{plan.name}</h3>
                            {isCurrentPlan && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/12 border border-brand-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-brand-primary">
                                    <i className="fas fa-check text-[7px]" />
                                    {ar ? 'نشط' : 'Active'}
                                </span>
                            )}
                            {!isCurrentPlan && plan.badge && (
                                <span className={`inline-flex rounded-full bg-gradient-to-r ${meta.from} ${meta.to} px-2 py-0.5 text-[9px] font-bold text-white`}>
                                    {plan.badge}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 line-clamp-1">{plan.tagline}</p>
                    </div>
                </div>

                {/* Price */}
                <div className="border-t border-light-border dark:border-dark-border pt-3">
                    {price !== null ? (
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-light-text dark:text-dark-text">${price}</span>
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    /{ar ? (cycle === 'yearly' ? 'سنة' : 'شهر') : (cycle === 'yearly' ? 'yr' : 'mo')}
                                </span>
                            </div>
                            {monthlyEq && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                    ≈ ${monthlyEq}/{ar ? 'شهر' : 'mo'} &nbsp;
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal">{ar ? 'عند الدفع سنوياً' : 'billed yearly'}</span>
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className={`text-base font-bold bg-gradient-to-r ${meta.from} ${meta.to} bg-clip-text text-transparent`}>
                            {ar ? 'تواصل معنا' : 'Contact sales'}
                        </p>
                    )}
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-1.5">
                    {plan.features.slice(0, 5).map(f => (
                        <li key={f} className="flex items-start gap-2">
                            <i className="fas fa-check text-emerald-500 mt-0.5 flex-shrink-0 text-[9px] pt-0.5" />
                            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{f}</span>
                        </li>
                    ))}
                </ul>

                {/* CTA */}
                <button
                    id={`plan-cta-${plan.id}`}
                    onClick={() => !isCurrentPlan && onUpgrade(plan)}
                    disabled={isCurrentPlan || isLoading}
                    className={`mt-auto flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        isCurrentPlan
                            ? 'cursor-default bg-brand-primary/8 text-brand-primary border border-brand-primary/20'
                            : plan.highlighted
                                ? `bg-gradient-to-r ${meta.from} ${meta.to} text-white shadow-md hover:opacity-90 hover:shadow-lg`
                                : `border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-gradient-to-r hover:${meta.from} hover:${meta.to} hover:text-white hover:border-transparent`
                    }`}
                >
                    {isLoading ? (
                        <i className="fas fa-circle-notch fa-spin text-xs" />
                    ) : isCurrentPlan ? (
                        <>{ar ? 'باقتك الحالية' : 'Current plan'}</>
                    ) : (
                        <>
                            <i className="fas fa-arrow-up text-xs" />
                            {plan.ctaLabel}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

interface PaymentHistoryTableProps {
    records: PaymentRecord[];
    ar: boolean;
}

function PaymentHistoryTable({ records, ar }: PaymentHistoryTableProps) {
    if (records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="relative mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center">
                        <i className="fas fa-receipt text-brand-primary text-xl" />
                    </div>
                    <div className="absolute -inset-2 rounded-3xl bg-brand-primary/5 blur-md" />
                </div>
                <p className="text-sm font-bold text-light-text dark:text-dark-text mb-1">
                    {ar ? 'لا توجد فواتير حتى الآن' : 'No invoices yet'}
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs">
                    {ar ? 'ستظهر فواتيرك هنا تلقائياً بعد إتمام أول دفعة.' : 'Your invoices will appear here after your first payment.'}
                </p>
            </div>
        );
    }

    const statusConfig: Record<string, { label: string; labelAr: string; cls: string; icon: string }> = {
        Paid:     { label: 'Paid',     labelAr: 'مدفوع',   cls: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: 'fa-check-circle' },
        Failed:   { label: 'Failed',   labelAr: 'فشل',     cls: 'bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/20',             icon: 'fa-times-circle' },
        Open:     { label: 'Open',     labelAr: 'مفتوح',   cls: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/20',          icon: 'fa-clock'       },
        Refunded: { label: 'Refunded', labelAr: 'مُسترجع', cls: 'bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/20',                  icon: 'fa-undo'        },
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
                <thead>
                    <tr className="border-b border-light-border dark:border-dark-border">
                        {[
                            { labelAr: 'التاريخ',      labelEn: 'Date'    },
                            { labelAr: 'رقم الفاتورة', labelEn: 'Invoice' },
                            { labelAr: 'المبلغ',       labelEn: 'Amount'  },
                            { labelAr: 'الحالة',       labelEn: 'Status'  },
                            { labelAr: '',             labelEn: ''        },
                        ].map((col, i) => (
                            <th key={i} className="pb-3 pt-1 text-start text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? col.labelAr : col.labelEn}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/40">
                    {records.map(record => {
                        const cfg = statusConfig[record.status] ?? statusConfig.Open;
                        return (
                            <tr key={record.id} className="group transition-colors hover:bg-brand-primary/4">
                                <td className="py-3.5 pe-4 text-light-text dark:text-dark-text font-medium text-sm whitespace-nowrap">
                                    {new Date(record.date).toLocaleDateString(ar ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="py-3.5 pe-4 text-light-text-secondary dark:text-dark-text-secondary font-mono text-xs">
                                    {record.invoiceNumber ?? record.id.slice(0, 12)}
                                </td>
                                <td className="py-3.5 pe-4 font-bold text-light-text dark:text-dark-text">
                                    ${record.amount.toFixed(2)}
                                    <span className="text-[10px] font-normal text-light-text-secondary dark:text-dark-text-secondary ms-1">{record.currency ?? 'USD'}</span>
                                </td>
                                <td className="py-3.5 pe-4">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${cfg.cls}`}>
                                        <i className={`fas ${cfg.icon} text-[8px]`} />
                                        {ar ? cfg.labelAr : cfg.label}
                                    </span>
                                </td>
                                <td className="py-3.5">
                                    {record.invoiceUrl && (
                                        <a
                                            href={record.invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            id={`download-invoice-${record.id}`}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-light-border dark:border-dark-border px-3 py-1.5 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary dark:hover:text-brand-primary transition-all"
                                        >
                                            <i className="fas fa-download text-[9px]" />
                                            PDF
                                        </a>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface UserBillingPageProps {
    brandCount: number;
    userCount: number;
    brandId?: string;
}

export const UserBillingPage: React.FC<UserBillingPageProps> = ({ brandCount, userCount, brandId }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const { planId, planName, limits, isLoading: planLoading } = usePlanLimits();
    const aiTokensUsed = useMonthlyAIUsage();
    const { activeBrand } = useBrandStore();
    const resolvedBrandId = brandId ?? activeBrand?.id;

    const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [subscription, setSubscription] = useState<SubscriptionPlan | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
    const [billingLoading, setBillingLoading] = useState(false);

    const currentPlan = PRICING_PLANS.find(p => p.id === planId);
    const meta = PLAN_ICON_MAP[planId] ?? PLAN_ICON_MAP.starter;

    const loadBillingOverview = useCallback(async () => {
        if (!resolvedBrandId) return;
        setBillingLoading(true);
        try {
            const result = await manageBillingSubscription({ brandId: resolvedBrandId, action: 'overview' });
            setSubscription(result.subscription);
            setPaymentHistory(result.paymentHistory);
        } catch { /* non-critical */ }
        finally { setBillingLoading(false); }
    }, [resolvedBrandId]);

    useEffect(() => { loadBillingOverview(); }, [loadBillingOverview]);

    const handleUpgrade = async (plan: PricingPlanDefinition) => {
        if (!resolvedBrandId) return;
        setUpgradeLoading(plan.id);
        try {
            await openBillingCheckout({ planId: plan.id, billingCycle: cycle, brandId: resolvedBrandId, brandName: activeBrand?.name });
        } catch (e) { console.error(e); }
        finally { setUpgradeLoading(null); }
    };

    const handlePortal = async () => {
        if (!resolvedBrandId) return;
        setPortalLoading(true);
        try {
            const r = await manageBillingSubscription({ brandId: resolvedBrandId, action: 'portal' });
            if (r.portalUrl) window.open(r.portalUrl, '_blank', 'noopener');
        } catch (e) { console.error(e); }
        finally { setPortalLoading(false); }
    };

    if (planLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary animate-pulse">
                    {ar ? 'جارٍ تحميل بيانات الاشتراك…' : 'Loading subscription data…'}
                </p>
            </div>
        );
    }

    return (
        <PageScaffold
            kicker={ar ? 'الإدارة والإعدادات' : 'Settings'}
            title={ar ? 'الباقة والاشتراك' : 'Plan & Billing'}
            description={ar ? 'باقتك الحالية، استخدامك، وخيارات الترقية.' : 'Your current plan, usage, and upgrade options.'}
        >

            {/* ── Hero Plan Card ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[1.75rem] animate-fade-in-up">
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.from} ${meta.to} opacity-10 dark:opacity-20`} />
                <div className="absolute inset-0 backdrop-blur-[1px] bg-white/60 dark:bg-dark-card/60" />
                <div className={`absolute inset-0 border border-light-border dark:border-dark-border rounded-[1.75rem]`} />

                {/* Decorative orb */}
                <div className={`absolute -top-12 -start-12 w-48 h-48 rounded-full bg-gradient-to-br ${meta.from} ${meta.to} opacity-10 blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-8 -end-8 w-32 h-32 rounded-full bg-gradient-to-br ${meta.to} ${meta.from} opacity-10 blur-2xl pointer-events-none`} />

                <div className="relative p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                        {/* Left: plan details */}
                        <div className="flex-1 min-w-0">
                            {/* Tags row */}
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-[11px] font-bold text-brand-primary">
                                    <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse" />
                                    {ar ? 'الباقة النشطة' : 'Active plan'}
                                </span>
                                {subscription?.status === 'trialing' && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                        <i className="fas fa-hourglass-half text-[9px]" />
                                        {ar ? 'تجربة مجانية' : 'Free trial'}
                                    </span>
                                )}
                            </div>

                            {/* Plan icon + name */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.from} ${meta.to} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                    <i className={`fas ${meta.icon} text-white text-lg`} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-light-text dark:text-dark-text">{planName}</h2>
                                    {currentPlan && (
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{currentPlan.tagline}</p>
                                    )}
                                </div>
                            </div>

                            {/* Price + renewal */}
                            {currentPlan?.monthlyPrice !== null && currentPlan?.monthlyPrice !== undefined && (
                                <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                                    <span className="text-3xl font-black text-light-text dark:text-dark-text">${currentPlan.monthlyPrice}</span>
                                    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">/ {ar ? 'شهر' : 'mo'}</span>
                                    {subscription?.nextBillingDate && (
                                        <span className="ms-2 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border px-2.5 py-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                            <i className="fas fa-calendar-alt me-1 text-[9px]" />
                                            {ar ? 'التجديد ' : 'Renews '}
                                            {new Date(subscription.nextBillingDate).toLocaleDateString(ar ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Feature chips */}
                            {currentPlan && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {currentPlan.features.map(f => (
                                        <span key={f} className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 dark:bg-dark-bg/80 border border-light-border dark:border-dark-border px-3 py-1.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary backdrop-blur-sm">
                                            <i className="fas fa-check text-[9px] text-emerald-500" />
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex flex-row flex-wrap lg:flex-col gap-2 lg:items-stretch lg:min-w-[180px]">
                            <button
                                id="btn-manage-subscription"
                                onClick={handlePortal}
                                disabled={portalLoading}
                                className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${meta.from} ${meta.to} px-5 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 active:scale-[0.97]`}
                            >
                                {portalLoading
                                    ? <i className="fas fa-circle-notch fa-spin text-xs" />
                                    : <i className="fas fa-credit-card text-xs" />
                                }
                                {ar ? 'إدارة الاشتراك' : 'Manage subscription'}
                            </button>
                            <button
                                id="btn-refresh-billing"
                                onClick={loadBillingOverview}
                                disabled={billingLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-light-border dark:border-dark-border bg-white/60 dark:bg-dark-bg/60 px-5 py-3 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/40 hover:text-brand-primary dark:hover:text-brand-primary transition-all backdrop-blur-sm"
                            >
                                <i className={`fas fa-sync text-xs ${billingLoading ? 'fa-spin' : ''}`} />
                                {ar ? 'تحديث البيانات' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Usage Metrics ──────────────────────────────────────────────── */}
            <PageSection
                title={ar ? 'استخدامك الحالي' : 'Current usage'}
                description={ar ? 'تتبّع استهلاكك مقابل حصة الباقة الشهرية.' : 'Track your consumption against your monthly plan quota.'}
            >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <UsageBar
                        used={brandCount} max={limits.maxBrands}
                        label={ar ? 'البراندات' : 'Brands'}
                        icon="fa-layer-group" color="from-blue-500 to-indigo-500"
                    />
                    <UsageBar
                        used={userCount} max={limits.maxUsers}
                        label={ar ? 'أعضاء الفريق' : 'Team members'}
                        icon="fa-users" color="from-violet-500 to-purple-600"
                    />
                    <UsageBar
                        used={aiTokensUsed} max={limits.aiTokensMonthly}
                        label={ar ? 'رصيد الذكاء الاصطناعي' : 'AI credits'}
                        icon="fa-brain" color="from-emerald-500 to-teal-500"
                        formatValue={n => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n)}
                    />
                </div>
            </PageSection>

            {/* ── All Plans ─────────────────────────────────────────────────── */}
            <PageSection
                title={ar ? 'جميع الباقات' : 'All plans'}
                description={ar ? 'قارن الباقات واختر ما يناسب نمو علامتك التجارية.' : "Compare plans and choose what fits your brand's growth."}
            >
                {/* Billing toggle */}
                <div className="flex justify-center mb-6">
                    <BillingCycleToggle cycle={cycle} onChange={setCycle} ar={ar} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {PRICING_PLANS.map(plan => (
                        <PlanCard
                            key={plan.id} plan={plan}
                            isCurrentPlan={plan.id === planId}
                            cycle={cycle} ar={ar}
                            onUpgrade={handleUpgrade}
                            isLoading={upgradeLoading === plan.id}
                        />
                    ))}
                </div>

                {cycle === 'monthly' && (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-3.5">
                        <i className="fas fa-lightbulb text-emerald-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
                            {ar
                                ? 'اشترك بالباقة السنوية ووفّر ما يعادل شهرين مجاناً — بدّل الإعداد أعلاه لرؤية الأسعار السنوية.'
                                : 'Switch to yearly billing and get 2 months free — toggle above to see annual pricing.'}
                        </p>
                    </div>
                )}
            </PageSection>

            {/* ── Payment History ────────────────────────────────────────────── */}
            <PageSection
                title={ar ? 'سجل الفواتير' : 'Billing history'}
                description={ar ? 'فواتيرك ومدفوعاتك السابقة.' : 'Your past invoices and payments.'}
            >
                {billingLoading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-circle-notch fa-spin text-brand-primary" />
                        <span className="text-sm">{ar ? 'جارٍ تحميل الفواتير…' : 'Loading invoices…'}</span>
                    </div>
                ) : (
                    <PaymentHistoryTable records={paymentHistory} ar={ar} />
                )}
            </PageSection>

            {/* ── Referral Program ───────────────────────────────────────────── */}
            <PageSection
                title={ar ? 'برنامج الإحالة' : 'Referral Program'}
                description={ar ? 'ادعُ أصدقاءك واكسب أشهراً مجانية مع كل اشتراك.' : 'Invite friends and earn free months for every subscription.'}
            >
                <ReferralWidget />
            </PageSection>
        </PageScaffold>
    );
};
