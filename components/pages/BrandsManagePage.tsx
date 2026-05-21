import React, { useState, useEffect } from 'react';
import { Brand } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyBrands } from '../shared/EmptyState';
import { getBrandHubProfile } from '../../services/brandHubService';
import { getSocialAccounts } from '../../services/socialAccountService';
import { getBrandKnowledge } from '../../services/brandKnowledgeService';
import { addBrand } from '../../services/brandService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandIntelligence {
    profileScore: number;    // 0-100
    hasVoice: boolean;
    hasAudience: boolean;
    hasKnowledge: boolean;
    loading: boolean;
}

interface BrandsManagePageProps {
    brands: Brand[];
    activeBrand: Brand | null;
    onAddBrand: () => void;
    onSwitchBrand: (brandId: string) => void;
    onDeleteBrand: (brandId: string) => Promise<void>;
    onRenameBrand: (brandId: string, newName: string) => Promise<void>;
    onBrandsRefresh?: () => void;
    onNavigate?: (page: string) => void;
}

// ─── Industry label helpers ───────────────────────────────────────────────────

const INDUSTRY_LABELS: Record<string, { ar: string; icon: string; color: string }> = {
    'E-commerce':          { ar: 'تجارة إلكترونية',   icon: 'fa-bag-shopping',   color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'     },
    'Food & Beverage':     { ar: 'مطاعم وأغذية',       icon: 'fa-utensils',       color: 'text-orange-400 bg-orange-500/10 border-orange-500/20'},
    'Fashion & Apparel':   { ar: 'أزياء وملابس',       icon: 'fa-shirt',          color: 'text-pink-400 bg-pink-500/10 border-pink-500/20'      },
    'Health & Wellness':   { ar: 'صحة ولياقة',         icon: 'fa-heart-pulse',    color: 'text-red-400 bg-red-500/10 border-red-500/20'         },
    'Technology':          { ar: 'تقنية',              icon: 'fa-microchip',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'      },
    'Real Estate':         { ar: 'عقارات',             icon: 'fa-building',       color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'},
    'Education':           { ar: 'تعليم',              icon: 'fa-graduation-cap', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20'},
    'Beauty & Cosmetics':  { ar: 'جمال وتجميل',       icon: 'fa-spa',            color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'      },
    'Travel & Tourism':    { ar: 'سياحة وسفر',        icon: 'fa-plane',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20'         },
    'Finance & Banking':   { ar: 'مالية ومصرفية',     icon: 'fa-landmark',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'},
    'Healthcare':          { ar: 'رعاية صحية',         icon: 'fa-stethoscope',    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'      },
    'Automotive':          { ar: 'سيارات',             icon: 'fa-car',            color: 'text-slate-400 bg-slate-500/10 border-slate-500/20'   },
    'Entertainment':       { ar: 'ترفيه',              icon: 'fa-film',           color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'},
    'Sports & Fitness':    { ar: 'رياضة وتمارين',     icon: 'fa-dumbbell',       color: 'text-green-400 bg-green-500/10 border-green-500/20'   },
    'Non-Profit':          { ar: 'منظمة غير ربحية',   icon: 'fa-handshake',      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'   },
    'Other':               { ar: 'أخرى',              icon: 'fa-grid-2',         color: 'text-gray-400 bg-gray-500/10 border-gray-500/20'      },
};

const COUNTRY_NAMES: Record<string, { ar: string; flag: string }> = {
    SA: { ar: 'السعودية',         flag: '🇸🇦' },
    AE: { ar: 'الإمارات',         flag: '🇦🇪' },
    EG: { ar: 'مصر',             flag: '🇪🇬' },
    KW: { ar: 'الكويت',          flag: '🇰🇼' },
    QA: { ar: 'قطر',             flag: '🇶🇦' },
    BH: { ar: 'البحرين',         flag: '🇧🇭' },
    OM: { ar: 'عُمان',           flag: '🇴🇲' },
    JO: { ar: 'الأردن',          flag: '🇯🇴' },
    LB: { ar: 'لبنان',           flag: '🇱🇧' },
    MA: { ar: 'المغرب',          flag: '🇲🇦' },
    GB: { ar: 'بريطانيا',        flag: '🇬🇧' },
    US: { ar: 'الولايات المتحدة',flag: '🇺🇸' },
};

// ─── Intelligence Score Meter ─────────────────────────────────────────────────

const IntelligenceMeter: React.FC<{ score: number; loading: boolean }> = ({ score, loading }) => {
    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-brand-primary/30 rounded-full animate-pulse" />
                </div>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-6">—</span>
            </div>
        );
    }
    const color = score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400';
    const textColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className={`text-xs font-bold ${textColor} w-6 text-right`}>{score}</span>
        </div>
    );
};

// ─── Duplicate Confirm Modal ──────────────────────────────────────────────────

const DuplicateBrandModal: React.FC<{
    sourceBrand: Brand;
    ar: boolean;
    onConfirm: (name: string, country: string) => Promise<void>;
    onClose: () => void;
}> = ({ sourceBrand, ar, onConfirm, onClose }) => {
    const defaultName = ar ? `${sourceBrand.name} (نسخة)` : `${sourceBrand.name} (Copy)`;
    const [name,    setName]    = useState(defaultName);
    const [country, setCountry] = useState(sourceBrand.country ?? '');
    const [saving,  setSaving]  = useState(false);

    const handleConfirm = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try { await onConfirm(name.trim(), country); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-dark-border bg-dark-card shadow-2xl">
                <div className="flex items-center gap-3 border-b border-dark-border px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/15">
                        <i className="fas fa-copy text-brand-secondary text-sm" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">{ar ? 'استنساخ البراند' : 'Duplicate Brand'}</p>
                        <p className="text-xs text-dark-text-secondary">{sourceBrand.name}</p>
                    </div>
                    <button onClick={onClose} className="ms-auto flex h-7 w-7 items-center justify-center rounded-lg border border-dark-border text-dark-text-secondary hover:text-white transition-colors">
                        <i className="fas fa-xmark text-xs" />
                    </button>
                </div>
                <div className="px-5 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-dark-text-secondary mb-1.5">
                            {ar ? 'اسم البراند الجديد' : 'New Brand Name'}
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/60"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-dark-text-secondary mb-1.5">
                            {ar ? 'الدولة (اختياري)' : 'Country (optional)'}
                        </label>
                        <select
                            value={country}
                            onChange={e => setCountry(e.target.value)}
                            className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/60"
                        >
                            <option value="">{ar ? '— اختر —' : '— Select —'}</option>
                            {Object.entries(COUNTRY_NAMES).map(([code, { ar: arName, flag }]) => (
                                <option key={code} value={code}>{flag} {ar ? arName : code}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-[11px] text-dark-text-secondary bg-dark-bg/50 border border-dark-border rounded-xl px-3 py-2 flex items-start gap-2">
                        <i className="fas fa-circle-info text-brand-secondary mt-0.5 flex-shrink-0" />
                        {ar
                            ? 'سيتم نسخ: الصناعة، الموقع الإلكتروني. يمكنك إضافة التفاصيل الأخرى لاحقاً من Brand Hub.'
                            : 'Copies: industry, website. Other details can be added later from Brand Hub.'}
                    </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-dark-border px-5 py-4">
                    <button onClick={onClose} className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors">
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!name.trim() || saving}
                        className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-copy'} text-xs`} />
                        {ar ? 'إنشاء النسخة' : 'Create Copy'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Brand Card ───────────────────────────────────────────────────────────────

interface BrandCardProps {
    brand: Brand;
    isActive: boolean;
    intel: BrandIntelligence | undefined;
    onSwitch: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onOpenHub: (() => void) | undefined;
    isEditingThis: boolean;
    isDeletingThis: boolean;
    isConfirmingDeleteThis: boolean;
    editName: string;
    savingThis: boolean;
    onEditNameChange: (v: string) => void;
    onSaveRename: () => void;
    onCancelEdit: () => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    ar: boolean;
}

const BrandCard: React.FC<BrandCardProps> = ({
    brand, isActive, intel, onSwitch, onEdit, onDelete, onDuplicate, onOpenHub,
    isEditingThis, isDeletingThis, isConfirmingDeleteThis, editName, savingThis,
    onEditNameChange, onSaveRename, onCancelEdit, onConfirmDelete, onCancelDelete, ar,
}) => {
    const industryMeta = brand.industry ? INDUSTRY_LABELS[brand.industry] : undefined;
    const countryMeta  = brand.country  ? COUNTRY_NAMES[brand.country]   : undefined;

    const createdRelative = (() => {
        if (!brand.createdAt) return null;
        const diff = Date.now() - new Date(brand.createdAt).getTime();
        const days  = Math.floor(diff / 86400000);
        if (days < 1)   return ar ? 'اليوم'      : 'Today';
        if (days < 7)   return ar ? `منذ ${days} أيام` : `${days}d ago`;
        if (days < 30)  return ar ? `منذ ${Math.floor(days / 7)} أسابيع`  : `${Math.floor(days / 7)}w ago`;
        if (days < 365) return ar ? `منذ ${Math.floor(days / 30)} أشهر`   : `${Math.floor(days / 30)}mo ago`;
        return ar ? `منذ ${Math.floor(days / 365)} سنة` : `${Math.floor(days / 365)}y ago`;
    })();

    return (
        <div className={`relative rounded-2xl border transition-all duration-200 bg-light-card dark:bg-dark-card overflow-hidden ${
            isActive
                ? 'border-brand-primary/50 shadow-lg shadow-brand-primary/10'
                : 'border-light-border dark:border-dark-border hover:border-light-border/80 dark:hover:border-dark-border/80'
        }`}>
            {/* Active brand accent line */}
            {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-primary to-indigo-500" />
            )}

            <div className="p-4">
                {/* Top row: logo + name + badges */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                        <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="w-12 h-12 rounded-xl object-cover border border-light-border dark:border-dark-border"
                        />
                        {isActive && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-light-card dark:border-dark-card flex items-center justify-center">
                                <i className="fas fa-check text-[7px] text-white" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        {isEditingThis ? (
                            <input
                                autoFocus
                                value={editName}
                                onChange={e => onEditNameChange(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter')  onSaveRename();
                                    if (e.key === 'Escape') onCancelEdit();
                                }}
                                className="w-full rounded-lg border border-brand-primary bg-light-bg dark:bg-dark-bg px-2.5 py-1.5 text-sm font-semibold text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                            />
                        ) : (
                            <p className="font-bold text-light-text dark:text-dark-text truncate text-sm leading-tight">
                                {brand.name}
                            </p>
                        )}

                        {/* Meta chips row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {isActive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wide border border-brand-primary/20">
                                    <i className="fas fa-bolt text-[8px]" />
                                    {ar ? 'نشط' : 'Active'}
                                </span>
                            )}
                            {industryMeta && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${industryMeta.color}`}>
                                    <i className={`fas ${industryMeta.icon} text-[8px]`} />
                                    {ar ? industryMeta.ar : brand.industry}
                                </span>
                            )}
                            {countryMeta && (
                                <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                    {countryMeta.flag}
                                </span>
                            )}
                            {brand.websiteUrl && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-globe text-[8px]" />
                                    {new URL(brand.websiteUrl).hostname.replace('www.', '')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Intelligence score */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wide">
                            {ar ? 'ذكاء البراند' : 'Brand Intelligence'}
                        </span>
                        {intel && !intel.loading && (
                            <div className="flex items-center gap-2">
                                {[
                                    { icon: 'fa-waveform-lines', ok: intel.hasVoice,    tipAr: 'الصوت',    tipEn: 'Voice'    },
                                    { icon: 'fa-users',          ok: intel.hasAudience, tipAr: 'الجمهور',  tipEn: 'Audience' },
                                    { icon: 'fa-database',       ok: intel.hasKnowledge,tipAr: 'المعرفة',  tipEn: 'Knowledge'},
                                ].map(dot => (
                                    <i
                                        key={dot.icon}
                                        className={`fas ${dot.icon} text-[9px] ${dot.ok ? 'text-emerald-400' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-30'}`}
                                        title={ar ? dot.tipAr : dot.tipEn}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <IntelligenceMeter score={intel?.profileScore ?? 0} loading={intel?.loading ?? true} />
                </div>

                {/* Footer: date + actions */}
                <div className="flex items-center justify-between">
                    {createdRelative && (
                        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                            <i className="fas fa-clock text-[8px]" />
                            {createdRelative}
                        </span>
                    )}

                    {/* Delete confirmation inline */}
                    {isConfirmingDeleteThis ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'حذف نهائي؟' : 'Delete forever?'}
                            </span>
                            <button
                                onClick={onConfirmDelete}
                                disabled={isDeletingThis}
                                className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50"
                            >
                                {isDeletingThis ? <i className="fas fa-circle-notch fa-spin text-xs" /> : (ar ? 'نعم' : 'Yes')}
                            </button>
                            <button onClick={onCancelDelete} className="px-2.5 py-1 border border-light-border dark:border-dark-border rounded-lg text-xs text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg">
                                {ar ? 'لا' : 'No'}
                            </button>
                        </div>
                    ) : isEditingThis ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                            <button
                                onClick={onSaveRename}
                                disabled={savingThis || !editName.trim()}
                                className="px-2.5 py-1 bg-brand-primary text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                            >
                                {savingThis ? <i className="fas fa-circle-notch fa-spin text-xs" /> : (ar ? 'حفظ' : 'Save')}
                            </button>
                            <button onClick={onCancelEdit} className="px-2.5 py-1 border border-light-border dark:border-dark-border rounded-lg text-xs text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg">
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 ml-auto">
                            {/* Open Hub */}
                            {onOpenHub && (
                                <button
                                    onClick={onOpenHub}
                                    title={ar ? 'فتح Brand Hub' : 'Open Brand Hub'}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-brand-primary bg-brand-primary/8 hover:bg-brand-primary/15 border border-brand-primary/20 transition-all"
                                >
                                    <i className="fas fa-brain text-[9px]" />
                                    Hub
                                </button>
                            )}
                            {/* Switch */}
                            {!isActive && (
                                <button
                                    onClick={onSwitch}
                                    title={ar ? 'تفعيل' : 'Switch to'}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg border border-light-border dark:border-dark-border transition-all"
                                >
                                    <i className="fas fa-bolt text-[9px]" />
                                    {ar ? 'تفعيل' : 'Switch'}
                                </button>
                            )}
                            {/* Rename */}
                            <button
                                onClick={onEdit}
                                title={ar ? 'تعديل الاسم' : 'Rename'}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg border border-transparent hover:border-light-border dark:hover:border-dark-border transition-all"
                            >
                                <i className="fas fa-pen text-[10px]" />
                            </button>
                            {/* Duplicate */}
                            <button
                                onClick={onDuplicate}
                                title={ar ? 'استنساخ البراند' : 'Duplicate brand'}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-brand-primary/10 hover:text-brand-secondary border border-transparent hover:border-brand-primary/20 transition-all"
                            >
                                <i className="fas fa-copy text-[10px]" />
                            </button>
                            {/* Delete */}
                            <button
                                onClick={onDelete}
                                title={ar ? 'حذف البراند' : 'Delete brand'}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-900/30 transition-all"
                            >
                                <i className="fas fa-trash text-[10px]" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const BrandsManagePage: React.FC<BrandsManagePageProps> = ({
    brands,
    activeBrand,
    onAddBrand,
    onSwitchBrand,
    onDeleteBrand,
    onRenameBrand,
    onBrandsRefresh,
    onNavigate,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [editingId,          setEditingId]          = useState<string | null>(null);
    const [editName,           setEditName]           = useState('');
    const [deletingId,         setDeletingId]         = useState<string | null>(null);
    const [confirmDeleteId,    setConfirmDeleteId]    = useState<string | null>(null);
    const [savingId,           setSavingId]           = useState<string | null>(null);
    const [intelMap,           setIntelMap]           = useState<Record<string, BrandIntelligence>>({});
    const [duplicatingBrand,   setDuplicatingBrand]  = useState<Brand | null>(null);

    // ── Load intelligence scores for all brands ───────────────────────────────
    const brandsKey = brands.map(b => b.id).join(',');
    useEffect(() => {
        if (!brands.length) return;

        const load = async (brand: Brand) => {
            setIntelMap(prev => ({
                ...prev,
                [brand.id]: { profileScore: 0, hasVoice: false, hasAudience: false, hasKnowledge: false, loading: true },
            }));
            try {
                // Fetch all three data sources in parallel
                const [profile, socialAccounts, knowledgeEntries] = await Promise.all([
                    getBrandHubProfile(brand.id, brand.name),
                    getSocialAccounts(brand.id),
                    getBrandKnowledge(brand.id),
                ]);

                const hasVoice    = profile.brandVoice.toneDescription.length > 0 || profile.brandVoice.keywords.length > 0;
                const hasAudience = profile.brandAudiences.length > 0 || (profile.targetAudienceSummary?.length ?? 0) > 10;
                const hasKnowledge = knowledgeEntries.length > 0 || (profile.keySellingPoints?.length ?? 0) > 0;
                const socialCount  = socialAccounts.length;
                const knowledgeCount = knowledgeEntries.length;

                // Score breakdown (100 pts max):
                // Profile identity: 45 pts
                let score = 0;
                if (brand.name)                                             score += 8;
                if (brand.industry)                                         score += 6;
                if (brand.country)                                          score += 4;
                if (profile.description && profile.description.length > 20) score += 10;
                if (profile.businessModel)                                  score += 6;
                if ((profile.goals?.length ?? 0) > 0)                      score += 5;
                if ((profile.values?.length ?? 0) > 0)                     score += 6;
                // Voice & audience: 20 pts
                if (hasVoice)                                               score += 12;
                if (hasAudience)                                            score += 8;
                // Social connections: 15 pts
                if (socialCount >= 1)                                       score += 8;
                if (socialCount >= 2)                                       score += 7;
                // Knowledge base: 20 pts
                if (knowledgeCount >= 1)                                    score += 6;
                if (knowledgeCount >= 3)                                    score += 7;
                if (knowledgeCount >= 8)                                    score += 7;

                setIntelMap(prev => ({
                    ...prev,
                    [brand.id]: { profileScore: Math.min(100, score), hasVoice, hasAudience, hasKnowledge, loading: false },
                }));
            } catch {
                setIntelMap(prev => ({
                    ...prev,
                    [brand.id]: { profileScore: 0, hasVoice: false, hasAudience: false, hasKnowledge: false, loading: false },
                }));
            }
        };

        brands.forEach(b => load(b));
    }, [brandsKey]);

    // ── Actions ──────────────────────────────────────────────────────────────

    const handleSaveRename = async (brandId: string) => {
        if (!editName.trim()) return;
        setSavingId(brandId);
        try {
            await onRenameBrand(brandId, editName.trim());
            setEditingId(null);
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteConfirm = async (brandId: string) => {
        setDeletingId(brandId);
        try {
            await onDeleteBrand(brandId);
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const handleOpenHub = (brandId: string) => {
        if (!onNavigate) return;
        // Switch to brand first if not active, then navigate to brand-hub
        if (activeBrand?.id !== brandId) onSwitchBrand(brandId);
        onNavigate('brand-hub');
    };

    const handleDuplicateConfirm = async (newName: string, newCountry: string) => {
        if (!duplicatingBrand) return;
        await addBrand(
            newName,
            duplicatingBrand.industry,
            undefined,
            newCountry || undefined,
            duplicatingBrand.websiteUrl,
        );
        setDuplicatingBrand(null);
        onBrandsRefresh?.();
    };

    // ── Stats ────────────────────────────────────────────────────────────────

    const avgScore = brands.length
        ? Math.round(brands.reduce((sum, b) => sum + (intelMap[b.id]?.profileScore ?? 0), 0) / brands.length)
        : 0;
    const fullySetup = brands.filter(b => (intelMap[b.id]?.profileScore ?? 0) >= 70).length;

    return (
        <>
        <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6" dir={ar ? 'rtl' : 'ltr'}>

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="section-kicker">{ar ? 'الإعدادات' : 'Settings'}</p>
                    <h1 className="mt-1 text-2xl font-bold text-light-text dark:text-dark-text">
                        {ar ? 'إدارة البراندات' : 'Manage Brands'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'أضف براندات جديدة، عدّل بياناتها، أو تحقق من مستوى ذكائها.'
                            : 'Add new brands, update their data, or check their intelligence score.'}
                    </p>
                </div>
                <button
                    onClick={onAddBrand}
                    className="flex items-center gap-2 self-start sm:self-auto rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                    <i className="fas fa-plus text-xs" />
                    <span>{ar ? 'براند جديد' : 'New Brand'}</span>
                </button>
            </div>

            {/* ── Stats strip (only when brands exist) ── */}
            {brands.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            icon: 'fa-layer-group',
                            color: 'text-brand-primary',
                            bg: 'bg-brand-primary/10',
                            valueAr: `${brands.length} براند`,
                            valueEn: `${brands.length} brand${brands.length !== 1 ? 's' : ''}`,
                            labelAr: 'إجمالي البراندات',
                            labelEn: 'Total brands',
                        },
                        {
                            icon: 'fa-brain',
                            color: avgScore >= 70 ? 'text-emerald-400' : avgScore >= 40 ? 'text-amber-400' : 'text-red-400',
                            bg: avgScore >= 70 ? 'bg-emerald-400/10' : avgScore >= 40 ? 'bg-amber-400/10' : 'bg-red-400/10',
                            valueAr: `${avgScore}%`,
                            valueEn: `${avgScore}%`,
                            labelAr: 'متوسط الذكاء',
                            labelEn: 'Avg. Intelligence',
                        },
                        {
                            icon: 'fa-circle-check',
                            color: 'text-emerald-400',
                            bg: 'bg-emerald-400/10',
                            valueAr: `${fullySetup} / ${brands.length}`,
                            valueEn: `${fullySetup} / ${brands.length}`,
                            labelAr: 'مكتملة الإعداد',
                            labelEn: 'Fully set up',
                        },
                    ].map(stat => (
                        <div key={stat.labelEn} className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-3">
                            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                                <i className={`fas ${stat.icon} ${stat.color} text-sm`} />
                            </div>
                            <p className="font-bold text-light-text dark:text-dark-text text-base leading-tight">
                                {ar ? stat.valueAr : stat.valueEn}
                            </p>
                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                {ar ? stat.labelAr : stat.labelEn}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Brand cards ── */}
            {brands.length === 0 ? (
                <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
                    <EmptyBrands onAdd={onAddBrand} />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {brands.map(brand => (
                        <BrandCard
                            key={brand.id}
                            brand={brand}
                            isActive={activeBrand?.id === brand.id}
                            intel={intelMap[brand.id]}
                            onSwitch={() => onSwitchBrand(brand.id)}
                            onEdit={() => { setEditingId(brand.id); setEditName(brand.name); }}
                            onDelete={() => setConfirmDeleteId(brand.id)}
                            onDuplicate={() => setDuplicatingBrand(brand)}
                            onOpenHub={onNavigate ? () => handleOpenHub(brand.id) : undefined}
                            isEditingThis={editingId === brand.id}
                            isDeletingThis={deletingId === brand.id}
                            isConfirmingDeleteThis={confirmDeleteId === brand.id}
                            editName={editName}
                            savingThis={savingId === brand.id}
                            onEditNameChange={setEditName}
                            onSaveRename={() => handleSaveRename(brand.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onConfirmDelete={() => handleDeleteConfirm(brand.id)}
                            onCancelDelete={() => setConfirmDeleteId(null)}
                            ar={ar}
                        />
                    ))}
                </div>
            )}

            {/* ── Footer note ── */}
            {brands.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <i className="fas fa-triangle-exclamation text-amber-400 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'حذف البراند يزيل جميع بياناته بشكل نهائي — بما في ذلك الملف الشخصي، قاعدة المعرفة، والحسابات المرتبطة.'
                            : 'Deleting a brand permanently removes all its data — including profile, knowledge base, and linked accounts.'}
                    </p>
                </div>
            )}
        </div>

        {/* Duplicate Brand Modal */}
        {duplicatingBrand && (
            <DuplicateBrandModal
                sourceBrand={duplicatingBrand}
                ar={ar}
                onConfirm={handleDuplicateConfirm}
                onClose={() => setDuplicatingBrand(null)}
            />
        )}
        </>
    );
};
