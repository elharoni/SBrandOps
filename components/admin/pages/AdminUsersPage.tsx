// components/admin/pages/AdminUsersPage.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { AdminUser, AdminUserRole, NotificationType, AdminPermission } from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import {
    createAdminUser,
    updateAdminUserRole,
    deleteAdminUser,
    getAdminPermissions,
    getRolePermissions,
} from '../../../services/adminService';
import {
    ADMIN_ROLE_META,
    ADMIN_ROLE_PERMISSIONS,
    PERMISSION_META,
    ALL_PERMISSION_IDS,
    ALL_ADMIN_ROLES,
} from '../../../constants/adminRoles';

const ROLE_META = ADMIN_ROLE_META;
const ROLE_DEFAULT_PERMISSIONS = ADMIN_ROLE_PERMISSIONS;
const PERMISSION_LABELS = PERMISSION_META;
const ALL_ROLES = ALL_ADMIN_ROLES;

// ── Helper: initials ──────────────────────────────────────────────────────────

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'منذ لحظات';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
    return d.toLocaleDateString('ar-EG');
}

// ── Role Stat Card ────────────────────────────────────────────────────────────

const RoleStatCard: React.FC<{
    role: AdminUserRole;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ role, count, isActive, onClick }) => {
    const meta = ROLE_META[role];
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col gap-3 p-4 rounded-2xl border transition-all text-right w-full
                ${isActive
                    ? `${meta.bg} ${meta.border} ring-2 ${meta.ring} ring-offset-2 ring-offset-transparent`
                    : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border hover:border-light-border/70 dark:hover:border-dark-border/70'
                }`}
        >
            <div className='flex items-center justify-between'>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg}`}>
                    <i className={`fas ${meta.icon} ${meta.color} text-sm`} />
                </div>
                <span className={`text-3xl font-black ${isActive ? meta.color : 'text-light-text dark:text-dark-text'}`}>
                    {count}
                </span>
            </div>
            <div>
                <p className={`font-bold text-sm ${isActive ? meta.color : 'text-light-text dark:text-dark-text'}`}>
                    {meta.label}
                </p>
                <p className='text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-tight mt-0.5'>
                    {meta.description}
                </p>
            </div>
        </button>
    );
};

// ── User Profile Card ─────────────────────────────────────────────────────────

const UserCard: React.FC<{
    user: AdminUser;
    onView: (user: AdminUser) => void;
    onDelete: (user: AdminUser) => void;
}> = ({ user, onView, onDelete }) => {
    const meta = ROLE_META[user.role];
    return (
        <div
            className={`group relative bg-light-card dark:bg-dark-card rounded-2xl border ${meta.border} hover:shadow-lg transition-all cursor-pointer`}
            onClick={() => onView(user)}
        >
            {/* Color accent top bar */}
            <div className={`h-1 rounded-t-2xl ${meta.bg.replace('/10', '')} opacity-60`} />

            <div className='p-4 space-y-3'>
                {/* Avatar + Name */}
                <div className='flex items-start gap-3'>
                    <div className={`w-11 h-11 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 ring-2 ${meta.border}`}>
                        <span className={`${meta.color} font-black text-sm`}>{getInitials(user.name)}</span>
                    </div>
                    <div className='flex-1 min-w-0'>
                        <p className='font-bold text-sm text-light-text dark:text-dark-text truncate'>{user.name}</p>
                        <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary truncate'>{user.email}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color}`}>
                        {meta.label}
                    </span>
                </div>

                {/* Meta info */}
                <div className='flex items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary'>
                    <span className='flex items-center gap-1'>
                        <i className='fas fa-building text-[10px]' />
                        {user.tenantName || 'System'}
                    </span>
                    <span className='flex items-center gap-1'>
                        <i className='fas fa-clock text-[10px]' />
                        {timeAgo(user.lastLogin)}
                    </span>
                </div>

                {/* Permissions preview */}
                <div className='flex flex-wrap gap-1'>
                    {ROLE_DEFAULT_PERMISSIONS[user.role].slice(0, 3).map(p => (
                        <span key={p} className='text-[10px] px-1.5 py-0.5 bg-light-bg dark:bg-dark-bg rounded text-light-text-secondary dark:text-dark-text-secondary'>
                            {PERMISSION_LABELS[p]?.label}
                        </span>
                    ))}
                    {ROLE_DEFAULT_PERMISSIONS[user.role].length > 3 && (
                        <span className='text-[10px] px-1.5 py-0.5 bg-light-bg dark:bg-dark-bg rounded text-light-text-secondary dark:text-dark-text-secondary'>
                            +{ROLE_DEFAULT_PERMISSIONS[user.role].length - 3}
                        </span>
                    )}
                </div>

                {/* 2FA + Actions */}
                <div className='flex items-center justify-between pt-1 border-t border-light-border dark:border-dark-border'>
                    <span className={`flex items-center gap-1 text-[11px] font-semibold ${user.twoFactorEnabled ? 'text-success' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        <i className={`fas ${user.twoFactorEnabled ? 'fa-shield-halved' : 'fa-shield'} text-[10px]`} />
                        {user.twoFactorEnabled ? '2FA مفعّل' : '2FA معطّل'}
                    </span>
                    <div className='flex items-center gap-1'>
                        <button
                            onClick={e => { e.stopPropagation(); onView(user); }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${meta.bg} ${meta.color} hover:opacity-80 transition-opacity`}
                        >
                            <i className='fas fa-pen-to-square me-1 text-[10px]' />
                            إدارة
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(user); }}
                            className='px-2 py-1 rounded-lg text-[11px] font-semibold text-danger bg-danger/10 hover:bg-danger/20 transition-colors'
                        >
                            <i className='fas fa-trash text-[10px]' />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── User Profile Drawer ───────────────────────────────────────────────────────

interface UserProfileDrawerProps {
    user: AdminUser;
    allPermissions: AdminPermission[];
    customRolePerms: Record<string, string[]>;
    onClose: () => void;
    onSaveRole: (userId: string, role: AdminUserRole) => Promise<void>;
    onDelete: (user: AdminUser) => void;
}

const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
    user, allPermissions, customRolePerms, onClose, onSaveRole, onDelete
}) => {
    const [role, setRole] = useState<AdminUserRole>(user.role);
    const [saving, setSaving] = useState(false);

    const meta = ROLE_META[role];
    const isDirty = role !== user.role;

    // Get effective permissions: custom DB ones if available, else defaults
    const effectivePerms = customRolePerms[role]?.length
        ? customRolePerms[role]
        : ROLE_DEFAULT_PERMISSIONS[role];

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSaveRole(user.id, role);
            onClose();
        } catch (e: any) {
            alert(e.message || 'حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm'>
            <div className='bg-light-card dark:bg-dark-card w-full max-w-md h-full flex flex-col border-s border-light-border dark:border-dark-border shadow-2xl'>

                {/* Header */}
                <div className={`px-5 py-4 border-b border-light-border dark:border-dark-border ${meta.bg}`}>
                    <div className='flex justify-between items-start'>
                        <div className='flex items-center gap-3'>
                            <div className={`w-12 h-12 rounded-xl ${meta.bg} ring-2 ${meta.border} flex items-center justify-center`}>
                                <span className={`${meta.color} font-black`}>{getInitials(user.name)}</span>
                            </div>
                            <div>
                                <p className='font-black text-light-text dark:text-dark-text'>{user.name}</p>
                                <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>{user.email}</p>
                                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.bg} ${meta.color}`}>
                                    <i className={`fas ${meta.icon} text-[10px]`} />
                                    {meta.label}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className='w-8 h-8 rounded-lg flex items-center justify-center text-light-text-secondary hover:text-danger hover:bg-danger/10 transition-colors'
                        >
                            <i className='fas fa-times' />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className='flex-1 overflow-y-auto'>

                    {/* Role Selector */}
                    <div className='p-5 border-b border-light-border dark:border-dark-border'>
                        <p className='text-xs font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-3'>
                            تغيير الدور
                        </p>
                        <div className='space-y-2'>
                            {ALL_ROLES.map(r => {
                                const m = ROLE_META[r];
                                return (
                                    <button
                                        key={r}
                                        onClick={() => setRole(r)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-right
                                            ${role === r
                                                ? `${m.bg} ${m.border} ring-1 ${m.ring}`
                                                : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center flex-shrink-0`}>
                                            <i className={`fas ${m.icon} ${m.color} text-sm`} />
                                        </div>
                                        <div className='flex-1 text-right'>
                                            <p className={`font-bold text-sm ${role === r ? m.color : 'text-light-text dark:text-dark-text'}`}>
                                                {m.label}
                                            </p>
                                            <p className='text-[11px] text-light-text-secondary dark:text-dark-text-secondary'>
                                                {m.description}
                                            </p>
                                        </div>
                                        {role === r && (
                                            <i className={`fas fa-circle-check ${m.color} flex-shrink-0`} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {isDirty && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60
                                    ${meta.bg.replace('/10', '')} bg-primary hover:bg-primary/90`}
                            >
                                {saving
                                    ? <><i className='fas fa-spinner fa-spin me-2' />جارٍ الحفظ...</>
                                    : <><i className='fas fa-save me-2' />حفظ الدور الجديد</>
                                }
                            </button>
                        )}
                    </div>

                    {/* Permissions */}
                    <div className='p-5 border-b border-light-border dark:border-dark-border'>
                        <p className='text-xs font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-3'>
                            الصلاحيات الحالية للدور
                        </p>
                        <div className='space-y-2'>
                            {ALL_PERMISSION_IDS.map(permId => {
                                const hasIt = effectivePerms.includes(permId);
                                const perm = PERMISSION_LABELS[permId];
                                return (
                                    <div
                                        key={permId}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors
                                            ${hasIt
                                                ? `${meta.bg} ${meta.border}`
                                                : 'border-light-border dark:border-dark-border opacity-40'
                                            }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                                            ${hasIt ? meta.bg : 'bg-light-bg dark:bg-dark-bg'}`}>
                                            <i className={`fas ${perm.icon} text-xs ${hasIt ? meta.color : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                                        </div>
                                        <span className={`flex-1 text-sm font-semibold ${hasIt ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                            {perm.label}
                                        </span>
                                        <i className={`fas ${hasIt ? 'fa-circle-check' : 'fa-circle-xmark'} text-sm ${hasIt ? meta.color : 'text-light-text-secondary dark:text-dark-text-secondary opacity-30'}`} />
                                    </div>
                                );
                            })}
                        </div>
                        <p className='text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-2'>
                            <i className='fas fa-circle-info me-1' />
                            يمكن تخصيص الصلاحيات من إعدادات النظام &rarr; الأدوار والصلاحيات
                        </p>
                    </div>

                    {/* Details */}
                    <div className='p-5'>
                        <p className='text-xs font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-3'>
                            تفاصيل الحساب
                        </p>
                        <div className='space-y-2'>
                            {[
                                { icon: 'fa-building', label: 'الحساب/العميل', value: user.tenantName || 'System' },
                                { icon: 'fa-clock', label: 'آخر تسجيل دخول', value: timeAgo(user.lastLogin) },
                                { icon: 'fa-shield-halved', label: 'التحقق بخطوتين', value: user.twoFactorEnabled ? 'مفعّل' : 'غير مفعّل' },
                            ].map(item => (
                                <div key={item.label} className='flex items-center justify-between py-2 border-b border-light-border/50 dark:border-dark-border/50'>
                                    <span className='flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary'>
                                        <i className={`fas ${item.icon} w-4 text-center text-xs`} />
                                        {item.label}
                                    </span>
                                    <span className='text-sm font-semibold text-light-text dark:text-dark-text'>
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className='p-4 border-t border-light-border dark:border-dark-border'>
                    <button
                        onClick={() => { onDelete(user); onClose(); }}
                        className='w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-danger border border-danger/30 hover:bg-danger/10 transition-colors'
                    >
                        <i className='fas fa-trash-alt' />
                        حذف المسؤول نهائياً
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Create User Modal ─────────────────────────────────────────────────────────

interface CreateUserModalProps {
    onClose: () => void;
    onCreate: (email: string, role: AdminUserRole, tenantName: string) => Promise<void>;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ onClose, onCreate }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<AdminUserRole>(AdminUserRole.SUPPORT);
    const [tenantName, setTenantName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) { setError('يرجى إدخال البريد الإلكتروني'); return; }
        setLoading(true);
        setError('');
        try {
            await onCreate(email.trim(), role, tenantName.trim() || 'System');
            onClose();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
            <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border w-full max-w-lg shadow-2xl'>
                <div className='flex justify-between items-center px-6 py-4 border-b border-light-border dark:border-dark-border'>
                    <div>
                        <h2 className='text-lg font-bold text-light-text dark:text-dark-text'>إضافة مسؤول جديد</h2>
                        <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>اختر الدور المناسب وسيحصل على الصلاحيات تلقائياً</p>
                    </div>
                    <button onClick={onClose} className='w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:text-danger hover:bg-danger/10 transition-colors'>
                        <i className='fas fa-times' />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className='p-6 space-y-5'>
                    {/* Email */}
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>
                            البريد الإلكتروني
                        </label>
                        <input
                            type='email'
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder='admin@example.com'
                            className='w-full p-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:border-primary'
                        />
                    </div>

                    {/* Role picker */}
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>
                            الدور والصلاحيات
                        </label>
                        <div className='grid grid-cols-2 gap-2'>
                            {ALL_ROLES.map(r => {
                                const m = ROLE_META[r];
                                return (
                                    <button
                                        key={r}
                                        type='button'
                                        onClick={() => setRole(r)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-right transition-all
                                            ${role === r
                                                ? `${m.bg} ${m.border} ring-1 ${m.ring}`
                                                : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                                            }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg ${m.bg} flex items-center justify-center flex-shrink-0`}>
                                            <i className={`fas ${m.icon} ${m.color} text-xs`} />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-xs ${role === r ? m.color : 'text-light-text dark:text-dark-text'}`}>{m.label}</p>
                                            <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-tight'>
                                                {ROLE_DEFAULT_PERMISSIONS[r].length} صلاحية
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Permissions preview */}
                    <div className={`rounded-xl border p-3 ${ROLE_META[role].bg} ${ROLE_META[role].border}`}>
                        <p className={`text-xs font-bold mb-2 ${ROLE_META[role].color}`}>صلاحيات {ROLE_META[role].label}:</p>
                        <div className='flex flex-wrap gap-1.5'>
                            {ROLE_DEFAULT_PERMISSIONS[role].map(p => (
                                <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full ${ROLE_META[role].bg} ${ROLE_META[role].color} font-semibold`}>
                                    {PERMISSION_LABELS[p]?.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Tenant */}
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>
                            اسم العميل <span className='normal-case font-normal'>(اختياري)</span>
                        </label>
                        <input
                            type='text'
                            value={tenantName}
                            onChange={e => setTenantName(e.target.value)}
                            placeholder='System'
                            className='w-full p-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:border-primary'
                        />
                    </div>

                    {error && (
                        <div className='flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-xl px-3 py-2'>
                            <i className='fas fa-circle-exclamation' />
                            {error}
                        </div>
                    )}

                    <div className='flex gap-3 pt-1'>
                        <button
                            type='button'
                            onClick={onClose}
                            className='flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'
                        >
                            إلغاء
                        </button>
                        <button
                            type='submit'
                            disabled={loading}
                            className='flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2'
                        >
                            {loading && <i className='fas fa-spinner fa-spin' />}
                            {loading ? 'جارٍ الإضافة...' : 'إضافة المسؤول'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Role Hierarchy Banner ─────────────────────────────────────────────────────

const RoleHierarchyBanner: React.FC = () => (
    <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-4'>
        <div className='flex items-center gap-2 mb-3'>
            <i className='fas fa-sitemap text-primary text-sm' />
            <p className='text-sm font-bold text-light-text dark:text-dark-text'>هيكلية الصلاحيات</p>
        </div>
        <div className='flex items-center gap-2 overflow-x-auto pb-1'>
            {ALL_ROLES.map((role, i) => {
                const m = ROLE_META[role];
                return (
                    <React.Fragment key={role}>
                        <div className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl ${m.bg} border ${m.border}`}>
                            <i className={`fas ${m.icon} ${m.color} text-base`} />
                            <span className={`text-[11px] font-bold ${m.color} whitespace-nowrap`}>{m.label}</span>
                            <span className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary'>
                                {ROLE_DEFAULT_PERMISSIONS[role].length} صلاحية
                            </span>
                        </div>
                        {i < ALL_ROLES.length - 1 && (
                            <i className='fas fa-chevron-left flex-shrink-0 text-light-text-secondary dark:text-dark-text-secondary text-xs opacity-40' />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
        <p className='text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-2'>
            <i className='fas fa-circle-info me-1' />
            تسلسل الصلاحيات من الأعلى (مدير عام) إلى الأدنى (دعم فني) — كل دور يحتوي على صلاحيات الدور الذي يليه وأكثر
        </p>
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const PageSkeleton: React.FC = () => (
    <div className='space-y-6 animate-pulse'>
        <div className='flex justify-between items-center'>
            <SkeletonLoader className='h-10 w-64' />
            <SkeletonLoader className='h-10 w-36' />
        </div>
        <div className='grid grid-cols-4 gap-4'>
            {[1, 2, 3, 4].map(i => <SkeletonLoader key={i} className='h-28' />)}
        </div>
        <div className='grid grid-cols-3 gap-4'>
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonLoader key={i} className='h-40' />)}
        </div>
    </div>
);

interface AdminUsersPageProps {
    users: AdminUser[];
    isLoading: boolean;
    addNotification?: (type: NotificationType, message: string) => void;
    onRefresh?: () => void;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
    users: initialUsers, isLoading, addNotification, onRefresh
}) => {
    const [users, setUsers] = useState<AdminUser[]>(initialUsers);
    const [showCreate, setShowCreate] = useState(false);
    const [viewUser, setViewUser] = useState<AdminUser | null>(null);
    const [activeRoleFilter, setActiveRoleFilter] = useState<AdminUserRole | 'all'>('all');
    const [search, setSearch] = useState('');
    const [allPermissions, setAllPermissions] = useState<AdminPermission[]>([]);
    const [customRolePerms, setCustomRolePerms] = useState<Record<string, string[]>>({});

    useEffect(() => { setUsers(initialUsers); }, [initialUsers]);

    useEffect(() => {
        getAdminPermissions().then(setAllPermissions);
        getRolePermissions().then(setCustomRolePerms);
    }, []);

    const notify = useCallback((type: NotificationType, msg: string) => {
        addNotification?.(type, msg);
    }, [addNotification]);

    // Role counts
    const roleCounts = useMemo(() => {
        const counts: Record<AdminUserRole, number> = {
            [AdminUserRole.SUPER_ADMIN]: 0,
            [AdminUserRole.ADMIN]: 0,
            [AdminUserRole.MODERATOR]: 0,
            [AdminUserRole.SUPPORT]: 0,
        };
        users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
        return counts;
    }, [users]);

    // Filtered users
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchRole = activeRoleFilter === 'all' || u.role === activeRoleFilter;
            const matchSearch = !search ||
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase()) ||
                u.tenantName?.toLowerCase().includes(search.toLowerCase());
            return matchRole && matchSearch;
        });
    }, [users, activeRoleFilter, search]);

    const handleCreate = async (email: string, role: AdminUserRole, tenantName: string) => {
        await createAdminUser(email, role, tenantName);
        const newUser: AdminUser = {
            id: crypto.randomUUID(),
            name: email.split('@')[0],
            email,
            role,
            tenantName,
            lastLogin: new Date().toISOString(),
            twoFactorEnabled: false,
        };
        setUsers(prev => [newUser, ...prev]);
        notify(NotificationType.Success, `تم إضافة المسؤول "${email}" بنجاح`);
    };

    const handleEditRole = async (userId: string, role: AdminUserRole) => {
        await updateAdminUserRole(userId, role);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
        notify(NotificationType.Success, 'تم تحديث الدور بنجاح');
    };

    const handleDelete = useCallback(async (user: AdminUser) => {
        if (!confirm(`هل أنت متأكد من حذف المسؤول "${user.name}"؟`)) return;
        try {
            await deleteAdminUser(user.id);
            setUsers(prev => prev.filter(u => u.id !== user.id));
            notify(NotificationType.Success, 'تم حذف المسؤول');
        } catch (e: any) {
            notify(NotificationType.Error, e.message || 'فشل الحذف');
        }
    }, [notify]);

    if (isLoading && users.length === 0) return <PageSkeleton />;

    return (
        <div className='space-y-6'>

            {/* Page Header */}
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-3xl font-bold text-light-text dark:text-dark-text'>إدارة المسؤولين</h1>
                    <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                        {users.length} مسؤول ·&nbsp;
                        {Object.values(roleCounts).filter(c => c > 0).length} أدوار نشطة
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className='flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25'
                >
                    <i className='fas fa-user-plus' />
                    إضافة مسؤول
                </button>
            </div>

            {/* Role Stat Cards */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                {ALL_ROLES.map(role => (
                    <RoleStatCard
                        key={role}
                        role={role}
                        count={roleCounts[role]}
                        isActive={activeRoleFilter === role}
                        onClick={() => setActiveRoleFilter(prev => prev === role ? 'all' : role)}
                    />
                ))}
            </div>

            {/* Role Hierarchy */}
            <RoleHierarchyBanner />

            {/* Search + Filter Bar */}
            <div className='flex items-center gap-3'>
                <div className='relative flex-1'>
                    <i className='fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-sm' />
                    <input
                        type='text'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder='ابحث بالاسم أو البريد أو العميل...'
                        className='w-full pe-10 ps-4 py-2.5 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary'
                    />
                </div>
                <div className='flex items-center gap-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-1'>
                    <button
                        onClick={() => setActiveRoleFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                            ${activeRoleFilter === 'all'
                                ? 'bg-primary text-white'
                                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                            }`}
                    >
                        الكل ({users.length})
                    </button>
                    {ALL_ROLES.map(r => (
                        <button
                            key={r}
                            onClick={() => setActiveRoleFilter(prev => prev === r ? 'all' : r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                                ${activeRoleFilter === r
                                    ? `${ROLE_META[r].bg} ${ROLE_META[r].color}`
                                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                        >
                            {ROLE_META[r].label} ({roleCounts[r]})
                        </button>
                    ))}
                </div>
            </div>

            {/* User Cards Grid */}
            {filteredUsers.length === 0 ? (
                <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-12 text-center'>
                    <i className='fas fa-users-slash text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3' />
                    <p className='font-bold text-light-text dark:text-dark-text'>لا يوجد مسؤولون مطابقون</p>
                    <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                        {users.length === 0
                            ? 'لا يوجد مسؤولون بعد — أضف أول مسؤول للبدء'
                            : 'جرّب تغيير مرشح الدور أو كلمة البحث'
                        }
                    </p>
                    {users.length === 0 && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className='mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors'
                        >
                            <i className='fas fa-user-plus me-2' />
                            إضافة أول مسؤول
                        </button>
                    )}
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {filteredUsers.map(user => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onView={setViewUser}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showCreate && (
                <CreateUserModal
                    onClose={() => setShowCreate(false)}
                    onCreate={handleCreate}
                />
            )}

            {viewUser && (
                <UserProfileDrawer
                    user={viewUser}
                    allPermissions={allPermissions}
                    customRolePerms={customRolePerms}
                    onClose={() => setViewUser(null)}
                    onSaveRole={handleEditRole}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
};
