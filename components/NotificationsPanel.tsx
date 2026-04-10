import React from 'react';
import { Notification, NotificationType } from '../types';

const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'الآن';
    if (seconds < 60) return `قبل ${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `قبل ${days} يوم`;
};

const NOTIFICATION_META: Record<NotificationType, { icon: string; iconColor: string; label: string; bgUnread: string }> = {
    [NotificationType.Success]: {
        icon: 'fa-check-circle',
        iconColor: 'text-emerald-500',
        label: 'نجاح',
        bgUnread: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    },
    [NotificationType.Info]: {
        icon: 'fa-info-circle',
        iconColor: 'text-blue-500',
        label: 'معلومة',
        bgUnread: 'bg-blue-500/5 dark:bg-blue-500/10',
    },
    [NotificationType.Warning]: {
        icon: 'fa-exclamation-triangle',
        iconColor: 'text-amber-500',
        label: 'تحذير',
        bgUnread: 'bg-amber-500/5 dark:bg-amber-500/10',
    },
    [NotificationType.Error]: {
        icon: 'fa-times-circle',
        iconColor: 'text-red-500',
        label: 'خطأ',
        bgUnread: 'bg-red-500/5 dark:bg-red-500/10',
    },
};

interface NotificationsPanelProps {
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onClose,
}) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="absolute top-16 end-4 w-[22rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border shadow-2xl z-50 overflow-hidden"
            style={{ animation: 'fadeInDown 0.18s ease-out' }}>
            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-light-border dark:border-dark-border">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-light-text dark:text-dark-text">الإشعارات</span>
                    {unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-brand-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={onMarkAllAsRead}
                            className="text-xs text-brand-primary hover:text-brand-primary/80 font-semibold transition-colors"
                        >
                            قراءة الكل
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                        <i className="fas fa-times text-xs" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-light-border/60 dark:divide-dark-border/60">
                {notifications.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center mb-4">
                            <i className="fas fa-bell-slash text-2xl text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <p className="font-semibold text-sm text-light-text dark:text-dark-text mb-1">لا توجد إشعارات</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            ستظهر هنا تنبيهات الحملات والمنشورات والأحداث المهمة
                        </p>
                    </div>
                ) : (
                    notifications.map(notification => {
                        const meta = NOTIFICATION_META[notification.type];
                        return (
                            <div
                                key={notification.id}
                                className={`flex items-start gap-3 px-4 py-3.5 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors group ${!notification.read ? meta.bgUnread : ''}`}
                            >
                                {/* Icon */}
                                <div className="shrink-0 mt-0.5">
                                    <i className={`fas ${meta.icon} ${meta.iconColor}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-light-text dark:text-dark-text leading-snug mb-0.5">
                                        {notification.message}
                                    </p>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {formatTimeAgo(notification.timestamp)}
                                    </p>
                                </div>

                                {/* Unread dot / mark read */}
                                {!notification.read && (
                                    <button
                                        onClick={() => onMarkAsRead(notification.id)}
                                        title="وضع علامة كمقروء"
                                        className="shrink-0 mt-1.5 w-2 h-2 bg-brand-primary rounded-full hover:bg-brand-primary/70 transition-colors"
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-light-border dark:border-dark-border bg-light-bg/50 dark:bg-dark-bg/50">
                    <p className="text-[10px] text-center text-light-text-secondary dark:text-dark-text-secondary">
                        {notifications.length} إشعار · {unreadCount} غير مقروء
                    </p>
                </div>
            )}
        </div>
    );
};
