/**
 * CRM Roles & Permissions Service
 * Manages per-brand CRM role definitions and user assignments.
 * 7 built-in roles, each with a curated set of CrmPermission strings.
 */

import { supabase } from './supabaseClient';
import { CrmRole, CrmRoleKey, CrmUserRole, CrmPermission } from '../types';

// ── Default permission sets per role ─────────────────────────────────────────

export const ROLE_DEFAULT_PERMISSIONS: Record<CrmRoleKey, CrmPermission[]> = {
    owner: [
        'view_customers', 'edit_customers', 'delete_customers',
        'view_orders', 'edit_orders',
        'view_analytics',
        'manage_automations', 'manage_integrations', 'manage_roles',
        'export_data',
        'view_notes', 'edit_notes',
        'view_tasks', 'edit_tasks',
        'manage_segments',
        'view_inbox', 'reply_inbox',
    ],
    admin: [
        'view_customers', 'edit_customers', 'delete_customers',
        'view_orders', 'edit_orders',
        'view_analytics',
        'manage_automations', 'manage_integrations', 'manage_roles',
        'export_data',
        'view_notes', 'edit_notes',
        'view_tasks', 'edit_tasks',
        'manage_segments',
        'view_inbox', 'reply_inbox',
    ],
    sales_manager: [
        'view_customers', 'edit_customers',
        'view_orders', 'edit_orders',
        'view_analytics',
        'manage_automations',
        'export_data',
        'view_notes', 'edit_notes',
        'view_tasks', 'edit_tasks',
        'manage_segments',
        'view_inbox', 'reply_inbox',
    ],
    sales_rep: [
        'view_customers', 'edit_customers',
        'view_orders',
        'view_notes', 'edit_notes',
        'view_tasks', 'edit_tasks',
        'view_inbox', 'reply_inbox',
    ],
    support_agent: [
        'view_customers',
        'view_orders',
        'view_notes', 'edit_notes',
        'view_tasks', 'edit_tasks',
        'view_inbox', 'reply_inbox',
    ],
    analyst: [
        'view_customers',
        'view_orders',
        'view_analytics',
        'export_data',
        'view_notes',
        'view_tasks',
        'manage_segments',
    ],
    read_only_client: [
        'view_customers',
        'view_orders',
        'view_analytics',
    ],
};

export const ROLE_LABELS: Record<CrmRoleKey, { name: string; nameAr: string; description: string }> = {
    owner:           { name: 'Owner',          nameAr: 'مالك',             description: 'Full access to all CRM features' },
    admin:           { name: 'Admin',           nameAr: 'مسؤول',            description: 'Full access, except cannot delete the owner' },
    sales_manager:   { name: 'Sales Manager',   nameAr: 'مدير مبيعات',      description: 'Manage team, view analytics, run automations' },
    sales_rep:       { name: 'Sales Rep',       nameAr: 'مندوب مبيعات',     description: 'View & edit customers and orders, tasks, inbox' },
    support_agent:   { name: 'Support Agent',   nameAr: 'وكيل دعم',         description: 'View customers/orders, manage tasks, reply inbox' },
    analyst:         { name: 'Analyst',         nameAr: 'محلل بيانات',       description: 'Read-only analytics, export data, build segments' },
    read_only_client:{ name: 'Read-Only Client',nameAr: 'عميل للاطلاع فقط', description: 'View customers, orders, and analytics — no edits' },
};

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToRole(row: Record<string, unknown>): CrmRole {
    return {
        id:          row.id as string,
        brandId:     row.brand_id as string,
        roleKey:     row.role_key as CrmRoleKey,
        name:        row.name as string,
        nameAr:      row.name_ar as string | undefined,
        permissions: (row.permissions as CrmPermission[]) ?? [],
        isSystem:    Boolean(row.is_system),
        createdAt:   row.created_at as string,
    };
}

function rowToUserRole(row: Record<string, unknown>): CrmUserRole {
    return {
        id:         row.id as string,
        brandId:    row.brand_id as string,
        userId:     row.user_id as string,
        roleKey:    row.role_key as CrmRoleKey,
        assignedBy: row.assigned_by as string | undefined,
        assignedAt: row.assigned_at as string,
    };
}

// ── Seed helper (idempotent) ──────────────────────────────────────────────────

/**
 * Ensure all 7 system roles exist for a brand (call on first CRM setup).
 */
export async function seedSystemRoles(brandId: string): Promise<void> {
    const rows = (Object.keys(ROLE_DEFAULT_PERMISSIONS) as CrmRoleKey[]).map(roleKey => ({
        brand_id:    brandId,
        role_key:    roleKey,
        name:        ROLE_LABELS[roleKey].name,
        name_ar:     ROLE_LABELS[roleKey].nameAr,
        permissions: ROLE_DEFAULT_PERMISSIONS[roleKey],
        is_system:   true,
    }));

    await supabase
        .from('crm_roles')
        .upsert(rows, { onConflict: 'brand_id,role_key' });
}

// ── Roles CRUD ────────────────────────────────────────────────────────────────

export async function getCrmRoles(brandId: string): Promise<CrmRole[]> {
    try {
        const { data, error } = await supabase
            .from('crm_roles')
            .select('*')
            .eq('brand_id', brandId)
            .order('role_key');

        if (error || !data) return getDefaultRoles(brandId);
        return data.map(r => rowToRole(r as Record<string, unknown>));
    } catch {
        return getDefaultRoles(brandId);
    }
}

export async function getCrmRoleByKey(brandId: string, roleKey: CrmRoleKey): Promise<CrmRole | null> {
    try {
        const { data } = await supabase
            .from('crm_roles')
            .select('*')
            .eq('brand_id', brandId)
            .eq('role_key', roleKey)
            .single();

        return data ? rowToRole(data as Record<string, unknown>) : buildDefaultRole(brandId, roleKey);
    } catch {
        return buildDefaultRole(brandId, roleKey);
    }
}

export async function updateRolePermissions(
    brandId: string,
    roleKey: CrmRoleKey,
    permissions: CrmPermission[]
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_roles')
            .update({ permissions })
            .eq('brand_id', brandId)
            .eq('role_key', roleKey);
        return !error;
    } catch {
        return false;
    }
}

// ── User Role Assignment ──────────────────────────────────────────────────────

export async function getCrmUserRole(brandId: string, userId: string): Promise<CrmUserRole | null> {
    try {
        const { data } = await supabase
            .from('crm_user_roles')
            .select('*')
            .eq('brand_id', brandId)
            .eq('user_id', userId)
            .single();

        return data ? rowToUserRole(data as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export async function assignCrmRole(
    brandId: string,
    userId: string,
    roleKey: CrmRoleKey,
    assignedBy?: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_user_roles')
            .upsert([{
                brand_id:    brandId,
                user_id:     userId,
                role_key:    roleKey,
                assigned_by: assignedBy,
            }], { onConflict: 'brand_id,user_id' });
        return !error;
    } catch {
        return false;
    }
}

export async function removeCrmRole(brandId: string, userId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_user_roles')
            .delete()
            .eq('brand_id', brandId)
            .eq('user_id', userId);
        return !error;
    } catch {
        return false;
    }
}

export async function getBrandUserRoles(brandId: string): Promise<CrmUserRole[]> {
    try {
        const { data, error } = await supabase
            .from('crm_user_roles')
            .select('*')
            .eq('brand_id', brandId)
            .order('assigned_at', { ascending: false });

        if (error || !data) return [];
        return data.map(r => rowToUserRole(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

// ── Permission Check ──────────────────────────────────────────────────────────

/**
 * Check if a user has a specific permission within a brand.
 * Fetches the user's role, then checks its permission list.
 */
export async function checkPermission(
    brandId: string,
    userId: string,
    permission: CrmPermission
): Promise<boolean> {
    try {
        const userRole = await getCrmUserRole(brandId, userId);
        if (!userRole) return false;

        const role = await getCrmRoleByKey(brandId, userRole.roleKey);
        if (!role) return false;

        return role.permissions.includes(permission);
    } catch {
        return false;
    }
}

/**
 * Get all permissions for a user in a brand (resolved from their role).
 */
export async function getUserPermissions(brandId: string, userId: string): Promise<CrmPermission[]> {
    try {
        const userRole = await getCrmUserRole(brandId, userId);
        if (!userRole) return [];

        const role = await getCrmRoleByKey(brandId, userRole.roleKey);
        return role?.permissions ?? [];
    } catch {
        return [];
    }
}

// ── Local fallbacks ───────────────────────────────────────────────────────────

function buildDefaultRole(brandId: string, roleKey: CrmRoleKey): CrmRole {
    return {
        id:          `default-${roleKey}`,
        brandId,
        roleKey,
        name:        ROLE_LABELS[roleKey].name,
        nameAr:      ROLE_LABELS[roleKey].nameAr,
        permissions: ROLE_DEFAULT_PERMISSIONS[roleKey],
        isSystem:    true,
        createdAt:   new Date().toISOString(),
    };
}

function getDefaultRoles(brandId: string): CrmRole[] {
    return (Object.keys(ROLE_DEFAULT_PERMISSIONS) as CrmRoleKey[]).map(k => buildDefaultRole(brandId, k));
}
