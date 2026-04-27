import React, { useState, useEffect } from 'react';

interface OnboardingChecklistProps {
    brandId?: string;
    hasBrandProfile: boolean;
    hasConnectedAccount: boolean;
    hasProductOrContent: boolean;
    hasFirstPost: boolean;
    hasVoiceSet: boolean;
    onNavigate: (page: string) => void;
}

interface Step {
    id: string;
    icon: string;
    titleAr: string;
    descAr: string;
    done: boolean;
    navPage: string;
    navLabelAr: string;
}

function dismissKey(brandId?: string) {
    return `onboarding_dismissed_${brandId ?? 'default'}`;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
    brandId,
    hasBrandProfile,
    hasConnectedAccount,
    hasProductOrContent,
    hasFirstPost,
    hasVoiceSet,
    onNavigate,
}) => {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(dismissKey(brandId));
        if (stored === '1') setDismissed(true);
    }, [brandId]);

    const steps: Step[] = [
        {
            id: 'email',
            icon: 'fa-envelope-circle-check',
            titleAr: 'تأكيد البريد الإلكتروني',
            descAr: 'تحقق من بريدك وانقر على رابط التفعيل',
            done: true,
            navPage: '',
            navLabelAr: 'مكتمل',
        },
        {
            id: 'brand',
            icon: 'fa-building',
            titleAr: 'إنشاء البراند',
            descAr: 'أضف بياناتك الأساسية: الاسم، الصناعة، الوصف',
            done: hasBrandProfile,
            navPage: 'brand-hub',
            navLabelAr: 'أكمل الآن',
        },
        {
            id: 'social',
            icon: 'fa-link',
            titleAr: 'ربط حساب اجتماعي',
            descAr: 'اربط Facebook أو Instagram لتفعيل النشر والإحصائيات',
            done: hasConnectedAccount,
            navPage: 'integrations',
            navLabelAr: 'اربط الآن',
        },
        {
            id: 'product',
            icon: 'fa-box',
            titleAr: 'إضافة منتج أو خدمة',
            descAr: 'أضف ما تبيعه حتى يفهمه الذكاء الاصطناعي',
            done: hasProductOrContent,
            navPage: 'brand-hub/knowledge',
            navLabelAr: 'أضف الآن',
        },
        {
            id: 'post',
            icon: 'fa-pen-to-square',
            titleAr: 'توليد أول منشور',
            descAr: 'استخدم Content Studio لإنشاء منشور بصوت البراند',
            done: hasFirstPost,
            navPage: 'social-ops/publisher',
            navLabelAr: 'ابدأ الآن',
        },
        {
            id: 'voice',
            icon: 'fa-waveform-lines',
            titleAr: 'ضبط نبرة الصوت',
            descAr: 'حدّد شخصية البراند وأسلوب تواصله',
            done: hasVoiceSet,
            navPage: 'brand-hub',
            navLabelAr: 'اضبط الآن',
        },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const allDone = completedCount === steps.length;

    if (dismissed || allDone) return null;

    const progressPct = Math.round((completedCount / steps.length) * 100);

    const handleDismiss = () => {
        localStorage.setItem(dismissKey(brandId), '1');
        setDismissed(true);
    };

    return (
        <div className="surface-panel rounded-[1.75rem] p-5 md:p-6 mb-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-rocket text-brand-primary text-lg" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-light-text dark:text-dark-text">
                            ابدأ مع SBrandOps
                        </h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {completedCount} من {steps.length} خطوات مكتملة
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    title="إخفاء القائمة"
                    className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors mt-0.5"
                >
                    <i className="fas fa-times text-sm" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-light-border dark:bg-dark-border rounded-full overflow-hidden mb-5">
                <div
                    className="h-full bg-brand-primary rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-2">
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                            step.done
                                ? 'bg-emerald-500/6 border border-emerald-500/15'
                                : 'bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border'
                        }`}
                    >
                        {/* Status icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            step.done
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary'
                        }`}>
                            {step.done
                                ? <i className="fas fa-check text-xs" />
                                : <i className={`fas ${step.icon} text-xs`} />
                            }
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${
                                step.done
                                    ? 'text-emerald-600 dark:text-emerald-400 line-through decoration-emerald-500/50'
                                    : 'text-light-text dark:text-dark-text'
                            }`}>
                                {step.titleAr}
                            </p>
                            {!step.done && (
                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
                                    {step.descAr}
                                </p>
                            )}
                        </div>

                        {/* CTA */}
                        {!step.done && step.navPage && (
                            <button
                                onClick={() => onNavigate(step.navPage)}
                                className="flex-shrink-0 text-[11px] font-bold text-brand-primary hover:text-brand-primary/80 transition-colors whitespace-nowrap"
                            >
                                {step.navLabelAr}
                                <i className="fas fa-chevron-left mr-1 text-[9px]" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
