
import React, { useState } from 'react';
import { SocialAsset, SocialPlatform, AssetPurpose, PLATFORM_ASSETS } from '../types';
import { useLanguage } from '../context/LanguageContext';

type Step = 'assets' | 'purpose';

const PURPOSE_OPTIONS = [
    { id: AssetPurpose.Publishing, icon: 'fa-paper-plane',      labelAr: 'النشر والجدولة',  labelEn: 'Publishing',  descAr: 'نشر المحتوى وجدولته',             descEn: 'Post and schedule content' },
    { id: AssetPurpose.Inbox,      icon: 'fa-comments',         labelAr: 'صندوق الوارد',    labelEn: 'Inbox',       descAr: 'الردود والتعليقات والرسائل',        descEn: 'Messages, comments & replies' },
    { id: AssetPurpose.Analytics,  icon: 'fa-chart-bar',        labelAr: 'التحليلات',       labelEn: 'Analytics',   descAr: 'سحب بيانات الأداء والإحصاءات',     descEn: 'Pull performance insights' },
    { id: AssetPurpose.Ads,        icon: 'fa-bullhorn',         labelAr: 'الإعلانات',       labelEn: 'Ads',         descAr: 'مراقبة وتحليل الحملات الإعلانية',  descEn: 'Monitor ad campaigns' },
    { id: AssetPurpose.Commerce,   icon: 'fa-bag-shopping',     labelAr: 'التجارة',         labelEn: 'Commerce',    descAr: 'المنتجات والطلبات والمبيعات',       descEn: 'Products, orders & sales' },
    { id: AssetPurpose.Seo,        icon: 'fa-magnifying-glass', labelAr: 'السيو',           labelEn: 'SEO',         descAr: 'البحث والمحتوى وصفحات الموقع',     descEn: 'Search, content & pages' },
] as const;

const MARKET_OPTIONS = [
    { value: 'sa',     flag: '🇸🇦', labelAr: 'السعودية',     labelEn: 'Saudi Arabia' },
    { value: 'eg',     flag: '🇪🇬', labelAr: 'مصر',          labelEn: 'Egypt' },
    { value: 'ae',     flag: '🇦🇪', labelAr: 'الإمارات',     labelEn: 'UAE' },
    { value: 'kw',     flag: '🇰🇼', labelAr: 'الكويت',       labelEn: 'Kuwait' },
    { value: 'global', flag: '🌐', labelAr: 'عالمي / عام',   labelEn: 'Global' },
];

interface AssetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedAssets: SocialAsset[], purposes: AssetPurpose[], market?: string) => void;
    assets: SocialAsset[];
    platform: SocialPlatform;
    isLoading: boolean;
}

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    assets,
    platform,
    isLoading,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [step, setStep] = useState<Step>('assets');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedPurposes, setSelectedPurposes] = useState<AssetPurpose[]>([AssetPurpose.Publishing, AssetPurpose.Analytics]);
    const [market, setMarket] = useState<string>('');
    const platformAsset = PLATFORM_ASSETS[platform];

    if (!isOpen) return null;

    const toggleAsset = (id: string) =>
        setSelectedIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

    const togglePurpose = (p: AssetPurpose) =>
        setSelectedPurposes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    const handleConfirm = () => {
        const selected = assets
            .filter(a => selectedIds.includes(a.id))
            .map(a => ({ ...a, purposes: selectedPurposes }));
        onConfirm(selected, selectedPurposes, market || undefined);
    };

    const selectedCount = selectedIds.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border border-light-border bg-light-card shadow-2xl dark:border-dark-border dark:bg-dark-card" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-light-border px-6 py-4 dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${platformAsset.color} text-white`}>
                            <i className={`${platformAsset.icon} text-base`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                {step === 'assets'
                                    ? (ar ? 'الخطوة 1 من 2 — اختر الحسابات' : 'Step 1 of 2 — Select accounts')
                                    : (ar ? 'الخطوة 2 من 2 — حدد الوظيفة والسوق' : 'Step 2 of 2 — Purpose & market')}
                            </p>
                            <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                {step === 'assets'
                                    ? (ar ? `حسابات ${platform}` : `${platform} accounts`)
                                    : (ar ? 'ماذا تريد من هذا الحساب؟' : 'What will you use this for?')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-light-text-secondary transition-colors hover:bg-light-bg hover:text-light-text dark:hover:bg-dark-bg dark:hover:text-dark-text">
                        <i className="fas fa-xmark text-sm" />
                    </button>
                </div>

                {/* Step bar */}
                <div className="flex gap-1.5 px-6 pt-3">
                    {(['assets', 'purpose'] as Step[]).map((s, i) => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i === 0 || step === 'purpose' ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`} />
                    ))}
                </div>

                {/* Body */}
                <div className="px-6 py-4">
                    {step === 'assets' ? (
                        <>
                            <p className="mb-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? `وجدنا ${assets.length} حساب مرتبط. اختر ما تريد إدارته.` : `Found ${assets.length} account(s). Select the ones you want to manage.`}
                            </p>
                            {assets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <i className="fas fa-inbox mb-3 text-3xl text-light-text-secondary dark:text-dark-text-secondary" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                        {ar ? 'لا توجد حسابات. تأكد أن لديك صفحة أو حساب أعمال.' : 'No accounts found. Make sure you have a Page or Business account.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="max-h-60 space-y-2 overflow-y-auto">
                                    {assets.map(a => {
                                        const sel = selectedIds.includes(a.id);
                                        return (
                                            <div key={a.id} onClick={() => toggleAsset(a.id)} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${sel ? 'border-brand-primary bg-brand-primary/10 ring-1 ring-brand-primary' : 'border-light-border hover:bg-light-bg dark:border-dark-border dark:hover:bg-dark-bg'}`}>
                                                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${sel ? 'border-brand-primary bg-brand-primary' : 'border-gray-400'}`}>
                                                    {sel && <i className="fas fa-check text-[10px] text-white" />}
                                                </div>
                                                <img src={a.avatarUrl} alt={a.name} className="h-10 w-10 shrink-0 rounded-full object-cover"
                                                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=2563eb&color=fff`; }} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{a.name}</p>
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                        {a.category && `${a.category} · `}
                                                        {a.followers.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ar ? 'متابع' : 'followers'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-5">
                            {/* Purposes */}
                            <div>
                                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                    {ar ? 'الوظائف' : 'Purposes'}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PURPOSE_OPTIONS.map(opt => {
                                        const active = selectedPurposes.includes(opt.id);
                                        return (
                                            <div key={opt.id} onClick={() => togglePurpose(opt.id)} className={`cursor-pointer rounded-xl border p-3 transition-all ${active ? 'border-brand-primary bg-brand-primary/10 ring-1 ring-brand-primary' : 'border-light-border hover:bg-light-bg dark:border-dark-border dark:hover:bg-dark-bg'}`}>
                                                <div className="mb-1 flex items-center gap-2">
                                                    <i className={`fas ${opt.icon} text-sm ${active ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                                                    <span className={`text-xs font-bold ${active ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>
                                                        {ar ? opt.labelAr : opt.labelEn}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] leading-tight text-light-text-secondary dark:text-dark-text-secondary">
                                                    {ar ? opt.descAr : opt.descEn}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Market */}
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                    {ar ? 'السوق (اختياري)' : 'Market (optional)'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {MARKET_OPTIONS.map(m => (
                                        <button key={m.value} type="button" onClick={() => setMarket(prev => prev === m.value ? '' : m.value)}
                                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${market === m.value ? 'border-brand-primary bg-brand-primary text-white' : 'border-light-border text-light-text-secondary hover:border-brand-primary dark:border-dark-border dark:text-dark-text-secondary'}`}>
                                            <span>{m.flag}</span>
                                            <span>{ar ? m.labelAr : m.labelEn}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-light-border px-6 py-4 dark:border-dark-border">
                    {step === 'purpose' ? (
                        <button onClick={() => setStep('assets')} disabled={isLoading} className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-medium text-light-text-secondary hover:bg-light-bg disabled:opacity-50 dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                            {ar ? 'رجوع' : 'Back'}
                        </button>
                    ) : (
                        <button onClick={onClose} disabled={isLoading} className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-medium text-light-text-secondary hover:bg-light-bg disabled:opacity-50 dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                            {ar ? 'إلغاء' : 'Cancel'}
                        </button>
                    )}

                    {step === 'assets' ? (
                        <button onClick={() => selectedCount > 0 && setStep('purpose')} disabled={selectedCount === 0}
                            className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50">
                            {ar ? `التالي — ${selectedCount} ${selectedCount === 1 ? 'حساب' : 'حسابات'}` : `Next — ${selectedCount} account${selectedCount !== 1 ? 's' : ''}`}
                            <i className={`fas text-xs ${ar ? 'fa-arrow-left' : 'fa-arrow-right'}`} />
                        </button>
                    ) : (
                        <button onClick={handleConfirm} disabled={isLoading || selectedPurposes.length === 0}
                            className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50">
                            {isLoading
                                ? <><i className="fas fa-circle-notch fa-spin text-xs" />{ar ? 'جارٍ الحفظ...' : 'Saving...'}</>
                                : <><i className="fas fa-plug text-xs" />{ar ? 'ربط الحساب' : 'Connect'}</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
