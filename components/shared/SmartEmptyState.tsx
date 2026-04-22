import React from 'react';

type Variant = 'no-brands' | 'no-posts' | 'no-analytics' | 'no-social';
type Goal = 'social' | 'seo' | 'ads' | 'branding' | 'analytics' | 'all';

interface SmartEmptyStateProps {
    variant: Variant;
    onAction?: () => void;
    onSecondaryAction?: () => void;
}

const CONFIG: Record<Variant, {
    icon: string;
    gradient: string;
    title: string;
    desc: string;
    action: string;
    secondary?: string;
    tips: Partial<Record<Goal, string>>;
}> = {
    'no-brands': {
        icon: 'fa-layer-group',
        gradient: 'from-violet-500 to-indigo-600',
        title: 'لم تُنشئ أي براند بعد',
        desc: 'البراند هو نقطة انطلاقك — أنشئ أولاً وابدأ إدارة محتواك بالذكاء الاصطناعي.',
        action: '+ أنشئ أول براند',
        tips: {
            social: '💡 نصيحة: البراندات القوية على السوشيال تنشر بانتظام. ابدأ ببراند واحد وأتقنه.',
            seo: '💡 نصيحة: كل براند يحصل على تحليل SEO منفصل — سهّل التتبع من اليوم الأول.',
            ads: '💡 نصيحة: فصل البراندات يمنحك إحصاءات إعلانية دقيقة لكل منتج.',
            branding: '💡 نصيحة: SBrandOps يحفظ الألوان والـ tone لكل براند ويطبّقها تلقائياً.',
            analytics: '💡 نصيحة: كل براند له لوحة تحليلات مستقلة — الآن وضوح أكثر.',
        },
    },
    'no-posts': {
        icon: 'fa-calendar-plus',
        gradient: 'from-pink-500 to-rose-600',
        title: 'جدولك فارغ تماماً',
        desc: 'لا منشورات مجدولة. النشر المنتظم يضاعف التفاعل — دعني أساعدك.',
        action: '+ إنشاء منشور بالذكاء الاصطناعي',
        secondary: 'جدولة يدوية',
        tips: {
            social: '💡 نصيحة: المنشورات الأكثر تفاعلاً تُنشر بين 7-9 مساءً. جدوّل الآن.',
            seo: '💡 نصيحة: المقالات الطويلة على LinkedIn تحسّن ظهورك في البحث.',
            ads: '💡 نصيحة: المنشورات العضوية تُقلل تكلفة الإعلان — الخوارزمية تكافئ الثبات.',
            branding: '💡 نصيحة: الـ tone الموحّد في كل منشور يبني الثقة خلال 90 يوماً فقط.',
        },
    },
    'no-analytics': {
        icon: 'fa-chart-line',
        gradient: 'from-emerald-500 to-teal-600',
        title: 'لا بيانات بعد',
        desc: 'ربط حساباتك الاجتماعية يفتح تحليلات الأداء، المتابعين، والمنافسين.',
        action: 'ربط حساب اجتماعي',
        tips: {
            analytics: '💡 نصيحة: بعد ربط الحسابات ستجد أفضل أوقات النشر لجمهورك تلقائياً.',
            social: '💡 نصيحة: تتبّع معدل التفاعل أهم من تتبع عدد المتابعين.',
            seo: '💡 نصيحة: البيانات الاجتماعية تُغذّي استراتيجية SEO — كلاهما مرتبطان.',
        },
    },
    'no-social': {
        icon: 'fa-link',
        gradient: 'from-cyan-500 to-blue-600',
        title: 'لا حسابات مربوطة',
        desc: 'اربط انستقرام أو تويتر أو فيسبوك لتمكين النشر التلقائي والتحليلات.',
        action: 'ربط حساب الآن',
        tips: {
            social: '💡 نصيحة: يمكنك ربط حتى 10 حسابات من منصات مختلفة ونشر كل شيء بضغطة.',
            ads: '💡 نصيحة: الربط يمنحك بيانات الجمهور المثالية لاستهداف إعلاناتك.',
            branding: '💡 نصيحة: الهوية الموحّدة عبر المنصات تزيد التعرف على براندك 3×.',
        },
    },
};

export const SmartEmptyState: React.FC<SmartEmptyStateProps> = ({ variant, onAction, onSecondaryAction }) => {
    const goal = (localStorage.getItem('userGoal') ?? 'all') as Goal;
    const cfg = CONFIG[variant];
    const tip = cfg.tips[goal] ?? cfg.tips['social'] ?? null;

    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            {/* Icon */}
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                <i className={`fas ${cfg.icon} text-white text-3xl`} />
            </div>

            <h3 className="text-xl font-bold text-dark-text mb-2">{cfg.title}</h3>
            <p className="text-sm text-dark-text-secondary max-w-xs mb-5 leading-relaxed">{cfg.desc}</p>

            {/* Personalized tip */}
            {tip && (
                <div className="mb-6 max-w-sm w-full bg-brand-primary/10 border border-brand-primary/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-brand-primary font-medium leading-relaxed">{tip}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
                {onAction && (
                    <button onClick={onAction}
                        className={`bg-gradient-to-r ${cfg.gradient} text-white font-semibold py-2.5 px-6 rounded-xl text-sm shadow-md transition-all hover:-translate-y-0.5`}>
                        {cfg.action}
                    </button>
                )}
                {cfg.secondary && onSecondaryAction && (
                    <button onClick={onSecondaryAction}
                        className="border border-dark-border text-dark-text-secondary hover:text-dark-text hover:border-dark-text font-medium py-2.5 px-5 rounded-xl text-sm transition-colors">
                        {cfg.secondary}
                    </button>
                )}
            </div>
        </div>
    );
};
