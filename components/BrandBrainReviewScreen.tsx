import React, { useState } from 'react';
import { BrandHubProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface BrandBrainReviewScreenProps {
    brandProfile: BrandHubProfile;
    onApprove: () => void;
    onEdit: () => void;
}

interface ReviewSection {
    id: string;
    icon: string;
    titleAr: string;
    titleEn: string;
    color: string;
    bg: string;
    items: { labelAr: string; labelEn: string; value: string | string[] | number | undefined }[];
}

const Badge: React.FC<{ text: string; color?: string }> = ({ text, color = 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
        {text}
    </span>
);

const EmptyValue: React.FC<{ ar: boolean }> = ({ ar }) => (
    <span className="text-xs italic text-light-text-secondary dark:text-dark-text-secondary/60">
        {ar ? 'غير محدد بعد' : 'Not set yet'}
    </span>
);

const ConfidenceBar: React.FC<{ score: number; ar: boolean }> = ({ score, ar }) => {
    const pct = Math.round(score * 100);
    const barGradient = pct >= 70 
        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]' 
        : pct >= 40 
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.45)]' 
            : 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]';
    const label = pct >= 70
        ? (ar ? 'جاهز للعمل' : 'Ready to operate')
        : pct >= 40
            ? (ar ? 'يحتاج إكمال' : 'Needs completion')
            : (ar ? 'يحتاج معلومات أساسية' : 'Needs basic info');
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 overflow-hidden rounded-full bg-slate-950/60 p-[1px]" style={{ height: 10 }}>
                <div className={`h-full rounded-full transition-all duration-700 ${barGradient}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="min-w-[5rem] text-right text-xs font-bold text-white">{pct}% — {label}</span>
        </div>
    );
};

export const BrandBrainReviewScreen: React.FC<BrandBrainReviewScreenProps> = ({
    brandProfile,
    onApprove,
    onEdit,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [expandedSection, setExpandedSection] = useState<string | null>('identity');

    // Completeness score — covers all major brand profile fields (0–1)
    const completeness = (() => {
        const checks = [
            // Core identity
            !!brandProfile.brandName,
            !!brandProfile.industry,
            !!brandProfile.description,
            (brandProfile.businessModel?.length ?? 0) > 0,
            // Strategy
            !!brandProfile.valueProp,
            !!brandProfile.brandPromise,
            (brandProfile.messagingPillars?.length ?? 0) > 0,
            // Values & differentiation
            (brandProfile.values?.length ?? 0) > 0,
            (brandProfile.keySellingPoints?.length ?? 0) > 0,
            // Voice
            (brandProfile.brandVoice?.toneDescription?.length ?? 0) > 0,
            (brandProfile.brandVoice?.voiceGuidelines?.dos?.length ?? 0) > 0,
            // Audience
            (brandProfile.brandAudiences?.length ?? 0) > 0,
        ];
        return checks.filter(Boolean).length / checks.length;
    })();

    // Per-section completeness for granular feedback
    const sectionScores = {
        identity: [
            !!brandProfile.brandName,
            !!brandProfile.industry,
            !!brandProfile.description,
            (brandProfile.businessModel?.length ?? 0) > 0,
        ].filter(Boolean).length / 4,
        strategy: [
            !!brandProfile.valueProp,
            !!brandProfile.brandPromise,
            (brandProfile.messagingPillars?.length ?? 0) > 0,
        ].filter(Boolean).length / 3,
        voice: [
            (brandProfile.brandVoice?.toneDescription?.length ?? 0) > 0,
            (brandProfile.brandVoice?.keywords?.length ?? 0) > 0,
            (brandProfile.brandVoice?.voiceGuidelines?.dos?.length ?? 0) > 0,
        ].filter(Boolean).length / 3,
        audience: [
            (brandProfile.brandAudiences?.length ?? 0) > 0,
            (brandProfile.brandAudiences?.[0]?.painPoints?.length ?? 0) > 0,
        ].filter(Boolean).length / 2,
    };

    const sections: ReviewSection[] = [
        {
            id: 'identity',
            icon: 'fa-id-card',
            titleAr: 'هوية البراند الأساسية',
            titleEn: 'Core brand identity',
            color: 'text-brand-primary',
            bg: 'bg-brand-primary/8',
            items: [
                { labelAr: 'اسم البراند', labelEn: 'Brand name', value: brandProfile.brandName },
                { labelAr: 'المجال', labelEn: 'Industry', value: brandProfile.industry },
                { labelAr: 'وصف النشاط', labelEn: 'Business description', value: brandProfile.description },
                { labelAr: 'نموذج العمل', labelEn: 'Business model', value: brandProfile.businessModel?.join(' + ') },
                { labelAr: 'الدولة / السوق', labelEn: 'Country / Market', value: brandProfile.country },
                { labelAr: 'الموقع', labelEn: 'Website', value: brandProfile.website },
            ],
        },
        {
            id: 'strategy',
            icon: 'fa-chess',
            titleAr: 'الاستراتيجية التسويقية',
            titleEn: 'Marketing strategy',
            color: 'text-pink-400',
            bg: 'bg-pink-500/8',
            items: [
                { labelAr: 'عرض القيمة الفريدة', labelEn: 'Value proposition', value: brandProfile.valueProp },
                { labelAr: 'وعد البراند', labelEn: 'Brand promise', value: brandProfile.brandPromise },
                { labelAr: 'ركائز الرسائل', labelEn: 'Messaging pillars', value: brandProfile.messagingPillars },
                { labelAr: 'نقاط البيع الأساسية', labelEn: 'Key selling points', value: brandProfile.keySellingPoints },
            ],
        },
        {
            id: 'voice',
            icon: 'fa-microphone-lines',
            titleAr: 'صوت البراند ونبرته',
            titleEn: 'Brand voice & tone',
            color: 'text-violet-400',
            bg: 'bg-violet-500/8',
            items: [
                { labelAr: 'وصف النبرة', labelEn: 'Tone description', value: brandProfile.brandVoice?.toneDescription },
                { labelAr: 'الكلمات الجوهرية', labelEn: 'Core keywords', value: brandProfile.brandVoice?.keywords },
                { labelAr: 'كلمات ممنوعة', labelEn: 'Negative keywords', value: brandProfile.brandVoice?.negativeKeywords },
                { labelAr: 'ماذا نفعل', labelEn: 'Voice dos', value: brandProfile.brandVoice?.voiceGuidelines?.dos },
            ],
        },
        {
            id: 'values',
            icon: 'fa-star',
            titleAr: 'قيم البراند',
            titleEn: 'Brand values',
            color: 'text-amber-400',
            bg: 'bg-amber-500/8',
            items: [
                { labelAr: 'القيم الجوهرية', labelEn: 'Core values', value: brandProfile.values },
                { labelAr: 'إرشادات الأسلوب', labelEn: 'Style guidelines', value: brandProfile.styleGuidelines },
            ],
        },
        {
            id: 'audience',
            icon: 'fa-users',
            titleAr: 'الجمهور المستهدف',
            titleEn: 'Target audience',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/8',
            items: brandProfile.brandAudiences?.length > 0
                ? brandProfile.brandAudiences.map((a, i) => ({
                    labelAr: `شريحة ${i + 1}`,
                    labelEn: `Segment ${i + 1}`,
                    value: [
                        a.personaName && `${ar ? 'الشخصية:' : 'Persona:'} ${a.personaName}`,
                        a.description && `${ar ? 'الوصف:' : 'Description:'} ${a.description}`,
                        a.keyEmotions?.length ? `${ar ? 'المشاعر الجوهرية:' : 'Key emotions:'} ${a.keyEmotions.join('، ')}` : null,
                        a.painPoints?.length ? `${ar ? 'نقاط الألم:' : 'Pain points:'} ${a.painPoints.join('، ')}` : null,
                    ].filter(Boolean) as string[],
                }))
                : [{ labelAr: 'الجمهور المستهدف', labelEn: 'Target audience', value: [] }],
        },
    ];

    const renderValue = (val: string | string[] | number | undefined, sectionId: string) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return <EmptyValue ar={ar} />;
        
        const colors = {
            identity: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20',
            strategy: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
            voice: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
            values: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
            audience: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        }[sectionId] || 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20';

        if (Array.isArray(val)) {
            return (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {val.map((v, i) => <Badge key={i} text={v} color={colors} />)}
                </div>
            );
        }
        return <span className="text-sm font-medium text-light-text dark:text-dark-text">{String(val)}</span>;
    };

    return (
        <div className="animate-fade-in mx-auto max-w-3xl space-y-6 px-4 py-8">

            {/* Hero */}
            <div className="text-center relative py-6">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900/60 border border-white/10 text-brand-secondary shadow-[0_0_30px_rgba(6,182,212,0.25)] relative overflow-hidden group hover:scale-105 duration-350 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/10 to-transparent pointer-events-none" />
                    <i className="fas fa-brain text-3xl animate-pulse text-transparent bg-clip-text bg-gradient-to-r from-brand-secondary to-brand-primary" />
                </div>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-secondary leading-normal">
                    {ar ? 'فهمنا البراند بتاعك — راجع واعتمد' : "We've understood your brand — review & approve"}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-dark-text-secondary">
                    {ar
                        ? 'بناءً على المعلومات التي أدخلتها، بنى النظام صورة أولية عن البراند. راجع ما فهمناه وأكمل أي ناقص قبل البدء.'
                        : 'Based on the information you entered, the system built an initial brand picture. Review what we understood and complete anything missing before starting.'}
                </p>
            </div>

            {/* Completeness bar + per-section breakdown */}
            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden group hover:border-white/10 hover:shadow-[0_0_35px_rgba(37,99,235,0.08)] transition-all duration-300">
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-primary/15 transition-all duration-500" />
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white">
                        {ar ? 'جاهزية عقل البراند' : 'Brand Brain readiness'}
                    </p>
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-secondary hover:text-white transition-colors"
                    >
                        <i className="fas fa-pen text-[10px]" />
                        {ar ? 'أكمل البيانات' : 'Complete data'}
                    </button>
                </div>
                <ConfidenceBar score={completeness} ar={ar} />

                {/* Section-level mini scores */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    {[
                        { key: 'identity',  labelAr: 'الهوية',     labelEn: 'Identity',  color: 'bg-gradient-to-r from-brand-primary to-blue-400' },
                        { key: 'strategy',  labelAr: 'الاستراتيجية', labelEn: 'Strategy', color: 'bg-gradient-to-r from-pink-500 to-rose-400'       },
                        { key: 'voice',     labelAr: 'الصوت',      labelEn: 'Voice',     color: 'bg-gradient-to-r from-violet-500 to-purple-400'    },
                        { key: 'audience',  labelAr: 'الجمهور',    labelEn: 'Audience',  color: 'bg-gradient-to-r from-emerald-500 to-teal-400'   },
                    ].map(({ key, labelAr, labelEn, color }) => {
                        const pct = Math.round(sectionScores[key as keyof typeof sectionScores] * 100);
                        return (
                            <div key={key} className="space-y-1 bg-slate-950/20 px-3.5 py-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-slate-950/40 transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-dark-text-secondary font-bold">{ar ? labelAr : labelEn}</span>
                                    <span className="text-[10px] font-bold text-white">{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-950/60 overflow-hidden p-[1px]">
                                    <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Review sections */}
            <div className="space-y-3">
                {sections.map((section) => {
                    const isOpen = expandedSection === section.id;
                    return (
                        <div key={section.id} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.01)] group relative">
                            <button
                                className="flex w-full items-center gap-4 p-5 text-start"
                                onClick={() => setExpandedSection(isOpen ? null : section.id)}
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950/40 border border-white/10 text-brand-secondary shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-200">
                                    <i className={`fas ${section.icon} text-xs`} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white">
                                        {ar ? section.titleAr : section.titleEn}
                                    </p>
                                    {!isOpen && (
                                        <p className="mt-0.5 text-[10px] text-dark-text-secondary/70">
                                            {section.items.some((item) => !item.value || (Array.isArray(item.value) && item.value.length === 0))
                                                ? (ar ? 'يوجد حقول ناقصة' : 'Some fields missing')
                                                : (ar ? 'مكتمل' : 'Complete')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {section.items.every((item) => item.value && !(Array.isArray(item.value) && item.value.length === 0)) ? (
                                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/10">
                                            {ar ? 'مكتمل' : 'Complete'}
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/10">
                                            {ar ? 'غير مكتمل' : 'Incomplete'}
                                        </span>
                                    )}
                                    <i className={`fas fa-chevron-down text-xs text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {isOpen && (
                                <div className="border-t border-white/5 px-6 pb-6 pt-5 bg-slate-950/30">
                                    <div className="space-y-4">
                                        {section.items.map((item, idx) => (
                                            <div key={idx}>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-dark-text-secondary/60">
                                                    {ar ? item.labelAr : item.labelEn}
                                                </p>
                                                <div className="mt-1">
                                                    {renderValue(item.value, section.id)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={onEdit}
                                        className="mt-5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-3.5 py-2 text-xs font-bold text-dark-text-secondary hover:text-white transition-all hover:bg-slate-950/60"
                                    >
                                        <i className="fas fa-pen text-[10px]" />
                                        {ar ? 'تعديل هذا القسم' : 'Edit this section'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* What happens after approval */}
            <div className="bg-slate-900/35 border border-white/5 backdrop-blur-md p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-white/10 duration-300 transition-all">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-secondary">
                    {ar ? 'بعد الاعتماد' : 'After approval'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                    {[
                        { icon: 'fa-wand-magic-sparkles', textAr: 'المحتوى يُولَّد بصوت البراند الفعلي',       textEn: 'Content generated in actual brand voice'       },
                        { icon: 'fa-comment-dots',         textAr: 'الردود تتبع أسلوب البراند وسيناريوهاته', textEn: 'Replies follow brand style and scenarios'       },
                        { icon: 'fa-lightbulb',            textAr: 'الاقتراحات مخصصة لمجالك وجمهورك',        textEn: 'Suggestions tailored to your field & audience'  },
                        { icon: 'fa-chart-line',           textAr: 'النظام يتعلم ويتحسن مع كل تفاعل',        textEn: 'System learns and improves with every interaction'},
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-brand-secondary">
                                <i className={`fas ${item.icon} text-xs`} />
                            </div>
                            <p className="text-xs text-white/80">{ar ? item.textAr : item.textEn}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-2">
                <button
                    onClick={onEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 text-xs font-bold text-dark-text-secondary hover:text-white hover:border-white/20 hover:bg-slate-900/85 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)] transition-all duration-200"
                >
                    <i className="fas fa-pen text-xs" />
                    {ar ? 'تعديل معلومات البراند' : 'Edit brand information'}
                </button>
                <button
                    onClick={onApprove}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary px-8 py-3.5 text-xs font-black text-white shadow-lg shadow-brand-primary/30 hover:shadow-[0_0_25px_rgba(37,99,235,0.35)] hover:scale-[1.03] transition-all duration-250 transform active:scale-[0.98]"
                >
                    <i className="fas fa-check text-xs" />
                    {ar ? 'اعتمد وابدأ التشغيل' : 'Approve & start operating'}
                    {ar ? <i className="fas fa-arrow-left text-xs" /> : <i className="fas fa-arrow-right text-xs" />}
                </button>
            </div>
        </div>
    );
};
