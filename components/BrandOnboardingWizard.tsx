import React, { useState } from 'react';
import { NotificationType } from '../types';
import { addBrand } from '../services/brandService';
import { updateBrandProfile } from '../services/brandHubService';
import { useLanguage } from '../context/LanguageContext';
import { BrandImportModal } from './BrandImportModal';

interface BrandOnboardingWizardProps {
    onComplete: (brandId: string) => void;
    onCancel: () => void;
    addNotification: (type: NotificationType, message: string) => void;
}

type Step = 'info' | 'voice' | 'connect' | 'done';

const INDUSTRY_OPTIONS = [
    { en: 'E-commerce',         ar: 'تجارة إلكترونية', icon: 'fa-bag-shopping' },
    { en: 'Food & Beverage',    ar: 'مطاعم وأغذية',    icon: 'fa-utensils' },
    { en: 'Fashion & Apparel',  ar: 'أزياء وملابس',    icon: 'fa-shirt' },
    { en: 'Health & Wellness',  ar: 'صحة ولياقة',       icon: 'fa-heart-pulse' },
    { en: 'Technology',         ar: 'تقنية',            icon: 'fa-microchip' },
    { en: 'Real Estate',        ar: 'عقارات',           icon: 'fa-building' },
    { en: 'Education',          ar: 'تعليم',            icon: 'fa-graduation-cap' },
    { en: 'Beauty & Cosmetics', ar: 'جمال وتجميل',     icon: 'fa-spa' },
    { en: 'Travel & Tourism',   ar: 'سياحة وسفر',      icon: 'fa-plane' },
    { en: 'Finance & Banking',  ar: 'مالية ومصرفية',   icon: 'fa-landmark' },
    { en: 'Healthcare',         ar: 'رعاية صحية',       icon: 'fa-stethoscope' },
    { en: 'Automotive',         ar: 'سيارات',           icon: 'fa-car' },
    { en: 'Entertainment',      ar: 'ترفيه',            icon: 'fa-film' },
    { en: 'Sports & Fitness',   ar: 'رياضة وتمارين',  icon: 'fa-dumbbell' },
    { en: 'Non-Profit',         ar: 'منظمة غير ربحية', icon: 'fa-handshake' },
    { en: 'Other',              ar: 'أخرى',             icon: 'fa-grid-2' },
];

const BRAND_VALUE_OPTIONS = [
    { en: 'Quality',        ar: 'الجودة' },
    { en: 'Innovation',     ar: 'الابتكار' },
    { en: 'Integrity',      ar: 'النزاهة' },
    { en: 'Customer Focus', ar: 'التركيز على العميل' },
    { en: 'Sustainability', ar: 'الاستدامة' },
    { en: 'Transparency',   ar: 'الشفافية' },
    { en: 'Excellence',     ar: 'التميز' },
    { en: 'Creativity',     ar: 'الإبداع' },
    { en: 'Trust',          ar: 'الثقة' },
    { en: 'Community',      ar: 'المجتمع' },
    { en: 'Diversity',      ar: 'التنوع' },
    { en: 'Passion',        ar: 'الشغف' },
];

const TONE_OF_VOICE_OPTIONS = [
    { en: 'Friendly',      ar: 'ودود' },
    { en: 'Professional',  ar: 'احترافي' },
    { en: 'Casual',        ar: 'غير رسمي' },
    { en: 'Authoritative', ar: 'موثوق' },
    { en: 'Inspiring',     ar: 'ملهم' },
    { en: 'Humorous',      ar: 'فكاهي' },
    { en: 'Empathetic',    ar: 'متعاطف' },
    { en: 'Bold',          ar: 'جريء' },
    { en: 'Elegant',       ar: 'راقي' },
    { en: 'Educational',   ar: 'تعليمي' },
    { en: 'Energetic',     ar: 'نشيط' },
    { en: 'Minimalist',    ar: 'بسيط' },
];

interface ChipProps {
    label: string;
    icon?: string;
    selected: boolean;
    onClick: () => void;
}

const SelectableChip: React.FC<ChipProps> = ({ label, icon, selected, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
            selected
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                : 'bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-light-border dark:border-dark-border hover:border-brand-primary/60 hover:bg-brand-primary/5'
        }`}
    >
        {icon && <i className={`fas ${icon} text-[10px] opacity-80`} />}
        {label}
        {selected && <i className="fas fa-check text-[10px] opacity-90" />}
    </button>
);

interface TagBadgeProps {
    label: string;
    colorClass: string;
    onRemove: () => void;
}

const TagBadge: React.FC<TagBadgeProps> = ({ label, colorClass, onRemove }) => (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${colorClass}`}>
        {label}
        <button
            type="button"
            onClick={onRemove}
            className="hover:opacity-60 transition-opacity"
            aria-label="Remove"
        >
            <i className="fas fa-xmark text-xs" />
        </button>
    </span>
);

export const BrandOnboardingWizard: React.FC<BrandOnboardingWizardProps> = ({ onComplete, onCancel, addNotification }) => {
    const { t, language } = useLanguage();
    const [currentStep, setCurrentStep] = useState<Step>('info');
    const [isSaving, setIsSaving] = useState(false);
    const [showImport, setShowImport] = useState(false);

    const [brandName, setBrandName] = useState('');
    const [industry, setIndustry] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    const [brandValues, setBrandValues] = useState<string[]>([]);
    const [toneDescription, setToneDescription] = useState<string[]>([]);
    const [newValue, setNewValue] = useState('');
    const [newTone, setNewTone] = useState('');

    const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);

    const ar = language === 'ar';

    const handleStep1Next = () => {
        if (!brandName.trim()) {
            addNotification(NotificationType.Error, ar ? 'الرجاء إدخال اسم العلامة التجارية' : 'Please enter brand name');
            return;
        }
        setCurrentStep('voice');
    };

    const saveBrandToDb = async (skipVoice = false) => {
        setIsSaving(true);
        setCurrentStep('connect');
        try {
            const newBrand = await addBrand(brandName, industry, logoUrl);
            setCreatedBrandId(newBrand.id);

            if (!skipVoice && (brandValues.length > 0 || toneDescription.length > 0)) {
                await updateBrandProfile(newBrand.id, {
                    values: brandValues,
                    brandVoice: {
                        toneDescription,
                        keywords: [],
                        negativeKeywords: [],
                        toneStrength: 0.5,
                        toneSentiment: 0.5,
                    },
                });
            }

            addNotification(NotificationType.Success, ar ? `تم إنشاء "${brandName}" بنجاح!` : `Brand "${brandName}" created!`);
        } catch (error: any) {
            console.error('Failed to save brand:', error);
            addNotification(NotificationType.Error, ar ? `تحذير: لم يتم حفظ البيانات (${error.message})` : `Warning: data not saved (${error.message})`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStep2Next = () => saveBrandToDb(false);
    const handleSkipVoice = () => saveBrandToDb(true);

    const handleFinish = () => {
        if (createdBrandId) onComplete(createdBrandId);
        else onComplete('');
    };

    const toggleIndustry = (val: string) => setIndustry(prev => (prev === val ? '' : val));

    const toggleValue = (val: string) => {
        setBrandValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    };

    const addCustomValue = () => {
        const v = newValue.trim();
        if (v && !brandValues.includes(v)) { setBrandValues(prev => [...prev, v]); setNewValue(''); }
    };

    const toggleTone = (tone: string) => {
        setToneDescription(prev => prev.includes(tone) ? prev.filter(t => t !== tone) : [...prev, tone]);
    };

    const addCustomTone = () => {
        const v = newTone.trim();
        if (v && !toneDescription.includes(v)) { setToneDescription(prev => [...prev, v]); setNewTone(''); }
    };

    const steps = [
        { key: 'info',    label: ar ? 'معلومات العلامة' : 'Brand Info',      icon: 'fa-building-2' },
        { key: 'voice',   label: ar ? 'صوت العلامة'    : 'Brand Voice',      icon: 'fa-waveform' },
        { key: 'connect', label: ar ? 'ربط الحسابات'   : 'Connect Accounts', icon: 'fa-link' },
        { key: 'done',    label: ar ? 'تم!'             : 'Done',             icon: 'fa-circle-check' },
    ];
    const currentStepIndex = steps.findIndex(s => s.key === currentStep);

    return (
        <>
        {showImport && (
            <BrandImportModal
                onClose={() => setShowImport(false)}
                onImported={(brandId) => {
                    setShowImport(false);
                    onComplete(brandId);
                }}
            />
        )}
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" dir={ar ? 'rtl' : 'ltr'}>
            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-light-border dark:border-dark-border">

                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                <i className="fas fa-layer-group text-brand-primary text-sm" />
                            </div>
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
                                {ar ? 'إعداد علامة تجارية جديدة' : 'Set Up New Brand'}
                            </h2>
                        </div>
                        <button
                            onClick={onCancel}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition-all"
                        >
                            <i className="fas fa-xmark text-sm" />
                        </button>
                    </div>

                    {/* Progress stepper */}
                    <div className="flex items-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.key}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm ${
                                        index < currentStepIndex
                                            ? 'bg-emerald-500/15 text-emerald-500'
                                            : index === currentStepIndex
                                                ? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/30'
                                                : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'
                                    }`}>
                                        {index < currentStepIndex
                                            ? <i className="fas fa-check text-xs" />
                                            : <i className={`fas ${step.icon} text-xs`} />
                                        }
                                    </div>
                                    <p className={`text-[10px] mt-1 whitespace-nowrap font-medium ${index <= currentStepIndex ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                        {step.label}
                                    </p>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-px mx-2 mb-4 transition-all ${index < currentStepIndex ? 'bg-emerald-500/40' : 'bg-light-border dark:bg-dark-border'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* STEP 1: Brand Info */}
                    {currentStep === 'info' && (
                        <div className="space-y-6 animate-fade-in">

                            {/* Import from file card */}
                            <button
                                type="button"
                                onClick={() => setShowImport(true)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-brand-primary/40 hover:border-brand-primary hover:bg-brand-primary/5 transition-all text-right group"
                            >
                                <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-primary/20 transition-colors">
                                    <i className="fas fa-file-import text-brand-primary text-lg" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-light-text dark:text-dark-text text-sm">
                                        {ar ? 'استيراد من ملف' : 'Import from File'}
                                    </p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                        {ar
                                            ? 'لديك وثيقة براند من ChatGPT أو Claude؟ استوردها وسيملأ الـ AI كل شيء في دقائق'
                                            : 'Have a brand document from ChatGPT or Claude? Import it and AI fills everything in minutes'}
                                    </p>
                                </div>
                                <i className="fas fa-chevron-left text-brand-primary/50 group-hover:text-brand-primary transition-colors flex-shrink-0 text-sm" />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 border-t border-light-border dark:border-dark-border" />
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                                    {ar ? 'أو أدخل يدوياً' : 'or enter manually'}
                                </span>
                                <div className="flex-1 border-t border-light-border dark:border-dark-border" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    {ar ? 'اسم العلامة التجارية' : 'Brand Name'}
                                    <span className="text-brand-primary ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={brandName}
                                    onChange={e => setBrandName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleStep1Next()}
                                    placeholder={ar ? 'مثال: شركتي' : 'Example: My Company'}
                                    className="w-full px-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all text-sm"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                    {ar ? 'الصناعة / القطاع' : 'Industry / Sector'}
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal text-xs ml-2">({ar ? 'اختياري' : 'optional'})</span>
                                </label>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                    {ar ? 'اختر القطاع الذي تعمل فيه' : 'Select the sector your brand operates in'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {INDUSTRY_OPTIONS.map(opt => (
                                        <SelectableChip
                                            key={opt.en}
                                            label={ar ? opt.ar : opt.en}
                                            icon={opt.icon}
                                            selected={industry === opt.en}
                                            onClick={() => toggleIndustry(opt.en)}
                                        />
                                    ))}
                                </div>
                                {industry && (
                                    <p className="mt-2.5 text-xs text-brand-primary font-medium flex items-center gap-1.5">
                                        <i className="fas fa-check-circle text-[11px]" />
                                        {ar ? 'تم الاختيار:' : 'Selected:'} {INDUSTRY_OPTIONS.find(o => o.en === industry)?.[ar ? 'ar' : 'en'] ?? industry}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    {ar ? 'رابط الشعار' : 'Logo URL'}
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal text-xs ml-2">({ar ? 'اختياري' : 'optional'})</span>
                                </label>
                                <input
                                    type="url"
                                    value={logoUrl}
                                    onChange={e => setLogoUrl(e.target.value)}
                                    placeholder="https://example.com/logo.png"
                                    className="w-full px-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Brand Voice */}
                    {currentStep === 'voice' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                    {ar ? 'قيم العلامة التجارية' : 'Brand Values'}
                                </label>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                    {ar ? 'اختر من الخيارات أو أضف خياراً مخصصاً' : 'Pick from suggestions or add your own'}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    {BRAND_VALUE_OPTIONS.map(opt => (
                                        <SelectableChip
                                            key={opt.en}
                                            label={ar ? opt.ar : opt.en}
                                            selected={brandValues.includes(opt.en)}
                                            onClick={() => toggleValue(opt.en)}
                                        />
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newValue}
                                        onChange={e => setNewValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomValue()}
                                        placeholder={ar ? 'أضف قيمة مخصصة...' : 'Add custom value...'}
                                        className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomValue}
                                        className="px-3 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                                    >
                                        <i className="fas fa-plus text-sm" />
                                    </button>
                                </div>

                                {brandValues.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/15">
                                        <span className="text-xs text-brand-primary font-semibold w-full mb-1">
                                            {ar ? 'القيم المختارة:' : 'Selected values:'}
                                        </span>
                                        {brandValues.map(v => (
                                            <TagBadge
                                                key={v}
                                                label={BRAND_VALUE_OPTIONS.find(o => o.en === v)?.[ar ? 'ar' : 'en'] ?? v}
                                                colorClass="bg-brand-primary/10 text-brand-primary"
                                                onRemove={() => toggleValue(v)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                    {ar ? 'نبرة الصوت' : 'Tone of Voice'}
                                </label>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                    {ar ? 'كيف تريد أن يشعر جمهورك تجاه محتواك؟' : 'How do you want your audience to feel about your content?'}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    {TONE_OF_VOICE_OPTIONS.map(opt => (
                                        <SelectableChip
                                            key={opt.en}
                                            label={ar ? opt.ar : opt.en}
                                            selected={toneDescription.includes(opt.en)}
                                            onClick={() => toggleTone(opt.en)}
                                        />
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTone}
                                        onChange={e => setNewTone(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomTone()}
                                        placeholder={ar ? 'أضف نبرة مخصصة...' : 'Add custom tone...'}
                                        className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomTone}
                                        className="px-3 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                                    >
                                        <i className="fas fa-plus text-sm" />
                                    </button>
                                </div>

                                {toneDescription.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 p-3 bg-violet-500/5 rounded-xl border border-violet-500/15">
                                        <span className="text-xs text-violet-400 font-semibold w-full mb-1">
                                            {ar ? 'النبرات المختارة:' : 'Selected tones:'}
                                        </span>
                                        {toneDescription.map(tone => (
                                            <TagBadge
                                                key={tone}
                                                label={TONE_OF_VOICE_OPTIONS.find(o => o.en === tone)?.[ar ? 'ar' : 'en'] ?? tone}
                                                colorClass="bg-violet-500/10 text-violet-400"
                                                onRemove={() => toggleTone(tone)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-start gap-2.5 p-3 bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border">
                                <i className="fas fa-lightbulb text-amber-400 text-xs mt-0.5 shrink-0" />
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {ar
                                        ? 'يمكنك تخطي هذه الخطوة وإضافة التفاصيل لاحقاً من Brand Hub'
                                        : 'You can skip this and add details later from Brand Hub'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Connect Accounts — showcase, connect later via Integrations */}
                    {currentStep === 'connect' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-3">
                                    <i className="fas fa-plug text-brand-primary text-lg" />
                                </div>
                                <h3 className="text-base font-bold text-light-text dark:text-dark-text">
                                    {ar ? 'ربط حسابات التواصل الاجتماعي' : 'Connect Social Accounts'}
                                </h3>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs mx-auto">
                                    {ar
                                        ? 'اربط منصاتك من صفحة Integrations بعد الإعداد — تستغرق الخطوة دقيقتين فقط'
                                        : 'Connect your platforms from the Integrations page after setup — takes just 2 minutes'}
                                </p>
                            </div>

                            {/* Platform cards — decorative / informational only */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: 'fab fa-facebook',  color: 'from-blue-500 to-blue-700',  name: 'Facebook',    desc: ar ? 'صفحات ومجموعات' : 'Pages & Groups' },
                                    { icon: 'fab fa-instagram', color: 'from-pink-500 to-purple-600', name: 'Instagram',   desc: ar ? 'أعمال وإنستغرام' : 'Business & IG' },
                                    { icon: 'fab fa-x-twitter', color: 'from-slate-600 to-slate-800', name: 'X (Twitter)', desc: ar ? 'تغريدات وخيوط' : 'Tweets & Threads' },
                                    { icon: 'fab fa-linkedin',  color: 'from-blue-600 to-blue-800',   name: 'LinkedIn',    desc: ar ? 'صفحات الشركة' : 'Company Pages' },
                                ].map(({ icon, color, name, desc }) => (
                                    <div
                                        key={name}
                                        className="p-4 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg"
                                    >
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3`}>
                                            <i className={`${icon} text-base`} />
                                        </div>
                                        <p className="font-semibold text-light-text dark:text-dark-text text-sm">{name}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Where to connect */}
                            <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 flex gap-3 items-start">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                                    <i className="fas fa-circle-info text-brand-primary text-sm" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text mb-0.5">
                                        {ar ? 'كيف تربط حساباتك؟' : 'How to connect your accounts?'}
                                    </p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                        {ar
                                            ? 'بعد الإنهاء، اذهب إلى صفحة Integrations من القائمة الجانبية واربط حساباتك بأمان عبر OAuth الرسمي لكل منصة.'
                                            : 'After finishing, go to Integrations from the sidebar and connect your accounts securely via each platform\'s official OAuth.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Done */}
                    {currentStep === 'done' && (
                        <div className="text-center space-y-6 py-6 animate-fade-in">
                            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                                <i className="fas fa-circle-check text-emerald-500 text-4xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                    {ar ? 'تم الإعداد بنجاح!' : 'Setup Complete!'}
                                </h3>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2 text-sm">
                                    {ar ? `علامتك التجارية "${brandName}" جاهزة الآن` : `Your brand "${brandName}" is ready to go`}
                                </p>
                            </div>

                            <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-5 text-start space-y-3 border border-light-border dark:border-dark-border">
                                <h4 className="font-semibold text-light-text dark:text-dark-text text-sm flex items-center gap-2">
                                    <i className="fas fa-list-check text-brand-primary text-xs" />
                                    {ar ? 'الخطوات التالية' : 'Next Steps'}
                                </h4>
                                <ul className="space-y-2.5">
                                    {[
                                        { icon: 'fa-pen-nib',           text: ar ? 'انشر أول منشور من Publisher' : 'Create your first post from Publisher' },
                                        { icon: 'fa-calendar',          text: ar ? 'جدول محتوى من Calendar' : 'Schedule content from Calendar' },
                                        { icon: 'fa-plug-circle-check', text: ar ? 'اربط حسابات السوشيال من صفحة Integrations' : 'Connect social accounts from Integrations' },
                                        { icon: 'fa-chart-line',        text: ar ? 'تابع الأداء من Analytics' : 'Track performance in Analytics' },
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2.5 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            <div className="w-6 h-6 rounded-md bg-brand-primary/10 flex items-center justify-center shrink-0">
                                                <i className={`fas ${item.icon} text-brand-primary text-[10px]`} />
                                            </div>
                                            {item.text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                    <div>
                        {currentStep !== 'done' && (
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors text-sm"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {currentStep === 'info' && (
                            <button
                                onClick={handleStep1Next}
                                disabled={!brandName.trim()}
                                className="px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                {ar ? 'التالي' : 'Next'}
                                <i className={`fas fa-arrow-${ar ? 'left' : 'right'} text-xs`} />
                            </button>
                        )}

                        {currentStep === 'voice' && (
                            <>
                                <button
                                    onClick={handleSkipVoice}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors text-sm"
                                >
                                    {ar ? 'تخطي' : 'Skip'}
                                </button>
                                <button
                                    onClick={handleStep2Next}
                                    disabled={isSaving}
                                    className="px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {isSaving
                                        ? <><i className="fas fa-circle-notch fa-spin text-xs" /> {ar ? 'جارٍ الحفظ...' : 'Saving...'}</>
                                        : <>{ar ? 'التالي' : 'Next'} <i className={`fas fa-arrow-${ar ? 'left' : 'right'} text-xs`} /></>
                                    }
                                </button>
                            </>
                        )}

                        {currentStep === 'connect' && (
                            <button
                                onClick={() => setCurrentStep('done')}
                                className="px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition-all flex items-center gap-2"
                            >
                                {ar ? 'إنهاء' : 'Finish'}
                                <i className="fas fa-check text-xs" />
                            </button>
                        )}

                        {currentStep === 'done' && (
                            <button
                                onClick={handleFinish}
                                className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all flex items-center gap-2 text-sm"
                            >
                                <i className="fas fa-arrow-right text-xs" />
                                {ar ? 'ابدأ الآن' : 'Get Started'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};
