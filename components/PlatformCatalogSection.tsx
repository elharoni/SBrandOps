/**
 * PlatformCatalogSection
 * معرض المنصات الـ 14 بكروت احترافية مع حالات الاتصال
 * يُستخدم داخل IntegrationsPage
 */

import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { NotificationType } from '../types';
import type { BrandConnection } from '../services/brandConnectionService';
import type { SocialAccount } from '../types';

// ── Platform definitions ──────────────────────────────────────────────────────

interface PlatformDef {
    key: string;
    nameAr: string;
    nameEn: string;
    benefitAr: string;
    benefitEn: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    category: 'social' | 'ads' | 'analytics' | 'commerce' | 'cms';
    categoryAr: string;
    capabilities: string[];  // icon class keys for capability chips
    connectType: 'oauth_popup' | 'oauth_redirect' | 'api_key';
    oauthProvider?: string;  // maps to socialAuthService platform or brandConnectionService provider
}

const PLATFORMS: PlatformDef[] = [
    // ── Social ────────────────────────────────────────────────────────────────
    {
        key: 'facebook', nameAr: 'فيسبوك', nameEn: 'Facebook',
        benefitAr: 'نشر المنشورات، إدارة الرسائل، تحليلات الصفحة',
        benefitEn: 'Publish posts, manage messages, page analytics',
        icon: 'fab fa-facebook', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-paper-plane', 'fa-inbox', 'fa-chart-bar'],
        connectType: 'oauth_popup', oauthProvider: 'facebook',
    },
    {
        key: 'instagram', nameAr: 'انستغرام', nameEn: 'Instagram',
        benefitAr: 'نشر المحتوى، Reels، تعليقات، تحليلات',
        benefitEn: 'Content publishing, Reels, comments, analytics',
        icon: 'fab fa-instagram', iconBg: 'bg-pink-500/10', iconColor: 'text-pink-500',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-paper-plane', 'fa-comment', 'fa-chart-bar'],
        connectType: 'oauth_popup', oauthProvider: 'instagram',
    },
    {
        key: 'tiktok', nameAr: 'تيك توك', nameEn: 'TikTok',
        benefitAr: 'نشر الفيديوهات، تحليلات الحساب، التعليقات',
        benefitEn: 'Publish videos, account analytics, comments',
        icon: 'fab fa-tiktok', iconBg: 'bg-zinc-500/10', iconColor: 'text-light-text dark:text-dark-text',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-video', 'fa-chart-bar', 'fa-comment'],
        connectType: 'oauth_redirect', oauthProvider: 'tiktok',
    },
    {
        key: 'youtube', nameAr: 'يوتيوب', nameEn: 'YouTube',
        benefitAr: 'نشر الفيديوهات، بيانات المشاهدات، التعليقات',
        benefitEn: 'Upload videos, view analytics, comments',
        icon: 'fab fa-youtube', iconBg: 'bg-red-500/10', iconColor: 'text-red-500',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-video', 'fa-chart-bar', 'fa-comment'],
        connectType: 'oauth_redirect', oauthProvider: 'youtube',
    },
    {
        key: 'linkedin', nameAr: 'لينكد إن', nameEn: 'LinkedIn',
        benefitAr: 'نشر منشورات الصفحة، تحليلات المتابعين',
        benefitEn: 'Page posts, follower analytics',
        icon: 'fab fa-linkedin', iconBg: 'bg-blue-700/10', iconColor: 'text-blue-600 dark:text-blue-300',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-paper-plane', 'fa-chart-bar'],
        connectType: 'oauth_redirect', oauthProvider: 'linkedin',
    },
    {
        key: 'x', nameAr: 'X', nameEn: 'X / Twitter',
        benefitAr: 'نشر التغريدات، مراقبة الإشارات، الردود',
        benefitEn: 'Publish tweets, mentions monitoring, replies',
        icon: 'fab fa-x-twitter', iconBg: 'bg-slate-500/10', iconColor: 'text-slate-300',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-paper-plane', 'fa-at', 'fa-comment'],
        connectType: 'oauth_redirect', oauthProvider: 'x',
    },
    {
        key: 'pinterest', nameAr: 'بينتريست', nameEn: 'Pinterest',
        benefitAr: 'نشر الـ Pins، تحليلات اللوحات',
        benefitEn: 'Publish pins, board analytics',
        icon: 'fab fa-pinterest', iconBg: 'bg-red-500/10', iconColor: 'text-red-600',
        category: 'social', categoryAr: 'سوشيال',
        capabilities: ['fa-thumbtack', 'fa-chart-bar'],
        connectType: 'oauth_redirect', oauthProvider: 'pinterest',
    },
    // ── Ads ───────────────────────────────────────────────────────────────────
    {
        key: 'meta_ads', nameAr: 'Meta Ads', nameEn: 'Meta Ads',
        benefitAr: 'بيانات الحملات، الإنفاق، ROAS، CPM، CPC',
        benefitEn: 'Campaign data, spend, ROAS, CPM, CPC',
        icon: 'fab fa-meta', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500',
        category: 'ads', categoryAr: 'إعلانات',
        capabilities: ['fa-bullhorn', 'fa-chart-line', 'fa-dollar-sign'],
        connectType: 'oauth_popup', oauthProvider: 'meta',
    },
    {
        key: 'google_ads', nameAr: 'Google Ads', nameEn: 'Google Ads',
        benefitAr: 'إنفاق الحملات، التحويلات، ROAS، جودة الكلمات',
        benefitEn: 'Campaign spend, conversions, ROAS, keyword quality',
        icon: 'fab fa-google', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500',
        category: 'ads', categoryAr: 'إعلانات',
        capabilities: ['fa-bullhorn', 'fa-chart-line', 'fa-dollar-sign'],
        connectType: 'oauth_redirect', oauthProvider: 'google_ads',
    },
    // ── Analytics ──────────────────────────────────────────────────────────────
    {
        key: 'ga4', nameAr: 'Google Analytics 4', nameEn: 'Google Analytics 4',
        benefitAr: 'الجلسات، المستخدمون، التحويلات، مصادر الزيارات',
        benefitEn: 'Sessions, users, conversions, traffic sources',
        icon: 'fas fa-chart-line', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500',
        category: 'analytics', categoryAr: 'تحليلات',
        capabilities: ['fa-chart-line', 'fa-users', 'fa-rotate'],
        connectType: 'oauth_redirect', oauthProvider: 'ga4',
    },
    {
        key: 'search_console', nameAr: 'Search Console', nameEn: 'Search Console',
        benefitAr: 'الكلمات المفتاحية، الظهور، النقرات، متوسط الترتيب',
        benefitEn: 'Keywords, impressions, clicks, average position',
        icon: 'fas fa-magnifying-glass-chart', iconBg: 'bg-cyan-500/10', iconColor: 'text-cyan-500',
        category: 'analytics', categoryAr: 'تحليلات',
        capabilities: ['fa-magnifying-glass', 'fa-chart-bar'],
        connectType: 'oauth_redirect', oauthProvider: 'search_console',
    },
    // ── Commerce ──────────────────────────────────────────────────────────────
    {
        key: 'shopify', nameAr: 'Shopify', nameEn: 'Shopify',
        benefitAr: 'الطلبات، المنتجات، العملاء، العربات المتروكة',
        benefitEn: 'Orders, products, customers, abandoned carts',
        icon: 'fab fa-shopify', iconBg: 'bg-green-500/10', iconColor: 'text-green-500',
        category: 'commerce', categoryAr: 'تجارة',
        capabilities: ['fa-bag-shopping', 'fa-boxes-stacked', 'fa-users'],
        connectType: 'api_key', oauthProvider: 'shopify',
    },
    {
        key: 'woocommerce', nameAr: 'WooCommerce', nameEn: 'WooCommerce',
        benefitAr: 'الطلبات، المنتجات، تقارير المبيعات',
        benefitEn: 'Orders, products, sales reports',
        icon: 'fas fa-store', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500',
        category: 'commerce', categoryAr: 'تجارة',
        capabilities: ['fa-bag-shopping', 'fa-boxes-stacked'],
        connectType: 'api_key', oauthProvider: 'woocommerce',
    },
    // ── CMS ───────────────────────────────────────────────────────────────────
    {
        key: 'wordpress', nameAr: 'WordPress', nameEn: 'WordPress',
        benefitAr: 'نشر المقالات، مزامنة تقويم المحتوى',
        benefitEn: 'Publish blog posts, content calendar sync',
        icon: 'fab fa-wordpress', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-500',
        category: 'cms', categoryAr: 'CMS',
        capabilities: ['fa-newspaper', 'fa-calendar'],
        connectType: 'api_key', oauthProvider: 'wordpress',
    },
];

const CATEGORY_FILTER = [
    { id: 'all',       labelAr: 'الكل',      labelEn: 'All',       icon: 'fa-grid-2'       },
    { id: 'social',    labelAr: 'سوشيال',    labelEn: 'Social',    icon: 'fa-hashtag'      },
    { id: 'ads',       labelAr: 'إعلانات',   labelEn: 'Ads',       icon: 'fa-bullhorn'     },
    { id: 'analytics', labelAr: 'تحليلات',   labelEn: 'Analytics', icon: 'fa-chart-pie'    },
    { id: 'commerce',  labelAr: 'تجارة',     labelEn: 'Commerce',  icon: 'fa-bag-shopping' },
    { id: 'cms',       labelAr: 'CMS',       labelEn: 'CMS',       icon: 'fa-newspaper'    },
] as const;

// ── Connection status resolver ────────────────────────────────────────────────

function resolveStatus(
    platformKey: string,
    socialAccounts: SocialAccount[],
    brandConnections: BrandConnection[],
): { status: 'connected' | 'expired' | 'needs_reconnect' | 'disconnected'; accountName?: string; lastSync?: string } {
    // Check social_accounts (Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Pinterest)
    const social = socialAccounts.find(a =>
        a.platform?.toLowerCase() === platformKey ||
        (platformKey === 'x' && a.platform?.toLowerCase() === 'x') ||
        (platformKey === 'meta_ads' && a.platform?.toLowerCase() === 'facebook')
    );
    if (social) {
        const syncStatus = social.syncStatus ?? 'active';
        const status = syncStatus === 'active' ? 'connected'
            : syncStatus === 'token_expired' ? 'expired'
            : syncStatus === 'needs_reconnect' ? 'needs_reconnect'
            : 'disconnected';
        return { status, accountName: social.username, lastSync: social.lastSyncedAt };
    }

    // Check brand_connections (Google, Shopify, WooCommerce, WordPress)
    const conn = brandConnections.find(c =>
        c.provider?.toLowerCase() === platformKey ||
        (platformKey === 'google_ads' && c.provider === 'google_ads') ||
        (platformKey === 'ga4' && c.provider === 'ga4') ||
        (platformKey === 'search_console' && c.provider === 'search_console') ||
        (platformKey === 'meta_ads' && c.provider === 'meta')
    );
    if (conn) {
        const status = conn.status === 'connected' ? 'connected'
            : conn.status === 'expired' ? 'expired'
            : conn.status === 'needs_reauth' ? 'needs_reconnect'
            : 'disconnected';
        return {
            status,
            accountName: conn.external_account_name ?? undefined,
            lastSync:    conn.last_sync_at ?? undefined,
        };
    }

    return { status: 'disconnected' };
}

function relativeTime(iso: string | null | undefined, ar: boolean): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return ar ? 'الآن' : 'Just now';
    if (mins < 60) return ar ? `${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return ar ? `${hrs} س` : `${hrs}h ago`;
    return ar ? `${Math.floor(hrs / 24)} ي` : `${Math.floor(hrs / 24)}d ago`;
}

// ── Platform Card ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: 'connected' | 'expired' | 'needs_reconnect' | 'disconnected'; ar: boolean }> = ({ status, ar }) => {
    const cfg = {
        connected:        { label: ar ? 'متصل'              : 'Connected',       cls: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
        expired:          { label: ar ? 'منتهي الصلاحية'    : 'Token expired',   cls: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',         dot: 'bg-rose-500'    },
        needs_reconnect:  { label: ar ? 'يحتاج إعادة ربط'   : 'Needs reconnect', cls: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500 animate-pulse' },
        disconnected:     { label: ar ? 'غير متصل'           : 'Not connected',   cls: 'bg-slate-500/10 text-slate-500',                          dot: 'bg-slate-400'   },
    }[status];

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

interface PlatformCardProps {
    platform: PlatformDef;
    connectionInfo: ReturnType<typeof resolveStatus>;
    ar: boolean;
    onConnect: (platform: PlatformDef) => void;
    onManage: (platform: PlatformDef) => void;
    onDisconnect: (platform: PlatformDef) => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({ platform, connectionInfo, ar, onConnect, onManage, onDisconnect }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const isConnected    = connectionInfo.status === 'connected';
    const needsAttention = connectionInfo.status === 'expired' || connectionInfo.status === 'needs_reconnect';

    return (
        <div className={`relative rounded-2xl border p-4 transition-all hover:shadow-md dark:hover:shadow-dark-card/50 ${
            isConnected
                ? 'border-emerald-500/20 bg-light-card dark:bg-dark-card'
                : needsAttention
                    ? 'border-amber-500/20 bg-light-card dark:bg-dark-card'
                    : 'border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card'
        }`}>

            {/* Header */}
            <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${platform.iconBg}`}>
                    <i className={`${platform.icon} text-xl ${platform.iconColor}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">
                            {ar ? platform.nameAr : platform.nameEn}
                        </p>
                        <span className="rounded-full bg-light-bg px-1.5 py-0.5 text-[10px] font-medium text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                            {ar ? platform.categoryAr : platform.category}
                        </span>
                    </div>
                    <StatusBadge status={connectionInfo.status} ar={ar} />
                </div>

                {/* Manage menu */}
                {isConnected && (
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen(v => !v)}
                            className="flex h-7 w-7 items-center justify-center rounded-xl border border-light-border text-xs text-light-text-secondary transition-colors hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                        >
                            <i className="fas fa-ellipsis-vertical" />
                        </button>
                        {menuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                                <div className={`absolute z-20 mt-1 w-40 rounded-xl border border-light-border bg-light-card shadow-xl dark:border-dark-border dark:bg-dark-card ${ar ? 'left-0' : 'right-0'}`}>
                                    {[
                                        { icon: 'fa-rotate-right', labelAr: 'مزامنة الآن',     labelEn: 'Sync now',      action: () => { setMenuOpen(false); onManage(platform); } },
                                        { icon: 'fa-gear',         labelAr: 'الإعدادات',       labelEn: 'Settings',      action: () => { setMenuOpen(false); onManage(platform); } },
                                        { icon: 'fa-plug-circle-xmark', labelAr: 'قطع الاتصال', labelEn: 'Disconnect', action: () => { setMenuOpen(false); onDisconnect(platform); } },
                                    ].map(item => (
                                        <button key={item.icon} onClick={item.action}
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-light-bg dark:hover:bg-dark-bg ${item.icon === 'fa-plug-circle-xmark' ? 'text-rose-500' : 'text-light-text dark:text-dark-text'}`}>
                                            <i className={`fas ${item.icon} w-4 text-center text-[11px]`} />
                                            {ar ? item.labelAr : item.labelEn}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Benefit */}
            <p className="mt-2.5 text-[12px] leading-relaxed text-light-text-secondary dark:text-dark-text-secondary line-clamp-2">
                {ar ? platform.benefitAr : platform.benefitEn}
            </p>

            {/* Connected account + last sync */}
            {isConnected && (connectionInfo.accountName || connectionInfo.lastSync) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                    {connectionInfo.accountName && (
                        <span className="flex items-center gap-1">
                            <i className="fas fa-user-check opacity-60 text-[9px]" />
                            {connectionInfo.accountName}
                        </span>
                    )}
                    {connectionInfo.lastSync && (
                        <span className="flex items-center gap-1">
                            <i className="fas fa-clock opacity-60 text-[9px]" />
                            {relativeTime(connectionInfo.lastSync, ar)}
                        </span>
                    )}
                </div>
            )}

            {/* Capabilities */}
            <div className="mt-3 flex gap-1.5">
                {platform.capabilities.map(cap => (
                    <span key={cap} className="flex h-6 w-6 items-center justify-center rounded-lg bg-light-bg text-[10px] text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary" title={cap}>
                        <i className={`fas ${cap}`} />
                    </span>
                ))}
            </div>

            {/* Action button */}
            <div className="mt-3 pt-3 border-t border-light-border/50 dark:border-dark-border/50">
                {connectionInfo.status === 'disconnected' ? (
                    <button
                        onClick={() => onConnect(platform)}
                        className="w-full rounded-xl bg-brand-primary/10 py-2 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
                    >
                        <i className="fas fa-plug me-1.5 text-[10px]" />
                        {ar ? 'ربط' : 'Connect'}
                    </button>
                ) : needsAttention ? (
                    <button
                        onClick={() => onConnect(platform)}
                        className="w-full rounded-xl bg-amber-500/10 py-2 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500 hover:text-white dark:text-amber-400"
                    >
                        <i className="fas fa-rotate-right me-1.5 text-[10px]" />
                        {ar ? 'إعادة الربط' : 'Reconnect'}
                    </button>
                ) : (
                    <button
                        onClick={() => onManage(platform)}
                        className="w-full rounded-xl bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white dark:text-emerald-400"
                    >
                        <i className="fas fa-circle-check me-1.5 text-[10px]" />
                        {ar ? 'متصل · إدارة' : 'Connected · Manage'}
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Main Export ────────────────────────────────────────────────────────────────

interface PlatformCatalogSectionProps {
    brandId: string;
    socialAccounts: SocialAccount[];
    brandConnections: BrandConnection[];
    onConnect: (providerKey: string, connectType: PlatformDef['connectType']) => void;
    onManage: (providerKey: string) => void;
    onDisconnect: (providerKey: string) => void;
    addNotification: (type: NotificationType, message: string) => void;
}

export const PlatformCatalogSection: React.FC<PlatformCatalogSectionProps> = ({
    socialAccounts,
    brandConnections,
    onConnect,
    onManage,
    onDisconnect,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [category, setCategory] = useState<string>('all');

    const filtered = useMemo(() =>
        PLATFORMS.filter(p => category === 'all' || p.category === category),
        [category],
    );

    const connectedCount   = PLATFORMS.filter(p => resolveStatus(p.key, socialAccounts, brandConnections).status === 'connected').length;
    const attentionCount   = PLATFORMS.filter(p => {
        const s = resolveStatus(p.key, socialAccounts, brandConnections).status;
        return s === 'expired' || s === 'needs_reconnect';
    }).length;

    return (
        <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
            {/* Section header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-light-text dark:text-dark-text">
                        {ar ? 'المنصات المتاحة' : 'Available Platforms'}
                    </h2>
                    <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? `${connectedCount} متصل · ${attentionCount} يحتاج انتباه · ${PLATFORMS.length} إجمالي`
                            : `${connectedCount} connected · ${attentionCount} need attention · ${PLATFORMS.length} total`
                        }
                    </p>
                </div>

                {/* Health summary chips */}
                <div className="flex gap-2">
                    {connectedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <i className="fas fa-circle-check text-[9px]" /> {connectedCount}
                        </span>
                    )}
                    {attentionCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <i className="fas fa-triangle-exclamation text-[9px]" /> {attentionCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTER.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                            category === cat.id
                                ? 'bg-brand-primary text-white shadow-primary-glow'
                                : 'bg-light-bg text-light-text-secondary hover:bg-brand-primary/10 hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text-secondary'
                        }`}
                    >
                        <i className={`fas ${cat.icon} text-[9px]`} />
                        {ar ? cat.labelAr : cat.labelEn}
                    </button>
                ))}
            </div>

            {/* Cards grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(platform => {
                    const connectionInfo = resolveStatus(platform.key, socialAccounts, brandConnections);
                    return (
                        <PlatformCard
                            key={platform.key}
                            platform={platform}
                            connectionInfo={connectionInfo}
                            ar={ar}
                            onConnect={p => onConnect(p.key, p.connectType)}
                            onManage={p => onManage(p.key)}
                            onDisconnect={p => onDisconnect(p.key)}
                        />
                    );
                })}
            </div>

            {/* Coming soon */}
            <div className="rounded-2xl border border-dashed border-light-border bg-light-bg/50 p-5 dark:border-dark-border dark:bg-dark-bg/50">
                <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? 'قريباً' : 'Coming soon'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {[
                        { icon: 'fab fa-whatsapp',    label: 'WhatsApp Business', color: 'text-green-500' },
                        { icon: 'fab fa-snapchat',    label: 'Snapchat Ads',      color: 'text-yellow-500' },
                        { icon: 'fas fa-envelope',    label: 'Mailchimp',         color: 'text-yellow-400' },
                        { icon: 'fab fa-telegram',    label: 'Telegram',          color: 'text-sky-500'   },
                        { icon: 'fas fa-fire',        label: 'Hotjar',            color: 'text-rose-500'  },
                        { icon: 'fas fa-shuffle',     label: 'Make',              color: 'text-indigo-500' },
                    ].map(item => (
                        <span key={item.label}
                            className="inline-flex items-center gap-1.5 rounded-full border border-light-border bg-light-card px-2.5 py-1 text-[11px] font-medium text-light-text-secondary dark:border-dark-border dark:bg-dark-card dark:text-dark-text-secondary">
                            <i className={`${item.icon} ${item.color} text-[10px]`} />
                            {item.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
