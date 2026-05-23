// components/pages/BrandAgentPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// لوحة تحكم وكيل البراند — إعدادات الوكيل + الشيفتات + الإحصائيات
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NotificationType, BrandHubProfile } from '../../types';
import {
    BrandAgentConfig, BrandAgentDialect, BrandAgentStats,
    DailyReplyStat, RecentAgentLog,
    getBrandAgentConfig, saveBrandAgentConfig,
    getBrandAgentStats, getDailyReplyStats, getRecentAgentLogs,
    DEFAULT_BRAND_AGENT_CONFIG, startShift, endShift,
} from '../../services/brandAgentService';
import { getBotPersonas } from '../../services/smartBotService';
import { BotPersona } from '../../types';
import { PageScaffold, PageSection } from '../shared/PageScaffold';

interface BrandAgentPageProps {
    brandId: string;
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
    initialTab?: 'settings' | 'shift' | 'stats';
}

// ── Dialect options ─────────────────────────────────────────────────────────

const DIALECT_OPTIONS: { value: BrandAgentDialect; label: string; flag: string; desc: string }[] = [
    { value: 'gulf',            label: 'خليجي',        flag: '🇸🇦', desc: 'وايد، زين، أبي، مشكور' },
    { value: 'egyptian',        label: 'مصري',          flag: '🇪🇬', desc: 'عايز، كده، يسطا، بالظبط' },
    { value: 'levantine',       label: 'شامي',          flag: '🇸🇾', desc: 'شو، هيك، يعني، والله' },
    { value: 'modern_standard', label: 'فصحى مبسطة',   flag: '📖', desc: 'عربية واضحة ورسمية' },
    { value: 'english',         label: 'إنجليزي',       flag: '🇬🇧', desc: 'English formal / friendly' },
    { value: 'bilingual',       label: 'ثنائي اللغة',  flag: '🌐', desc: 'عربي مع ردّ بلغة العميل' },
];

const renderDialectIcon = (value: BrandAgentDialect) => {
    switch (value) {
        case 'gulf':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
                    SA
                </span>
            );
        case 'egyptian':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20">
                    EG
                </span>
            );
        case 'levantine':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/20">
                    SY
                </span>
            );
        case 'modern_standard':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
                    📖
                </span>
            );
        case 'english':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20">
                    EN
                </span>
            );
        case 'bilingual':
            return (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/20">
                    🌐
                </span>
            );
        default:
            return null;
    }
};

// ── Toggle component ────────────────────────────────────────────────────────

const Toggle: React.FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    size?: 'sm' | 'md';
}> = ({ checked, onChange, size = 'md' }) => {
    const btnSize = size === 'sm' ? 'h-4 w-8' : 'h-5 w-10';
    const dotSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    const activeClass = checked ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border';
    const dotPosition = size === 'sm' 
        ? (checked ? 'left-[18px]' : 'left-0.5') 
        : (checked ? 'left-[22px]' : 'left-0.5');

    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${btnSize} ${activeClass}`}
        >
            <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${dotSize} ${dotPosition}`} />
        </button>
    );
};

// ── KPI Card ────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string; value: number | string; icon: string;
    color: string; bg: string; gradient: string; sub?: string;
}> = ({ label, value, icon, color, bg, gradient, sub }) => (
    <div className={`relative overflow-hidden bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 group hover:shadow-lg transition-all duration-300`}>
        <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        <div className="relative">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} mb-3`}>
                <i className={`fas ${icon} text-sm ${color}`} />
            </div>
            <p className="text-2xl font-bold text-light-text dark:text-dark-text leading-none mb-1">{value}</p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
            {sub && <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ── Main Component ──────────────────────────────────────────────────────────

export const BrandAgentPage: React.FC<BrandAgentPageProps> = ({
    brandId, brandProfile, addNotification, onNavigate, initialTab = 'settings',
}) => {
    const activeTab = initialTab;
    const [config, setConfig] = useState<BrandAgentConfig>({ ...DEFAULT_BRAND_AGENT_CONFIG, brandId });
    const [stats, setStats] = useState<BrandAgentStats | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyReplyStat[]>([]);
    const [recentLogs, setRecentLogs] = useState<RecentAgentLog[]>([]);
    const [personas, setPersonas] = useState<BotPersona[]>([]);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [escalationInput, setEscalationInput] = useState('');
    const [shiftLoading, setShiftLoading] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [moderatorInput, setModeratorInput] = useState('');

    // Live timer for shift
    const [liveTimer, setLiveTimer] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);



    // ── Load base data ────────────────────────────────────────────────────
    useEffect(() => {
        if (!brandId) return;
        setLoading(true);
        Promise.all([
            getBrandAgentConfig(brandId),
            getBrandAgentStats(brandId),
            getBotPersonas(brandId),
        ]).then(([cfg, st, bots]) => {
            setConfig(cfg);
            setStats(st);
            setPersonas(bots);
        }).catch(() => null)
          .finally(() => setLoading(false));
    }, [brandId]);

    // ── Load daily stats when stats tab opens ─────────────────────────────
    useEffect(() => {
        if (activeTab !== 'stats') return;
        setStatsLoading(true);
        Promise.all([
            getDailyReplyStats(brandId),
            getRecentAgentLogs(brandId, 15),
        ]).then(([daily, logs]) => {
            setDailyStats(daily);
            setRecentLogs(logs);
        }).catch(() => null)
          .finally(() => setStatsLoading(false));
    }, [activeTab, brandId]);

    // ── Live shift timer ──────────────────────────────────────────────────
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        const isHuman = config.shiftMode === 'human';
        if (!isHuman || !config.shiftStartedAt) { setLiveTimer(''); return; }
        const tick = () => {
            const diff = Date.now() - new Date(config.shiftStartedAt!).getTime();
            const s = Math.floor(diff / 1000);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setLiveTimer([h > 0 ? String(h).padStart(2,'0') : null, String(m).padStart(2,'0'), String(sec).padStart(2,'0')].filter(Boolean).join(':'));
        };
        tick();
        timerRef.current = setInterval(tick, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [config.shiftMode, config.shiftStartedAt]);

    // ── Save config ───────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const updated = await saveBrandAgentConfig(brandId, config);
            setConfig(updated);
            addNotification(NotificationType.Success, '✅ تم حفظ إعدادات الوكيل');
        } catch {
            addNotification(NotificationType.Error, 'فشل حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    }, [brandId, config, addNotification]);

    // ── Shift actions ─────────────────────────────────────────────────────
    const handleStartShift = async () => {
        if (!moderatorInput.trim()) return;
        setShiftLoading(true);
        try {
            const updated = await startShift(brandId, moderatorInput.trim());
            setConfig(updated);
            addNotification(NotificationType.Info, `👤 ${moderatorInput.trim()} استلم الشيفت`);
            setShowShiftModal(false);
            setModeratorInput('');
        } catch { addNotification(NotificationType.Error, 'فشل استلام الشيفت'); }
        finally { setShiftLoading(false); }
    };

    const handleEndShift = async () => {
        setShiftLoading(true);
        try {
            const updated = await endShift(brandId);
            setConfig(updated);
            addNotification(NotificationType.Success, '🤖 البوت عاد للعمل التلقائي');
        } catch { addNotification(NotificationType.Error, 'فشل تسليم الشيفت'); }
        finally { setShiftLoading(false); }
    };

    // ── Escalation keywords ───────────────────────────────────────────────
    const addEscalationKeyword = () => {
        const kw = escalationInput.trim();
        if (!kw || config.escalationKeywords.includes(kw)) return;
        setConfig(c => ({ ...c, escalationKeywords: [...c.escalationKeywords, kw] }));
        setEscalationInput('');
    };
    const removeEscalationKeyword = (kw: string) =>
        setConfig(c => ({ ...c, escalationKeywords: c.escalationKeywords.filter(k => k !== kw) }));

    const isHumanShift = config.shiftMode === 'human';

    const TABS = [
        { id: 'settings' as const, icon: 'fa-sliders',      label: 'إعدادات الوكيل' },
        { id: 'shift'    as const, icon: 'fa-user-shield',  label: 'الشيفتات' },
        { id: 'stats'    as const, icon: 'fa-chart-bar',    label: 'الإحصائيات' },
    ];

    const handleTabChange = (tabId: 'settings' | 'shift' | 'stats') => {
        onNavigate?.(`brand-agent/${tabId}`);
    };

    return (
        <PageScaffold
            kicker="Brand Agent"
            title="وكيل البراند الذكي"
            description={`أدر الوكيل الذكي الذي يرد على رسائل وتعليقات ${brandProfile.brandName} بنبرة البراند تلقائياً`}
            stats={stats ? [
                { label: 'إجمالي الردود', value: stats.totalReplies.toString(),      icon: 'fa-reply' },
                { label: 'تلقائي',         value: stats.autoReplies.toString(),      icon: 'fa-robot',                    tone: stats.autoReplies > 0 ? 'text-green-500' : undefined },
                { label: 'مقترح',          value: stats.suggestedReplies.toString(), icon: 'fa-wand-magic-sparkles' },
                { label: 'تصعيد',          value: stats.escalations.toString(),      icon: 'fa-triangle-exclamation',    tone: stats.escalations > 0 ? 'text-orange-500' : undefined },
            ] : []}
        >
            <PageSection className="pt-0">

                {/* ── Shift Active Banner (top of page) ───────────── */}
                {isHumanShift && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 mb-5">
                        <span className="relative flex h-3 w-3 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                                وضع المساعد نشط
                                {liveTimer && <span className="ms-2 font-mono text-xs bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-full">{liveTimer}</span>}
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                                {config.shiftModeratorName} يتابع المحادثات — البوت يقترح فقط
                            </p>
                        </div>
                        <button
                            onClick={handleEndShift}
                            disabled={shiftLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 transition"
                        >
                            <i className="fas fa-robot text-[10px]" />
                            {shiftLoading ? '...' : 'تسليم للبوت'}
                        </button>
                    </div>
                )}

                {/* Tab bar */}
                <div className="flex gap-1 border-b border-light-border dark:border-dark-border mb-6">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors
                                ${activeTab === tab.id
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            <i className={`fas ${tab.icon} text-xs`} />
                            {tab.label}
                            {tab.id === 'shift' && isHumanShift && (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>

                {/* ════════════════ SETTINGS TAB ════════════════ */}
                {activeTab === 'settings' && (
                    <div className="max-w-2xl space-y-5">

                        {/* Auto-Reply Mode */}
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                    <i className="fas fa-robot text-white text-sm" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-light-text dark:text-dark-text">نموذج الرد</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">حدد متى يرد الوكيل تلقائياً</p>
                                </div>
                            </div>
                            <div className="space-y-3 divide-y divide-light-border dark:divide-dark-border">
                                {[
                                    { key: 'autoReplyComments'  as const, label: 'رد تلقائي على التعليقات',     desc: 'Facebook, Instagram, إعلانات', icon: 'fa-comment',              color: 'text-blue-500'   },
                                    { key: 'autoReplyDMs'       as const, label: 'رد تلقائي على الرسائل الخاصة', desc: 'DM — يُنصح بتركها مقترحاً',   icon: 'fa-envelope',             color: 'text-violet-500' },
                                    { key: 'autoReplySuggested' as const, label: 'اقتراح الردود دائماً',          desc: 'يظهر الاقتراحات حتى مع التلقائي', icon: 'fa-wand-magic-sparkles', color: 'text-amber-500'  },
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between pt-3 first:pt-0">
                                        <div className="flex items-center gap-3">
                                            <i className={`fas ${item.icon} text-sm ${item.color}`} />
                                            <div>
                                                <p className="text-sm font-semibold text-light-text dark:text-dark-text">{item.label}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.desc}</p>
                                            </div>
                                        </div>
                                        <Toggle checked={Boolean(config[item.key])} onChange={v => setConfig(c => ({ ...c, [item.key]: v }))} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dialect */}
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                                    <i className="fas fa-language text-white text-sm" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-light-text dark:text-dark-text">لهجة البراند</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">اختر كيف يتحدث الوكيل</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {DIALECT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setConfig(c => ({ ...c, dialect: opt.value }))}
                                        className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-start transition-all w-full
                                            ${config.dialect === opt.value
                                                ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20'
                                                : 'border-light-border dark:border-dark-border hover:border-brand-primary/30'}`}
                                    >
                                        {renderDialectIcon(opt.value)}
                                        <div className="space-y-0.5 text-start">
                                            <span className="text-xs font-bold text-light-text dark:text-dark-text block">{opt.label}</span>
                                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-tight block">{opt.desc}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary block mb-1">
                                    ملاحظة مخصصة عن الأسلوب (اختياري)
                                </label>
                                <input
                                    value={config.customDialectNote || ''}
                                    onChange={e => setConfig(c => ({ ...c, customDialectNote: e.target.value }))}
                                    placeholder="مثال: استخدم الإيموجي أحياناً، تجنب الكلمات الرسمية..."
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                />
                            </div>
                        </div>

                        {/* Active Persona Picker */}
                        {personas.length > 0 && (
                            <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                        <i className="fas fa-masks-theater text-white text-sm" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-light-text dark:text-dark-text">الشخصية النشطة</h3>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">اربط الوكيل بأحد بوتات SmartBot</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {/* None option */}
                                    <button
                                        onClick={() => setConfig(c => ({ ...c, activePersonaId: null }))}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-start transition-all ${
                                            !config.activePersonaId
                                                ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20'
                                                : 'border-light-border dark:border-dark-border hover:border-brand-primary/30'
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-light-bg dark:bg-dark-bg flex items-center justify-center text-sm">🧩</div>
                                        <div>
                                            <p className="text-xs font-bold text-light-text dark:text-dark-text">بدون شخصية محددة</p>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">يستخدم إعدادات البراند مباشرة</p>
                                        </div>
                                        {!config.activePersonaId && <i className="fas fa-check text-brand-primary text-xs ms-auto" />}
                                    </button>
                                    {personas.filter(p => p.status === 'active').map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setConfig(c => ({ ...c, activePersonaId: p.id }))}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-start transition-all ${
                                                config.activePersonaId === p.id
                                                    ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20'
                                                    : 'border-light-border dark:border-dark-border hover:border-brand-primary/30'
                                            }`}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-light-bg dark:bg-dark-bg flex items-center justify-center text-sm">{p.avatarEmoji}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">{p.name}</p>
                                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{p.scenario}</p>
                                            </div>
                                            {config.activePersonaId === p.id && <i className="fas fa-check text-brand-primary text-xs" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Escalation Keywords */}
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                                    <i className="fas fa-triangle-exclamation text-white text-sm" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-light-text dark:text-dark-text">كلمات التصعيد</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">عند وجودها → البوت يوقف الرد التلقائي</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {config.escalationKeywords.map(kw => (
                                    <span key={kw} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                        {kw}
                                        <button onClick={() => removeEscalationKeyword(kw)} className="hover:opacity-70">
                                            <i className="fas fa-times text-[9px]" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={escalationInput}
                                    onChange={e => setEscalationInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addEscalationKeyword()}
                                    placeholder="أضف كلمة تصعيد..."
                                    className="flex-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                />
                                <button
                                    onClick={addEscalationKeyword}
                                    className="px-4 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition border border-red-200 dark:border-red-800"
                                >
                                    إضافة
                                </button>
                            </div>
                        </div>

                        {/* Working Hours */}
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                        <i className="fas fa-clock text-white text-sm" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-light-text dark:text-dark-text">ساعات العمل</h3>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">الرد التلقائي يعمل فقط في هذه الساعات</p>
                                    </div>
                                </div>
                                <Toggle checked={config.workingHoursEnabled} onChange={v => setConfig(c => ({ ...c, workingHoursEnabled: v }))} />
                            </div>
                            {config.workingHoursEnabled && (
                                <div className="grid grid-cols-3 gap-3 pt-2">
                                    {[
                                        { label: 'من', key: 'workingHoursStart' as const },
                                        { label: 'إلى', key: 'workingHoursEnd' as const },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary block mb-1">{f.label}</label>
                                            <input
                                                type="number" min="0" max="23"
                                                value={config[f.key]}
                                                onChange={e => setConfig(c => ({ ...c, [f.key]: Number(e.target.value) }))}
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary block mb-1">المنطقة الزمنية</label>
                                        <select
                                            value={config.workingHoursTimezone}
                                            onChange={e => setConfig(c => ({ ...c, workingHoursTimezone: e.target.value }))}
                                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                        >
                                            <option value="Asia/Riyadh">الرياض (AST+3)</option>
                                            <option value="Asia/Dubai">دبي (GST+4)</option>
                                            <option value="Africa/Cairo">القاهرة (EET+2)</option>
                                            <option value="Asia/Beirut">بيروت (EET+2)</option>
                                            <option value="Asia/Kuwait">الكويت (AST+3)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Save */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-primary to-violet-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-brand-primary/20"
                        >
                            {saving ? <><i className="fas fa-spinner fa-spin me-2" />جاري الحفظ...</> : <><i className="fas fa-save me-2" />حفظ الإعدادات</>}
                        </button>
                    </div>
                )}

                {/* ════════════════ SHIFT TAB ════════════════ */}
                {activeTab === 'shift' && (
                    <div className="max-w-2xl space-y-5">

                        {/* Live Status Card */}
                        <div className={`rounded-2xl p-6 border ${
                            isHumanShift
                                ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800'
                                : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
                        }`}>
                            <div className="flex items-center gap-4">
                                <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                                    isHumanShift ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-green-100 dark:bg-green-900/40'
                                }`}>
                                    {isHumanShift ? '👤' : '🤖'}
                                    {isHumanShift && (
                                        <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-white dark:border-dark-card">
                                            <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75" />
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className={`font-bold text-xl ${isHumanShift ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>
                                        {isHumanShift ? 'وضع المساعد نشط' : 'الوكيل يعمل تلقائياً'}
                                    </p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                        {isHumanShift
                                            ? `${config.shiftModeratorName} يتابع المحادثات`
                                            : 'الوكيل يرد تلقائياً حسب الإعدادات'}
                                    </p>
                                    {isHumanShift && liveTimer && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <i className="fas fa-stopwatch text-orange-500 text-xs" />
                                            <span className="font-mono text-lg font-bold text-orange-600 dark:text-orange-300">{liveTimer}</span>
                                            <span className="text-xs text-orange-500">مدة الشيفت</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                {isHumanShift ? (
                                    <button
                                        onClick={handleEndShift}
                                        disabled={shiftLoading}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50 transition"
                                    >
                                        <i className="fas fa-robot" />
                                        {shiftLoading ? 'جاري التسليم...' : 'تسليم الشيفت للبوت'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowShiftModal(true)}
                                        disabled={shiftLoading}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-orange-500/20"
                                    >
                                        <i className="fas fa-user-shield" />
                                        {shiftLoading ? '...' : 'استلام الشيفت (تعطيل الردود التلقائية)'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* How Shift Works */}
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                            <h3 className="font-bold text-light-text dark:text-dark-text mb-4 text-sm">كيف يعمل الشيفت؟</h3>
                            <div className="space-y-4">
                                {[
                                    { step: '1', icon: 'fa-user-plus',           color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800',
                                      title: 'استلام الشيفت', desc: 'المودريتور يضغط "استلام" ← البوت يتوقف عن الإرسال التلقائي تماماً ويدخل وضع المساعد' },
                                    { step: '2', icon: 'fa-wand-magic-sparkles', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800',
                                      title: 'وضع المساعد',   desc: 'البوت يقترح ردوداً ذكية 3 خيارات — المودريتور يراجع ويختار أو يكتب رده الخاص' },
                                    { step: '3', icon: 'fa-robot',               color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800',
                                      title: 'تسليم الشيفت',  desc: 'المودريتور يضغط "تسليم" ← البوت يعود للعمل التلقائي الكامل فوراً' },
                                ].map((item) => (
                                    <div key={item.step} className={`flex items-start gap-3 p-3 rounded-xl border ${item.border} ${item.bg}`}>
                                        <div className="w-7 h-7 rounded-xl bg-white dark:bg-dark-card flex items-center justify-center flex-shrink-0 shadow-sm">
                                            <i className={`fas ${item.icon} text-xs ${item.color}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-light-text dark:text-dark-text">{item.title}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mt-0.5">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Go to Inbox */}
                        <button
                            onClick={() => onNavigate?.('inbox')}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-sm font-semibold hover:bg-brand-primary/20 transition w-full justify-center"
                        >
                            <i className="fas fa-inbox text-xs" />
                            انتقل للصندوق لاستخدام الوكيل على المحادثات الحقيقية
                        </button>
                    </div>
                )}

                {/* ════════════════ STATS TAB ════════════════ */}
                {activeTab === 'stats' && (
                    <div className="space-y-5">

                        {/* Loading */}
                        {statsLoading && (
                            <div className="text-center py-12">
                                <i className="fas fa-spinner fa-spin text-brand-primary text-2xl" />
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">جاري تحليل البيانات...</p>
                            </div>
                        )}

                        {!statsLoading && (
                            <>
                            {/* Date label */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                                <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary px-2 whitespace-nowrap">
                                    <i className="fas fa-calendar-alt me-1" />آخر 30 يوم — بيانات حقيقية
                                </span>
                                <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                            </div>

                            {/* KPI Cards */}
                            {stats && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <KpiCard label="إجمالي الردود"  value={stats.totalReplies}     icon="fa-reply"                gradient="bg-gradient-to-br from-brand-primary/5 to-violet-500/5" color="text-brand-primary" bg="bg-brand-primary/10"                      sub="آخر 30 يوم" />
                                    <KpiCard label="تلقائي"          value={stats.autoReplies}      icon="fa-robot"                gradient="bg-gradient-to-br from-green-500/5 to-emerald-500/5"   color="text-green-600"    bg="bg-green-100 dark:bg-green-900/20"        sub="بدون تدخل بشري" />
                                    <KpiCard label="مقترح"           value={stats.suggestedReplies} icon="fa-wand-magic-sparkles"  gradient="bg-gradient-to-br from-violet-500/5 to-purple-500/5"   color="text-violet-600"   bg="bg-violet-100 dark:bg-violet-900/20"      sub="راجعه فريقك" />
                                    <KpiCard label="تصعيد"           value={stats.escalations}      icon="fa-triangle-exclamation" gradient="bg-gradient-to-br from-orange-500/5 to-amber-500/5"   color="text-orange-600"   bg="bg-orange-100 dark:bg-orange-900/20"      sub="يحتاج متابعة" />
                                </div>
                            )}

                            {/* Today highlight */}
                            {stats && (
                                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-primary/30">
                                        <span className="text-xl font-bold text-white">{stats.todayReplies}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-light-text dark:text-dark-text">{stats.todayReplies} رد اليوم</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            الوكيل في وضع {config.shiftMode === 'bot' ? 'تلقائي 🤖' : `مساعد 👤 (${config.shiftModeratorName})`}
                                        </p>
                                    </div>
                                    {stats.totalReplies > 0 && (
                                        <div className="ms-auto text-end">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">معدل التلقائي</p>
                                            <p className="font-bold text-green-600 text-lg">
                                                {Math.round((stats.autoReplies / Math.max(stats.totalReplies, 1)) * 100)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 7-day chart */}
                            {dailyStats.length > 0 && (
                                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                                    <p className="font-bold text-light-text dark:text-dark-text mb-4 text-sm">الردود اليومية — آخر 7 أيام</p>
                                    {(() => {
                                        const maxVal = Math.max(...dailyStats.map(d => d.total), 1);
                                        const isToday = (i: number) => i === dailyStats.length - 1;
                                        return (
                                            <div className="flex items-end gap-1 h-32">
                                                {dailyStats.map((day, i) => (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                                        <div className="w-full flex flex-col justify-end h-24 gap-0.5">
                                                            {/* Escalated */}
                                                            {day.escalated > 0 && (
                                                                <div
                                                                    className="w-full rounded-sm bg-orange-400 transition-all"
                                                                    style={{ height: `${(day.escalated / maxVal) * 100}%` }}
                                                                    title={`تصعيد: ${day.escalated}`}
                                                                />
                                                            )}
                                                            {/* Suggested */}
                                                            {day.suggested > 0 && (
                                                                <div
                                                                    className="w-full rounded-sm bg-violet-400 transition-all"
                                                                    style={{ height: `${(day.suggested / maxVal) * 100}%` }}
                                                                    title={`مقترح: ${day.suggested}`}
                                                                />
                                                            )}
                                                            {/* Auto */}
                                                            {day.auto > 0 && (
                                                                <div
                                                                    className="w-full rounded-sm bg-emerald-400 transition-all"
                                                                    style={{ height: `${(day.auto / maxVal) * 100}%` }}
                                                                    title={`تلقائي: ${day.auto}`}
                                                                />
                                                            )}
                                                            {day.total === 0 && (
                                                                <div className="w-full rounded-sm bg-light-border dark:bg-dark-border" style={{ height: '4px' }} />
                                                            )}
                                                        </div>
                                                        <p className={`text-[9px] font-medium truncate w-full text-center ${isToday(i) ? 'text-brand-primary font-bold' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                                            {isToday(i) ? 'اليوم' : day.date.slice(0, 3)}
                                                        </p>
                                                        <p className={`text-[9px] ${isToday(i) ? 'text-brand-primary font-bold' : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'}`}>
                                                            {day.dateShort}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    {/* Legend */}
                                    <div className="flex items-center gap-4 mt-3 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />تلقائي</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block" />مقترح</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />تصعيد</span>
                                    </div>
                                </div>
                            )}

                            {/* Effectiveness bars */}
                            {stats && stats.totalReplies > 0 && (
                                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                                    <p className="font-bold text-light-text dark:text-dark-text mb-4 text-sm">فعالية الوكيل</p>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'ردود تلقائية',  value: stats.autoReplies,      total: stats.totalReplies, color: 'bg-gradient-to-r from-green-400 to-emerald-500',  textColor: 'text-green-600' },
                                            { label: 'ردود مقترحة',   value: stats.suggestedReplies, total: stats.totalReplies, color: 'bg-gradient-to-r from-violet-400 to-purple-500',  textColor: 'text-violet-600' },
                                            { label: 'تصعيدات',        value: stats.escalations,      total: stats.totalReplies, color: 'bg-gradient-to-r from-orange-400 to-amber-500',  textColor: 'text-orange-600' },
                                        ].map(bar => {
                                            const pct = Math.round((bar.value / bar.total) * 100);
                                            return (
                                                <div key={bar.label}>
                                                    <div className="flex justify-between text-xs mb-1.5">
                                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">{bar.label}</span>
                                                        <span className={`font-bold ${bar.textColor}`}>{bar.value} ({pct}%)</span>
                                                    </div>
                                                    <div className="h-2.5 bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-700 ${bar.color}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Recent logs */}
                            {recentLogs.length > 0 && (
                                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                                    <p className="font-bold text-light-text dark:text-dark-text mb-4 text-sm">آخر نشاطات الوكيل</p>
                                    <div className="space-y-2">
                                        {recentLogs.map(log => {
                                            const meta: Record<RecentAgentLog['action'], {icon: string; color: string; bg: string; label: string}> = {
                                                auto_replied: { icon: 'fa-robot',               color: 'text-green-600',   bg: 'bg-green-100 dark:bg-green-900/20',   label: 'رد تلقائي' },
                                                suggested:    { icon: 'fa-wand-magic-sparkles', color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/20', label: 'اقتراح' },
                                                escalated:    { icon: 'fa-triangle-exclamation',color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20', label: 'تصعيد' },
                                                skipped:      { icon: 'fa-forward',              color: 'text-gray-500',   bg: 'bg-gray-100 dark:bg-gray-900/20',     label: 'تخطي' },
                                            };
                                            const m = meta[log.action] || {
                                                icon: 'fa-info-circle',
                                                color: 'text-gray-500',
                                                bg: 'bg-gray-100 dark:bg-gray-900/20',
                                                label: log.action || 'نشاط غير معروف',
                                            };
                                            const timeAgo = (() => {
                                                const diff = (Date.now() - new Date(log.createdAt).getTime()) / 1000;
                                                if (diff < 60) return 'الآن';
                                                if (diff < 3600) return `${Math.floor(diff/60)}د`;
                                                if (diff < 86400) return `${Math.floor(diff/3600)}س`;
                                                return `${Math.floor(diff/86400)}ي`;
                                            })();
                                            return (
                                                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-light-bg dark:hover:bg-dark-bg transition">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${m.bg}`}>
                                                        <i className={`fas ${m.icon} text-[10px] ${m.color}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-bold ${m.color}`}>{m.label}</span>
                                                            <span className="text-[10px] text-light-text-secondary/50 dark:text-dark-text-secondary/50">{timeAgo}</span>
                                                        </div>
                                                        {log.replyText && (
                                                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5">
                                                                {log.replyText}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* No data empty state */}
                            {(!stats || stats.totalReplies === 0) && recentLogs.length === 0 && !statsLoading && (
                                <div className="text-center py-16 bg-light-card dark:bg-dark-card rounded-2xl border border-dashed border-light-border dark:border-dark-border">
                                    <div className="text-5xl mb-4">📊</div>
                                    <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">لا توجد بيانات بعد</p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto mb-4">
                                        فعّل الوكيل وسيبدأ تجميع الإحصائيات تلقائياً من أول رد
                                    </p>
                                    <button
                                        onClick={() => handleTabChange('settings')}
                                        className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:opacity-90 transition"
                                    >
                                        اذهب للإعدادات
                                    </button>
                                </div>
                            )}
                            </>
                        )}
                    </div>
                )}
            </PageSection>

            {/* ── Start Shift Modal ─────────────────────────────────────── */}
            {showShiftModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl border border-light-border dark:border-dark-border w-full max-w-sm mx-4 overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl">👤</div>
                                <div>
                                    <h3 className="font-bold text-light-text dark:text-dark-text">استلام الشيفت</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">البوت سيتحول لوضع المساعد فقط</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">اسمك (المودريتور)</label>
                                    <input
                                        value={moderatorInput}
                                        onChange={e => setModeratorInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleStartShift()}
                                        placeholder="مثال: أحمد المودريتور"
                                        autoFocus
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-light-text dark:text-dark-text"
                                    />
                                </div>
                                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-300 space-y-1">
                                    <p className="font-semibold">ما الذي سيحدث:</p>
                                    <p>• البوت يتوقف عن الرد التلقائي فوراً</p>
                                    <p>• يستمر في اقتراح ردود ذكية لمساعدتك</p>
                                    <p>• يظهر عداد مباشر لمدة الشيفت</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 p-4 border-t border-light-border dark:border-dark-border">
                            <button
                                onClick={() => { setShowShiftModal(false); setModeratorInput(''); }}
                                className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleStartShift}
                                disabled={!moderatorInput.trim() || shiftLoading}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition"
                            >
                                {shiftLoading ? <i className="fas fa-spinner fa-spin" /> : 'استلام الشيفت'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageScaffold>
    );
};
