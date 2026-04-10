/**
 * ToastStack — Floating toast notifications
 * تظهر في أسفل الشاشة وتختفي تلقائياً بعد 4 ثوان
 * مرتبطة بـ uiStore.notifications
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../stores/uiStore';
import { NotificationType, Notification } from '../../types';

const TOAST_DURATION = 4500; // ms

const TOAST_STYLES: Record<NotificationType, { bg: string; border: string; icon: string; iconColor: string }> = {
    [NotificationType.Success]: {
        bg: 'bg-emerald-950/95',
        border: 'border-emerald-500/40',
        icon: 'fa-circle-check',
        iconColor: 'text-emerald-400',
    },
    [NotificationType.Info]: {
        bg: 'bg-blue-950/95',
        border: 'border-blue-500/40',
        icon: 'fa-circle-info',
        iconColor: 'text-blue-400',
    },
    [NotificationType.Warning]: {
        bg: 'bg-amber-950/95',
        border: 'border-amber-500/40',
        icon: 'fa-triangle-exclamation',
        iconColor: 'text-amber-400',
    },
    [NotificationType.Error]: {
        bg: 'bg-red-950/95',
        border: 'border-red-500/40',
        icon: 'fa-circle-xmark',
        iconColor: 'text-red-400',
    },
};

interface ToastItemProps {
    notification: Notification;
    onDismiss: (id: string) => void;
    undoAction?: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss, undoAction }) => {
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(100);
    const style = TOAST_STYLES[notification.type];

    useEffect(() => {
        // Animate in
        const showTimer = requestAnimationFrame(() => setVisible(true));

        // Progress bar
        const start = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
            setProgress(remaining);
            if (remaining === 0) clearInterval(progressInterval);
        }, 50);

        // Auto dismiss
        const dismissTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDismiss(notification.id), 300);
        }, TOAST_DURATION);

        return () => {
            cancelAnimationFrame(showTimer);
            clearInterval(progressInterval);
            clearTimeout(dismissTimer);
        };
    }, [notification.id, onDismiss]);

    return (
        <div
            className={`
                relative overflow-hidden flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-2xl
                backdrop-blur-xl min-w-[280px] max-w-[380px]
                transition-all duration-300 ease-out
                ${style.bg} ${style.border}
                ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
            `}
        >
            {/* Icon */}
            <i className={`fas ${style.icon} ${style.iconColor} mt-0.5 text-base flex-shrink-0`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-snug">{notification.message}</p>
                {undoAction && (
                    <button
                        onClick={() => { undoAction(); onDismiss(notification.id); }}
                        className="mt-1.5 text-xs font-bold text-white/70 hover:text-white underline underline-offset-2 transition-colors"
                    >
                        تراجع عن الإجراء
                    </button>
                )}
            </div>

            {/* Dismiss button */}
            <button
                onClick={() => { setVisible(false); setTimeout(() => onDismiss(notification.id), 300); }}
                className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5"
            >
                <i className="fas fa-xmark text-xs" />
            </button>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                <div
                    className="h-full bg-white/30 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

interface ToastStackProps {
    maxVisible?: number;
}

export const ToastStack: React.FC<ToastStackProps> = ({ maxVisible = 4 }) => {
    const { notifications, markNotificationRead } = useUIStore();
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
    const [shownIds, setShownIds] = useState<Set<string>>(new Set());

    // Watch for new notifications and show them as toasts
    useEffect(() => {
        notifications.forEach(n => {
            if (!shownIds.has(n.id)) {
                setShownIds(prev => new Set([...prev, n.id]));
                setVisibleIds(prev => new Set([...prev, n.id]));
            }
        });
    }, [notifications, shownIds]);

    const handleDismiss = (id: string) => {
        setVisibleIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        markNotificationRead(id);
    };

    const toastsToShow = notifications
        .filter(n => visibleIds.has(n.id))
        .slice(0, maxVisible);

    if (toastsToShow.length === 0) return null;

    return createPortal(
        <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2 items-center pointer-events-none"
            style={{ direction: 'ltr' }}
        >
            {toastsToShow.map(n => (
                <div key={n.id} className="pointer-events-auto">
                    <ToastItem
                        notification={n}
                        onDismiss={handleDismiss}
                    />
                </div>
            ))}
        </div>,
        document.body
    );
};
