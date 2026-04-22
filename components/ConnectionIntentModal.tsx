
import React, { useState } from 'react';
import { SocialPlatform, AssetPurpose } from '../types';
import { useLanguage } from '../context/LanguageContext';

export interface IntentResult {
    purpose: AssetPurpose;
    recommendedPlatforms: SocialPlatform[];
}

interface IntentOption {
    purpose: AssetPurpose;
    icon: string;
    labelAr: string;
    labelEn: string;
    descAr: string;
    descEn: string;
    platforms: SocialPlatform[];
    bgColor: string;
    iconColor: string;
}

const INTENT_OPTIONS: IntentOption[] = [
    {
        purpose:   AssetPurpose.Publishing,
        icon:      'fa-paper-plane',
        labelAr:   'نشر المحتوى',
        labelEn:   'Publish content',
        descAr:    'جدولة ونشر على السوشيال',
        descEn:    'Schedule & post to social',
        platforms: [SocialPlatform.Facebook, SocialPlatform.Instagram, SocialPlatform.X, SocialPlatform.LinkedIn, SocialPlatform.TikTok],
        bgColor:   'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
        iconColor: 'text-blue-500',
    },
    {
        purpose:   AssetPurpose.Inbox,
        icon:      'fa-comments',
        labelAr:   'الرد على العملاء',
        labelEn:   'Reply to customers',
        descAr:    'رسائل، تعليقات، استفسارات',
        descEn:    'Messages, comments, DMs',
        platforms: [SocialPlatform.Facebook, SocialPlatform.Instagram],
        bgColor:   'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
        iconColor: 'text-emerald-500',
    },
    {
        purpose:   AssetPurpose.Analytics,
        icon:      'fa-chart-bar',
        labelAr:   'تحليل الأداء',
        labelEn:   'Analyze performance',
        descAr:    'إحصاءات، reach، engagement',
        descEn:    'Insights, reach & engagement',
        platforms: [SocialPlatform.Facebook, SocialPlatform.Instagram, SocialPlatform.TikTok],
        bgColor:   'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20',
        iconColor: 'text-violet-500',
    },
    {
        purpose:   AssetPurpose.Ads,
        icon:      'fa-bullhorn',
        labelAr:   'مراقبة الإعلانات',
        labelEn:   'Monitor ads',
        descAr:    'حملات، ميزانية، ROAS',
        descEn:    'Campaigns, budget, ROAS',
        platforms: [SocialPlatform.Facebook],
        bgColor:   'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20',
        iconColor: 'text-orange-500',
    },
    {
        purpose:   AssetPurpose.Commerce,
        icon:      'fa-bag-shopping',
        labelAr:   'ربط المبيعات',
        labelEn:   'Connect commerce',
        descAr:    'منتجات، طلبات، إيرادات',
        descEn:    'Products, orders, revenue',
        platforms: [],
        bgColor:   'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20',
        iconColor: 'text-pink-500',
    },
    {
        purpose:   AssetPurpose.Seo,
        icon:      'fa-magnifying-glass',
        labelAr:   'نشر محتوى SEO',
        labelEn:   'SEO publishing',
        descAr:    'موقع، بلوج، ظهور بحثي',
        descEn:    'Site, blog, search visibility',
        platforms: [],
        bgColor:   'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20',
        iconColor: 'text-cyan-500',
    },
];

const PLATFORM_META: Record<SocialPlatform, { icon: string; color: string }> = {
    [SocialPlatform.Facebook]:  { icon: 'fab fa-facebook-square', color: 'text-blue-500' },
    [SocialPlatform.Instagram]: { icon: 'fab fa-instagram',       color: 'text-pink-500' },
    [SocialPlatform.X]:         { icon: 'fab fa-twitter',         color: 'text-slate-400' },
    [SocialPlatform.LinkedIn]:  { icon: 'fab fa-linkedin',        color: 'text-blue-600' },
    [SocialPlatform.TikTok]:    { icon: 'fab fa-tiktok',          color: 'text-light-text dark:text-dark-text' },
    [SocialPlatform.Pinterest]: { icon: 'fab fa-pinterest',       color: 'text-red-500' },
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlatform: (platform: SocialPlatform, intent: AssetPurpose) => void;
}

export const ConnectionIntentModal: React.FC<Props> = ({ isOpen, onClose, onSelectPlatform }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [selected, setSelected] = useState<IntentOption | null>(null);

    if (!isOpen) return null;

    const handleSelect = (opt: IntentOption) => setSelected(opt);

    const handlePlatformPick = (platform: SocialPlatform) => {
        if (!selected) return;
        onClose();
        setSelected(null);
        onSelectPlatform(platform, selected.purpose);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-light-border bg-light-card shadow-2xl dark:border-dark-border dark:bg-dark-card" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-light-border px-6 py-4 dark:border-dark-border">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'ربط منصة جديدة' : 'Connect a platform'}
                        </p>
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">
                            {selected
                                ? (ar ? 'اختر المنصة' : 'Choose a platform')
                                : (ar ? 'ماذا تريد أن تفعل؟' : 'What do you want to do?')}
                        </p>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-light-text-secondary hover:bg-light-bg hover:text-light-text dark:hover:bg-dark-bg dark:hover:text-dark-text">
                        <i className="fas fa-xmark text-sm" />
                    </button>
                </div>

                <div className="px-6 py-5">
                    {!selected ? (
                        <>
                            <p className="mb-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar
                                    ? 'حدد الهدف الأساسي — النظام سيرشدك للمنصة المناسبة.'
                                    : 'Select your main goal — we\'ll guide you to the right platform.'}
                            </p>
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                                {INTENT_OPTIONS.map(opt => (
                                    <button key={opt.purpose} onClick={() => handleSelect(opt)}
                                        className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-start transition-all ${opt.bgColor}`}>
                                        <i className={`fas ${opt.icon} text-lg ${opt.iconColor}`} />
                                        <div>
                                            <p className="text-xs font-bold text-light-text dark:text-dark-text">{ar ? opt.labelAr : opt.labelEn}</p>
                                            <p className="mt-0.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{ar ? opt.descAr : opt.descEn}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Selected intent summary */}
                            <div className={`mb-4 flex items-center gap-3 rounded-xl border p-3 ${selected.bgColor}`}>
                                <i className={`fas ${selected.icon} text-lg ${selected.iconColor}`} />
                                <div>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">{ar ? selected.labelAr : selected.labelEn}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{ar ? selected.descAr : selected.descEn}</p>
                                </div>
                                <button onClick={() => setSelected(null)} className="ms-auto text-xs text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text">
                                    <i className="fas fa-xmark" />
                                </button>
                            </div>

                            {selected.platforms.length > 0 ? (
                                <>
                                    <p className="mb-3 text-sm font-semibold text-light-text dark:text-dark-text">
                                        {ar ? 'المنصات المناسبة لهذا الهدف:' : 'Best platforms for this goal:'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {selected.platforms.map(platform => {
                                            const meta = PLATFORM_META[platform];
                                            return (
                                                <button key={platform} onClick={() => handlePlatformPick(platform)}
                                                    className="flex items-center gap-2.5 rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm font-semibold text-light-text transition-all hover:border-brand-primary hover:bg-brand-primary/5 hover:text-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:hover:border-brand-primary dark:hover:bg-brand-primary/10">
                                                    <i className={`${meta.icon} text-base ${meta.color}`} />
                                                    <span>{platform}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-3 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {ar ? 'أو اختر منصة أخرى:' : 'Or pick any other platform:'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {Object.values(SocialPlatform).filter(p => !selected.platforms.includes(p)).map(platform => {
                                            const meta = PLATFORM_META[platform];
                                            return (
                                                <button key={platform} onClick={() => handlePlatformPick(platform)}
                                                    className="flex items-center gap-1.5 rounded-lg border border-light-border px-3 py-1.5 text-xs text-light-text-secondary hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:text-dark-text-secondary">
                                                    <i className={`${meta.icon} text-sm ${meta.color}`} />
                                                    <span>{platform}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl bg-amber-500/10 p-4 text-center">
                                    <i className="fas fa-clock mb-2 text-2xl text-amber-500" />
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                                        {ar ? 'قريبًا' : 'Coming soon'}
                                    </p>
                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        {ar ? 'هذا النوع من الربط قيد التطوير. ستجد المنصات المناسبة له هنا قريبًا.' : 'This connection type is in development. The right platforms will appear here soon.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="flex justify-end border-t border-light-border px-6 py-4 dark:border-dark-border">
                    <button onClick={onClose} className="rounded-xl border border-light-border px-4 py-2 text-sm font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
};
