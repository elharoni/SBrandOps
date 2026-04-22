// components/media/CreativeRequestModal.tsx
// Creative Request Modal — intake form لبدء مشروع ميديا جديد

import React, { useState } from 'react';
import {
    CreativeRequestForm,
    MediaProjectGoal,
    MediaProjectOutputType,
    MediaProjectPriority,
    NotificationType,
    SocialPlatform,
    PLATFORM_ASSETS,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';

// ── Option configs ────────────────────────────────────────────────────────────

const GOALS: { value: MediaProjectGoal; ar: string; en: string; icon: string }[] = [
    { value: 'awareness',  ar: 'رفع الوعي',      en: 'Awareness',   icon: 'fa-bullhorn' },
    { value: 'engagement', ar: 'رفع التفاعل',    en: 'Engagement',  icon: 'fa-comments' },
    { value: 'conversion', ar: 'تحويل وبيع',     en: 'Conversion',  icon: 'fa-dollar-sign' },
    { value: 'leads',      ar: 'توليد عملاء',    en: 'Leads',       icon: 'fa-user-plus' },
    { value: 'retention',  ar: 'تحفيز العودة',   en: 'Retention',   icon: 'fa-rotate-left' },
    { value: 'traffic',    ar: 'زيارات الموقع',  en: 'Traffic',     icon: 'fa-arrow-trend-up' },
];

const OUTPUT_TYPES: { value: MediaProjectOutputType; ar: string; en: string; icon: string }[] = [
    { value: 'static',   ar: 'تصميم ثابت',   en: 'Static',   icon: 'fa-image' },
    { value: 'carousel', ar: 'كاروسيل',      en: 'Carousel', icon: 'fa-images' },
    { value: 'reel',     ar: 'ريل / فيديو',  en: 'Reel',     icon: 'fa-film' },
    { value: 'story',    ar: 'ستوري',        en: 'Story',    icon: 'fa-circle-notch' },
    { value: 'ad',       ar: 'إعلان',        en: 'Ad',       icon: 'fa-rectangle-ad' },
    { value: 'motion',   ar: 'موشن',         en: 'Motion',   icon: 'fa-wand-magic-sparkles' },
    { value: 'mixed',    ar: 'متعدد',        en: 'Mixed',    icon: 'fa-layer-group' },
];

const PRIORITIES: { value: MediaProjectPriority; ar: string; en: string; color: string }[] = [
    { value: 'low',    ar: 'منخفضة',  en: 'Low',    color: 'text-gray-400' },
    { value: 'normal', ar: 'عادية',   en: 'Normal', color: 'text-blue-400' },
    { value: 'high',   ar: 'عالية',   en: 'High',   color: 'text-amber-400' },
    { value: 'urgent', ar: 'عاجل',    en: 'Urgent', color: 'text-rose-400' },
];

const BLANK: CreativeRequestForm = {
    title: '',
    goal: 'awareness',
    outputType: 'static',
    campaign: '',
    productOffer: '',
    cta: '',
    platforms: [],
    deadline: '',
    priority: 'normal',
    notes: '',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface CreativeRequestModalProps {
    onClose: () => void;
    onSubmit: (form: CreativeRequestForm) => Promise<void>;
    addNotification: (type: NotificationType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CreativeRequestModal: React.FC<CreativeRequestModalProps> = ({
    onClose,
    onSubmit,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [form, setForm] = useState<CreativeRequestForm>(BLANK);
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

    const set = <K extends keyof CreativeRequestForm>(key: K, val: CreativeRequestForm[K]) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const togglePlatform = (p: SocialPlatform) => {
        set(
            'platforms',
            form.platforms.includes(p)
                ? form.platforms.filter(x => x !== p)
                : [...form.platforms, p],
        );
    };

    const canProceed = form.title.trim().length > 0;
    const canSubmit  = canProceed && form.platforms.length > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSaving(true);
        try {
            await onSubmit(form);
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل إنشاء المشروع.' : 'Failed to create project.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="relative flex w-full max-w-2xl flex-col rounded-3xl border border-dark-border bg-dark-card shadow-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-dark-border px-6 py-5 flex-shrink-0">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                            {ar ? 'استوديو الميديا' : 'Media Studio'}
                        </p>
                        <h2 className="mt-0.5 text-xl font-black text-white">
                            {ar ? 'طلب إبداعي جديد' : 'New Creative Request'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:border-white/20 hover:text-white"
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex border-b border-dark-border flex-shrink-0">
                    {([1, 2] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => s === 1 || canProceed ? setStep(s) : undefined}
                            className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
                                step === s
                                    ? 'border-b-2 border-brand-primary text-white'
                                    : canProceed || s === 1
                                        ? 'text-dark-text-secondary hover:text-white'
                                        : 'cursor-not-allowed text-dark-text-secondary/40'
                            }`}
                        >
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                                step === s ? 'bg-brand-primary text-white' : 'bg-dark-bg text-dark-text-secondary'
                            }`}>
                                {s}
                            </span>
                            {s === 1
                                ? (ar ? 'الهدف والمخرج' : 'Goal & Output')
                                : (ar ? 'التفاصيل والمنصات' : 'Details & Platforms')}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {step === 1 && (
                        <>
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'عنوان المشروع *' : 'Project Title *'}
                                </label>
                                <input
                                    value={form.title}
                                    onChange={e => set('title', e.target.value)}
                                    placeholder={ar
                                        ? 'مثال: تصميمات رمضان 2025 — منتج X'
                                        : 'e.g. Ramadan 2025 Creatives — Product X'}
                                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 placeholder:text-dark-text-secondary/50"
                                />
                            </div>

                            {/* Goal */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الهدف التسويقي *' : 'Marketing Goal *'}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {GOALS.map(g => (
                                        <button
                                            key={g.value}
                                            type="button"
                                            onClick={() => set('goal', g.value)}
                                            className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                                                form.goal === g.value
                                                    ? 'border-brand-primary bg-brand-primary/10 text-white'
                                                    : 'border-dark-border bg-dark-bg text-dark-text-secondary hover:border-dark-text-secondary/40 hover:text-white'
                                            }`}
                                        >
                                            <i className={`fas ${g.icon} w-4 text-center ${form.goal === g.value ? 'text-brand-secondary' : ''}`} />
                                            {ar ? g.ar : g.en}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Output Type */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'نوع المخرج *' : 'Output Type *'}
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {OUTPUT_TYPES.map(o => (
                                        <button
                                            key={o.value}
                                            type="button"
                                            onClick={() => set('outputType', o.value)}
                                            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all ${
                                                form.outputType === o.value
                                                    ? 'border-brand-primary bg-brand-primary/10 text-white'
                                                    : 'border-dark-border bg-dark-bg text-dark-text-secondary hover:border-dark-text-secondary/40 hover:text-white'
                                            }`}
                                        >
                                            <i className={`fas ${o.icon} text-base ${form.outputType === o.value ? 'text-brand-secondary' : ''}`} />
                                            {ar ? o.ar : o.en}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الأولوية' : 'Priority'}
                                </label>
                                <div className="flex gap-2">
                                    {PRIORITIES.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => set('priority', p.value)}
                                            className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                                                form.priority === p.value
                                                    ? `border-brand-primary bg-brand-primary/10 ${p.color}`
                                                    : 'border-dark-border bg-dark-bg text-dark-text-secondary hover:text-white'
                                            }`}
                                        >
                                            {ar ? p.ar : p.en}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {/* Campaign */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الحملة أو المناسبة' : 'Campaign / Occasion'}
                                </label>
                                <input
                                    value={form.campaign}
                                    onChange={e => set('campaign', e.target.value)}
                                    placeholder={ar ? 'مثال: رمضان 2025 / إطلاق منتج جديد' : 'e.g. Ramadan 2025 / Product Launch'}
                                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                                />
                            </div>

                            {/* Product / Offer */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'المنتج أو العرض' : 'Product / Offer'}
                                </label>
                                <input
                                    value={form.productOffer}
                                    onChange={e => set('productOffer', e.target.value)}
                                    placeholder={ar ? 'مثال: تشيرت كلاسيك — خصم 20%' : 'e.g. Classic Tee — 20% off'}
                                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                                />
                            </div>

                            {/* CTA */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الـ CTA' : 'Call To Action'}
                                </label>
                                <input
                                    value={form.cta}
                                    onChange={e => set('cta', e.target.value)}
                                    placeholder={ar ? 'مثال: اشتري الآن / تواصل معنا / سجّل مجاناً' : 'e.g. Shop Now / Contact Us / Register Free'}
                                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                                />
                            </div>

                            {/* Platforms */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'المنصات المستهدفة *' : 'Target Platforms *'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.values(SocialPlatform).map(p => {
                                        const asset = PLATFORM_ASSETS[p];
                                        const selected = form.platforms.includes(p);
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => togglePlatform(p)}
                                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                                    selected
                                                        ? 'bg-brand-primary text-white shadow-sm'
                                                        : 'border border-dark-border bg-dark-bg text-dark-text-secondary hover:border-brand-primary/40 hover:text-white'
                                                }`}
                                            >
                                                <i className={`fas ${asset.icon} text-[10px]`} />
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Deadline */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الموعد النهائي' : 'Deadline'}
                                </label>
                                <input
                                    type="date"
                                    value={form.deadline}
                                    onChange={e => set('deadline', e.target.value)}
                                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60"
                                />
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'ملاحظات إضافية' : 'Additional Notes'}
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => set('notes', e.target.value)}
                                    rows={3}
                                    placeholder={ar
                                        ? 'أي تفاصيل أو سياق إضافي يساعد الذكاء الاصطناعي...'
                                        : 'Any extra details or context that helps the AI...'}
                                    className="w-full resize-none rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-dark-border px-6 py-4 flex-shrink-0">
                    {step === 1 ? (
                        <>
                            <button
                                onClick={onClose}
                                className="rounded-xl border border-dark-border px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-colors hover:text-white"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={!canProceed}
                                className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                            >
                                {ar ? 'التالي' : 'Next'}
                                <i className="fas fa-arrow-left text-xs" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-colors hover:text-white"
                            >
                                <i className="fas fa-arrow-right text-xs" />
                                {ar ? 'السابق' : 'Back'}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit || isSaving}
                                className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                            >
                                <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-bolt'} text-xs`} />
                                {ar ? 'إنشاء وبناء البريف' : 'Create & Build Brief'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
