import React, { useState } from 'react';
import { BrandHubProfile, BrandGoal, BrandLanguage, BusinessModel, NotificationType } from '../../types';
import { BrandDocument } from '../../services/brandDocumentService';
import { updateBrandProfile, invalidateProfileCache, getBrandHubProfile } from '../../services/brandHubService';
import { mapOpenAIAnalysisToBrandImport } from '../../services/brandFileAnalysisShared';
import { BrandImportModal } from '../BrandImportModal';

interface IdentityTabContentProps {
    profile: BrandHubProfile;
    setProfile: React.Dispatch<React.SetStateAction<BrandHubProfile>>;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onRefresh: () => Promise<void>;
    setShowOnboarding: (show: boolean) => void;
    documents: BrandDocument[];
    loadDocuments: () => Promise<void>;
    isLoadingDocs: boolean;
}

const INDUSTRY_OPTIONS = [
    'تجزئة وتسوق', 'عقارات وتطوير عقاري', 'مطاعم وأغذية ومشروبات', 'صحة وجمال وعناية',
    'تقنية وSaaS وبرمجيات', 'تعليم وتدريب وتطوير', 'سياحة وفنادق وضيافة', 'مالية وبنوك وتأمين',
    'رياضة ولياقة بدنية', 'أثاث وديكور ومنزل', 'ملابس وأزياء وإكسسوار', 'سيارات وخدمات مركبات',
    'طبي وصحة عامة وصيدلة', 'قانوني واستشاري ومحاسبة', 'وكالة تسويق وإعلانات وإبداع',
    'لوجستيات وشحن وتوصيل', 'مقاولات وبناء وتشييد', 'زراعة وصناعات غذائية',
    'ترفيه وإعلام ومحتوى رقمي', 'تصميم جرافيك وفنون بصرية', 'خدمات منزلية ومهنية',
    'أعمال خيرية وغير ربحية', 'طاقة وبيئة واستدامة', 'تجميل ومكياج وعطور', 'أخرى',
];

export const IdentityTabContent: React.FC<IdentityTabContentProps> = ({
    profile,
    setProfile,
    brandId,
    addNotification,
    onRefresh,
    setShowOnboarding,
    documents,
    loadDocuments,
    isLoadingDocs,
}) => {
    const [newValueInput, setNewValueInput] = useState('');
    const [newPillarInput, setNewPillarInput] = useState('');
    const [newKspInput, setNewKspInput] = useState('');
    const [newGuidelineInput, setNewGuidelineInput] = useState('');

    const [showImportModal, setShowImportModal] = useState(false);
    const [showLibraryImport, setShowLibraryImport] = useState(false);
    const [libraryImportLoading, setLibraryImportLoading] = useState(false);

    const handleLibraryImport = async (doc: BrandDocument) => {
        if (!doc.analysisJson) {
            addNotification(NotificationType.Warning, 'هذه الوثيقة لا تحتوي على بيانات تحليل — جرب الاستيراد من وثيقة جديدة');
            return;
        }
        setLibraryImportLoading(true);
        try {
            const mapped = mapOpenAIAnalysisToBrandImport(doc.analysisJson as any);
            await updateBrandProfile(brandId, {
                ...(mapped.industry && { industry: mapped.industry }),
                ...(mapped.values?.length    && { values: mapped.values }),
                ...(mapped.keySellingPoints?.length && { keySellingPoints: mapped.keySellingPoints }),
                ...(mapped.styleGuidelines?.length  && { styleGuidelines: mapped.styleGuidelines }),
                ...(mapped.targetAudienceSummary    && { targetAudienceSummary: mapped.targetAudienceSummary }),
                ...(mapped.valueProp     && { valueProp:     mapped.valueProp }),
                ...(mapped.coreOffer     && { brandPromise:  mapped.coreOffer }),
                ...(mapped.contentPillars?.length && { messagingPillars: mapped.contentPillars }),
                ...(mapped.brandVoice    && { brandVoice:    mapped.brandVoice }),
                ...(mapped.brandAudiences?.length && { brandAudiences: mapped.brandAudiences }),
            });
            invalidateProfileCache(brandId);
            const refreshed = await getBrandHubProfile(brandId, profile.brandName);
            setProfile(refreshed);
            await onRefresh();
            setShowLibraryImport(false);
            addNotification(NotificationType.Success, `✅ تم تحديث هوية البراند من "${doc.title}"`);
        } catch (err) {
            console.error('Library import failure:', err);
            addNotification(NotificationType.Error, 'تعذّر الاستيراد من المكتبة');
        } finally {
            setLibraryImportLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-building text-brand-pink animate-pulse" />
                    الهوية الأساسية
                </h2>
                <div className="flex items-center gap-3.5 flex-wrap">
                    <button onClick={() => setShowOnboarding(true)}
                        className="text-xs font-semibold text-brand-secondary hover:underline flex items-center gap-1.5 transition-colors">
                        <i className="fas fa-wand-magic-sparkles text-xs text-brand-pink" /> تحديث بالذكاء الاصطناعي
                    </button>
                    <span className="text-white/10 text-[10px]">|</span>
                    <button onClick={() => setShowImportModal(true)}
                        className="text-xs font-semibold text-brand-pink hover:underline flex items-center gap-1.5 transition-colors">
                        <i className="fas fa-file-import text-xs" /> استيراد من وثيقة
                    </button>
                    <span className="text-white/10 text-[10px]">|</span>
                    <button onClick={() => { setShowLibraryImport(v => !v); if (!documents.length) loadDocuments(); }}
                        className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1.5 transition-colors">
                        <i className="fas fa-book-open text-xs" /> من المكتبة
                    </button>
                </div>
            </div>

            {showImportModal && (
                <BrandImportModal
                    onClose={() => setShowImportModal(false)}
                    existingBrandId={brandId}
                    onImported={async () => {
                        setShowImportModal(false);
                        await onRefresh();
                        addNotification(NotificationType.Success, 'تم تحديث بيانات البراند من الوثيقة');
                    }}
                />
            )}

            {/* Library Import Panel */}
            {showLibraryImport && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <i className="fas fa-book-open" /> اختر وثيقة من المكتبة لاستيراد هوية البراند منها
                        </p>
                        <button onClick={() => setShowLibraryImport(false)} className="text-dark-text-secondary hover:text-white text-xs">
                            <i className="fas fa-times" />
                        </button>
                    </div>
                    {isLoadingDocs ? (
                        <p className="text-xs text-dark-text-secondary"><i className="fas fa-spinner fa-spin me-1" />جارٍ التحميل...</p>
                    ) : documents.length === 0 ? (
                        <p className="text-xs text-dark-text-secondary">لا توجد وثائق في المكتبة بعد — ارفع وثيقة أولاً من تاب "مكتبة التعلم"</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {documents.map(doc => (
                                <button key={doc.id} type="button"
                                    disabled={libraryImportLoading || !doc.analysisJson}
                                    onClick={() => handleLibraryImport(doc)}
                                    className="w-full flex items-center justify-between gap-3 bg-dark-bg/60 hover:bg-dark-card border border-white/5 hover:border-amber-500/30 rounded-xl px-4 py-2.5 transition-all disabled:opacity-40"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <i className="fas fa-file-alt text-amber-400 text-xs flex-shrink-0" />
                                        <span className="text-xs text-white truncate">{doc.title}</span>
                                        {!doc.analysisJson && <span className="text-[10px] text-dark-text-secondary">(بدون تحليل)</span>}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {doc.completenessScore > 0 && (
                                            <span className="text-[10px] text-emerald-400">{doc.completenessScore}%</span>
                                        )}
                                        {libraryImportLoading
                                            ? <i className="fas fa-spinner fa-spin text-xs text-amber-400" />
                                            : <i className="fas fa-arrow-left text-xs text-dark-text-secondary" />
                                        }
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Name + Industry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <label className="text-xs font-bold text-dark-text-secondary mb-2 block">اسم البراند</label>
                    <p className="text-white font-extrabold bg-slate-950/40 border border-white/5 rounded-xl px-4 py-3.5 text-sm shadow-inner">{profile.brandName || '—'}</p>
                    <p className="text-[10px] text-slate-500 mt-2">لتغيير الاسم، افتح إعدادات البراند</p>
                </div>
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-primary/10 transition-all duration-500" />
                    <label className="text-xs font-bold text-dark-text-secondary mb-2 block">الصناعة / المجال</label>
                    <div className="relative">
                        <select
                            value={INDUSTRY_OPTIONS.includes(profile.industry) ? profile.industry : (profile.industry ? 'أخرى' : '')}
                            onChange={e => {
                                if (e.target.value !== 'أخرى') setProfile(prev => ({ ...prev, industry: e.target.value }));
                                else setProfile(prev => ({ ...prev, industry: '' }));
                            }}
                            className="w-full bg-slate-950/40 border border-white/10 rounded-xl pr-4 pl-10 py-3.5 text-sm text-white focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-slate-950 text-white">اختر الصناعة...</option>
                            {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-slate-955 text-white">{opt}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-hover:text-white transition-colors">
                            <i className="fas fa-chevron-down text-xs" />
                        </div>
                    </div>
                    {(!INDUSTRY_OPTIONS.includes(profile.industry) && profile.industry !== '') || profile.industry === 'أخرى' ? (
                        <input
                            type="text"
                            value={profile.industry === 'أخرى' ? '' : profile.industry}
                            onChange={e => setProfile(prev => ({ ...prev, industry: e.target.value }))}
                            placeholder="اكتب اسم الصناعة..."
                            className="mt-3 w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner"
                        />
                    ) : null}
                </div>
            </div>

            {/* Description */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <label className="text-xs font-bold text-dark-text-secondary mb-2 block">وصف النشاط التجاري</label>
                <textarea
                    value={profile.description ?? ''}
                    onChange={e => setProfile(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="وصف موجز للنشاط التجاري ومميزاته ورسالته في السوق..."
                    className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none transition-all duration-200 shadow-inner"
                />
            </div>

            {/* Business Model + Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-dark-text-secondary mb-1 block">نموذج العمل <span className="text-slate-500 font-normal">(اختر واحداً أو أكثر)</span></label>
                    <div className="flex flex-wrap gap-2">
                        {([
                            { v: 'b2c' as BusinessModel,      label: 'B2C — أفراد' },
                            { v: 'b2b' as BusinessModel,      label: 'B2B — شركات' },
                            { v: 'ecommerce' as BusinessModel, label: 'تجارة إلكترونية' },
                            { v: 'service' as BusinessModel,  label: 'خدمات' },
                            { v: 'local' as BusinessModel,    label: 'محلي' },
                            { v: 'saas' as BusinessModel,     label: 'SaaS' },
                            { v: 'mixed' as BusinessModel,    label: 'مختلط' },
                        ]).map(({ v, label }) => {
                            const active = (profile.businessModel ?? []).includes(v);
                            return (
                                <button key={v} type="button"
                                    onClick={() => setProfile(prev => ({
                                        ...prev,
                                        businessModel: active
                                            ? (prev.businessModel ?? []).filter(m => m !== v)
                                            : [...(prev.businessModel ?? []), v],
                                    }))}
                                    className={`px-4 py-2 rounded-full text-xs font-extrabold border transition-all duration-300 transform active:scale-[0.97] ${active ? 'bg-gradient-to-r from-brand-primary to-brand-secondary border-transparent text-white shadow-lg shadow-brand-primary/25 scale-[1.03]' : 'bg-slate-950/40 border-white/5 text-dark-text-secondary hover:border-white/15 hover:text-white hover:-translate-y-0.5'}`}
                                >{label}</button>
                            );
                        })}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-dark-text-secondary mb-1 block">لغة التواصل للجمهور</label>
                    <div className="flex gap-2.5 h-[48px]">
                        {([
                            { v: 'ar', label: 'العربية' },
                            { v: 'en', label: 'الإنجليزية' },
                            { v: 'both', label: 'العربية والالإنجليزية' },
                        ] as { v: BrandLanguage; label: string }[]).map(({ v, label }) => (
                            <button
                                key={v}
                                onClick={() => setProfile(prev => ({ ...prev, language: v }))}
                                className={`flex-1 rounded-xl text-xs font-extrabold border transition-all duration-300 transform active:scale-[0.97] ${
                                    profile.language === v
                                        ? 'bg-gradient-to-r from-brand-primary to-brand-secondary border-transparent text-white shadow-lg shadow-brand-primary/25 scale-[1.02]'
                                        : 'bg-slate-950/40 border-white/5 text-dark-text-secondary hover:border-white/15 hover:text-white hover:-translate-y-0.5'
                                }`}
                            >{label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Goals */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <label className="text-xs font-bold text-dark-text-secondary mb-1 block">أهداف البراند الاستراتيجية</label>
                <div className="flex flex-wrap gap-2.5">
                    {([
                        { v: 'awareness', label: 'توعية بالعلامة', icon: 'fa-bullhorn' },
                        { v: 'leads',     label: 'عملاء محتملون', icon: 'fa-user-plus' },
                        { v: 'sales',     label: 'زيادة المبيعات', icon: 'fa-shopping-bag' },
                        { v: 'bookings',  label: 'حجوزات مباشرة',   icon: 'fa-calendar-check' },
                        { v: 'engagement',label: 'تفاعل المتابعين', icon: 'fa-heart' },
                        { v: 'support',   label: 'دعم وخدمة عملاء', icon: 'fa-headset' },
                        { v: 'recruitment',label: 'توظيف واستقطاب', icon: 'fa-users' },
                    ] as { v: BrandGoal; label: string; icon: string }[]).map(({ v, label, icon }) => {
                        const active = (profile.goals ?? []).includes(v);
                        return (
                            <button
                                key={v}
                                onClick={() => {
                                    const cur = profile.goals ?? [];
                                    setProfile(prev => ({
                                        ...prev,
                                        goals: active ? cur.filter(g => g !== v) : [...cur, v],
                                    }));
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold border transition-all duration-300 transform active:scale-[0.97] ${
                                    active
                                        ? 'bg-gradient-to-r from-brand-primary to-brand-secondary border-transparent text-white shadow-lg shadow-brand-primary/25 scale-[1.03]'
                                        : 'bg-slate-950/40 border-white/5 text-dark-text-secondary hover:border-white/15 hover:text-white hover:-translate-y-0.5'
                                }`}
                            >
                                <i className={`fas ${icon} text-[11px]`} />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Age Range + Audience Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-dark-text-secondary mb-1 block">الفئات العمرية المستهدفة</label>
                    <div className="flex flex-wrap gap-2.5">
                        {['13-17', '18-24', '25-34', '35-44', '45-54', '55+'].map(r => {
                            const active = (profile.ageRange ?? []).includes(r);
                            return (
                                <button key={r} type="button"
                                    onClick={() => setProfile(prev => ({
                                        ...prev,
                                        ageRange: active
                                            ? (prev.ageRange ?? []).filter(a => a !== r)
                                            : [...(prev.ageRange ?? []), r],
                                    }))}
                                    className={`px-4 py-2 rounded-full text-xs font-extrabold border transition-all duration-300 transform active:scale-[0.97] ${active ? 'bg-gradient-to-r from-brand-primary to-brand-secondary border-transparent text-white shadow-lg shadow-brand-primary/25 scale-[1.03]' : 'bg-slate-950/40 border-white/5 text-dark-text-secondary hover:border-white/15 hover:text-white hover:-translate-y-0.5'}`}
                                >{r}</button>
                            );
                        })}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-dark-text-secondary mb-1 block">ملخص الجمهور المستهدف</label>
                    <textarea
                        value={profile.targetAudienceSummary ?? ''}
                        onChange={e => setProfile(prev => ({ ...prev, targetAudienceSummary: e.target.value }))}
                        rows={2}
                        placeholder="مثال: أصحاب الأعمال الصغيرة في السعودية والخليج، من سن 25-45 سنة..."
                        className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none transition-all duration-200 shadow-inner"
                    />
                </div>
            </div>

            {/* Contact Info + Website + Country */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <h3 className="text-xs font-extrabold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                    <i className="fas fa-globe text-brand-secondary text-sm" /> بيانات الاتصال والموقع الجغرافي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-dark-text-secondary mb-2 block">رقم الهاتف</label>
                        <div className="relative">
                            <input type="tel"
                                value={profile.contactInfo?.phone ?? ''}
                                onChange={e => setProfile(prev => ({ ...prev, contactInfo: { ...prev.contactInfo, phone: e.target.value } }))}
                                placeholder="+966 5X XXX XXXX"
                                className="w-full bg-slate-950/40 border border-white/10 rounded-xl pr-10 pl-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner text-right"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                <i className="fas fa-phone text-[10px]" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-dark-text-secondary mb-2 block">البريد الإلكتروني</label>
                        <div className="relative">
                            <input type="email"
                                value={profile.contactInfo?.email ?? ''}
                                onChange={e => setProfile(prev => ({ ...prev, contactInfo: { ...prev.contactInfo, email: e.target.value } }))}
                                placeholder="contact@brand.com"
                                className="w-full bg-slate-950/40 border border-white/10 rounded-xl pr-10 pl-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner text-right"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                <i className="fas fa-envelope text-[10px]" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-dark-text-secondary mb-2 block">الموقع الإلكتروني الرسمي</label>
                        <div className="relative">
                            <input type="url"
                                value={profile.website ?? ''}
                                onChange={e => setProfile(prev => ({ ...prev, website: e.target.value || undefined }))}
                                placeholder="https://yourbrand.com"
                                className="w-full bg-slate-950/40 border border-white/10 rounded-xl pr-10 pl-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner text-right"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                <i className="fas fa-link text-[10px]" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-dark-text-secondary mb-2 block">الدولة / السوق المستهدف</label>
                        <div className="relative">
                            <select
                                value={profile.country ?? ''}
                                onChange={e => setProfile(prev => ({ ...prev, country: e.target.value || undefined }))}
                                className="w-full bg-slate-950/40 border border-white/10 rounded-xl pr-4 pl-10 py-3 text-xs text-white focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-slate-950 text-white">اختر الدولة...</option>
                                {['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'IQ', 'MA', 'TN', 'DZ', 'LY', 'YE', 'SD', 'PS', 'SY', 'OTHER'].map(c => (
                                    <option key={c} value={c} className="bg-slate-955 text-white">{
                                        ({ SA:'السعودية', AE:'الإمارات', EG:'مصر', KW:'الكويت', QA:'قطر', BH:'البحرين', OM:'عُمان', JO:'الأردن', LB:'لبنان', IQ:'العراق', MA:'المغرب', TN:'تونس', DZ:'الجزائر', LY:'ليبيا', YE:'اليمن', SD:'السودان', PS:'فلسطين', SY:'سوريا', OTHER:'أخرى' } as Record<string,string>)[c]
                                    }</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                                <i className="fas fa-chevron-down text-[10px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Values */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <label className="text-xs font-bold text-dark-text-secondary mb-1 block">قيم البراند الأساسية</label>
                <div className="flex flex-wrap gap-2.5">
                    {(profile.values ?? []).map((v, i) => (
                        <span key={i} className="flex items-center gap-2 text-xs bg-brand-primary/10 text-brand-secondary px-3.5 py-1.5 rounded-full border border-brand-primary/20 transition-all duration-200 hover:scale-105 hover:bg-brand-primary/15 hover:border-brand-primary/45 shadow-sm">
                            {v}
                            <button
                                onClick={() => setProfile(prev => ({ ...prev, values: prev.values.filter((_, idx) => idx !== i) }))}
                                className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all"
                            >
                                <i className="fas fa-times text-[9px]" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2.5">
                    <input
                        value={newValueInput}
                        onChange={e => setNewValueInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && newValueInput.trim()) {
                                setProfile(prev => ({ ...prev, values: [...(prev.values ?? []), newValueInput.trim()] }));
                                setNewValueInput('');
                            }
                        }}
                        placeholder="اكتب قيمة واضغط Enter..."
                        className="flex-1 bg-slate-950/45 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner"
                    />
                    <button
                        onClick={() => { if (newValueInput.trim()) { setProfile(prev => ({ ...prev, values: [...(prev.values ?? []), newValueInput.trim()] })); setNewValueInput(''); } }}
                        className="px-4 py-3 bg-brand-primary/10 text-brand-secondary border border-brand-primary/20 rounded-xl text-xs hover:bg-brand-primary hover:text-white hover:shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all duration-200 flex items-center justify-center min-w-[48px]"
                    >
                        <i className="fas fa-plus text-[10px]" />
                    </button>
                </div>
            </div>

            {/* Key Selling Points */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <label className="text-xs font-bold text-dark-text-secondary mb-1 block">نقاط البيع الرئيسية <span className="text-slate-500 font-normal">(ميزتك التنافسية)</span></label>
                <div className="flex flex-wrap gap-2.5">
                    {(profile.keySellingPoints ?? []).map((ksp, i) => (
                        <span key={i} className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 rounded-full border border-emerald-500/25 transition-all duration-200 hover:scale-105 hover:bg-emerald-500/15 hover:border-emerald-500/45 shadow-sm">
                            {ksp}
                            <button onClick={() => setProfile(prev => ({ ...prev, keySellingPoints: (prev.keySellingPoints ?? []).filter((_, idx) => idx !== i) }))}
                                className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all"><i className="fas fa-times text-[9px]" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2.5">
                    <input value={newKspInput} onChange={e => setNewKspInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && newKspInput.trim()) { setProfile(prev => ({ ...prev, keySellingPoints: [...(prev.keySellingPoints ?? []), newKspInput.trim()] })); setNewKspInput(''); } }}
                        placeholder='مثال: "توصيل مجاني خلال 24 ساعة" أو "ضمان جودة مدى الحياة للقطع"'
                        className="flex-1 bg-slate-950/45 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner" />
                    <button onClick={() => { if (newKspInput.trim()) { setProfile(prev => ({ ...prev, keySellingPoints: [...(prev.keySellingPoints ?? []), newKspInput.trim()] })); setNewKspInput(''); } }}
                        className="px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-200 flex items-center justify-center min-w-[48px]">
                        <i className="fas fa-plus text-[10px]" />
                    </button>
                </div>
            </div>

            {/* Style Guidelines */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <label className="text-xs font-bold text-dark-text-secondary mb-1 block">إرشادات الأسلوب والكتابة <span className="text-slate-500 font-normal">(قواعد صياغة المحتوى)</span></label>
                <div className="flex flex-wrap gap-2.5">
                    {(profile.styleGuidelines ?? []).map((g, i) => (
                        <span key={i} className="flex items-center gap-2 text-xs bg-cyan-500/10 text-cyan-400 px-3.5 py-1.5 rounded-full border border-cyan-500/25 transition-all duration-200 hover:scale-105 hover:bg-cyan-500/15 hover:border-cyan-500/45 shadow-sm">
                            {g}
                            <button onClick={() => setProfile(prev => ({ ...prev, styleGuidelines: (prev.styleGuidelines ?? []).filter((_, idx) => idx !== i) }))}
                                className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all"><i className="fas fa-times text-[9px]" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2.5">
                    <input value={newGuidelineInput} onChange={e => setNewGuidelineInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && newGuidelineInput.trim()) { setProfile(prev => ({ ...prev, styleGuidelines: [...(prev.styleGuidelines ?? []), newGuidelineInput.trim()] })); setNewGuidelineInput(''); } }}
                        placeholder='مثال: "تجنب المصطلحات المعقدة" أو "خاطب العميل بصفته شريكاً نجاحاً"'
                        className="flex-1 bg-slate-955/45 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner" />
                    <button onClick={() => { if (newGuidelineInput.trim()) { setProfile(prev => ({ ...prev, styleGuidelines: [...(prev.styleGuidelines ?? []), newGuidelineInput.trim()] })); setNewGuidelineInput(''); } }}
                        className="px-4 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs hover:bg-cyan-500 hover:text-white hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-200 flex items-center justify-center min-w-[48px]">
                        <i className="fas fa-plus text-[10px]" />
                    </button>
                </div>
            </div>

            {/* ── Strategy Fields ── */}
            <div className="pt-6 border-t border-white/5 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                    <i className="fas fa-chess text-brand-secondary text-base animate-bounce" />
                    <h3 className="text-base font-extrabold text-white">الاستراتيجية التسويقية والتموضع</h3>
                    <span className="text-[10px] bg-brand-secondary/15 text-brand-secondary px-3 py-1 rounded-full border border-brand-secondary/20 font-black tracking-wide">تحسين ذكاء AI</span>
                </div>

                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-2.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-white mb-1.5 block">
                        عرض القيمة الفريدة (Value Proposition)
                    </label>
                    <textarea
                        value={profile.valueProp ?? ''}
                        onChange={e => setProfile(prev => ({ ...prev, valueProp: e.target.value }))}
                        rows={2}
                        placeholder='مثال: "نساعد أصحاب المطاعم على ملء طاولاتهم يومياً بنظام حجز ذكي، بعكس الأدوات المعقدة المنافسة..."'
                        className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none transition-all duration-200 shadow-inner"
                    />
                    <p className="text-[10px] text-dark-text-secondary">يُستخدم في: عناوين الإعلانات، السطور الافتتاحية للمحتوى، وردود المبيعات.</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-2.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-white mb-1.5 block">
                        وعد البراند (Brand Promise)
                    </label>
                    <input
                        type="text"
                        value={profile.brandPromise ?? ''}
                        onChange={e => setProfile(prev => ({ ...prev, brandPromise: e.target.value }))}
                        placeholder='مثال: "نضمن لك نتيجة واضحة وقابلة للقياس خلال أول 30 يوماً"'
                        className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner"
                    />
                    <p className="text-[10px] text-dark-text-secondary">يُستخدم في: ردود خدمة العملاء، إغلاق الإعلانات العريضة، صفحات الهبوط.</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-3.5 relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <label className="text-xs font-bold text-white mb-1 block">
                        ركائز الرسائل التسويقية (Messaging Pillars)
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                        {(profile.messagingPillars ?? []).map((p, i) => (
                            <span key={i} className="flex items-center gap-2 text-xs bg-violet-500/10 text-violet-400 px-3.5 py-1.5 rounded-full border border-violet-500/25 transition-all duration-200 hover:scale-105 hover:bg-violet-500/15 hover:border-violet-500/45 shadow-sm">
                                {p}
                                <button
                                    onClick={() => setProfile(prev => ({ ...prev, messagingPillars: (prev.messagingPillars ?? []).filter((_, idx) => idx !== i) }))}
                                    className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all"
                                >
                                    <i className="fas fa-times text-[9px]" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2.5">
                        <input
                            value={newPillarInput}
                            onChange={e => setNewPillarInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newPillarInput.trim()) {
                                    setProfile(prev => ({ ...prev, messagingPillars: [...(prev.messagingPillars ?? []), newPillarInput.trim()] }));
                                    setNewPillarInput('');
                                }
                            }}
                            placeholder='مثال: "نتائج موثقة بالبيانات" أو "توفير نصف الوقت الضائع"'
                            className="flex-1 bg-slate-955/45 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200 shadow-inner"
                        />
                        <button
                            onClick={() => { if (newPillarInput.trim()) { setProfile(prev => ({ ...prev, messagingPillars: [...(prev.messagingPillars ?? []), newPillarInput.trim()] })); setNewPillarInput(''); } }}
                            className="px-4 py-3 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl text-xs hover:bg-violet-500 hover:text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all duration-200 flex items-center justify-center min-w-[48px]"
                        >
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                    <p className="text-[10px] text-dark-text-secondary mt-2">أضف من 3 إلى 5 ركائز أساسية — تُستخدم لبناء وتوجيه خطط المحتوى.</p>
                </div>
            </div>
        </div>
    );
};
