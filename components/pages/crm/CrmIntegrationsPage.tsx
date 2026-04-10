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
                        <h1 className="text-xl font-bold text-light-text dark:text-dark-text">ØªÙƒØ§Ù…Ù„Ø§Øª Ø§Ù„Ù…ØªØ§Ø¬Ø±</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                            Ù‡Ø°Ù‡ Ø§Ù„Ø´Ø§Ø´Ø© ØªØ¹Ø±Ø¶ Ø­Ø§Ù„Ø© Shopify Ùˆ WooCommerce Ù…Ù† Ø³Ø¬Ù„ brand_connections Ø§Ù„Ù…ÙˆØ­Ø¯. Ø£ÙŠ Ø±Ø¨Ø· Ø£Ùˆ Ø¥Ø¹Ø§Ø¯Ø© ØªÙˆØ«ÙŠÙ‚ Ø£Ùˆ ØªØ­Ø¯ÙŠØ« Ø£ØµÙˆÙ„ ÙŠØªÙ… Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§ØªØŒ Ù„ÙŠØ¨Ù‚Ù‰ CRM ÙˆØ§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ù…ØªØ·Ø§Ø¨Ù‚ÙŠÙ†.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onNavigate('integrations')}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
                    >
                        <i className="fas fa-plug text-xs" />
                        <span>ÙØªØ­ Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ProviderConnectionCallout
                    title="Shopify"
                    description="Ù…ØµØ¯Ø± Ø§Ù„Ù…ØªØ¬Ø± ÙˆØ§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø°ÙŠ ÙŠØºØ°ÙŠ ÙˆØ­Ø¯Ø© Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆØ§Ù„Ø¹Ù…Ù„ÙŠØ§Øª."
                    connection={shopifyConnection}
                    brandAssets={brandAssets}
                    emptyTitle="Shopify ØºÙŠØ± Ù…Ø±Ø¨ÙˆØ· Ø¨Ø¹Ø¯"
                    emptyDescription="Ø§Ø±Ø¨Ø· Shopify Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ù„Ø­ÙØ¸ Ø§Ù„Ù…ØªØ¬Ø± ÙˆØªØ´ØºÙŠÙ„ Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø£ÙˆÙ„ÙŠØ© ÙˆØ¥Ø¸Ù‡Ø§Ø± Ø­Ø§Ù„ØªÙ‡ Ø¯Ø§Ø®Ù„ CRM."
                    primaryActionLabel="Ø§Ø±Ø¨Ø· Shopify"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="ÙØªØ­ CRM"
                    onSecondaryAction={() => onNavigate('crm')}
                />

                <ProviderConnectionCallout
                    title="WooCommerce"
                    description="Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø§ØªØµØ§Ù„ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù„Ù„Ø·Ù„Ø¨Ø§Øª ÙˆØ¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø© Ù…Ù† Ù…ØªØ§Ø¬Ø± WooCommerce."
                    connection={wooCommerceConnection}
                    brandAssets={brandAssets}
                    emptyTitle="WooCommerce ØºÙŠØ± Ù…Ø±Ø¨ÙˆØ· Ø¨Ø¹Ø¯"
                    emptyDescription="Ø§Ø±Ø¨Ø· WooCommerce Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ù„ØªØ­ÙØ¸ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ØªØ¬Ø± ÙˆØªØªØ¨Ø¹ ØµØ­Ø© Ø§Ù„Ø§ØªØµØ§Ù„ ÙˆØ¢Ø®Ø± Ù…Ø²Ø§Ù…Ù†Ø© Ù…Ù† Ù†ÙØ³ Ø§Ù„Ù…ÙƒØ§Ù†."
                    primaryActionLabel="Ø§Ø±Ø¨Ø· WooCommerce"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="ÙØªØ­ CRM"
                    onSecondaryAction={() => onNavigate('crm')}
                />
            </div>

            <div className="rounded-[1.35rem] border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-light-text dark:text-dark-text">
                    <i className="fas fa-webhook text-brand-primary" />
                    <span>Webhook URLs</span>
                </div>
                <p className="mt-2 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    Ù„Ù„Ø³Ù†Ùƒ Ø§Ù„ÙÙˆØ±ÙŠ Ø¨Ø¹Ø¯ ØªÙ…Ø§Ù… Ø§Ù„Ø±Ø¨Ø· Ø§Ù„Ù…ÙˆØ­Ø¯ Ù„Ù„Ø¨Ø±Ø§Ù†Ø¯ {brandId ? `(${brandId})` : ''}ØŒ Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù€ webhook URLs Ø§Ù„ØªØ§Ù„ÙŠØ© ÙÙŠ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ØªØ¬Ø±.
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
