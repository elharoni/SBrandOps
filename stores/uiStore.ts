// stores/uiStore.ts — Zustand global state for UI
import { create } from 'zustand';
import { Notification, NotificationType } from '../types';

interface UIStore {
    // Sidebar
    isSidebarCollapsed: boolean;
    isMobileSidebarOpen: boolean;

    // Notifications
    notifications: Notification[];
    showNotificationsPanel: boolean;

    // View mode
    viewMode: 'brand' | 'admin';

    // Active pages
    activeBrandPage: string;
    activeAdminPage: string;

    // Modals
    isCommandPaletteOpen: boolean;
    showAddBrandModal: boolean;

    // Actions
    toggleSidebar: () => void;
    setMobileSidebarOpen: (open: boolean) => void;

    addNotification: (type: NotificationType, message: string) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    setShowNotificationsPanel: (show: boolean) => void;

    setViewMode: (mode: 'brand' | 'admin') => void;
    setActiveBrandPage: (page: string) => void;
    setActiveAdminPage: (page: string) => void;

    setCommandPaletteOpen: (open: boolean) => void;
    setShowAddBrandModal: (show: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
    // Initial state
    isSidebarCollapsed: false,
    isMobileSidebarOpen: false,

    notifications: [],
    showNotificationsPanel: false,

    viewMode: 'brand',

    activeBrandPage: 'dashboard',
    activeAdminPage: 'admin-dashboard',

    isCommandPaletteOpen: false,
    showAddBrandModal: false,

    // Sidebar
    toggleSidebar: () => set(s => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
    setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),

    // Notifications
    addNotification: (type, message) => set(s => ({
        notifications: [
            { id: crypto.randomUUID(), type, message, timestamp: new Date(), read: false },
            ...s.notifications,
        ],
    })),
    markNotificationRead: (id) => set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    })),
    markAllNotificationsRead: () => set(s => ({
        notifications: s.notifications.map(n => ({ ...n, read: true })),
    })),
    setShowNotificationsPanel: (show) => set({ showNotificationsPanel: show }),

    // Navigation
    setViewMode: (viewMode) => set({ viewMode }),
    setActiveBrandPage: (activeBrandPage) => set({ activeBrandPage }),
    setActiveAdminPage: (activeAdminPage) => set({ activeAdminPage }),

    // Modals
    setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
    setShowAddBrandModal: (showAddBrandModal) => set({ showAddBrandModal }),
}));
