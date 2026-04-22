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

const Badge: React.FC<{ text: string; color?: string }> = ({ text, color = 'bg-brand-primary/10 text-brand-primary' }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
        {text}
    </span>
);

const EmptyValue: React.FC<{ ar: boolean }> = ({ ar }) => (
    <span className="text-xs italic text-light-text-secondary dark:text-dark-text-secondary">
        {ar ? 'غير محدد بعد' : 'Not set yet'}
    </span>
);

const ConfidenceBar: React.FC<{ score: number; ar: boolean }> = ({ score, ar }) => {
    const pct = Math.round(score * 100);
    const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
    const label = pct >= 70
        ? (ar ? 'جاهز للعمل' : 'Ready to operate')
        : pct >= 40
            ? (ar ? 'يحتاج إكمال' : 'Needs completion')
            : (ar ? 'يحتاج معلومات أساسية' : 'Needs core information');
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg" style={{ height: 6 }}>
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="min-w-[5rem] text-right text-xs font-semibold text-light-text dark:text-dark-text">{pct}% — {label}</span>
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

    // Compute a simple completeness score (0–1)
    const completeness = (() => {
        let score = 0;
        const checks = [
            !!brandProfile.brandName,
            !!brandProfile.industry,
            brandProfile.values.length > 0,
            brandProfile.keySellingPoints.length > 0,
            !!brandProfile.brandVoice?.toneDescription?.length,
            brandProfile.brandAudiences.length > 0,
        ];
        checks.forEach((c) => { if (c) score++; });
        return score / checks.length;
    })();

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
                { labelAr: 'الدولة / السوق', labelEn: 'Country / Market', value: brandProfile.country },
                { labelAr: 'الموقع', labelEn: 'Website', value: brandProfile.website },
            ],
        },
        {
            id: 'voice',
            icon: 'fa-microphone-lines',
            titleAr: 'صوت البراند ونبرته',
            titleEn: 'Brand voice & tone',
            color: 'text-violet-600',
            bg: 'bg-violet-500/8',
            items: [
                { labelAr: 'وصف النبرة', labelEn: 'Tone description', value: brandProfile.brandVoice?.toneDescription },
                { labelAr: 'الكلمات الجوهرية', labelEn: 'Core keywords', value: brandProfile.brandVoice?.keywords },
                { labelAr: 'كلمات ممنوعة', labelEn: 'Negative keywords', value: brandProfile.brandVoice?.negativeKeywords },
            ],
        },
        {
            id: 'values',
            icon: 'fa-star',
            titleAr: 'قيم البراند ونقاط التميز',
            titleEn: 'Brand values & USPs',
            color: 'text-amber-600',
            bg: 'bg-amber-500/8',
            items: [
                { labelAr: 'القيم الجوهرية', labelEn: 'Core values', value: brandProfile.values },
                { labelAr: 'نقاط البيع الأساسية', labelEn: 'Key selling points', value: brandProfile.keySellingPoints },
                { labelAr: 'إرشادات الأسلوب', labelEn: 'Style guidelines', value: brandProfile.styleGuidelines },
            ],
        },
        {
            id: 'audience',
            icon: 'fa-users',
            titleAr: 'الجمهور المستهدف',
            titleEn: 'Target audience',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/8',
            items: brandProfile.brandAudiences.length > 0
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

    const renderValue = (val: string | string[] | number | undefined) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return <EmptyValue ar={ar} />;
        if (Array.isArray(val)) {
            return (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {val.map((v, i) => <Badge key={i} text={v} />)}
                </div>
            );
        }
        return <span className="text-sm font-medium text-light-text dark:text-dark-text">{String(val)}</span>;
    };

    return (
        <div className="animate-fade-in mx-auto max-w-3xl space-y-6 px-4 py-8">

            {/* Hero */}
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                    <i className="fas fa-brain text-2xl" />
                </div>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">
                    {ar ? 'فهمنا البراند بتاعك — راجع واعتمد' : "We've understood your brand — review & approve"}
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    {ar
                        ? 'بناءً على المعلومات التي أدخلتها، بنى النظام صورة أولية عن البراند. راجع ما فهمناه وأكمل أي ناقص قبل البدء.'
                        : 'Based on the information you entered, the system built an initial brand picture. Review what we understood and complete anything missing before starting.'}
                </p>
            </div>

            {/* Completeness bar */}
            <div className="surface-panel rounded-[1.5rem] p-5">
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                        {ar ? 'جاهزية عقل البراند' : 'Brand Brain readiness'}
                    </p>
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
                    >
                        <i className="fas fa-pen text-[10px]" />
                        {ar ? 'أكمل البيانات' : 'Complete data'}
                    </button>
                </div>
                <ConfidenceBar score={completeness} ar={ar} />
            </div>

            {/* Review sections */}
            <div className="space-y-3">
                {sections.map((section) => {
                    const isOpen = expandedSection === section.id;
                    return (
                        <div key={section.id} className="surface-panel overflow-hidden rounded-[1.5rem]">
                            <button
                                className="flex w-full items-center gap-4 p-5 text-start"
                                onClick={() => setExpandedSection(isOpen ? null : section.id)}
                            >
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${section.bg} ${section.color}`}>
                                    <i className={`fas ${section.icon} text-sm`} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                        {ar ? section.titleAr : section.titleEn}
                                    </p>
                                    {!isOpen && (
                                        <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {section.items.some((item) => !item.value || (Array.isArray(item.value) && item.value.length === 0))
                                                ? (ar ? 'يوجد حقول ناقصة' : 'Some fields missing')
                                                : (ar ? 'مكتمل' : 'Complete')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {section.items.every((item) => item.value && !(Array.isArray(item.value) && item.value.length === 0)) ? (
                                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                            {ar ? 'مكتمل' : 'Complete'}
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                            {ar ? 'غير مكتمل' : 'Incomplete'}
                                        </span>
                                    )}
                                    <i className={`fas fa-chevron-down text-xs text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {isOpen && (
                                <div className="border-t border-light-border/40 px-5 pb-5 pt-4 dark:border-dark-border/40">
                                    <div className="space-y-4">
                                        {section.items.map((item, idx) => (
                                            <div key={idx}>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-light-text-secondary dark:text-dark-text-secondary">
                                                    {ar ? item.labelAr : item.labelEn}
                                                </p>
                                                <div className="mt-1">
                                                    {renderValue(item.value)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={onEdit}
                                        className="mt-4 flex items-center gap-1.5 rounded-xl bg-light-bg px-3 py-2 text-xs font-semibold text-light-text transition-colors hover:bg-brand-primary/10 hover:text-brand-primary dark:bg-dark-bg dark:text-dark-text"
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
            <div className="rounded-[1.5rem] border border-brand-primary/20 bg-brand-primary/5 p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-primary">
                    {ar ? 'بعد الاعتماد' : 'After approval'}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                    {[
                        { icon: 'fa-wand-magic-sparkles', textAr: 'المحتوى يُولَّد بصوت البراند الفعلي',       textEn: 'Content generated in actual brand voice'       },
                        { icon: 'fa-comment-dots',         textAr: 'الردود تتبع أسلوب البراند وسيناريوهاته', textEn: 'Replies follow brand style and scenarios'       },
                        { icon: 'fa-lightbulb',            textAr: 'الاقتراحات مخصصة لمجالك وجمهورك',        textEn: 'Suggestions tailored to your field & audience'  },
                        { icon: 'fa-chart-line',           textAr: 'النظام يتعلم ويتحسن مع كل تفاعل',        textEn: 'System learns and improves with every interaction'},
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                                <i className={`fas ${item.icon} text-xs`} />
                            </div>
                            <p className="text-xs text-light-text dark:text-dark-text">{ar ? item.textAr : item.textEn}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                    onClick={onEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-light-border bg-white px-6 py-3 text-sm font-semibold text-light-text transition-colors hover:bg-light-bg dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
                >
                    <i className="fas fa-pen text-xs" />
                    {ar ? 'تعديل معلومات البراند' : 'Edit brand information'}
                </button>
                <button
                    onClick={onApprove}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-8 py-3 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                    <i className="fas fa-check text-xs" />
                    {ar ? 'اعتمد وابدأ التشغيل' : 'Approve & start operating'}
                    <i className="fas fa-arrow-left text-xs" />
                </button>
            </div>
        </div>
    );
};
