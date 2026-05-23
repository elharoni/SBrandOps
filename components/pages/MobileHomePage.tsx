import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchTodaySummary, TodaySummary, TodayPriority } from '../../services/todaySummaryService';

interface BrandOption { id: string; name: string }

interface Props {
    brandId: string;
    brandName: string;
    brands?: BrandOption[];
    onSwitchBrand?: (id: string) => void;
    onNavigate: (page: string) => void;
}

// ── Priority card ─────────────────────────────────────────────────────────────

const PriorityCard: React.FC<{ priority: TodayPriority; onNavigate: (page: string) => void; ar?: boolean }> = ({ priority, onNavigate, ar }) => {
    const icons: Record<string, string> = {
        inbox:      'fa-inbox',
        approvals:  'fa-check-circle',
        ad_alert:   'fa-exclamation-triangle',
    };
    const colors: Record<string, string> = {
        inbox:      'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
        approvals:  'bg-violet-500/10 text-violet-500 border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
        ad_alert:   'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    };
    const urgentDot = priority.urgent ? (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151b2a] animate-pulse" />
    ) : null;

    return (
        <button
            onClick={() => onNavigate(priority.action)}
            className="relative flex items-center gap-3 rounded-2xl border border-light-border/60 bg-light-card p-4 text-start transition-all duration-200 active:scale-[0.97] dark:border-dark-border/40 dark:bg-dark-card hover:shadow-md"
        >
            <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[priority.type] ?? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 dark:bg-brand-primary/15 dark:text-brand-primary dark:border-brand-primary/30'}`}>
                <i className={`fas ${icons[priority.type] ?? 'fa-bell'} text-base`} />
                {urgentDot}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">{priority.label}</p>
                {priority.urgent && (
                    <p className="mt-0.5 text-xs text-rose-500 dark:text-rose-400 font-medium">
                        {ar ? 'عاجل — يحتاج تدخل الآن' : 'Urgent — needs action now'}
                    </p>
                )}
            </div>
            <i className="fas fa-chevron-left text-xs text-light-text-secondary dark:text-dark-text-secondary rtl:rotate-180" />
        </button>
    );
};

// ── Quick action button ────────────────────────────────────────────────────────

const QuickAction: React.FC<{ icon: string; label: string; color: string; onClick: () => void }> = ({ icon, label, color, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 rounded-2xl border border-light-border/60 bg-light-card p-3 transition-all duration-200 active:scale-90 dark:border-dark-border/40 dark:bg-dark-card hover:shadow-md"
    >
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
            <i className={`fas ${icon} text-base`} />
        </div>
        <span className="text-[11px] font-semibold leading-tight text-center text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    </button>
);

// ── AI Brief card ─────────────────────────────────────────────────────────────

const AiBriefCard: React.FC<{ brief: TodaySummary['ai_brief'] }> = ({ brief }) => {
    if (!brief) return null;

    const items = [
        { icon: 'fa-lightbulb', color: 'text-amber-500 dark:text-amber-400', label: 'فرصة', value: brief.opportunity },
        { icon: 'fa-shield-alt', color: 'text-rose-500 dark:text-rose-400',  label: 'تحذير', value: brief.risk },
        { icon: 'fa-star',       color: 'text-violet-500 dark:text-violet-400', label: 'توصية', value: brief.recommendation },
        { icon: 'fa-bolt',       color: 'text-brand-primary dark:text-blue-400', label: 'الأكشن', value: brief.action },
    ];

    return (
        <div className="rounded-2xl border border-light-border/60 bg-gradient-to-br from-brand-primary/5 via-brand-secondary/5 to-transparent p-4 dark:border-dark-border/40 dark:bg-dark-card/45 backdrop-blur-md">
            <div className="mb-3.5 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-primary/15 dark:bg-brand-primary/20">
                    <i className="fas fa-brain text-xs text-brand-primary dark:text-primary" />
                </div>
                <span className="text-sm font-semibold text-light-text dark:text-dark-text">موجز اليوم من AI</span>
            </div>
            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2.5">
                        <i className={`fas ${item.icon} mt-0.5 w-4 shrink-0 text-sm ${item.color}`} />
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{item.label} </span>
                            <span className="text-xs text-light-text dark:text-dark-text leading-relaxed font-medium">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Skeleton loader ───────────────────────────────────────────────────────────

const Skeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse px-4 pb-24 pt-4">
        <div className="h-20 rounded-2xl bg-light-border/40 dark:bg-dark-border/40" />
        <div className="h-6 w-32 rounded-lg bg-light-border/40 dark:bg-dark-border/40" />
        <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-light-border/40 dark:bg-dark-border/40" />)}
        </div>
        <div className="h-6 w-24 rounded-lg bg-light-border/40 dark:bg-dark-border/40" />
        <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 rounded-2xl bg-light-border/40 dark:bg-dark-border/40" />)}
        </div>
        <div className="h-40 rounded-2xl bg-light-border/40 dark:bg-dark-border/40" />
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const MobileHomePage: React.FC<Props> = ({ brandId, brandName, brands, onSwitchBrand, onNavigate }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [summary, setSummary]           = useState<TodaySummary | null>(null);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [showBrandMenu, setShowBrandMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!showBrandMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowBrandMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showBrandMenu]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchTodaySummary(brandId);
            setSummary(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => { load(); }, [load]);

    const quickActions = [
        { icon: 'fa-reply',         label: ar ? 'رد الآن'         : 'Reply now',      color: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400',       page: 'inbox' },
        { icon: 'fa-check-circle',  label: ar ? 'وافق على محتوى' : 'Approve content', color: 'bg-violet-500/10 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400',   page: 'content-ops' },
        { icon: 'fa-lightbulb',     label: ar ? 'أنشئ فكرة'       : 'New idea',        color: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400',     page: 'idea-ops' },
        { icon: 'fa-microphone',    label: ar ? 'سجل ملاحظة'      : 'Record note',     color: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400', page: 'idea-ops' },
        { icon: 'fa-calendar-alt',  label: ar ? 'راجع التقويم'    : 'Calendar',        color: 'bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400',       page: 'calendar' },
        { icon: 'fa-chart-bar',     label: ar ? 'شوف الأداء'      : 'Performance',     color: 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400',       page: 'analytics' },
    ];

    if (loading) return <Skeleton />;

    if (error) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
                    <i className="fas fa-exclamation-circle text-xl text-rose-500" />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{error}</p>
                <button
                    onClick={load}
                    className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    const stats = summary?.stats;
    const priorities = summary?.priorities ?? [];

    return (
        <div className="pb-24 pt-2" dir={ar ? 'rtl' : 'ltr'}>

            {/* ── Brand header ── */}
            <div className="px-4 pb-4 pt-2">
                <div className="flex items-center justify-between rounded-2xl border border-light-border/60 bg-gradient-to-br from-brand-primary/10 via-brand-secondary/5 to-transparent p-4 dark:border-dark-border/40 dark:bg-dark-card/50 backdrop-blur-md shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'البراند الحالي' : 'Active Brand'}</p>
                        <h1 className="mt-0.5 text-lg font-bold text-light-text dark:text-dark-text">{brandName}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {stats && (
                                <>
                                    <span className="flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {stats.unread_inbox} {ar ? 'رسالة' : 'messages'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                        {stats.pending_approvals} {ar ? 'موافقة' : 'approvals'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        {stats.posts_today} {ar ? 'منشور اليوم' : 'today'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Brand switcher (P3-07) */}
                        {brands && brands.length > 1 && onSwitchBrand && (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setShowBrandMenu(v => !v)}
                                    className="flex h-9 items-center gap-1.5 rounded-xl bg-light-card/85 dark:bg-dark-card/85 px-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary transition-all duration-200 active:scale-90 border border-light-border/60 dark:border-dark-border/40 shadow-sm"
                                >
                                    <i className="fas fa-layer-group text-xs text-brand-primary" />
                                    {ar ? 'تبديل' : 'Switch'}
                                    <i className={`fas fa-chevron-down text-[9px] transition-transform ${showBrandMenu ? 'rotate-180' : ''}`} />
                                </button>
                                {showBrandMenu && (
                                    <div className="absolute end-0 top-11 z-50 w-48 rounded-2xl glass-modal shadow-xl overflow-hidden animate-scale-in">
                                        {brands.map(b => (
                                            <button
                                                key={b.id}
                                                onClick={() => { onSwitchBrand(b.id); setShowBrandMenu(false); }}
                                                className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-all duration-150 active:scale-[0.98] text-start ${
                                                    b.id === brandId
                                                        ? 'bg-brand-primary/10 text-brand-primary font-bold'
                                                        : 'text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg'
                                                }`}
                                            >
                                                {b.id === brandId && <i className="fas fa-check text-[10px] text-brand-primary" />}
                                                <span className="truncate">{b.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={load}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-light-card/85 dark:bg-dark-card/85 text-light-text-secondary dark:text-dark-text-secondary transition-all duration-200 active:scale-90 border border-light-border/60 dark:border-dark-border/40 shadow-sm"
                        >
                            <i className="fas fa-sync-alt text-sm" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Top priorities ── */}
            {priorities.length > 0 && (
                <div className="px-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'الأولويات الآن' : 'Current priorities'}
                    </h2>
                    <div className="space-y-2.5">
                        {priorities.map((p) => (
                            <PriorityCard key={p.type} priority={p} onNavigate={onNavigate} ar={ar} />
                        ))}
                    </div>
                </div>
            )}

            {priorities.length === 0 && (
                <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <i className="fas fa-check-circle text-emerald-500 text-lg" />
                    <p className="text-sm text-light-text dark:text-dark-text">
                        {ar ? 'كل شيء على ما يرام — لا يوجد عناصر عاجلة' : 'All clear — no urgent items right now'}
                    </p>
                </div>
            )}

            {/* ── Quick actions ── */}
            <div className="mt-5 px-4">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? 'أكشن سريع' : 'Quick actions'}
                </h2>
                <div className="grid grid-cols-3 gap-2.5">
                    {quickActions.map((qa) => (
                        <QuickAction
                            key={qa.page + qa.label}
                            icon={qa.icon}
                            label={qa.label}
                            color={qa.color}
                            onClick={() => onNavigate(qa.page)}
                        />
                    ))}
                </div>
            </div>

            {/* ── AI Brief ── */}
            {summary?.ai_brief && (
                <div className="mt-5 px-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'موجز AI اليومي' : "Today's AI brief"}
                    </h2>
                    <AiBriefCard brief={summary.ai_brief} />
                </div>
            )}

            {/* ── Ad alerts strip ── */}
            {(summary?.ad_alerts?.length ?? 0) > 0 && (
                <div className="mt-5 px-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'تنبيهات الإعلانات' : 'Ad alerts'}
                    </h2>
                    <div className="space-y-2">
                        {summary!.ad_alerts.map((ad) => (
                            <button
                                key={ad.id}
                                onClick={() => onNavigate('ads-ops')}
                                className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 p-3.5 text-start transition-all duration-200 active:scale-[0.98] hover:shadow-md"
                            >
                                <i className="fas fa-exclamation-triangle text-rose-500 text-base shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{ad.name}</p>
                                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                                        ROAS: {ad.roas?.toFixed(2) ?? '--'} &nbsp;·&nbsp;
                                        {ar ? 'الإنفاق' : 'Spend'}: {ad.spend?.toFixed(0)} / {ad.budget?.toFixed(0)}
                                    </p>
                                </div>
                                <i className="fas fa-chevron-left text-xs text-light-text-secondary dark:text-dark-text-secondary rtl:rotate-180 shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
