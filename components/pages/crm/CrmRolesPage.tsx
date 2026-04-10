/**
 * CRM Roles & Permissions Management Page
 * Shows the 7 system roles with their permission sets.
 * Allows editing permission toggles per role (non-system roles fully editable).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CrmRole, CrmRoleKey, CrmPermission } from '../../../types';
import {
    getCrmRoles,
    updateRolePermissions,
    seedSystemRoles,
    ROLE_LABELS,
    ROLE_DEFAULT_PERMISSIONS,
} from '../../../services/crmRolesService';

// ── Permission groups for UI display ─────────────────────────────────────────

const PERMISSION_GROUPS: { label: string; labelAr: string; permissions: CrmPermission[] }[] = [
    {
        label: 'Customers',
        labelAr: 'العملاء',
        permissions: ['view_customers', 'edit_customers', 'delete_customers'],
    },
    {
        label: 'Orders',
        labelAr: 'الطلبات',
        permissions: ['view_orders', 'edit_orders'],
    },
    {
        label: 'Analytics & Data',
        labelAr: 'التحليلات',
        permissions: ['view_analytics', 'export_data'],
    },
    {
        label: 'Notes & Tasks',
        labelAr: 'الملاحظات والمهام',
        permissions: ['view_notes', 'edit_notes', 'view_tasks', 'edit_tasks'],
    },
    {
        label: 'Segments & Automations',
        labelAr: 'الشرائح والأتمتة',
        permissions: ['manage_segments', 'manage_automations'],
    },
    {
        label: 'Inbox',
        labelAr: 'صندوق الوارد',
        permissions: ['view_inbox', 'reply_inbox'],
    },
    {
        label: 'Administration',
        labelAr: 'الإدارة',
        permissions: ['manage_integrations', 'manage_roles'],
    },
];

const PERMISSION_LABEL: Record<CrmPermission, string> = {
    view_customers:       'عرض العملاء',
    edit_customers:       'تعديل العملاء',
    delete_customers:     'حذف العملاء',
    view_orders:          'عرض الطلبات',
    edit_orders:          'تعديل الطلبات',
    view_analytics:       'عرض التحليلات',
    manage_automations:   'إدارة الأتمتة',
    manage_integrations:  'إدارة التكاملات',
    manage_roles:         'إدارة الصلاحيات',
    export_data:          'تصدير البيانات',
    view_notes:           'عرض الملاحظات',
    edit_notes:           'تعديل الملاحظات',
    view_tasks:           'عرض المهام',
    edit_tasks:           'تعديل المهام',
    manage_segments:      'إدارة الشرائح',
    view_inbox:           'عرض صندوق الوارد',
    reply_inbox:          'الرد على الرسائل',
};

const ROLE_COLOR: Record<CrmRoleKey, string> = {
    owner:            'bg-purple-100 text-purple-700 border-purple-200',
    admin:            'bg-indigo-100 text-indigo-700 border-indigo-200',
    sales_manager:    'bg-blue-100 text-blue-700 border-blue-200',
    sales_rep:        'bg-sky-100 text-sky-700 border-sky-200',
    support_agent:    'bg-teal-100 text-teal-700 border-teal-200',
    analyst:          'bg-amber-100 text-amber-700 border-amber-200',
    read_only_client: 'bg-gray-100 text-gray-700 border-gray-200',
};

// ── Role Card ─────────────────────────────────────────────────────────────────

const RoleCard: React.FC<{
    role: CrmRole;
    onPermissionToggle: (roleKey: CrmRoleKey, perm: CrmPermission) => void;
    saving: boolean;
}> = ({ role, onPermissionToggle, saving }) => {
    const [expanded, setExpanded] = useState(false);
    const label = ROLE_LABELS[role.roleKey];
    const permSet = new Set(role.permissions);

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-right"
            >
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLOR[role.roleKey]}`}>
                    {role.nameAr ?? label.nameAr}
                </div>
                <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">{label.name}</p>
                    <p className="text-xs text-gray-500">{label.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{role.permissions.length} صلاحية</span>
                    <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-gray-400 text-xs`} />
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {PERMISSION_GROUPS.map(group => {
                        const groupPerms = group.permissions;
                        const activeCount = groupPerms.filter(p => permSet.has(p)).length;
                        return (
                            <div key={group.label}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.labelAr}</span>
                                    <span className="text-xs text-gray-400">{activeCount}/{groupPerms.length}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {groupPerms.map(perm => {
                                        const active = permSet.has(perm);
                                        const isOwner = role.roleKey === 'owner';
                                        return (
                                            <button
                                                key={perm}
                                                disabled={isOwner || saving}
                                                onClick={() => onPermissionToggle(role.roleKey, perm)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-right transition-colors border ${
                                                    active
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                        : 'bg-gray-50 border-gray-200 text-gray-400'
                                                } ${isOwner ? 'cursor-not-allowed opacity-70' : 'hover:opacity-80 cursor-pointer'}`}
                                            >
                                                <i className={`fas ${active ? 'fa-check-circle text-indigo-500' : 'fa-circle text-gray-300'} text-xs`} />
                                                {PERMISSION_LABEL[perm]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {role.roleKey === 'owner' && (
                        <p className="text-xs text-gray-400 text-center py-1">
                            <i className="fas fa-lock mr-1" />
                            صلاحيات Owner لا يمكن تعديلها
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CrmRolesPageProps {
    brandId: string;
}

export const CrmRolesPage: React.FC<CrmRolesPageProps> = ({ brandId }) => {
    const [roles, setRoles]     = useState<CrmRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        // Ensure system roles exist
        await seedSystemRoles(brandId);
        const data = await getCrmRoles(brandId);
        setRoles(data.length > 0 ? data : (Object.keys(ROLE_DEFAULT_PERMISSIONS) as CrmRoleKey[]).map(k => ({
            id: k, brandId, roleKey: k, name: ROLE_LABELS[k].name,
            nameAr: ROLE_LABELS[k].nameAr, permissions: ROLE_DEFAULT_PERMISSIONS[k],
            isSystem: true, createdAt: new Date().toISOString(),
        })));
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const handlePermissionToggle = async (roleKey: CrmRoleKey, perm: CrmPermission) => {
        if (roleKey === 'owner') return;
        setSaving(true);

        const updatedRoles = roles.map(r => {
            if (r.roleKey !== roleKey) return r;
            const has = r.permissions.includes(perm);
            return {
                ...r,
                permissions: has
                    ? r.permissions.filter(p => p !== perm)
                    : [...r.permissions, perm],
            };
        });
        setRoles(updatedRoles);

        const updated = updatedRoles.find(r => r.roleKey === roleKey);
        if (updated) {
            await updateRolePermissions(brandId, roleKey, updated.permissions);
        }

        setSaving(false);
        setSaveMsg('تم الحفظ');
        setTimeout(() => setSaveMsg(''), 2000);
    };

    const roleOrder: CrmRoleKey[] = ['owner', 'admin', 'sales_manager', 'sales_rep', 'support_agent', 'analyst', 'read_only_client'];
    const sortedRoles = [...roles].sort((a, b) => roleOrder.indexOf(a.roleKey) - roleOrder.indexOf(b.roleKey));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">الصلاحيات والأدوار</h1>
                    <p className="text-sm text-gray-500">7 أدوار مدمجة · انقر على أي دور لتعديل صلاحياته</p>
                </div>
                <div className="flex items-center gap-2">
                    {saveMsg && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                            <i className="fas fa-check-circle" /> {saveMsg}
                        </span>
                    )}
                    {saving && <i className="fas fa-circle-notch fa-spin text-indigo-500 text-xs" />}
                </div>
            </div>

            {/* Info banner */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-start gap-3">
                <i className="fas fa-info-circle text-indigo-500 mt-0.5" />
                <div className="text-xs text-indigo-700">
                    <p className="font-semibold mb-0.5">كيف تعمل الصلاحيات؟</p>
                    <p>كل مستخدم يُعيَّن له دور واحد داخل البراند. الدور يحدد ما يمكنه رؤيته وتعديله. دور <strong>Owner</strong> لا يمكن تعديله.</p>
                </div>
            </div>

            {/* Roles grid */}
            {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl h-16 animate-pulse" />
                ))
                : sortedRoles.map(role => (
                    <RoleCard
                        key={role.id}
                        role={role}
                        onPermissionToggle={handlePermissionToggle}
                        saving={saving}
                    />
                ))
            }

            {/* Permission legend */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">جدول مقارنة الصلاحيات</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr>
                                <th className="text-right font-medium text-gray-500 pb-2 pr-2 w-40">الصلاحية</th>
                                {roleOrder.map(rk => (
                                    <th key={rk} className="text-center font-medium pb-2 px-2">
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs border ${ROLE_COLOR[rk]}`}>
                                            {ROLE_LABELS[rk].nameAr}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {(Object.keys(PERMISSION_LABEL) as CrmPermission[]).map(perm => {
                                const roleMap = new Map(sortedRoles.map(r => [r.roleKey, r.permissions.includes(perm)]));
                                return (
                                    <tr key={perm} className="hover:bg-gray-50">
                                        <td className="py-1.5 pr-2 text-gray-600">{PERMISSION_LABEL[perm]}</td>
                                        {roleOrder.map(rk => (
                                            <td key={rk} className="py-1.5 px-2 text-center">
                                                {roleMap.get(rk)
                                                    ? <i className="fas fa-check text-green-500" />
                                                    : <i className="fas fa-minus text-gray-200" />
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
