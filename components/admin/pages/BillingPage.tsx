import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminBillingAuditLog,
    AdminBillingEvent,
    AdminBillingInvoice,
    AdminBillingOverview,
    AdminBillingSubscription,
    BillingCycle,
    NotificationType,
    SubscriptionPlanAdmin,
} from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import { startBillingCheckout } from '../../../services/billingCheckoutService';
import { manageBillingSubscription } from '../../../services/billingManagementService';
import { retryBillingWebhook, retryBillingWebhooks } from '../../../services/billingWebhookService';
import { BillingPaginationMeta, getAdminBillingSnapshot } from '../../../services/billingService';
import { updateSubscriptionPlan } from '../../../services/tenantService';
import { useLanguage } from '../../../context/LanguageContext';

interface BillingPageProps {
    plans: SubscriptionPlanAdmin[];
    overview: AdminBillingOverview | null;
    subscriptions: AdminBillingSubscription[];
    invoices: AdminBillingInvoice[];
    webhookEvents: AdminBillingEvent[];
    auditLogs: AdminBillingAuditLog[];
    isLoading: boolean;
    onRefreshBilling: () => Promise<void>;
    addNotification: (type: NotificationType, message: string) => void;
}

const formatMoney = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);

const formatDate = (value?: string | null) =>
    value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '—';

const OVERVIEW_CARD_STYLES = [
    'from-brand-primary/15 to-brand-primary/5',
    'from-emerald-500/15 to-emerald-500/5',
    'from-amber-500/15 to-amber-500/5',
    'from-rose-500/15 to-rose-500/5',
] as const;

const OverviewCard: React.FC<{ label: string; value: string; helper: string; index: number }> = ({ label, value, helper, index }) => (
    <div className={`rounded-[1.75rem] border border-light-border bg-gradient-to-br ${OVERVIEW_CARD_STYLES[index % OVERVIEW_CARD_STYLES.length]} p-5 dark:border-dark-border`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
        <p className="mt-3 text-3xl font-black text-light-text dark:text-dark-text">{value}</p>
        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{helper}</p>
    </div>
);

const BillingStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const styles: Record<string, string> = {
        active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        trialing: 'bg-brand-primary/10 text-brand-primary',
        past_due: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
        paused: 'bg-slate-400/15 text-slate-500 dark:text-slate-300',
        canceled: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
        inactive: 'bg-slate-400/15 text-slate-500 dark:text-slate-300',
        processed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        received: 'bg-brand-primary/10 text-brand-primary',
        failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
        open: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
        paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        refunded: 'bg-slate-400/15 text-slate-500 dark:text-slate-300',
        draft: 'bg-slate-400/15 text-slate-500 dark:text-slate-300',
    };

    const labels: Record<string, string> = {
        active: ar ? 'نشط' : 'Active',
        trialing: ar ? 'تجريبي' : 'Trialing',
        past_due: ar ? 'متأخر' : 'Past due',
        paused: ar ? 'متوقف' : 'Paused',
        canceled: ar ? 'ملغى' : 'Canceled',
        inactive: ar ? 'غير نشط' : 'Inactive',
        processed: ar ? 'تمت المعالجة' : 'Processed',
        received: ar ? 'تم الاستلام' : 'Received',
        failed: ar ? 'فشل' : 'Failed',
        open: ar ? 'مفتوحة' : 'Open',
        paid: ar ? 'مدفوعة' : 'Paid',
        refunded: ar ? 'مستردة' : 'Refunded',
        draft: ar ? 'مسودة' : 'Draft',
    };

    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.inactive}`}>
            {labels[status] || status}
        </span>
    );
};

const BillingPageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
            <div>
                <SkeletonLoader className="h-10 w-56" />
                <SkeletonLoader className="mt-3 h-5 w-96" />
            </div>
            <SkeletonLoader className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(item => <SkeletonLoader key={item} className="h-36 rounded-[1.75rem]" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
            {[1, 2, 3].map(item => <SkeletonLoader key={item} className="h-96 rounded-[1.75rem]" />)}
        </div>
        <SkeletonLoader className="h-96 rounded-[1.75rem]" />
    </div>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="rounded-[1.75rem] border border-dashed border-light-border bg-light-card px-6 py-10 text-center dark:border-dark-border dark:bg-dark-card">
        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{title}</h3>
        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
    </div>
);

const PlanCard: React.FC<{ plan: SubscriptionPlanAdmin; cycle: BillingCycle }> = ({ plan, cycle }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const price = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const isCustomPlan = plan.id === 'enterprise' || (price === 0 && plan.badge === 'Custom');
    const paddleReady = cycle === 'yearly' ? Boolean(plan.paddleYearlyPriceId) : Boolean(plan.paddleMonthlyPriceId);

    return (
        <div className={`rounded-[1.75rem] border p-6 ${plan.highlighted ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10' : 'border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card'}`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">{plan.name}</h3>
                    {plan.tagline && <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{plan.tagline}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                    {plan.badge && <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paddleReady ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'}`}>
                        {paddleReady ? (ar ? 'جاهز للدفع' : 'Paddle ready') : (ar ? 'معرّف السعر مفقود' : 'Price ID missing')}
                    </span>
                </div>
            </div>
            <p className="mt-6 text-4xl font-black text-light-text dark:text-dark-text">
                {isCustomPlan ? (ar ? 'مخصص' : 'Custom') : formatMoney(price, plan.currency)}
                {!isCustomPlan && <span className="ms-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">/{cycle === 'yearly' ? (ar ? 'سنة' : 'year') : (ar ? 'شهر' : 'month')}</span>}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-light-bg px-3 py-3 dark:bg-dark-bg">
                    <p className="text-xs uppercase tracking-[0.14em] text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'البراندات' : 'Brands'}</p>
                    <p className="mt-2 font-semibold text-light-text dark:text-dark-text">{plan.brandLimit}</p>
                </div>
                <div className="rounded-2xl bg-light-bg px-3 py-3 dark:bg-dark-bg">
                    <p className="text-xs uppercase tracking-[0.14em] text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'المستخدمون' : 'Users'}</p>
                    <p className="mt-2 font-semibold text-light-text dark:text-dark-text">{plan.userLimit}</p>
                </div>
                <div className="rounded-2xl bg-light-bg px-3 py-3 dark:bg-dark-bg">
                    <p className="text-xs uppercase tracking-[0.14em] text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'التجربة' : 'Trial'}</p>
                    <p className="mt-2 font-semibold text-light-text dark:text-dark-text">{plan.trialDays}{ar ? ' يوم' : 'd'}</p>
                </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {plan.features.slice(0, 5).map(feature => (
                    <li key={feature} className="flex items-start gap-2">
                        <i className="fas fa-check mt-1 text-xs text-brand-primary" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ── Plan Edit Modal ───────────────────────────────────────────────────────────

interface PlanEditModalProps {
    plan: SubscriptionPlanAdmin;
    onClose: () => void;
    onSave: (planId: string, updated: SubscriptionPlanAdmin) => Promise<void>;
}

const PlanEditModal: React.FC<PlanEditModalProps> = ({ plan, onClose, onSave }) => {
    const [form, setForm] = useState({ ...plan });
    const [featuresText, setFeaturesText] = useState(plan.features.join('\n'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            const updated: SubscriptionPlanAdmin = {
                ...form,
                features: featuresText.split('\n').map(f => f.trim()).filter(Boolean),
            };
            await onSave(plan.id, updated);
            onClose();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1">{label}</label>
            {children}
        </div>
    );

    const inputCls = "w-full px-3 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-light-border dark:border-dark-border flex-shrink-0">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">تعديل خطة: {plan.name}</h2>
                    <button onClick={onClose} className="text-light-text-secondary hover:text-danger transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="اسم الخطة">
                            <input name="name" value={form.name} onChange={handleChange} className={inputCls} />
                        </Field>
                        <Field label="الشعار (Badge)">
                            <input name="badge" value={form.badge || ''} onChange={handleChange} placeholder="مثال: Recommended" className={inputCls} />
                        </Field>
                    </div>

                    <Field label="وصف مختصر (Tagline)">
                        <input name="tagline" value={form.tagline || ''} onChange={handleChange} className={inputCls} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="السعر الشهري ($)">
                            <input name="monthlyPrice" type="number" value={form.monthlyPrice} onChange={handleChange} min={0} className={inputCls} />
                        </Field>
                        <Field label="السعر السنوي ($)">
                            <input name="yearlyPrice" type="number" value={form.yearlyPrice} onChange={handleChange} min={0} className={inputCls} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Field label="عدد البراندات">
                            <input name="brandLimit" type="number" value={form.brandLimit} onChange={handleChange} min={1} className={inputCls} />
                        </Field>
                        <Field label="عدد المستخدمين">
                            <input name="userLimit" type="number" value={form.userLimit} onChange={handleChange} min={1} className={inputCls} />
                        </Field>
                        <Field label="أيام التجربة">
                            <input name="trialDays" type="number" value={form.trialDays} onChange={handleChange} min={0} className={inputCls} />
                        </Field>
                    </div>

                    <Field label="حد رموز AI الشهرية">
                        <input name="aiTokenLimit" type="number" value={form.aiTokenLimit} onChange={handleChange} min={0} className={inputCls} />
                    </Field>

                    <Field label="المميزات (سطر لكل ميزة)">
                        <textarea
                            value={featuresText}
                            onChange={e => setFeaturesText(e.target.value)}
                            rows={5}
                            className={inputCls + ' resize-none'}
                            placeholder="ميزة 1&#10;ميزة 2&#10;ميزة 3"
                        />
                    </Field>

                    <div className="flex items-center gap-3 p-3 bg-light-bg dark:bg-dark-bg rounded-xl">
                        <input
                            type="checkbox"
                            id="highlighted"
                            name="highlighted"
                            checked={form.highlighted || false}
                            onChange={e => setForm(prev => ({ ...prev, highlighted: e.target.checked }))}
                            className="w-4 h-4 rounded text-primary"
                        />
                        <label htmlFor="highlighted" className="text-sm font-semibold text-light-text dark:text-dark-text cursor-pointer">
                            تمييز هذه الخطة (Recommended)
                        </label>
                    </div>

                    {error && <p className="text-sm text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 p-6 border-t border-light-border dark:border-dark-border flex-shrink-0">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors text-sm font-semibold">
                        إلغاء
                    </button>
                    <button onClick={handleSave} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2">
                        {loading && <i className="fas fa-spinner fa-spin" />}
                        {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DataTableShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <section className="rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
        <div className="mb-5">
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h2>
            <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">{subtitle}</p>
        </div>
        {children}
    </section>
);

type BillingPageDataState = {
    overview: AdminBillingOverview | null;
    plans: SubscriptionPlanAdmin[];
    subscriptions: AdminBillingSubscription[];
    invoices: AdminBillingInvoice[];
    webhookEvents: AdminBillingEvent[];
    auditLogs: AdminBillingAuditLog[];
    subscriptionsPagination: BillingPaginationMeta;
    invoicesPagination: BillingPaginationMeta;
    webhookPagination: BillingPaginationMeta;
    auditPagination: BillingPaginationMeta;
};

const createPaginationFallback = (pageSize = 10, total = 0): BillingPaginationMeta => ({
    page: 1,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
});

const getBillingQueryParams = () => {
    if (typeof window === 'undefined') {
        return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
};

const getInitialPage = (key: string) => {
    const value = Number(getBillingQueryParams().get(key) || '1');
    return Number.isFinite(value) && value > 0 ? value : 1;
};

const getInitialString = (key: string) => getBillingQueryParams().get(key) || '';

const PaginationControls: React.FC<{
    pagination: BillingPaginationMeta;
    onPageChange: (page: number) => void;
}> = ({ pagination, onPageChange }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-light-border pt-4 text-sm dark:border-dark-border">
        <div className="text-light-text-secondary dark:text-dark-text-secondary">
            {ar ? `الصفحة ${pagination.page} من ${pagination.totalPages} • ${pagination.total} عنصر` : `Page ${pagination.page} of ${pagination.totalPages} • ${pagination.total} items`}
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text"
            >
                {ar ? 'السابق' : 'Previous'}
            </button>
            <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text"
            >
                {ar ? 'التالي' : 'Next'}
            </button>
        </div>
    </div>
    );
};

function getSubscriptionCapabilities(subscription: AdminBillingSubscription) {
    const hasScheduledPause = subscription.scheduledChangeAction === 'pause' && subscription.status !== 'paused';
    const hasScheduledCancellation = subscription.scheduledChangeAction === 'cancel' || subscription.cancelAtPeriodEnd;
    const canManage = Boolean(subscription.paddleSubscriptionId && subscription.paddleSubscriptionId !== '—');

    return {
        canManage,
        hasScheduledPause,
        hasScheduledCancellation,
        canPause: canManage && ['active', 'trialing', 'past_due'].includes(subscription.status) && !hasScheduledPause && !hasScheduledCancellation,
        canCancel: canManage && ['active', 'trialing', 'past_due'].includes(subscription.status) && !hasScheduledPause && !hasScheduledCancellation,
        canResume: canManage && (subscription.status === 'paused' || hasScheduledPause || hasScheduledCancellation),
        canChangeBillingCycle: canManage && ['active', 'trialing', 'past_due', 'paused'].includes(subscription.status) && !hasScheduledPause,
    };
}

export const BillingPage: React.FC<BillingPageProps> = ({
    plans,
    overview,
    subscriptions,
    invoices,
    webhookEvents,
    auditLogs,
    isLoading,
    onRefreshBilling,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [dataState, setDataState] = useState<BillingPageDataState>({
        overview,
        plans,
        subscriptions,
        invoices,
        webhookEvents,
        auditLogs,
        subscriptionsPagination: createPaginationFallback(10, subscriptions.length),
        invoicesPagination: createPaginationFallback(10, invoices.length),
        webhookPagination: createPaginationFallback(10, webhookEvents.length),
        auditPagination: createPaginationFallback(10, auditLogs.length),
    });
    const [isRemoteLoading, setIsRemoteLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlanAdmin | null>(null);
    const [localPlans, setLocalPlans] = useState<SubscriptionPlanAdmin[]>([]);
    const [pendingRowAction, setPendingRowAction] = useState<string | null>(null);
    const [pendingWebhookId, setPendingWebhookId] = useState<string | null>(null);
    const [pendingBulkRetry, setPendingBulkRetry] = useState(false);

    const [subscriptionSearchInput, setSubscriptionSearchInput] = useState(() => getInitialString('sub_search'));
    const [subscriptionSearch, setSubscriptionSearch] = useState(() => getInitialString('sub_search'));
    const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<'all' | AdminBillingSubscription['status']>(() => (getInitialString('sub_status') as 'all' | AdminBillingSubscription['status']) || 'all');
    const [subscriptionPage, setSubscriptionPage] = useState(() => getInitialPage('sub_page'));

    const [invoiceSearchInput, setInvoiceSearchInput] = useState(() => getInitialString('inv_search'));
    const [invoiceSearch, setInvoiceSearch] = useState(() => getInitialString('inv_search'));
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | AdminBillingInvoice['status']>(() => (getInitialString('inv_status') as 'all' | AdminBillingInvoice['status']) || 'all');
    const [invoicePage, setInvoicePage] = useState(() => getInitialPage('inv_page'));

    const [webhookSearchInput, setWebhookSearchInput] = useState(() => getInitialString('webhook_search'));
    const [webhookSearch, setWebhookSearch] = useState(() => getInitialString('webhook_search'));
    const [webhookStatusFilter, setWebhookStatusFilter] = useState<'all' | 'received' | 'processed' | 'failed'>(() => (getInitialString('webhook_status') as 'all' | 'received' | 'processed' | 'failed') || 'all');
    const [webhookPage, setWebhookPage] = useState(() => getInitialPage('webhook_page'));

    const [auditSearchInput, setAuditSearchInput] = useState(() => getInitialString('audit_search'));
    const [auditSearch, setAuditSearch] = useState(() => getInitialString('audit_search'));
    const [auditActionFilter, setAuditActionFilter] = useState<'all' | string>(() => getInitialString('audit_action') || 'all');
    const [auditPage, setAuditPage] = useState(() => getInitialPage('audit_page'));

    const copy = useMemo(() => ({
        title: ar ? 'الفوترة والاشتراكات' : 'Billing & subscriptions',
        subtitle: ar ? 'أدر الخطط والاشتراكات والفواتير وسجل Webhooks والتدقيق من لوحة إدارية واحدة.' : 'Manage plans, subscriptions, invoices, webhook processing, and audit history from one admin surface.',
        refreshing: ar ? 'جارٍ تحديث البيانات...' : 'Refreshing data...',
        monthly: ar ? 'شهري' : 'Monthly',
        yearly: ar ? 'سنوي' : 'Yearly',
        mrrHelper: (count: number) => ar ? `${count} اشتراك نشط` : `${count} active subscriptions`,
        arrHelper: (trial: number, due: number) => ar ? `${trial} تجريبي • ${due} متأخر` : `${trial} trialing • ${due} past due`,
        invoicesHelper: ar ? 'فواتير مفتوحة أو متأخرة تحتاج متابعة.' : 'Open and past-due invoices requiring follow-up.',
        retriesHelper: (queued: number, retried: number) => ar ? `${queued} في الانتظار • ${retried} أُعيدت محاولته` : `${queued} queued • ${retried} retried`,
        preparingCheckout: ar ? 'جارٍ تجهيز إجراء الفوترة...' : 'Preparing billing action...',
        customSalesFlow: ar ? 'مسار مبيعات مخصص' : 'Custom sales flow',
        startPlan: (plan: string) => ar ? `ابدأ ${plan}` : `Start ${plan}`,
        liveSubscriptions: ar ? 'الاشتراكات الحالية' : 'Live subscriptions',
        liveSubscriptionsSubtitle: ar ? 'الاشتراكات الحالية للـ tenants والمتزامنة من Paddle.' : 'Current tenant subscriptions synchronized from Paddle.',
        invoices: ar ? 'الفواتير' : 'Invoices',
        invoicesSubtitle: ar ? 'آخر الفواتير والمدفوعات المتزامنة من الفوترة.' : 'Recent invoice and payment trail from billing sync.',
        webhookLogs: ar ? 'سجل Webhooks' : 'Webhook logs',
        webhookLogsSubtitle: ar ? 'أحداث Paddle الحديثة ونتيجة معالجتها.' : 'Recent Paddle events and their processing result.',
        auditTrail: ar ? 'سجل التدقيق' : 'Audit trail',
        auditTrailSubtitle: ar ? 'تغييرات الاشتراك وإعادات المحاولة اليدوية من جهة الإدارة.' : 'Admin-side subscription changes and manual retry actions.',
        allStatuses: ar ? 'كل الحالات' : 'All statuses',
        active: ar ? 'نشط' : 'Active',
        trialing: ar ? 'تجريبي' : 'Trialing',
        pastDue: ar ? 'متأخر' : 'Past due',
        paused: ar ? 'متوقف' : 'Paused',
        canceled: ar ? 'ملغى' : 'Canceled',
        inactive: ar ? 'غير نشط' : 'Inactive',
        draft: ar ? 'مسودة' : 'Draft',
        open: ar ? 'مفتوحة' : 'Open',
        paid: ar ? 'مدفوعة' : 'Paid',
        failedOnly: ar ? 'فاشلة فقط' : 'Failed only',
        received: ar ? 'تم الاستلام' : 'Received',
        processed: ar ? 'تمت المعالجة' : 'Processed',
        subscriptionsCount: (pageCount: number, total: number) => ar ? `${pageCount} من ${total} اشتراك` : `${pageCount} / ${total} subscriptions`,
        invoicesCount: (pageCount: number, total: number) => ar ? `${pageCount} من ${total} فاتورة` : `${pageCount} / ${total} invoices`,
        auditCount: (pageCount: number, total: number) => ar ? `${pageCount} من ${total} سجل` : `${pageCount} / ${total} entries`,
        emptySubscriptions: ar ? 'لا توجد اشتراكات بعد' : 'No active subscriptions yet',
        emptySubscriptionsFiltered: ar ? 'لا توجد نتائج مطابقة للفلاتر الحالية' : 'No subscriptions match the current filters',
        emptySubscriptionsDescription: ar ? 'بعد أول Checkout ناجح ومعالجة Webhooks، ستظهر الاشتراكات هنا.' : 'After the first successful Paddle checkout and webhook sync, subscriptions will appear here.',
        emptyFilteredDescription: ar ? 'غيّر البحث أو الفلاتر لعرض مجموعة مختلفة من النتائج.' : 'Adjust the search query or filter to inspect a different subset.',
        tenant: ar ? 'العميل' : 'Tenant',
        plan: ar ? 'الخطة' : 'Plan',
        status: ar ? 'الحالة' : 'Status',
        billing: ar ? 'الفوترة' : 'Billing',
        customer: ar ? 'العميل' : 'Customer',
        nextBill: ar ? 'الفاتورة القادمة' : 'Next bill',
        actions: ar ? 'الإجراءات' : 'Actions',
        trialEnds: (date: string) => ar ? `تنتهي التجربة ${date}` : `Trial ends ${date}`,
        noManagedSubscription: ar ? 'لا يوجد اشتراك مُدار' : 'No managed subscription',
        portal: ar ? 'البوابة' : 'Portal',
        payment: ar ? 'الدفع' : 'Payment',
        pause: ar ? 'إيقاف' : 'Pause',
        cancel: ar ? 'إلغاء' : 'Cancel',
        resume: ar ? 'استئناف' : 'Resume',
        undoPause: ar ? 'إلغاء الإيقاف' : 'Undo pause',
        undoCancel: ar ? 'إلغاء الإلغاء' : 'Undo cancel',
        switchTo: (cycle: BillingCycle) => ar ? `حوّل إلى ${cycle === 'monthly' ? 'شهري' : 'سنوي'}` : `Switch to ${cycle}`,
        cancelAtPeriodEnd: ar ? 'سيُلغى بنهاية الفترة' : 'Cancels at period end',
        pauseAtPeriodEnd: ar ? 'سيتوقف بنهاية الفترة' : 'Pauses at period end',
        reason: ar ? 'السبب' : 'Reason',
        openInvoice: ar ? 'فتح الفاتورة' : 'Open invoice',
        noUrl: ar ? 'لا يوجد رابط' : 'No URL',
        retryingBatch: (count: number) => ar ? `جارٍ إعادة ${count} حدثًا فاشلًا...` : `Retrying failed batch (${count})...`,
        retryBatch: (count: number) => ar ? `إعادة محاولة الفاشلة (${count})` : `Retry failed batch (${count})`,
        retryWebhook: ar ? 'إعادة المحاولة' : 'Retry webhook',
        retrying: ar ? 'جارٍ الإعادة...' : 'Retrying...',
        searchSubscriptions: ar ? 'ابحث بالبريد أو الخطة أو معرّف الاشتراك' : 'Search customer email, plan, or Paddle subscription ID',
        searchInvoices: ar ? 'ابحث برقم الفاتورة أو العملة أو الحالة' : 'Search invoice number, currency, or status',
        searchWebhook: ar ? 'ابحث بنوع الحدث أو الخطأ أو سبب الإعادة' : 'Search event type, error, or retry reason',
        searchAudit: ar ? 'ابحث بالإجراء أو السبب' : 'Search action or reason',
        allActions: ar ? 'كل الإجراءات' : 'All actions',
        noInvoices: ar ? 'لا توجد فواتير بعد' : 'No invoices yet',
        noInvoicesFiltered: ar ? 'لا توجد فواتير مطابقة للفلاتر الحالية' : 'No invoices match the current filters',
        noInvoicesDescription: ar ? 'ستظهر الفواتير هنا بعد معالجة Webhooks الخاصة بعمليات Paddle.' : 'Invoices will appear here after Paddle transaction webhooks are processed successfully.',
        noWebhooks: ar ? 'لا توجد أحداث Webhook بعد' : 'No webhook events yet',
        noWebhooksFiltered: ar ? 'لا توجد أحداث مطابقة للفلاتر الحالية' : 'No webhook events match the current filters',
        noWebhooksDescription: ar ? 'انشر وظيفة Paddle webhook ثم وجّه Paddle إليها حتى تبدأ الأحداث في الظهور هنا.' : 'Publish the Paddle webhook function and point Paddle to it to start capturing billing events here.',
        noAudit: ar ? 'لا يوجد سجل تدقيق بعد' : 'No audit entries yet',
        noAuditFiltered: ar ? 'لا توجد سجلات مطابقة للفلاتر الحالية' : 'No audit entries match the current filters',
        noAuditDescription: ar ? 'إيقاف أو إلغاء أو استئناف أو تغيير الدورة أو إعادة محاولات Webhooks ستسجل هنا.' : 'Pause, cancel, resume, cycle changes, and webhook retries will be logged here.',
        failedBillingLoad: ar ? 'تعذر تحميل بيانات الفوترة' : 'Failed to load billing data',
        failedCheckout: ar ? 'تعذر بدء عملية الفوترة' : 'Failed to start billing checkout',
        failedManage: ar ? 'تعذر تنفيذ إجراء الاشتراك' : 'Failed to manage subscription',
        retryQueued: ar ? 'تمت إضافة إعادة المحاولة إلى الطابور' : 'Webhook retry queued',
        failedRetry: ar ? 'تعذر إعادة محاولة الحدث' : 'Failed to retry webhook',
        failedRetryBatch: ar ? 'تعذر إعادة محاولة الأحداث الفاشلة' : 'Failed to retry failed webhooks',
    }), [ar]);

    useEffect(() => {
        setDataState({
            overview,
            plans,
            subscriptions,
            invoices,
            webhookEvents,
            auditLogs,
            subscriptionsPagination: createPaginationFallback(10, subscriptions.length),
            invoicesPagination: createPaginationFallback(10, invoices.length),
            webhookPagination: createPaginationFallback(10, webhookEvents.length),
            auditPagination: createPaginationFallback(10, auditLogs.length),
        });
    }, [overview, plans, subscriptions, invoices, webhookEvents, auditLogs]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setSubscriptionSearch(subscriptionSearchInput.trim()), 300);
        return () => window.clearTimeout(timeoutId);
    }, [subscriptionSearchInput]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setInvoiceSearch(invoiceSearchInput.trim()), 300);
        return () => window.clearTimeout(timeoutId);
    }, [invoiceSearchInput]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setWebhookSearch(webhookSearchInput.trim()), 300);
        return () => window.clearTimeout(timeoutId);
    }, [webhookSearchInput]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setAuditSearch(auditSearchInput.trim()), 300);
        return () => window.clearTimeout(timeoutId);
    }, [auditSearchInput]);

    useEffect(() => {
        setSubscriptionPage(1);
    }, [subscriptionSearch, subscriptionStatusFilter]);

    useEffect(() => {
        setInvoicePage(1);
    }, [invoiceSearch, invoiceStatusFilter]);

    useEffect(() => {
        setWebhookPage(1);
    }, [webhookSearch, webhookStatusFilter]);

    useEffect(() => {
        setAuditPage(1);
    }, [auditSearch, auditActionFilter]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const setOrDelete = (key: string, value: string | number, fallback?: string | number) => {
            const normalized = String(value);
            const fallbackValue = fallback === undefined ? '' : String(fallback);
            if (!normalized || normalized === fallbackValue) {
                params.delete(key);
                return;
            }
            params.set(key, normalized);
        };

        setOrDelete('sub_search', subscriptionSearch, '');
        setOrDelete('sub_status', subscriptionStatusFilter, 'all');
        setOrDelete('sub_page', subscriptionPage, 1);
        setOrDelete('inv_search', invoiceSearch, '');
        setOrDelete('inv_status', invoiceStatusFilter, 'all');
        setOrDelete('inv_page', invoicePage, 1);
        setOrDelete('webhook_search', webhookSearch, '');
        setOrDelete('webhook_status', webhookStatusFilter, 'all');
        setOrDelete('webhook_page', webhookPage, 1);
        setOrDelete('audit_search', auditSearch, '');
        setOrDelete('audit_action', auditActionFilter, 'all');
        setOrDelete('audit_page', auditPage, 1);

        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
    }, [
        auditActionFilter,
        auditPage,
        auditSearch,
        invoicePage,
        invoiceSearch,
        invoiceStatusFilter,
        subscriptionPage,
        subscriptionSearch,
        subscriptionStatusFilter,
        webhookPage,
        webhookSearch,
        webhookStatusFilter,
    ]);

    const loadBillingData = useCallback(async () => {
        setIsRemoteLoading(true);
        try {
            const snapshot = await getAdminBillingSnapshot({
                subscription: {
                    page: subscriptionPage,
                    pageSize: 10,
                    search: subscriptionSearch,
                    status: subscriptionStatusFilter,
                },
                invoice: {
                    page: invoicePage,
                    pageSize: 10,
                    search: invoiceSearch,
                    status: invoiceStatusFilter,
                },
                webhook: {
                    page: webhookPage,
                    pageSize: 10,
                    search: webhookSearch,
                    status: webhookStatusFilter,
                },
                audit: {
                    page: auditPage,
                    pageSize: 10,
                    search: auditSearch,
                    action: auditActionFilter,
                },
            });
            setDataState(snapshot);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.failedBillingLoad;
            addNotification(NotificationType.Error, message);
        } finally {
            setIsRemoteLoading(false);
        }
    }, [
        addNotification,
        copy.failedBillingLoad,
        auditActionFilter,
        auditPage,
        auditSearch,
        invoicePage,
        invoiceSearch,
        invoiceStatusFilter,
        subscriptionPage,
        subscriptionSearch,
        subscriptionStatusFilter,
        webhookPage,
        webhookSearch,
        webhookStatusFilter,
    ]);

    useEffect(() => {
        void loadBillingData();
    }, [loadBillingData]);

    const effectiveOverview = dataState.overview ?? overview;
    const basePlans = dataState.plans.length ? dataState.plans : plans;
    const effectivePlans = localPlans.length ? localPlans : basePlans;

    // Sync localPlans when remote plans change
    React.useEffect(() => {
        if (basePlans.length) setLocalPlans(basePlans);
    }, [basePlans]);
    const effectiveSubscriptions = dataState.subscriptions;
    const effectiveInvoices = dataState.invoices;
    const effectiveWebhookEvents = dataState.webhookEvents;
    const effectiveAuditLogs = dataState.auditLogs;
    const effectiveSubscriptionsPagination = dataState.subscriptionsPagination;
    const effectiveInvoicesPagination = dataState.invoicesPagination;
    const effectiveWebhookPagination = dataState.webhookPagination;
    const effectiveAuditPagination = dataState.auditPagination;

    const metrics = useMemo(() => {
        const current = effectiveOverview ?? {
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

        return [
            {
                label: 'MRR',
                value: formatMoney(current.monthlyRecurringRevenue),
                helper: copy.mrrHelper(current.activeSubscriptions),
            },
            {
                label: 'ARR',
                value: formatMoney(current.annualRecurringRevenue),
                helper: copy.arrHelper(current.trialSubscriptions, current.pastDueSubscriptions),
            },
            {
                label: copy.invoices,
                value: String(current.openInvoices),
                helper: copy.invoicesHelper,
            },
            {
                label: ar ? 'إعادات المحاولة' : 'Retries',
                value: String(current.failedWebhooks),
                helper: copy.retriesHelper(current.queuedWebhookRetries, current.retriedWebhooks),
            },
        ];
    }, [ar, copy, effectiveOverview]);

    const auditActionOptions = useMemo(() => {
        const values = new Set<string>();
        [...auditLogs, ...effectiveAuditLogs].forEach(log => {
            if (log.action) {
                values.add(log.action);
            }
        });
        return Array.from(values).sort();
    }, [auditLogs, effectiveAuditLogs]);

    const failedWebhookCount = effectiveOverview?.failedWebhooks ?? effectiveWebhookEvents.filter(event => event.processingStatus === 'failed').length;

    const handlePlanAction = useCallback(async (planId: string) => {
        setPendingPlanId(planId);
        setCheckoutMessage(null);
        try {
            const result = await startBillingCheckout({
                planId,
                billingCycle,
            });

            setCheckoutMessage(result.message);
            addNotification(NotificationType.Success, result.message);

            if (result.checkoutUrl) {
                window.location.assign(result.checkoutUrl);
                return;
            }

            await Promise.allSettled([onRefreshBilling(), loadBillingData()]);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.failedCheckout;
            setCheckoutMessage(message);
            addNotification(NotificationType.Error, message);
        } finally {
            setPendingPlanId(null);
        }
    }, [addNotification, billingCycle, copy.failedCheckout, loadBillingData, onRefreshBilling]);

    const handleSubscriptionAction = useCallback(async (
        subscription: AdminBillingSubscription,
        action: 'portal' | 'pause' | 'cancel' | 'resume' | 'change_billing_cycle',
        options?: { open?: 'portal' | 'payment'; billingCycle?: BillingCycle },
    ) => {
        const pendingKey = `${subscription.id}:${action}`;
        setPendingRowAction(pendingKey);
        try {
            const result = await manageBillingSubscription({
                tenantId: subscription.tenantId,
                action,
                billingCycle: options?.billingCycle,
                reason: action === 'pause' || action === 'cancel' ? 'Managed from admin billing' : undefined,
            });

            if (action === 'portal') {
                const url = options?.open === 'payment'
                    ? result.updatePaymentMethodUrl || result.portalUrl
                    : result.portalUrl || result.updatePaymentMethodUrl;

                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            }

            addNotification(NotificationType.Success, result.message);
            await Promise.allSettled([onRefreshBilling(), loadBillingData()]);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.failedManage;
            addNotification(NotificationType.Error, message);
        } finally {
            setPendingRowAction(null);
        }
    }, [addNotification, copy.failedManage, loadBillingData, onRefreshBilling]);

    const handleRetryWebhook = useCallback(async (event: AdminBillingEvent) => {
        setPendingWebhookId(event.id);
        try {
            const result = await retryBillingWebhook(event.id, 'Manual retry from admin billing');
            addNotification(NotificationType.Success, result.message || copy.retryQueued);
            await Promise.allSettled([onRefreshBilling(), loadBillingData()]);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.failedRetry;
            addNotification(NotificationType.Error, message);
        } finally {
            setPendingWebhookId(null);
        }
    }, [addNotification, copy.failedRetry, copy.retryQueued, loadBillingData, onRefreshBilling]);

    const handleBulkRetryWebhooks = useCallback(async () => {
        setPendingBulkRetry(true);
        try {
            const result = await retryBillingWebhooks({
                retryFailed: true,
                reason: 'Manual bulk retry from admin billing',
                limit: 50,
            });
            addNotification(
                NotificationType.Success,
                result.message || `Processed ${result.processed || 0} failed webhook events.`,
            );
            await Promise.allSettled([onRefreshBilling(), loadBillingData()]);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.failedRetryBatch;
            addNotification(NotificationType.Error, message);
        } finally {
            setPendingBulkRetry(false);
        }
    }, [addNotification, copy.failedRetryBatch, loadBillingData, onRefreshBilling]);

    const handleSavePlan = async (planId: string, updated: SubscriptionPlanAdmin) => {
        await updateSubscriptionPlan(planId, {
            name: updated.name,
            tagline: updated.tagline,
            badge: updated.badge,
            highlighted: updated.highlighted,
            price_monthly: updated.monthlyPrice,
            price_yearly: updated.yearlyPrice,
            trial_days: updated.trialDays,
            max_brands: updated.brandLimit,
            max_users: updated.userLimit,
            ai_tokens_monthly: updated.aiTokenLimit,
            features: updated.features,
        });
        setLocalPlans(prev => prev.map(p => p.id === planId ? updated : p));
        addNotification(NotificationType.Success, `تم تحديث خطة ${updated.name} بنجاح`);
    };

    if (isLoading && !effectivePlans.length && !effectiveSubscriptions.length && !effectiveInvoices.length && !effectiveWebhookEvents.length && !effectiveAuditLogs.length) {
        return <BillingPageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-light-text dark:text-dark-text">{copy.title}</h1>
                    <p className="mt-2 max-w-3xl text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {copy.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isRemoteLoading && (
                        <span className="rounded-full border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                            {copy.refreshing}
                        </span>
                    )}
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-light-border bg-light-card p-1 dark:border-dark-border dark:bg-dark-card">
                        {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
                            <button
                                key={cycle}
                                onClick={() => setBillingCycle(cycle)}
                                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${billingCycle === cycle ? 'bg-brand-primary text-white' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                            >
                                {cycle === 'monthly' ? copy.monthly : copy.yearly}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric, index) => (
                    <OverviewCard
                        key={metric.label}
                        label={metric.label}
                        value={metric.value}
                        helper={metric.helper}
                        index={index}
                    />
                ))}
            </div>

            {/* ── Plans Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">خطط الأسعار</h2>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        تحكم في الأسعار والمميزات المعروضة على الموقع مباشرةً.
                    </p>
                </div>
            </div>

            <section className="grid gap-5 xl:grid-cols-3">
                {effectivePlans.map(plan => (
                    <div key={plan.id} className="space-y-3">
                        <PlanCard plan={plan} cycle={billingCycle} />
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setEditingPlan(plan)}
                                className="flex items-center justify-center gap-2 rounded-2xl border border-light-border dark:border-dark-border px-4 py-2.5 text-sm font-semibold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
                            >
                                <i className="fas fa-pen text-xs text-primary" />
                                تعديل الخطة
                            </button>
                            <button
                                onClick={() => handlePlanAction(plan.id)}
                                disabled={pendingPlanId === plan.id || plan.id === 'enterprise'}
                                className="rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 transition-colors hover:bg-brand-primary/90"
                            >
                                {plan.id === 'enterprise'
                                    ? copy.customSalesFlow
                                    : pendingPlanId === plan.id
                                        ? copy.preparingCheckout
                                        : copy.startPlan(plan.name)}
                            </button>
                        </div>
                    </div>
                ))}
            </section>

            {checkoutMessage && (
                <div className="rounded-2xl border border-light-border bg-light-card px-4 py-3 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-card dark:text-dark-text-secondary">
                    {checkoutMessage}
                </div>
            )}

            <DataTableShell title={copy.liveSubscriptions} subtitle={copy.liveSubscriptionsSubtitle}>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                        <input
                            value={subscriptionSearchInput}
                            onChange={event => setSubscriptionSearchInput(event.target.value)}
                            placeholder={copy.searchSubscriptions}
                            className="w-full rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                        />
                        <select
                            value={subscriptionStatusFilter}
                            onChange={event => setSubscriptionStatusFilter(event.target.value as 'all' | AdminBillingSubscription['status'])}
                            className="rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                        >
                            <option value="all">{copy.allStatuses}</option>
                            <option value="active">{copy.active}</option>
                            <option value="trialing">{copy.trialing}</option>
                            <option value="past_due">{copy.pastDue}</option>
                            <option value="paused">{copy.paused}</option>
                            <option value="canceled">{copy.canceled}</option>
                            <option value="inactive">{copy.inactive}</option>
                        </select>
                    </div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {copy.subscriptionsCount(effectiveSubscriptions.length, effectiveSubscriptionsPagination.total)}
                    </div>
                </div>
                {effectiveSubscriptions.length === 0 ? (
                    <EmptyState
                        title={effectiveSubscriptionsPagination.total === 0 ? copy.emptySubscriptions : copy.emptySubscriptionsFiltered}
                        description={effectiveSubscriptionsPagination.total === 0
                            ? copy.emptySubscriptionsDescription
                            : copy.emptyFilteredDescription}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-light-border text-start dark:border-dark-border">
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.tenant}</th>
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.plan}</th>
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.status}</th>
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.billing}</th>
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.customer}</th>
                                        <th className="pb-3 pe-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.nextBill}</th>
                                        <th className="pb-3 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {effectiveSubscriptions.map(subscription => {
                                        const state = getSubscriptionCapabilities(subscription);
                                        const cycleTarget = subscription.billingCycle === 'yearly' ? 'monthly' : 'yearly';
                                        const actionBase = `${subscription.id}:`;
                                        const resumeLabel = state.hasScheduledPause
                                            ? copy.undoPause
                                            : state.hasScheduledCancellation
                                                ? copy.undoCancel
                                                : copy.resume;

                                        return (
                                            <tr key={subscription.id} className="border-b border-light-border/70 align-top last:border-b-0 dark:border-dark-border/70">
                                                <td className="py-4 pe-4">
                                                    <p className="font-semibold text-light-text dark:text-dark-text">{subscription.tenantName}</p>
                                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{subscription.paddleSubscriptionId}</p>
                                                </td>
                                                <td className="py-4 pe-4">
                                                    <p className="font-semibold text-light-text dark:text-dark-text">{subscription.planName}</p>
                                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{subscription.planId}</p>
                                                </td>
                                                <td className="py-4 pe-4">
                                                    <BillingStatusBadge status={subscription.status} />
                                                    {state.hasScheduledCancellation && (
                                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{copy.cancelAtPeriodEnd}</p>
                                                    )}
                                                    {state.hasScheduledPause && (
                                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{copy.pauseAtPeriodEnd}</p>
                                                    )}
                                                    {subscription.pauseReason && (
                                                        <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.reason}: {subscription.pauseReason}</p>
                                                    )}
                                                </td>
                                                <td className="py-4 pe-4">
                                                    <p className="font-semibold text-light-text dark:text-dark-text">{formatMoney(subscription.amount, subscription.currency)}</p>
                                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{subscription.billingCycle}</p>
                                                </td>
                                                <td className="py-4 pe-4 text-light-text-secondary dark:text-dark-text-secondary">{subscription.customerEmail}</td>
                                                <td className="py-4 pe-4 text-light-text-secondary dark:text-dark-text-secondary">
                                                    <p>{formatDate(subscription.nextBilledAt)}</p>
                                                    {subscription.trialEndsAt && <p className="mt-1 text-xs">{copy.trialEnds(formatDate(subscription.trialEndsAt))}</p>}
                                                </td>
                                                <td className="py-4">
                                                    {!state.canManage ? (
                                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.noManagedSubscription}</span>
                                                    ) : (
                                                        <div className="flex max-w-[18rem] flex-wrap gap-2">
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'portal', { open: 'portal' })}
                                                                disabled={pendingRowAction === `${actionBase}portal`}
                                                                className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text"
                                                            >
                                                                {pendingRowAction === `${actionBase}portal` ? '...' : copy.portal}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'portal', { open: 'payment' })}
                                                                disabled={pendingRowAction === `${actionBase}portal`}
                                                                className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text"
                                                            >
                                                                {pendingRowAction === `${actionBase}portal` ? '...' : copy.payment}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'pause')}
                                                                disabled={!state.canPause || pendingRowAction === `${actionBase}pause`}
                                                                className="rounded-xl bg-amber-500/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                                            >
                                                                {pendingRowAction === `${actionBase}pause` ? '...' : copy.pause}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'cancel')}
                                                                disabled={!state.canCancel || pendingRowAction === `${actionBase}cancel`}
                                                                className="rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                                            >
                                                                {pendingRowAction === `${actionBase}cancel` ? '...' : copy.cancel}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'resume')}
                                                                disabled={!state.canResume || pendingRowAction === `${actionBase}resume`}
                                                                className="rounded-xl bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                                            >
                                                                {pendingRowAction === `${actionBase}resume` ? '...' : resumeLabel}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSubscriptionAction(subscription, 'change_billing_cycle', { billingCycle: cycleTarget })}
                                                                disabled={!state.canChangeBillingCycle || pendingRowAction === `${actionBase}change_billing_cycle`}
                                                                className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                                            >
                                                                {pendingRowAction === `${actionBase}change_billing_cycle` ? '...' : copy.switchTo(cycleTarget)}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            pagination={effectiveSubscriptionsPagination}
                            onPageChange={setSubscriptionPage}
                        />
                    </>
                )}
            </DataTableShell>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <DataTableShell title={copy.invoices} subtitle={copy.invoicesSubtitle}>
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                            <input
                                value={invoiceSearchInput}
                                onChange={event => setInvoiceSearchInput(event.target.value)}
                                placeholder={copy.searchInvoices}
                                className="w-full rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            />
                            <select
                                value={invoiceStatusFilter}
                                onChange={event => setInvoiceStatusFilter(event.target.value as 'all' | AdminBillingInvoice['status'])}
                                className="rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                <option value="all">{copy.allStatuses}</option>
                                <option value="draft">{copy.draft}</option>
                                <option value="open">{copy.open}</option>
                                <option value="paid">{copy.paid}</option>
                                <option value="past_due">{copy.pastDue}</option>
                                <option value="failed">{ar ? 'فشل' : 'Failed'}</option>
                                <option value="refunded">{ar ? 'مستردة' : 'Refunded'}</option>
                            </select>
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {copy.invoicesCount(effectiveInvoices.length, effectiveInvoicesPagination.total)}
                        </div>
                    </div>
                    {effectiveInvoices.length === 0 ? (
                        <EmptyState
                            title={effectiveInvoicesPagination.total === 0 ? copy.noInvoices : copy.noInvoicesFiltered}
                            description={effectiveInvoicesPagination.total === 0
                                ? copy.noInvoicesDescription
                                : copy.emptyFilteredDescription}
                        />
                    ) : (
                        <div className="space-y-3">
                            {effectiveInvoices.map(invoice => (
                                <div key={invoice.id} className="flex flex-col gap-3 rounded-2xl border border-light-border px-4 py-4 dark:border-dark-border lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold text-light-text dark:text-dark-text">{invoice.tenantName}</p>
                                            <BillingStatusBadge status={invoice.status} />
                                        </div>
                                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            {invoice.invoiceNumber || invoice.id} • {formatDate(invoice.billedAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="font-semibold text-light-text dark:text-dark-text">{formatMoney(invoice.amount, invoice.currency)}</p>
                                        {invoice.invoiceUrl ? (
                                            <a
                                                href={invoice.invoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text dark:border-dark-border dark:text-dark-text"
                                            >
                                                {copy.openInvoice}
                                            </a>
                                        ) : (
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.noUrl}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <PaginationControls
                                pagination={effectiveInvoicesPagination}
                                onPageChange={setInvoicePage}
                            />
                        </div>
                    )}
                </DataTableShell>

                <DataTableShell title={copy.webhookLogs} subtitle={copy.webhookLogsSubtitle}>
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                            <input
                                value={webhookSearchInput}
                                onChange={event => setWebhookSearchInput(event.target.value)}
                                placeholder={copy.searchWebhook}
                                className="w-full rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            />
                            <select
                                value={webhookStatusFilter}
                                onChange={event => setWebhookStatusFilter(event.target.value as 'all' | 'received' | 'processed' | 'failed')}
                                className="rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                <option value="all">{copy.allStatuses}</option>
                                <option value="failed">{copy.failedOnly}</option>
                                <option value="received">{copy.received}</option>
                                <option value="processed">{copy.processed}</option>
                            </select>
                        </div>
                        <button
                            onClick={handleBulkRetryWebhooks}
                            disabled={pendingBulkRetry || failedWebhookCount === 0}
                            className="rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {pendingBulkRetry ? copy.retryingBatch(failedWebhookCount) : copy.retryBatch(failedWebhookCount)}
                        </button>
                    </div>
                    {effectiveWebhookEvents.length === 0 ? (
                        <EmptyState
                            title={effectiveWebhookPagination.total === 0 ? copy.noWebhooks : copy.noWebhooksFiltered}
                            description={effectiveWebhookPagination.total === 0
                                ? copy.noWebhooksDescription
                                : copy.emptyFilteredDescription}
                        />
                    ) : (
                        <div className="space-y-3">
                            {effectiveWebhookEvents.map(event => (
                                <div key={event.id} className="rounded-2xl border border-light-border px-4 py-4 dark:border-dark-border">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-light-text dark:text-dark-text">{event.eventType}</p>
                                            <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{event.tenantName} • {formatDate(event.occurredAt)}</p>
                                        </div>
                                        <BillingStatusBadge status={event.processingStatus} />
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        <span>{ar ? `المحاولات: ${event.retryCount || 0}` : `Retries: ${event.retryCount || 0}`}</span>
                                        {event.lastRetryAt && <span>{ar ? `آخر إعادة: ${formatDate(event.lastRetryAt)}` : `Last retry: ${formatDate(event.lastRetryAt)}`}</span>}
                                        {event.lastRetryReason && <span>{copy.reason}: {event.lastRetryReason}</span>}
                                        {event.nextRetryAt && <span>{ar ? `الإعادة التالية: ${formatDate(event.nextRetryAt)}` : `Next auto retry: ${formatDate(event.nextRetryAt)}`}</span>}
                                    </div>
                                    {event.errorMessage && (
                                        <p className="mt-3 text-xs leading-6 text-rose-600 dark:text-rose-300">{event.errorMessage}</p>
                                    )}
                                    <div className="mt-4">
                                        <button
                                            onClick={() => handleRetryWebhook(event)}
                                            disabled={event.processingStatus !== 'failed' || pendingWebhookId === event.id}
                                            className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text"
                                        >
                                            {pendingWebhookId === event.id ? copy.retrying : copy.retryWebhook}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <PaginationControls
                                pagination={effectiveWebhookPagination}
                                onPageChange={setWebhookPage}
                            />
                        </div>
                    )}
                </DataTableShell>
            </div>

            <DataTableShell title={copy.auditTrail} subtitle={copy.auditTrailSubtitle}>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                        <input
                            value={auditSearchInput}
                            onChange={event => setAuditSearchInput(event.target.value)}
                            placeholder={copy.searchAudit}
                            className="w-full rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                        />
                        <select
                            value={auditActionFilter}
                            onChange={event => setAuditActionFilter(event.target.value)}
                            className="rounded-2xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                        >
                            <option value="all">{copy.allActions}</option>
                            {auditActionOptions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {copy.auditCount(effectiveAuditLogs.length, effectiveAuditPagination.total)}
                    </div>
                </div>
                {effectiveAuditLogs.length === 0 ? (
                    <EmptyState
                        title={effectiveAuditPagination.total === 0 ? copy.noAudit : copy.noAuditFiltered}
                        description={effectiveAuditPagination.total === 0
                            ? copy.noAuditDescription
                            : copy.emptyFilteredDescription}
                    />
                ) : (
                    <div className="space-y-3">
                        {effectiveAuditLogs.map(log => (
                            <div key={log.id} className="rounded-2xl border border-light-border px-4 py-4 dark:border-dark-border">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-light-text dark:text-dark-text">{log.action}</p>
                                        <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {log.tenantName} • {formatDate(log.createdAt)} • {log.actorScope}
                                        </p>
                                    </div>
                                    {log.reason && (
                                        <span className="rounded-full bg-light-bg px-3 py-1 text-xs font-semibold text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                            {log.reason}
                                        </span>
                                    )}
                                </div>
                                {log.subscriptionId && (
                                    <p className="mt-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        {ar ? 'الاشتراك' : 'Subscription'}: {log.subscriptionId}
                                    </p>
                                )}
                            </div>
                        ))}
                        <PaginationControls
                            pagination={effectiveAuditPagination}
                            onPageChange={setAuditPage}
                        />
                    </div>
                )}
            </DataTableShell>

            {editingPlan && (
                <PlanEditModal
                    plan={editingPlan}
                    onClose={() => setEditingPlan(null)}
                    onSave={handleSavePlan}
                />
            )}
        </div>
    );
};

