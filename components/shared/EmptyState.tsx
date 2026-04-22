/**
 * Empty State Component
 * حالات فارغة موحّدة لكل الصفحات
 */

import React from 'react';

interface EmptyStateProps {
    icon?: string;          // Font Awesome class e.g. 'fas fa-inbox'
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'fas fa-box-open',
    title,
    description,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    className = '',
}) => (
    <div className={`flex flex-col items-center justify-center py-20 px-4 text-center ${className}`}>
        <div className="w-20 h-20 rounded-full bg-dark-border flex items-center justify-center mb-5">
            <i className={`${icon} text-3xl text-dark-text-secondary`} />
        </div>
        <h3 className="text-lg font-bold text-dark-text mb-2">{title}</h3>
        {description && (
            <p className="text-sm text-dark-text-secondary max-w-xs mb-6">{description}</p>
        )}
        {(actionLabel || secondaryActionLabel) && (
            <div className="flex items-center gap-3">
                {actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-2 px-5 rounded-xl text-sm transition-colors"
                    >
                        {actionLabel}
                    </button>
                )}
                {secondaryActionLabel && onSecondaryAction && (
                    <button
                        onClick={onSecondaryAction}
                        className="bg-dark-card border border-dark-border hover:border-brand-primary text-dark-text font-semibold py-2 px-5 rounded-lg text-sm transition-colors"
                    >
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        )}
    </div>
);

/* ─── Pre-configured empty states ─── */

export const EmptyScheduled: React.FC<{ onCreatePost: () => void }> = ({ onCreatePost }) => (
    <EmptyState
        icon="far fa-calendar-alt"
        title="لا توجد منشورات مجدولة"
        description="لم تقم بجدولة أي منشورات بعد. ابدأ بإنشاء منشور جديد من الناشر."
        actionLabel="إنشاء منشور"
        onAction={onCreatePost}
    />
);

export const EmptyInbox: React.FC = () => (
    <EmptyState
        icon="fas fa-inbox"
        title="صندوق الوارد فارغ"
        description="لا توجد محادثات جديدة. ستظهر الرسائل الواردة من جميع المنصات هنا."
    />
);

export const EmptyAnalytics: React.FC = () => (
    <EmptyState
        icon="fas fa-chart-bar"
        title="لا توجد بيانات تحليلية"
        description="قم بربط حسابات التواصل الاجتماعي لبدء تتبع الأداء."
        actionLabel="ربط الحسابات"
    />
);

export const EmptyContentPipeline: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <EmptyState
        icon="fas fa-pencil-alt"
        title="لا يوجد محتوى في الخط الإنتاجي"
        description="أضف أفكارًا جديدة أو استخدم مساعد الذكاء الاصطناعي لتوليد محتوى."
        actionLabel="إضافة فكرة"
        onAction={onAdd}
    />
);

export const EmptyCampaigns: React.FC = () => (
    <EmptyState
        icon="fas fa-bullhorn"
        title="لا توجد حملات إعلانية"
        description="قم بربط حساب الإعلانات لعرض ومتابعة حملاتك."
    />
);

export const EmptyNotifications: React.FC = () => (
    <EmptyState
        icon="fas fa-bell-slash"
        title="لا توجد إشعارات"
        description="ستظهر الإشعارات والتنبيهات هنا."
    />
);

export const EmptySearchResults: React.FC<{ query: string }> = ({ query }) => (
    <EmptyState
        icon="fas fa-search"
        title={`لا نتائج لـ "${query}"`}
        description="جرب كلمات بحث مختلفة أو تحقق من الإملاء."
    />
);

export const EmptyBrands: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <EmptyState
        icon="fas fa-store"
        title="لا توجد براندات بعد"
        description="أضف أول براند لك للبدء في إدارة محتواه وحملاته."
        actionLabel="إضافة براند"
        onAction={onAdd}
    />
);
