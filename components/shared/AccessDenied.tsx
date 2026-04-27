import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type DenialReason = 'no_permission' | 'plan_locked' | 'trial_expired';

interface AccessDeniedProps {
    reason?: DenialReason;
    requiredPlan?: string;
    featureName?: string;
    onUpgrade?: () => void;
    onNavigateBack?: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
    reason = 'no_permission',
    requiredPlan,
    featureName,
    onUpgrade,
    onNavigateBack,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    type Config = {
        icon: string;
        color: string;
        bgColor: string;
        borderColor: string;
        title: string;
        message: string;
        action: string | null;
    };

    const configs: Record<DenialReason, Config> = {
        no_permission: {
            icon: 'fa-lock',
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/20',
            title: ar ? 'لا تملك صلاحية' : 'Access Denied',
            message: ar
                ? 'ليس لديك الصلاحية للوصول إلى هذه الصفحة. تواصل مع مدير الـ workspace.'
                : "You don't have permission to access this page. Contact your workspace admin.",
            action: null,
        },
        plan_locked: {
            icon: 'fa-crown',
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/20',
            title: ar ? 'ميزة مدفوعة' : 'Premium Feature',
            message: ar
                ? `هذه الميزة${featureName ? ` (${featureName})` : ''} متاحة في خطة ${requiredPlan ?? 'Pro'} وما فوق.`
                : `This feature${featureName ? ` (${featureName})` : ''} is available on the ${requiredPlan ?? 'Pro'} plan and above.`,
            action: onUpgrade ? (ar ? 'ترقية الآن' : 'Upgrade Now') : null,
        },
        trial_expired: {
            icon: 'fa-hourglass-end',
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/10',
            borderColor: 'border-orange-500/20',
            title: ar ? 'انتهت فترة التجربة' : 'Trial Expired',
            message: ar
                ? 'انتهت فترة التجربة المجانية. ابدأ اشتراكاً للمواصلة.'
                : 'Your free trial has ended. Start a subscription to continue.',
            action: onUpgrade ? (ar ? 'ابدأ اشتراكاً' : 'Start Subscription') : null,
        },
    };

    const cfg = configs[reason];

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className={`max-w-md w-full rounded-2xl border ${cfg.borderColor} ${cfg.bgColor} p-8 text-center`}>
                <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${cfg.bgColor} ${cfg.color}`}>
                    <i className={`fas ${cfg.icon} text-2xl`} />
                </div>
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">
                    {cfg.title}
                </h2>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-6 mb-6">
                    {cfg.message}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                    {onNavigateBack && (
                        <button
                            onClick={onNavigateBack}
                            className="px-4 py-2 rounded-xl border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                        >
                            <i className="fas fa-arrow-left me-2" />
                            {ar ? 'العودة' : 'Go Back'}
                        </button>
                    )}
                    {cfg.action && onUpgrade && (
                        <button
                            onClick={onUpgrade}
                            className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-colors shadow-primary-glow"
                        >
                            <i className="fas fa-arrow-up me-2" />
                            {cfg.action}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
