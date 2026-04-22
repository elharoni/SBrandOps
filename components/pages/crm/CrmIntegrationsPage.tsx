import React, { useMemo } from 'react';
import type { BrandAsset, BrandConnection } from '../../../services/brandConnectionService';
import { ProviderConnectionCallout } from '../../shared/ProviderConnectionCallout';

interface CrmIntegrationsPageProps {
    brandId: string;
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onNavigate: (page: string) => void;
}

export const CrmIntegrationsPage: React.FC<CrmIntegrationsPageProps> = ({
    brandId,
    brandConnections,
    brandAssets,
    onNavigate,
}) => {
    const shopifyConnection = useMemo(
        () => brandConnections.find((connection) => connection.provider === 'shopify' && connection.status !== 'disconnected') ?? null,
        [brandConnections],
    );
    const wooCommerceConnection = useMemo(
        () => brandConnections.find((connection) => connection.provider === 'woocommerce' && connection.status !== 'disconnected') ?? null,
        [brandConnections],
    );

    return (
        <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-light-text dark:text-dark-text">تكاملات المتاجر</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                            هذه الشاشة تعرض حالة Shopify و WooCommerce من سجل brand_connections الموحد. أي ربط أو إعادة توثيق أو تحديث أصول يتم من مساحة التكاملات، ليبقى CRM والتكاملات متطابقين.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onNavigate('integrations')}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
                    >
                        <i className="fas fa-plug text-xs" />
                        <span>فتح مساحة التكاملات</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ProviderConnectionCallout
                    title="Shopify"
                    description="مصدر المتجر والطلبات الذي يغذي وحدة العملاء والعمليات."
                    connection={shopifyConnection}
                    brandAssets={brandAssets}
                    emptyTitle="Shopify غير مربوط بعد"
                    emptyDescription="اربط Shopify من مساحة التكاملات لحفظ المتجر وتشغيل المزامنة الأولية وإظهار حالته داخل CRM."
                    primaryActionLabel="اربط Shopify"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="فتح CRM"
                    onSecondaryAction={() => onNavigate('crm')}
                />

                <ProviderConnectionCallout
                    title="WooCommerce"
                    description="محتوى الاتصال المستخدم للطلبات وبيانات العملاء القادمة من متاجر WooCommerce."
                    connection={wooCommerceConnection}
                    brandAssets={brandAssets}
                    emptyTitle="WooCommerce غير مربوط بعد"
                    emptyDescription="اربط WooCommerce من مساحة التكاملات لتحفظ بيانات المتجر وتتبع صحة الاتصال وآخر مزامنة من نفس المكان."
                    primaryActionLabel="اربط WooCommerce"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="فتح CRM"
                    onSecondaryAction={() => onNavigate('crm')}
                />
            </div>

            <div className="rounded-[1.35rem] border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-light-text dark:text-dark-text">
                    <i className="fas fa-webhook text-brand-primary" />
                    <span>Webhook URLs</span>
                </div>
                <p className="mt-2 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    للسنك الفوري بعد تمام الربط الموحد للبراند {brandId ? `(${brandId})` : ''}، استخدم الـ webhook URLs التالية في إعدادات المتجر.
                </p>
                <div className="mt-4 space-y-2">
                    <div className="rounded-xl border border-light-border/80 bg-light-bg/80 p-3 dark:border-dark-border/70 dark:bg-dark-bg/70">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">WooCommerce</p>
                        <code className="mt-1 block break-all text-xs text-light-text dark:text-dark-text">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-webhook-woo</code>
                    </div>
                    <div className="rounded-xl border border-light-border/80 bg-light-bg/80 p-3 dark:border-dark-border/70 dark:bg-dark-bg/70">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">Shopify</p>
                        <code className="mt-1 block break-all text-xs text-light-text dark:text-dark-text">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-webhook-shopify</code>
                    </div>
                </div>
            </div>
        </div>
    );
};
