import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AssetPurpose,
    AssetType,
    IntegrationHealth,
    NotificationType,
    SyncStatus,
} from '../../types';
import {
    getIntegrationHealth,
    updateAssetMetadata,
    updateAssetSyncStatus,
} from '../../services/socialAccountService';
import { useLanguage } from '../../context/LanguageContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const SS = SyncStatus;
const AP = AssetPurpose;

const SYNC_STATUS_CONFIG: Record<SyncStatus, { labelAr: string; labelEn: string; dot: string; badge: string; icon: string }> = {
    [SS.Active]:          { labelAr: 'نشط',               labelEn: 'Active',           dot: 'bg-emerald-500',               badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', icon: 'fa-circle-check'       },
    [SS.NeedsReconnect]:  { labelAr: 'يحتاج إعادة ربط',   labelEn: 'Needs reconnect',  dot: 'bg-amber-500 animate-pulse',   badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',       icon: 'fa-rotate-right'       },
    [SS.TokenExpired]:    { labelAr: 'التوكن منتهي',       labelEn: 'Token expired',    dot: 'bg-rose-500',                  badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',           icon: 'fa-key'                },
    [SS.ScopeMissing]:    { labelAr: 'صلاحيات ناقصة',      labelEn: 'Scope missing',    dot: 'bg-orange-500',                badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',    icon: 'fa-lock-open'          },
    [SS.WebhookInactive]: { labelAr: 'Webhook معطل',       labelEn: 'Webhook inactive', dot: 'bg-blue-400',                  badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',           icon: 'fa-bolt'               },
    [SS.PartialSync]:     { labelAr: 'مزامنة جزئية',       labelEn: 'Partial sync',     dot: 'bg-violet-500',                badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',    icon: 'fa-circle-half-stroke' },
    [SS.SyncDelayed]:     { labelAr: 'مزامنة متأخرة',      labelEn: 'Sync delayed',     dot: 'bg-slate-500 animate-pulse',   badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',       icon: 'fa-clock'              },
    [SS.Disconnected]:    { labelAr: 'غير متصل',           labelEn: 'Disconnected',     dot: 'bg-slate-400',                 badge: 'bg-slate-400/15 text-slate-600 dark:text-slate-400',       icon: 'fa-circle-xmark'       },
};

const ASSET_TYPE_LABELS: Record<AssetType, { ar: string; en: string }> = {
    [AssetType.Page]:           { ar: 'صفحة',          en: 'Page'          },
    [AssetType.IgAccount]:      { ar: 'انستغرام',      en: 'Instagram'     },
    [AssetType.AdAccount]:      { ar: 'حساب إعلانات',  en: 'Ad Account'    },
    [AssetType.Pixel]:          { ar: 'بيكسل',         en: 'Pixel'         },
    [AssetType.Store]:          { ar: 'متجر',          en: 'Store'         },
    [AssetType.Site]:           { ar: 'موقع',          en: 'Website'       },
    [AssetType.InboxChannel]:   { ar: 'قناة رسائل',    en: 'Inbox Channel' },
    [AssetType.YouTubeChannel]: { ar: 'يوتيوب',        en: 'YouTube'       },
    [AssetType.TikTokAccount]:  { ar: 'تيك توك',       en: 'TikTok'        },
    [AssetType.LinkedInPage]:   { ar: 'لينكد إن',      en: 'LinkedIn'      },
    [AssetType.XAccount]:       { ar: 'حساب X',        en: 'X Account'     },
};

const PURPOSE_CONFIG: Record<AssetPurpose, {
    labelAr: string; labelEn: string; descAr: string; descEn: string;
    icon: string; color: string; iconBg: string;
}> = {
    [AP.Publishing]: { labelAr: 'النشر',     labelEn: 'Publishing', descAr: 'قنوات نشر المحتوى على السوشيال', descEn: 'Social publishing channels', icon: 'fa-paper-plane',     color: 'text-blue-500',    iconBg: 'bg-blue-500/10'    },
    [AP.Inbox]:      { labelAr: 'الرسائل',   labelEn: 'Inbox',      descAr: 'قنوات استقبال رسائل العملاء',    descEn: 'Customer messaging channels', icon: 'fa-inbox',           color: 'text-amber-500',   iconBg: 'bg-amber-500/10'   },
    [AP.Analytics]:  { labelAr: 'التحليلات', labelEn: 'Analytics',  descAr: 'مصادر بيانات الأداء والزيارات',  descEn: 'Performance data sources',   icon: 'fa-chart-pie',       color: 'text-violet-500',  iconBg: 'bg-violet-500/10'  },
    [AP.Commerce]:   { labelAr: 'التجارة',   labelEn: 'Commerce',   descAr: 'متاجر ومصادر بيانات الطلبات',   descEn: 'Stores and order data',       icon: 'fa-bag-shopping',    color: 'text-emerald-500', iconBg: 'bg-emerald-500/10' },
    [AP.Ads]:        { labelAr: 'الإعلانات', labelEn: 'Ads',        descAr: 'حسابات وبيانات الإعلانات',       descEn: 'Ad accounts and campaign data', icon: 'fa-bullhorn',       color: 'text-rose-500',    iconBg: 'bg-rose-500/10'    },
    [AP.Seo]:        { labelAr: 'SEO',       labelEn: 'SEO',        descAr: 'البحث العضوي والظهور في محركات البحث', descEn: 'Organic search visibility', icon: 'fa-magnifying-glass-chart', color: 'text-teal-500', iconBg: 'bg-teal-500/10' },
};

const ALL_PURPOSES = Object.values(AP);

const CRITICAL_STATUSES = new Set<SyncStatus>([SS.TokenExpired, SS.NeedsReconnect, SS.ScopeMissing, SS.Disconnected]);
const WARNING_STATUSES  = new Set<SyncStatus>([SS.PartialSync, SS.SyncDelayed, SS.WebhookInactive]);

function relativeTime(iso: string | null, ar: boolean): string {
    if (!iso) return ar ? 'لم تتم' : 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return ar ? 'الآن' : 'Just now';
    if (mins < 60) return ar ? `${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return ar ? `${hrs} س` : `${hrs}h ago`;
    return ar ? `${Math.floor(hrs / 24)} ي` : `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PurposePill: React.FC<{ purpose: AssetPurpose; ar: boolean }> = ({ purpose, ar }) => {
    const cfg = PURPOSE_CONFIG[purpose];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.iconBg} ${cfg.color}`}>
            <i className={`fas ${cfg.icon} text-[8px]`} />
            {ar ? cfg.labelAr : cfg.labelEn}
        </span>
    );
};

const PurposesEditor: React.FC<{ current: AssetPurpose[]; onChange: (p: AssetPurpose[]) => void; ar: boolean }> = ({ current, onChange, ar }) => (
    <div className="flex flex-wrap gap-1.5">
        {ALL_PURPOSES.map((p) => {
            const cfg = PURPOSE_CONFIG[p];
            const active = current.includes(p);
            return (
                <button
                    key={p}
                    onClick={() => onChange(active ? current.filter((x) => x !== p) : [...current, p])}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${active ? `${cfg.iconBg} ${cfg.color}` : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary opacity-50 hover:opacity-80'}`}
                >
                    <i className={`fas ${cfg.icon} text-[9px]`} />
                    {ar ? cfg.labelAr : cfg.labelEn}
                </button>
            );
        })}
    </div>
);

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

    const statusCfg  = SYNC_STATUS_CONFIG[asset.syncStatus];
    const typeCfg    = ASSET_TYPE_LABELS[asset.assetType];
    const hasProblem = CRITICAL_STATUSES.has(asset.syncStatus);
    const hasWarning = WARNING_STATUSES.has(asset.syncStatus);

    const savePurposes = async () => {
        setSaving(true);
        await onUpdatePurposes(asset.id, localPurposes);
        setSaving(false);
        setEditingPurposes(false);
    };

    const borderColor = hasProblem ? 'border-rose-500/30 bg-rose-500/3' : hasWarning ? 'border-amber-500/25' : 'border-light-border dark:border-dark-border';

    return (
        <div className={`rounded-2xl border p-4 transition-all ${borderColor} bg-light-card dark:bg-dark-card`}>
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    {asset.avatarUrl
                        ? <img src={asset.avatarUrl} alt={asset.assetName} className="h-11 w-11 rounded-2xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-light-bg dark:bg-dark-bg text-light-text-secondary">
                            <i className="fas fa-plug text-base" />
                          </div>
                    }
                    {asset.isPrimary && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary">
                            <i className="fas fa-star text-[7px] text-white" />
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-light-text dark:text-dark-text">{asset.assetName}</p>
                        <span className="rounded-full bg-light-bg px-1.5 py-0.5 text-[10px] font-medium text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                            {ar ? typeCfg.ar : typeCfg.en}
                        </span>
                        {asset.market && (
                            <span className="rounded-full border border-light-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                {asset.market}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{asset.platform}</p>
                </div>

                <div className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCfg.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {ar ? statusCfg.labelAr : statusCfg.labelEn}
                </div>
            </div>

            {/* Alerts */}
            {asset.syncError && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-rose-500/8 px-3 py-2">
                    <i className="fas fa-circle-exclamation mt-0.5 text-[10px] text-rose-500" />
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">{asset.syncError}</p>
                </div>
            )}
            {asset.tokenExpiringSoon && !asset.syncError && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-orange-500/8 px-3 py-1.5">
                    <i className="fas fa-key text-[10px] text-orange-500" />
                    <p className="text-[11px] text-orange-700 dark:text-orange-400">
                        {ar ? 'التوكن سينتهي قريباً' : 'Token expiring soon'}
                        {asset.tokenExpiresAt && ` — ${new Date(asset.tokenExpiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}`}
                    </p>
                </div>
            )}

            {/* Meta row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                <span><i className="fas fa-clock me-1 opacity-60" />{relativeTime(asset.lastSyncedAt, ar)}</span>
                {asset.followersCount !== null && asset.followersCount > 0 && (
                    <span><i className="fas fa-users me-1 opacity-60" />{Intl.NumberFormat(ar ? 'ar-EG' : 'en-US', { notation: 'compact' }).format(asset.followersCount)}</span>
                )}
                {asset.webhookActive && (
                    <span className="text-emerald-600 dark:text-emerald-400"><i className="fas fa-bolt me-1" />Webhook</span>
                )}
                {asset.scopesGranted.length > 0 && (
                    <span><i className="fas fa-shield me-1 opacity-60" />{asset.scopesGranted.length} {ar ? 'صلاحية' : 'scopes'}</span>
                )}
            </div>

            {/* Purposes row */}
            <div className="mt-3">
                {editingPurposes ? (
                    <div className="space-y-2">
                        <PurposesEditor current={localPurposes} onChange={setLocalPurposes} ar={ar} />
                        <div className="flex gap-2">
                            <button onClick={savePurposes} disabled={saving} className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                                {saving ? <i className="fas fa-circle-notch fa-spin" /> : (ar ? 'حفظ' : 'Save')}
                            </button>
                            <button onClick={() => { setEditingPurposes(false); setLocalPurposes(asset.purposes); }} className="rounded-xl bg-light-bg px-3 py-1.5 text-xs font-semibold text-light-text dark:bg-dark-bg dark:text-dark-text">
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {localPurposes.length > 0
                            ? localPurposes.map((p) => <PurposePill key={p} purpose={p} ar={ar} />)
                            : <span className="text-[11px] italic text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'لم تُحدد الأغراض' : 'No purposes set'}</span>
                        }
                        <button onClick={() => setEditingPurposes(true)} className="ms-1 rounded-full border border-dashed border-light-border px-2 py-0.5 text-[10px] text-light-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border">
                            <i className="fas fa-pen text-[8px]" />
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            {(hasProblem || !asset.isPrimary) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-light-border/50 pt-3 dark:border-dark-border/50">
                    {hasProblem && (
                        <button onClick={() => onMarkStatus(asset.id, SS.Active)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white">
                            <i className="fas fa-rotate-right text-[10px]" />
                            {ar ? 'إعادة الاتصال' : 'Reconnect'}
                        </button>
                    )}
                    {!asset.isPrimary && (
                        <button onClick={() => onSetPrimary(asset.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-light-bg px-3 py-1.5 text-xs font-semibold text-light-text transition-colors hover:bg-amber-500/10 hover:text-amber-600 dark:bg-dark-bg dark:text-dark-text">
                            <i className="fas fa-star text-[10px]" />
                            {ar ? 'جعله أساسياً' : 'Set primary'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Purpose Coverage Matrix ──────────────────────────────────────────────────

const CoverageMatrix: React.FC<{ assets: IntegrationHealth[]; ar: boolean }> = ({ assets, ar }) => {
    const coverage = useMemo(() => {
        return ALL_PURPOSES.map((purpose) => {
            const purposeAssets = assets.filter((a) => a.purposes.includes(purpose));
            const active = purposeAssets.filter((a) => a.syncStatus === SS.Active);
            const critical = purposeAssets.filter((a) => CRITICAL_STATUSES.has(a.syncStatus));
            return { purpose, total: purposeAssets.length, active: active.length, critical: critical.length };
        });
    }, [assets]);

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {coverage.map(({ purpose, total, active, critical }) => {
                const cfg = PURPOSE_CONFIG[purpose];
                const covered   = active > 0;
                const hasCritical = critical > 0;
                const unconfigured = total === 0;
                return (
                    <div key={purpose} className={`rounded-2xl border p-4 transition-all ${unconfigured ? 'border-dashed border-light-border opacity-60 dark:border-dark-border' : hasCritical ? 'border-rose-500/30 bg-rose-500/3' : covered ? 'border-emerald-500/25 bg-emerald-500/3' : 'border-amber-500/25 bg-amber-500/3'}`}>
                        <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${cfg.iconBg}`}>
                            <i className={`fas ${cfg.icon} text-sm ${cfg.color}`} />
                        </div>
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">{ar ? cfg.labelAr : cfg.labelEn}</p>
                        <p className="mt-0.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                            {unconfigured
                                ? (ar ? 'غير مضبوط' : 'Not configured')
                                : hasCritical
                                    ? (ar ? `${critical} حرج` : `${critical} critical`)
                                    : covered
                                        ? (ar ? `${active} نشط` : `${active} active`)
                                        : (ar ? 'تحذير' : 'Warning')}
                        </p>
                        <div className={`mt-1.5 h-1 rounded-full ${unconfigured ? 'bg-light-bg dark:bg-dark-bg' : hasCritical ? 'bg-rose-500' : covered ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                );
            })}
        </div>
    );
};

// ─── Alert strip ─────────────────────────────────────────────────────────────

const AlertStrip: React.FC<{ assets: IntegrationHealth[]; ar: boolean }> = ({ assets, ar }) => {
    const issues = assets.filter((a) => CRITICAL_STATUSES.has(a.syncStatus) || a.tokenExpiringSoon);
    if (issues.length === 0) return null;

    return (
        <div className="rounded-2xl bg-rose-500/8 border border-rose-500/25 p-4 space-y-2">
            <div className="flex items-center gap-2">
                <i className="fas fa-triangle-exclamation text-rose-500 text-sm" />
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {ar ? `${issues.length} أصل يحتاج انتباهك` : `${issues.length} asset${issues.length > 1 ? 's' : ''} need attention`}
                </p>
            </div>
            <div className="space-y-1.5">
                {issues.slice(0, 4).map((a) => {
                    const scfg = SYNC_STATUS_CONFIG[a.syncStatus];
                    return (
                        <div key={a.id} className="flex items-center gap-2 text-[12px]">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${scfg.dot}`} />
                            <span className="font-semibold text-rose-800 dark:text-rose-200">{a.assetName}</span>
                            <span className="text-rose-600 dark:text-rose-400">—</span>
                            <span className="text-rose-600 dark:text-rose-400">{ar ? scfg.labelAr : scfg.labelEn}</span>
                        </div>
                    );
                })}
                {issues.length > 4 && (
                    <p className="text-[11px] text-rose-500">{ar ? `+ ${issues.length - 4} أصول أخرى` : `+ ${issues.length - 4} more`}</p>
                )}
            </div>
        </div>
    );
};

// ─── Page skeleton ────────────────────────────────────────────────────────────

const PageSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-light-card dark:bg-dark-card" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-light-card dark:bg-dark-card" />)}
        </div>
    </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

interface IntegrationOSPageProps {
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}

type PurposeFilter = AssetPurpose | 'all' | 'issues';

export const IntegrationOSPage: React.FC<IntegrationOSPageProps> = ({ brandId, addNotification }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [assets, setAssets] = useState<IntegrationHealth[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<PurposeFilter>('all');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getIntegrationHealth(brandId);
        setAssets(data);
        setLoading(false);
    }, [brandId]);

    useEffect(() => { load(); }, [load]);

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

    const issueCount = assets.filter((a) => CRITICAL_STATUSES.has(a.syncStatus) || a.tokenExpiringSoon).length;

    const filteredAssets = useMemo(() => {
        if (activeFilter === 'all') return assets;
        if (activeFilter === 'issues') return assets.filter((a) => CRITICAL_STATUSES.has(a.syncStatus) || a.tokenExpiringSoon);
        return assets.filter((a) => a.purposes.includes(activeFilter));
    }, [assets, activeFilter]);

    const filterTabs: { id: PurposeFilter; labelAr: string; labelEn: string; icon: string }[] = [
        { id: 'all',     labelAr: 'الكل',       labelEn: 'All',      icon: 'fa-grid-2'       },
        ...(issueCount > 0 ? [{ id: 'issues' as PurposeFilter, labelAr: 'مشاكل', labelEn: 'Issues', icon: 'fa-triangle-exclamation' }] : []),
        ...ALL_PURPOSES.map((p) => ({ id: p as PurposeFilter, labelAr: PURPOSE_CONFIG[p].labelAr, labelEn: PURPOSE_CONFIG[p].labelEn, icon: PURPOSE_CONFIG[p].icon })),
    ];

    if (loading) return <PageSkeleton />;

    return (
        <div className="space-y-6" dir="rtl">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                        <i className="fas fa-plug text-brand-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-light-text dark:text-dark-text">
                            {ar ? 'نظام التكاملات' : 'Integration OS'}
                        </h1>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {ar ? 'سجل الأصول · الصحة · الأغراض' : 'Asset registry · Health · Purposes'}
                        </p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-light-border px-3 py-2 text-xs font-medium text-light-text-secondary transition-colors hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                    <i className="fas fa-rotate-right text-[10px]" />
                    {ar ? 'تحديث' : 'Refresh'}
                </button>
            </div>

            {/* Alert strip */}
            <AlertStrip assets={assets} ar={ar} />

            {/* Coverage matrix */}
            {assets.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'تغطية الأغراض' : 'Purpose Coverage'}
                    </p>
                    <CoverageMatrix assets={assets} ar={ar} />
                </div>
            )}

            {/* Filter tabs */}
            {assets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filterTabs.map((tab) => {
                        const count = tab.id === 'all'
                            ? assets.length
                            : tab.id === 'issues'
                                ? issueCount
                                : assets.filter((a) => a.purposes.includes(tab.id as AssetPurpose)).length;
                        if (count === 0 && tab.id !== 'all') return null;
                        const isIssues = tab.id === 'issues';
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                    activeFilter === tab.id
                                        ? isIssues ? 'bg-rose-500 text-white' : 'bg-brand-primary text-white shadow-primary-glow'
                                        : isIssues ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20' : 'bg-light-bg text-light-text-secondary hover:bg-brand-primary/10 hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text-secondary'
                                }`}
                            >
                                <i className={`fas ${tab.icon} text-[9px]`} />
                                {ar ? tab.labelAr : tab.labelEn}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeFilter === tab.id ? 'bg-white/20' : 'bg-light-card text-light-text dark:bg-dark-card dark:text-dark-text'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Assets grid */}
            {assets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-light-border bg-light-card p-12 text-center dark:border-dark-border dark:bg-dark-card">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-light-bg dark:bg-dark-bg">
                        <i className="fas fa-plug text-xl text-light-text-secondary dark:text-dark-text-secondary" />
                    </div>
                    <p className="font-semibold text-light-text dark:text-dark-text">
                        {ar ? 'لا توجد أصول مرتبطة' : 'No assets connected'}
                    </p>
                    <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'اربط حساباتك من صفحة الحسابات لتبدأ.' : 'Connect accounts from the Accounts page to get started.'}
                    </p>
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-light-border bg-light-card p-8 text-center dark:border-dark-border dark:bg-dark-card">
                    <i className="fas fa-filter text-2xl text-light-text-secondary dark:text-dark-text-secondary opacity-40 mb-3 block" />
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'لا توجد أصول لهذا الغرض' : 'No assets for this purpose'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {filteredAssets.map((asset) => (
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
            )}

            {/* Summary footer */}
            {assets.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-light-border dark:border-dark-border pt-4">
                    {[
                        { label: ar ? 'إجمالي الأصول' : 'Total assets',  value: assets.length,                                                             icon: 'fa-plug',          color: 'text-brand-primary' },
                        { label: ar ? 'نشط'           : 'Active',         value: assets.filter((a) => a.syncStatus === SS.Active).length,                   icon: 'fa-circle-check',  color: 'text-emerald-500'   },
                        { label: ar ? 'يحتاج تدخل'   : 'Need attention', value: issueCount,                                                                icon: 'fa-triangle-exclamation', color: 'text-rose-500' },
                        { label: ar ? 'أساسية'        : 'Primary',        value: assets.filter((a) => a.isPrimary).length,                                  icon: 'fa-star',          color: 'text-amber-500'     },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3 rounded-xl bg-light-bg dark:bg-dark-bg px-4 py-3">
                            <i className={`fas ${s.icon} text-sm ${s.color}`} />
                            <div>
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">{s.value}</p>
                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
