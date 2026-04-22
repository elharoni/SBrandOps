import React, { useCallback, useEffect, useState } from 'react';
import {
    AssetPurpose,
    AssetType,
    IntegrationHealth,
    NotificationType,
    SyncStatus,
} from '../types';
import { getIntegrationHealth, updateAssetMetadata, updateAssetSyncStatus } from '../services/socialAccountService';
import { useLanguage } from '../context/LanguageContext';

// shorthand aliases for readable record keys
const SS = SyncStatus;
const AT = AssetType;
const AP = AssetPurpose;

interface IntegrationHealthPanelProps {
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const SYNC_STATUS_CONFIG: Record<SyncStatus, { labelAr: string; labelEn: string; dot: string; badge: string; icon: string }> = {
    [SS.Active]:          { labelAr: 'نشط',               labelEn: 'Active',           dot: 'bg-emerald-500',               badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', icon: 'fa-circle-check'       },
    [SS.NeedsReconnect]:  { labelAr: 'يحتاج إعادة ربط',   labelEn: 'Needs reconnect',  dot: 'bg-amber-500 animate-pulse',   badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',       icon: 'fa-rotate-right'       },
    [SS.TokenExpired]:    { labelAr: 'التوكن منتهي',       labelEn: 'Token expired',    dot: 'bg-rose-500',                  badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',           icon: 'fa-key'                },
    [SS.ScopeMissing]:    { labelAr: 'صلاحيات ناقصة',      labelEn: 'Scope missing',    dot: 'bg-orange-500',                badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',    icon: 'fa-lock-open'          },
    [SS.WebhookInactive]: { labelAr: 'Webhook معطل',       labelEn: 'Webhook inactive', dot: 'bg-blue-400',                  badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',           icon: 'fa-webhook'            },
    [SS.PartialSync]:     { labelAr: 'مزامنة جزئية',       labelEn: 'Partial sync',     dot: 'bg-violet-500',                badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',    icon: 'fa-circle-half-stroke' },
    [SS.SyncDelayed]:     { labelAr: 'مزامنة متأخرة',      labelEn: 'Sync delayed',     dot: 'bg-slate-500 animate-pulse',   badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',       icon: 'fa-clock'              },
    [SS.Disconnected]:    { labelAr: 'غير متصل',           labelEn: 'Disconnected',     dot: 'bg-slate-400',                 badge: 'bg-slate-400/15 text-slate-600 dark:text-slate-400',       icon: 'fa-circle-xmark'       },
};

const ASSET_TYPE_LABELS: Record<AssetType, { ar: string; en: string }> = {
    [AT.Page]:           { ar: 'صفحة',            en: 'Page'          },
    [AT.IgAccount]:      { ar: 'حساب انستغرام',   en: 'Instagram'     },
    [AT.AdAccount]:      { ar: 'حساب إعلانات',    en: 'Ad Account'    },
    [AT.Pixel]:          { ar: 'بيكسل',           en: 'Pixel'         },
    [AT.Store]:          { ar: 'متجر',            en: 'Store'         },
    [AT.Site]:           { ar: 'موقع',            en: 'Website'       },
    [AT.InboxChannel]:   { ar: 'قناة رسائل',      en: 'Inbox Channel' },
    [AT.YouTubeChannel]: { ar: 'يوتيوب',          en: 'YouTube'       },
    [AT.TikTokAccount]:  { ar: 'تيك توك',         en: 'TikTok'        },
    [AT.LinkedInPage]:   { ar: 'لينكد إن',        en: 'LinkedIn'      },
    [AT.XAccount]:       { ar: 'حساب X',          en: 'X Account'     },
};

const PURPOSE_CONFIG: Record<AssetPurpose, { labelAr: string; labelEn: string; icon: string; color: string }> = {
    [AP.Publishing]: { labelAr: 'نشر',    labelEn: 'Publishing', icon: 'fa-paper-plane',    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400'          },
    [AP.Inbox]:      { labelAr: 'رسائل',  labelEn: 'Inbox',      icon: 'fa-inbox',          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'        },
    [AP.Analytics]:  { labelAr: 'تحليلات',labelEn: 'Analytics',  icon: 'fa-chart-pie',      color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400'     },
    [AP.Commerce]:   { labelAr: 'تجارة',  labelEn: 'Commerce',   icon: 'fa-bag-shopping',   color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'  },
    [AP.Ads]:        { labelAr: 'إعلانات',labelEn: 'Ads',        icon: 'fa-bullhorn',       color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400'           },
    [AP.Seo]:        { labelAr: 'SEO',    labelEn: 'SEO',        icon: 'fa-search-location', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400'          },
};

const ALL_PURPOSES: AssetPurpose[] = [AP.Publishing, AP.Inbox, AP.Analytics, AP.Commerce, AP.Ads, AP.Seo];

// ─── Health summary bar ───────────────────────────────────────────────────────

const HealthSummary: React.FC<{ assets: IntegrationHealth[]; ar: boolean }> = ({ assets, ar }) => {
    const healthy   = assets.filter((a) => a.syncStatus === 'active').length;
    const degraded  = assets.filter((a) => ['partial_sync', 'sync_delayed', 'webhook_inactive', 'scope_missing'].includes(a.syncStatus)).length;
    const broken    = assets.filter((a) => ['token_expired', 'needs_reconnect', 'disconnected'].length > 0 && ['token_expired', 'needs_reconnect', 'disconnected'].includes(a.syncStatus)).length;
    const expiring  = assets.filter((a) => a.tokenExpiringSoon).length;

    const tiles = [
        { icon: 'fa-circle-check', value: healthy,  labelAr: 'نشط',         labelEn: 'Active',    color: 'text-emerald-600', bg: 'bg-emerald-500/8' },
        { icon: 'fa-triangle-exclamation', value: degraded, labelAr: 'متدهور', labelEn: 'Degraded', color: 'text-amber-600',   bg: 'bg-amber-500/8'   },
        { icon: 'fa-circle-xmark', value: broken,   labelAr: 'خاطئ',        labelEn: 'Broken',    color: 'text-rose-600',    bg: 'bg-rose-500/8'    },
        { icon: 'fa-key',          value: expiring, labelAr: 'توكن ينتهي',  labelEn: 'Token expiring', color: 'text-orange-600', bg: 'bg-orange-500/8'},
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
                <div key={t.labelEn} className={`surface-panel-soft flex items-center gap-3 rounded-[1.25rem] p-4 ${t.bg}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 dark:bg-white/10 ${t.color}`}>
                        <i className={`fas ${t.icon} text-sm`} />
                    </div>
                    <div>
                        <p className="text-xl font-black text-light-text dark:text-dark-text">{t.value}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{ar ? t.labelAr : t.labelEn}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Purposes editor ──────────────────────────────────────────────────────────

const PurposesEditor: React.FC<{
    current: AssetPurpose[];
    onChange: (p: AssetPurpose[]) => void;
    ar: boolean;
}> = ({ current, onChange, ar }) => (
    <div className="flex flex-wrap gap-1.5">
        {ALL_PURPOSES.map((p) => {
            const cfg = PURPOSE_CONFIG[p];
            const active = current.includes(p);
            return (
                <button
                    key={p}
                    onClick={() => onChange(active ? current.filter((x) => x !== p) : [...current, p])}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${active ? cfg.color : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary opacity-50'}`}
                >
                    <i className={`fas ${cfg.icon} text-[9px]`} />
                    {ar ? cfg.labelAr : cfg.labelEn}
                </button>
            );
        })}
    </div>
);

// ─── Single asset card ────────────────────────────────────────────────────────

const AssetCard: React.FC<{
    asset: IntegrationHealth;
    ar: boolean;
    onUpdatePurposes: (id: string, purposes: AssetPurpose[]) => Promise<void>;
    onSetPrimary: (id: string) => Promise<void>;
    onMarkStatus: (id: string, status: SyncStatus) => Promise<void>;
}> = ({ asset, ar, onUpdatePurposes, onSetPrimary, onMarkStatus }) => {
    const [editingPurposes, setEditingPurposes] = useState(false);
    const [localPurposes, setLocalPurposes] = useState<AssetPurpose[]>(asset.purposes);
    const [saving, setSaving] = useState(false);

    const statusCfg = SYNC_STATUS_CONFIG[asset.syncStatus];
    const typeCfg   = ASSET_TYPE_LABELS[asset.assetType];
    const isHealthy = asset.syncStatus === 'active';
    const hasProblem = ['token_expired', 'needs_reconnect', 'disconnected', 'scope_missing'].includes(asset.syncStatus);

    const savePurposes = async () => {
        setSaving(true);
        await onUpdatePurposes(asset.id, localPurposes);
        setSaving(false);
        setEditingPurposes(false);
    };

    const relativeTime = (iso: string | null) => {
        if (!iso) return ar ? 'لم تتم المزامنة' : 'Never synced';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return ar ? 'الآن' : 'Just now';
        if (mins < 60) return ar ? `منذ ${mins} دقيقة` : `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return ar ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return ar ? `منذ ${days} يوم` : `${days}d ago`;
    };

    return (
        <div className={`surface-panel rounded-[1.5rem] p-5 transition-all ${hasProblem ? 'border border-rose-500/25' : isHealthy ? 'border border-emerald-500/20' : 'border border-amber-500/20'}`}>
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    {asset.avatarUrl
                        ? <img src={asset.avatarUrl} alt={asset.assetName} className="h-12 w-12 rounded-2xl object-cover" />
                        : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-light-bg dark:bg-dark-bg text-light-text-secondary text-lg"><i className="fas fa-plug" /></div>
                    }
                    {asset.isPrimary && (
                        <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[9px] text-white">
                            <i className="fas fa-star" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{asset.assetName}</p>
                        <span className="rounded-full bg-light-bg px-2 py-0.5 text-[10px] font-semibold text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                            {ar ? typeCfg.ar : typeCfg.en}
                        </span>
                        {asset.market && (
                            <span className="rounded-full bg-light-bg px-2 py-0.5 text-[10px] font-mono uppercase text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                {asset.market}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">{asset.platform}</p>
                </div>

                {/* Sync status badge */}
                <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCfg.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {ar ? statusCfg.labelAr : statusCfg.labelEn}
                </div>
            </div>

            {/* Sync error */}
            {asset.syncError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/8 px-3 py-2">
                    <i className="fas fa-circle-exclamation mt-0.5 text-xs text-rose-500" />
                    <p className="text-xs text-rose-700 dark:text-rose-400">{asset.syncError}</p>
                </div>
            )}

            {/* Token expiry warning */}
            {asset.tokenExpiringSoon && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-500/8 px-3 py-2">
                    <i className="fas fa-key text-xs text-orange-500" />
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                        {ar ? 'التوكن سينتهي قريباً' : 'Token expiring soon'}
                        {asset.tokenExpiresAt && ` — ${new Date(asset.tokenExpiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}`}
                    </p>
                </div>
            )}

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                <span className="flex items-center gap-1">
                    <i className="fas fa-clock text-[9px]" />
                    {relativeTime(asset.lastSyncedAt)}
                </span>
                {asset.followersCount !== null && asset.followersCount > 0 && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-users text-[9px]" />
                        {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US').format(asset.followersCount)}
                    </span>
                )}
                {asset.webhookActive && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <i className="fas fa-bolt text-[9px]" />
                        {ar ? 'Webhook نشط' : 'Webhook active'}
                    </span>
                )}
                {asset.scopesGranted.length > 0 && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-shield text-[9px]" />
                        {asset.scopesGranted.length} {ar ? 'صلاحية' : 'scopes'}
                    </span>
                )}
            </div>

            {/* Purposes */}
            <div className="mt-3">
                {editingPurposes ? (
                    <div>
                        <PurposesEditor current={localPurposes} onChange={setLocalPurposes} ar={ar} />
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={savePurposes}
                                disabled={saving}
                                className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                                {saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ' : 'Save')}
                            </button>
                            <button
                                onClick={() => { setEditingPurposes(false); setLocalPurposes(asset.purposes); }}
                                className="rounded-xl bg-light-bg px-3 py-1.5 text-xs font-semibold text-light-text dark:bg-dark-bg dark:text-dark-text"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {localPurposes.length > 0
                            ? localPurposes.map((p) => {
                                const cfg = PURPOSE_CONFIG[p];
                                return (
                                    <span key={p} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                                        <i className={`fas ${cfg.icon} text-[8px]`} />
                                        {ar ? cfg.labelAr : cfg.labelEn}
                                    </span>
                                );
                            })
                            : <span className="text-[11px] italic text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'لم تُحدد الأغراض بعد' : 'No purposes set'}</span>
                        }
                        <button
                            onClick={() => setEditingPurposes(true)}
                            className="ms-1 rounded-full border border-dashed border-light-border px-2 py-0.5 text-[10px] text-light-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border"
                        >
                            <i className="fas fa-pen text-[8px]" />
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            {(hasProblem || !asset.isPrimary) && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-light-border/40 pt-3 dark:border-dark-border/40">
                    {hasProblem && (
                        <button
                            onClick={() => onMarkStatus(asset.id, SyncStatus.Active)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
                        >
                            <i className="fas fa-rotate-right text-[10px]" />
                            {ar ? 'إعادة الاتصال' : 'Reconnect'}
                        </button>
                    )}
                    {!asset.isPrimary && (
                        <button
                            onClick={() => onSetPrimary(asset.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-light-bg px-3 py-1.5 text-xs font-semibold text-light-text transition-colors hover:bg-brand-primary/10 hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text"
                        >
                            <i className="fas fa-star text-[10px]" />
                            {ar ? 'تعيين كأساسي' : 'Set as primary'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const IntegrationHealthPanel: React.FC<IntegrationHealthPanelProps> = ({
    brandId,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [assets, setAssets]   = useState<IntegrationHealth[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter]   = useState<SyncStatus | 'all'>('all' as const);

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getIntegrationHealth(brandId);
        setAssets(data);
        setLoading(false);
    }, [brandId]);

    useEffect(() => { load(); }, [load]);

    const filtered = filter === 'all' ? assets : assets.filter((a) => a.syncStatus === filter);

    const handleUpdatePurposes = async (id: string, purposes: AssetPurpose[]) => {
        await updateAssetMetadata(id, { purposes });
        setAssets((prev) => prev.map((a) => a.id === id ? { ...a, purposes } : a));
        addNotification(NotificationType.Success, ar ? 'تم تحديث الأغراض.' : 'Purposes updated.');
    };

    const handleSetPrimary = async (id: string) => {
        const asset = assets.find((a) => a.id === id);
        if (!asset) return;
        await updateAssetMetadata(id, { isPrimary: true });
        setAssets((prev) => prev.map((a) => ({
            ...a,
            isPrimary: a.id === id ? true : (a.assetType === asset.assetType ? false : a.isPrimary),
        })));
        addNotification(NotificationType.Success, ar ? 'تم التعيين كأصل أساسي.' : 'Set as primary asset.');
    };

    const handleMarkStatus = async (id: string, status: SyncStatus) => {
        await updateAssetSyncStatus(id, status);
        setAssets((prev) => prev.map((a) => a.id === id ? { ...a, syncStatus: status, syncError: null } : a));
        addNotification(NotificationType.Success, ar ? 'تم تحديث الحالة.' : 'Status updated.');
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="surface-panel animate-pulse rounded-[1.5rem] p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-light-bg dark:bg-dark-bg" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 rounded-full bg-light-bg dark:bg-dark-bg" />
                                <div className="h-3 w-1/4 rounded-full bg-light-bg dark:bg-dark-bg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (assets.length === 0) {
        return (
            <div className="surface-panel rounded-[1.75rem] px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-light-bg text-light-text-secondary dark:bg-dark-bg">
                    <i className="fas fa-plug text-xl" />
                </div>
                <p className="font-semibold text-light-text dark:text-dark-text">
                    {ar ? 'لا توجد أصول مرتبطة بعد' : 'No assets connected yet'}
                </p>
                <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? 'اربط حساباتك من تبويب الحسابات.' : 'Connect your accounts from the Accounts tab.'}
                </p>
            </div>
        );
    }

    const filterOptions: { value: SyncStatus | 'all'; labelAr: string; labelEn: string }[] = [
        { value: 'all',                     labelAr: 'الكل',             labelEn: 'All'            },
        { value: SS.Active,                 labelAr: 'نشط',              labelEn: 'Active'         },
        { value: SS.NeedsReconnect,         labelAr: 'يحتاج إعادة ربط', labelEn: 'Needs reconnect'},
        { value: SS.TokenExpired,           labelAr: 'التوكن منتهي',    labelEn: 'Token expired'  },
        { value: SS.Disconnected,           labelAr: 'غير متصل',         labelEn: 'Disconnected'   },
    ];

    return (
        <div className="space-y-5">
            {/* Summary */}
            <HealthSummary assets={assets} ar={ar} />

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
                {filterOptions.map((opt) => {
                    const count = opt.value === 'all' ? assets.length : assets.filter((a) => a.syncStatus === opt.value).length;
                    if (count === 0 && opt.value !== 'all') return null;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === opt.value ? 'bg-brand-primary text-white shadow-primary-glow' : 'bg-light-bg text-light-text-secondary hover:bg-brand-primary/10 hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text-secondary'}`}
                        >
                            {ar ? opt.labelAr : opt.labelEn}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === opt.value ? 'bg-white/20 text-white' : 'bg-light-card text-light-text dark:bg-dark-card dark:text-dark-text'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
                <button
                    onClick={load}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-light-bg px-3 py-1.5 text-xs font-semibold text-light-text-secondary transition-colors hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text-secondary"
                >
                    <i className="fas fa-rotate-right text-[10px]" />
                    {ar ? 'تحديث' : 'Refresh'}
                </button>
            </div>

            {/* Asset cards */}
            <div className="space-y-3">
                {filtered.map((asset) => (
                    <AssetCard
                        key={asset.id}
                        asset={asset}
                        ar={ar}
                        onUpdatePurposes={handleUpdatePurposes}
                        onSetPrimary={handleSetPrimary}
                        onMarkStatus={handleMarkStatus}
                    />
                ))}
            </div>
        </div>
    );
};
