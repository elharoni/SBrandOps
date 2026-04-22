// Shared admin role & permission constants
// Used by AdminUsersPage, AdminSettingsPage, and RolesPanel
import { AdminUserRole } from '../types';

export const ADMIN_ROLE_META: Record<AdminUserRole, {
    label: string;
    labelEn: string;
    description: string;
    icon: string;
    color: string;
    bg: string;
    border: string;
    ring: string;
}> = {
    [AdminUserRole.SUPER_ADMIN]: {
        label: 'مدير عام',
        labelEn: 'Super Admin',
        description: 'صلاحيات كاملة وغير محدودة على النظام',
        icon: 'fa-crown',
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        ring: 'ring-rose-500',
    },
    [AdminUserRole.ADMIN]: {
        label: 'مسؤول',
        labelEn: 'Admin',
        description: 'إدارة الحسابات والمستخدمين والفواتير',
        icon: 'fa-user-shield',
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        ring: 'ring-purple-500',
    },
    [AdminUserRole.MODERATOR]: {
        label: 'مشرف',
        labelEn: 'Moderator',
        description: 'مراقبة النظام وإدارة الحسابات',
        icon: 'fa-user-check',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        ring: 'ring-blue-500',
    },
    [AdminUserRole.SUPPORT]: {
        label: 'دعم فني',
        labelEn: 'Support',
        description: 'متابعة الدعم وعرض سجلات النظام',
        icon: 'fa-headset',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        ring: 'ring-emerald-500',
    },
};

export const ALL_ADMIN_ROLES: AdminUserRole[] = [
    AdminUserRole.SUPER_ADMIN,
    AdminUserRole.ADMIN,
    AdminUserRole.MODERATOR,
    AdminUserRole.SUPPORT,
];

export const PERMISSION_META: Record<string, { label: string; icon: string }> = {
    'tenants:manage':  { label: 'إدارة الحسابات',   icon: 'fa-building' },
    'users:manage':    { label: 'إدارة المستخدمين', icon: 'fa-users-cog' },
    'billing:manage':  { label: 'الفواتير والخطط',  icon: 'fa-credit-card' },
    'ai:monitor':      { label: 'مراقبة AI',          icon: 'fa-brain' },
    'queues:manage':   { label: 'إدارة الطوابير',   icon: 'fa-tasks' },
    'settings:manage': { label: 'إعدادات النظام',   icon: 'fa-cogs' },
};

export const ALL_PERMISSION_IDS = Object.keys(PERMISSION_META);

export const ADMIN_ROLE_PERMISSIONS: Record<AdminUserRole, string[]> = {
    [AdminUserRole.SUPER_ADMIN]: ['tenants:manage', 'users:manage', 'billing:manage', 'ai:monitor', 'queues:manage', 'settings:manage'],
    [AdminUserRole.ADMIN]:       ['tenants:manage', 'users:manage', 'billing:manage', 'ai:monitor'],
    [AdminUserRole.MODERATOR]:   ['tenants:manage', 'ai:monitor', 'queues:manage'],
    [AdminUserRole.SUPPORT]:     ['ai:monitor'],
};
