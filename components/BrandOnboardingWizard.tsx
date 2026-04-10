/**
 * Brand Onboarding Wizard
 * A step-by-step wizard to help users set up their brand completely
 */

import React, { useState } from 'react';
import { SocialPlatform, NotificationType } from '../types';
import { addBrand } from '../services/brandService';
import { updateBrandProfile } from '../services/brandHubService';
import { initiateSocialLogin, fetchAvailableAssets, connectSelectedAssets } from '../services/socialAuthService';
import { useLanguage } from '../context/LanguageContext';

interface BrandOnboardingWizardProps {
    onComplete: (brandId: string) => void;
    onCancel: () => void;
    addNotification: (type: NotificationType, message: string) => void;
}

type Step = 'info' | 'voice' | 'connect' | 'done';

// ─── Preset options ────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
    { en: 'E-commerce', ar: 'تجارة إلكترونية', icon: '🛒' },
    { en: 'Food & Beverage', ar: 'مطاعم وأغذية', icon: '🍽️' },
    { en: 'Fashion & Apparel', ar: 'أزياء وملابس', icon: '👗' },
    { en: 'Health & Wellness', ar: 'صحة ولياقة', icon: '💪' },
    { en: 'Technology', ar: 'تقنية', icon: '💻' },
    { en: 'Real Estate', ar: 'عقارات', icon: '🏠' },
    { en: 'Education', ar: 'تعليم', icon: '📚' },
    { en: 'Beauty & Cosmetics', ar: 'جمال وتجميل', icon: '💄' },
    { en: 'Travel & Tourism', ar: 'سياحة وسفر', icon: '✈️' },
    { en: 'Finance & Banking', ar: 'مالية ومصرفية', icon: '💰' },
    { en: 'Healthcare', ar: 'رعاية صحية', icon: '🏥' },
    { en: 'Automotive', ar: 'سيارات', icon: '🚗' },
    { en: 'Entertainment', ar: 'ترفيه', icon: '🎬' },
    { en: 'Sports & Fitness', ar: 'رياضة وتمارين', icon: '⚽' },
    { en: 'Non-Profit', ar: 'منظمة غير ربحية', icon: '🤝' },
    { en: 'Other', ar: 'أخرى', icon: '🔖' },
];

const BRAND_VALUE_OPTIONS = [
    { en: 'Quality', ar: 'الجودة' },
    { en: 'Innovation', ar: 'الابتكار' },
    { en: 'Integrity', ar: 'النزاهة' },
    { en: 'Customer Focus', ar: 'التركيز على العميل' },
    { en: 'Sustainability', ar: 'الاستدامة' },
    { en: 'Transparency', ar: 'الشفافية' },
    { en: 'Excellence', ar: 'التميز' },
    { en: 'Creativity', ar: 'الإبداع' },
    { en: 'Trust', ar: 'الثقة' },
    { en: 'Community', ar: 'المجتمع' },
    { en: 'Diversity', ar: 'التنوع' },
    { en: 'Passion', ar: 'الشغف' },
];

const TONE_OF_VOICE_OPTIONS = [
    { en: 'Friendly', ar: 'ودود' },
    { en: 'Professional', ar: 'احترافي' },
    { en: 'Casual', ar: 'غير رسمي' },
    { en: 'Authoritative', ar: 'موثوق' },
    { en: 'Inspiring', ar: 'ملهم' },
    { en: 'Humorous', ar: 'فكاهي' },
    { en: 'Empathetic', ar: 'متعاطف' },
    { en: 'Bold', ar: 'جريء' },
    { en: 'Elegant', ar: 'راقي' },
    { en: 'Educational', ar: 'تعليمي' },
    { en: 'Energetic', ar: 'نشيط' },
    { en: 'Minimalist', ar: 'بسيط' },
];

// ─── Chip Component ────────────────────────────────────────────────────────────

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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
            selected
                ? 'bg-brand-primary text-white border-brand-primary shadow-md scale-105'
                : 'bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-light-border dark:border-dark-border hover:border-brand-primary hover:bg-brand-primary/10'
        }`}
    >
        {icon && <span>{icon}</span>}
        {label}
        {selected && <i className="fas fa-check text-xs ml-0.5" />}
    </button>
);

// ─── Tag Badge ─────────────────────────────────────────────────────────────────

interface TagBadgeProps {
    label: string;
    colorClass: string;
    onRemove: () => void;
}

const TagBadge: React.FC<TagBadgeProps> = ({ label, colorClass, onRemove }) => (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
        {label}
        <button
            type="button"
            onClick={onRemove}
            className="hover:text-red-400 transition-colors"
            aria-label="Remove"
        >
            <i className="fas fa-times text-xs" />
        </button>
    </span>
);

// ─── Main Wizard ───────────────────────────────────────────────────────────────

export const BrandOnboardingWizard: React.FC<BrandOnboardingWizardProps> = ({ onComplete, onCancel, addNotification }) => {
    const { t, language } = useLanguage();
    const [currentStep, setCurrentStep] = useState<Step>('info');
    const [isSaving, setIsSaving] = useState(false);

    // Step 1: Brand Info
    const [brandName, setBrandName] = useState('');
    const [industry, setIndustry] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    // Step 2: Brand Voice
    const [brandValues, setBrandValues] = useState<string[]>([]);
    const [toneDescription, setToneDescription] = useState<string[]>([]);
    const [newValue, setNewValue] = useState('');
    const [newTone, setNewTone] = useState('');

    // Step 3: Social Accounts
    const [connectedPlatforms, setConnectedPlatforms] = useState<Set<SocialPlatform>>(new Set());
    const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);

    // Created brand ID (set after DB write)
    const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);

    const ar = language === 'ar';

    // ── Step navigation ──────────────────────────────────────────────────────

    const handleStep1Next = () => {
        if (!brandName.trim()) {
            addNotification(NotificationType.Error, ar ? 'الرجاء إدخال اسم العلامة التجارية' : 'Please enter brand name');
            return;
        }
        setCurrentStep('voice');
    };

    // Save brand to DB in background — navigation happens immediately
    const saveBrandToDb = async (skipVoice = false) => {
        setIsSaving(true);
        // Navigate first so the user is never blocked
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
            // Still on connect step — warn but don't block
            addNotification(NotificationType.Error, ar ? `تحذير: لم يتم حفظ البيانات (${error.message})` : `Warning: data not saved (${error.message})`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStep2Next  = () => saveBrandToDb(false);
    const handleSkipVoice  = () => saveBrandToDb(true);

    const handleConnectPlatform = async (platform: SocialPlatform) => {
        if (!createdBrandId) return;
        setConnectingPlatform(platform);
        try {
            const authResponse = await initiateSocialLogin(platform);
            const assets = await fetchAvailableAssets(platform, authResponse.accessToken);
            if (assets.length === 0) {
                addNotification(NotificationType.Warning, ar ? 'لم يتم العثور على حسابات' : 'No accounts found');
                return;
            }
            await connectSelectedAssets(createdBrandId, assets, platform, authResponse.accessToken);
            setConnectedPlatforms(prev => new Set(prev).add(platform));
            addNotification(NotificationType.Success, ar ? `تم ربط ${platform} بنجاح!` : `${platform} connected!`);
        } catch (error: any) {
            console.error(`Failed to connect ${platform}:`, error);
            addNotification(NotificationType.Error, ar ? `فشل ربط ${platform}: ${error.message}` : `Failed to connect ${platform}`);
        } finally {
            setConnectingPlatform(null);
        }
    };

    const handleFinish = () => {
        if (createdBrandId) onComplete(createdBrandId);
    };

    // ── Industry helpers ───────────────────────────────────────────────────────

    const toggleIndustry = (val: string) => setIndustry(prev => (prev === val ? '' : val));

    // ── Value / Tone helpers ──────────────────────────────────────────────────

    const toggleValue = (val: string) => {
        setBrandValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    };

    const addCustomValue = () => {
        const v = newValue.trim();
        if (v && !brandValues.includes(v)) {
            setBrandValues(prev => [...prev, v]);
            setNewValue('');
        }
    };

    const toggleTone = (tone: string) => {
        setToneDescription(prev => prev.includes(tone) ? prev.filter(t => t !== tone) : [...prev, tone]);
    };

    const addCustomTone = () => {
        const v = newTone.trim();
        if (v && !toneDescription.includes(v)) {
            setToneDescription(prev => [...prev, v]);
            setNewTone('');
        }
    };

    // ── Progress steps ─────────────────────────────────────────────────────────

    const steps = [
        { key: 'info',    label: ar ? 'معلومات العلامة' : 'Brand Info',       icon: 'fa-building' },
        { key: 'voice',   label: ar ? 'صوت العلامة'    : 'Brand Voice',       icon: 'fa-microphone' },
        { key: 'connect', label: ar ? 'ربط الحسابات'   : 'Connect Accounts',  icon: 'fa-link' },
        { key: 'done',    label: ar ? 'تم!'             : 'Done',              icon: 'fa-check-circle' },
    ];
    const currentStepIndex = steps.findIndex(s => s.key === currentStep);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" dir={ar ? 'rtl' : 'ltr'}>
            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">

                {/* ── Header ── */}
                <div className="p-6 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
                            🚀 {ar ? 'إعداد علامة تجارية جديدة' : 'Set Up New Brand'}
                        </h2>
                        <button onClick={onCancel} className="text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text transition-colors">
                            <i className="fas fa-times text-xl" />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.key}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-sm ${
                                        index < currentStepIndex
                                            ? 'bg-green-500 text-white'
                                            : index === currentStepIndex
                                                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
                                                : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'
                                    }`}>
                                        {index < currentStepIndex
                                            ? <i className="fas fa-check text-xs" />
                                            : <i className={`fas ${step.icon} text-xs`} />
                                        }
                                    </div>
                                    <p className={`text-xs mt-1 whitespace-nowrap ${index <= currentStepIndex ? 'text-brand-primary font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                        {step.label}
                                    </p>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${index < currentStepIndex ? 'bg-green-500' : 'bg-light-border dark:bg-dark-border'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── STEP 1: Brand Info ── */}
                    {currentStep === 'info' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Brand Name */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    {ar ? 'اسم العلامة التجارية *' : 'Brand Name *'}
                                </label>
                                <input
                                    type="text"
                                    value={brandName}
                                    onChange={e => setBrandName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleStep1Next()}
                                    placeholder={ar ? 'مثال: شركتي' : 'Example: My Company'}
                                    className="w-full px-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Industry – chip selector */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-3">
                                    {ar ? 'الصناعة / القطاع' : 'Industry / Sector'}
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal ml-1">({ar ? 'اختياري' : 'optional'})</span>
                                </label>
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
                                    <p className="mt-2 text-xs text-brand-primary font-medium">
                                        ✓ {ar ? 'تم الاختيار:' : 'Selected:'} {INDUSTRY_OPTIONS.find(o => o.en === industry)?.[ar ? 'ar' : 'en'] ?? industry}
                                    </p>
                                )}
                            </div>

                            {/* Logo URL */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    {ar ? 'رابط الشعار' : 'Logo URL'}
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary font-normal ml-1">({ar ? 'اختياري' : 'optional'})</span>
                                </label>
                                <input
                                    type="url"
                                    value={logoUrl}
                                    onChange={e => setLogoUrl(e.target.value)}
                                    placeholder="https://example.com/logo.png"
                                    className="w-full px-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Brand Voice ── */}
                    {currentStep === 'voice' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Brand Values */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                    {ar ? 'قيم العلامة التجارية' : 'Brand Values'}
                                </label>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                    {ar ? 'اختر من الخيارات أو أضف خياراً مخصصاً' : 'Pick from suggestions or add your own'}
                                </p>

                                {/* Preset chips */}
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

                                {/* Custom input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newValue}
                                        onChange={e => setNewValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomValue()}
                                        placeholder={ar ? 'أضف قيمة مخصصة...' : 'Add custom value...'}
                                        className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomValue}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                                    >
                                        <i className="fas fa-plus" />
                                    </button>
                                </div>

                                {/* Selected tags */}
                                {brandValues.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/20">
                                        <span className="text-xs text-brand-primary font-semibold w-full mb-1">
                                            {ar ? 'القيم المختارة:' : 'Selected values:'}
                                        </span>
                                        {brandValues.map(v => (
                                            <TagBadge
                                                key={v}
                                                label={BRAND_VALUE_OPTIONS.find(o => o.en === v)?.[ar ? 'ar' : 'en'] ?? v}
                                                colorClass="bg-brand-primary/15 text-brand-primary"
                                                onRemove={() => toggleValue(v)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tone of Voice */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                    {ar ? 'نبرة الصوت' : 'Tone of Voice'}
                                </label>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                    {ar ? 'كيف تريد أن يشعر جمهورك تجاه محتواك؟' : 'How do you want your audience to feel about your content?'}
                                </p>

                                {/* Preset chips */}
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

                                {/* Custom input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTone}
                                        onChange={e => setNewTone(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomTone()}
                                        placeholder={ar ? 'أضف نبرة مخصصة...' : 'Add custom tone...'}
                                        className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomTone}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                                    >
                                        <i className="fas fa-plus" />
                                    </button>
                                </div>

                                {/* Selected tags */}
                                {toneDescription.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 p-3 bg-purple-500/5 rounded-xl border border-purple-500/20">
                                        <span className="text-xs text-purple-500 font-semibold w-full mb-1">
                                            {ar ? 'النبرات المختارة:' : 'Selected tones:'}
                                        </span>
                                        {toneDescription.map(t => (
                                            <TagBadge
                                                key={t}
                                                label={TONE_OF_VOICE_OPTIONS.find(o => o.en === t)?.[ar ? 'ar' : 'en'] ?? t}
                                                colorClass="bg-purple-500/15 text-purple-500"
                                                onRemove={() => toggleTone(t)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg rounded-lg p-3">
                                💡 {ar
                                    ? 'يمكنك تخطي هذه الخطوة وإضافة التفاصيل لاحقاً من Brand Hub'
                                    : 'You can skip this and add details later from Brand Hub'}
                            </p>
                        </div>
                    )}

                    {/* ── STEP 3: Connect Accounts ── */}
                    {currentStep === 'connect' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="text-center mb-2">
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">
                                    {ar ? '🔗 اربط حساباتك على وسائل التواصل' : '🔗 Connect Your Social Accounts'}
                                </h3>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                    {ar
                                        ? 'اختر المنصات التي تريد النشر عليها من خلال sbrandops'
                                        : 'Choose the platforms you want to publish to via sbrandops'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { platform: SocialPlatform.Facebook,  icon: 'fab fa-facebook',  color: 'from-blue-500 to-blue-700',   name: 'Facebook' },
                                    { platform: SocialPlatform.Instagram, icon: 'fab fa-instagram', color: 'from-pink-500 to-purple-600',  name: 'Instagram' },
                                    { platform: SocialPlatform.X,         icon: 'fab fa-x-twitter', color: 'from-gray-700 to-gray-900',    name: 'Twitter / X' },
                                    { platform: SocialPlatform.LinkedIn,  icon: 'fab fa-linkedin',  color: 'from-blue-600 to-blue-800',   name: 'LinkedIn' },
                                ].map(({ platform, icon, color, name }) => {
                                    const isConnected   = connectedPlatforms.has(platform);
                                    const isConnecting  = connectingPlatform === platform;

                                    return (
                                        <button
                                            key={platform}
                                            onClick={() => !isConnected && !connectingPlatform && handleConnectPlatform(platform)}
                                            disabled={isConnected || !!connectingPlatform}
                                            className={`relative p-4 rounded-xl border-2 transition-all text-left group ${
                                                isConnected
                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 cursor-default'
                                                    : connectingPlatform
                                                        ? 'border-light-border dark:border-dark-border opacity-60 cursor-not-allowed'
                                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                                            }`}
                                        >
                                            {/* Platform icon */}
                                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3 shadow-lg`}>
                                                {isConnecting
                                                    ? <i className="fas fa-circle-notch fa-spin text-lg" />
                                                    : <i className={`${icon} text-lg`} />
                                                }
                                            </div>

                                            <p className="font-bold text-light-text dark:text-dark-text text-sm">{name}</p>
                                            <p className="text-xs mt-0.5 font-medium">
                                                {isConnected
                                                    ? <span className="text-green-500">✓ {ar ? 'متصل' : 'Connected'}</span>
                                                    : isConnecting
                                                        ? <span className="text-brand-primary">{ar ? 'جارٍ الربط...' : 'Connecting...'}</span>
                                                        : <span className="text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'اضغط للربط' : 'Click to connect'}</span>
                                                }
                                            </p>

                                            {isConnected && (
                                                <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                                    <i className="fas fa-check text-white text-xs" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {connectedPlatforms.size > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                                    <p className="text-green-700 dark:text-green-400 font-semibold text-sm">
                                        🎉 {ar
                                            ? `تم ربط ${connectedPlatforms.size} منصة بنجاح`
                                            : `${connectedPlatforms.size} platform(s) connected successfully`}
                                    </p>
                                </div>
                            )}

                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                                💡 {ar
                                    ? 'يمكنك ربط المزيد من الحسابات لاحقاً من صفحة Accounts'
                                    : 'You can connect more accounts later from the Accounts page'}
                            </p>
                        </div>
                    )}

                    {/* ── STEP 4: Done ── */}
                    {currentStep === 'done' && (
                        <div className="text-center space-y-6 py-8 animate-fade-in">
                            <div className="text-7xl">🎉</div>
                            <div>
                                <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">
                                    {ar ? 'تم الإعداد بنجاح!' : 'Setup Complete!'}
                                </h3>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">
                                    {ar ? `علامتك التجارية "${brandName}" جاهزة الآن!` : `Your brand "${brandName}" is ready to go!`}
                                </p>
                            </div>

                            <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-5 text-start space-y-2">
                                <h4 className="font-bold text-light-text dark:text-dark-text mb-3">
                                    {ar ? '📋 الخطوات التالية:' : '📋 Next Steps:'}
                                </h4>
                                <ul className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <li>✅ {ar ? 'انشر أول منشور من Publisher' : 'Create your first post from Publisher'}</li>
                                    <li>✅ {ar ? 'جدول محتوى من Calendar' : 'Schedule content from Calendar'}</li>
                                    <li>✅ {ar ? 'تابع الأداء من Analytics' : 'Track performance in Analytics'}</li>
                                    <li>🔌 {ar ? 'اربط Google Ads و GA4 و Search Console من صفحة Integrations عندما تصبح جاهزًا للتشغيل الفعلي.' : 'Connect Google Ads, GA4, and Search Console from Integrations when you are ready for live operations.'}</li>
                                    {connectedPlatforms.size > 0 && (
                                        <li>🔗 {ar ? `تم ربط ${connectedPlatforms.size} حساب` : `${connectedPlatforms.size} account(s) connected`}</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="p-5 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                    {/* Left: Cancel / Back */}
                    <div>
                        {currentStep !== 'done' && (
                            <button
                                onClick={onCancel}
                                className="px-5 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors text-sm"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        )}
                    </div>

                    {/* Right: Action buttons */}
                    <div className="flex gap-3">
                        {/* Step 1 → Next */}
                        {currentStep === 'info' && (
                            <button
                                onClick={handleStep1Next}
                                disabled={!brandName.trim()}
                                className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-primary/20 flex items-center gap-2"
                            >
                                {ar ? 'التالي' : 'Next'}
                                <i className={`fas fa-arrow-${ar ? 'left' : 'right'} text-sm`} />
                            </button>
                        )}

                        {/* Step 2 → Skip / Next */}
                        {currentStep === 'voice' && (
                            <>
                                <button
                                    onClick={handleSkipVoice}
                                    disabled={isSaving}
                                    className="px-5 py-2.5 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors text-sm"
                                >
                                    {ar ? 'تخطي' : 'Skip'}
                                </button>
                                <button
                                    onClick={handleStep2Next}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-primary/20 flex items-center gap-2"
                                >
                                    {isSaving
                                        ? <><i className="fas fa-circle-notch fa-spin" /> {ar ? 'جارٍ الحفظ...' : 'Saving...'}</>
                                        : <>{ar ? 'التالي' : 'Next'} <i className={`fas fa-arrow-${ar ? 'left' : 'right'} text-sm`} /></>
                                    }
                                </button>
                            </>
                        )}

                        {/* Step 3 → Finish */}
                        {currentStep === 'connect' && (
                            <button
                                onClick={() => setCurrentStep('done')}
                                disabled={!!connectingPlatform}
                                className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 disabled:opacity-50 transition-all shadow-md shadow-brand-primary/20 flex items-center gap-2"
                            >
                                {ar ? 'إنهاء' : 'Finish'}
                                <i className="fas fa-check text-sm" />
                            </button>
                        )}

                        {/* Step 4 → Get Started */}
                        {currentStep === 'done' && (
                            <button
                                onClick={handleFinish}
                                className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/30 text-base"
                            >
                                🚀 {ar ? 'ابدأ الآن!' : 'Get Started!'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
