// hooks/useNotifications.ts — Custom hook for notification management
import { useState, useCallback } from 'react';
import { Notification, NotificationType } from '../types';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const addNotification = useCallback((type: NotificationType, message: string) => {
        const newNotif: Notification = {
            id: crypto.randomUUID(),
            type,
            message,
            timestamp: new Date(),
            read: false,
        };
        setNotifications(prev => [newNotif, ...prev]);
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
        notifications,
        showNotifications,
        setShowNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        unreadCount,
    };
}
