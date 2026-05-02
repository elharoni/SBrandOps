import { supabase } from './supabaseClient';

// ── Audit action constants ────────────────────────────────────────────────────

export const AuditAction = {
    // User management
    USER_INVITED:           'user.invited',
    USER_REMOVED:           'user.removed',
    USER_ROLE_CHANGED:      'user.role_changed',
    USER_SUSPENDED:         'user.suspended',
    USER_UNSUSPENDED:       'user.unsuspended',

    // Auth
    USER_LOGIN:             'auth.login',
    USER_LOGOUT:            'auth.logout',
    PASSWORD_CHANGED:       'auth.password_changed',
    MFA_ENABLED:            'auth.mfa_enabled',
    MFA_DISABLED:           'auth.mfa_disabled',

    // Brand operations
    BRAND_CREATED:          'brand.created',
    BRAND_DELETED:          'brand.deleted',
    BRAND_PROFILE_UPDATED:  'brand.profile_updated',

    // Token / integrations
    TOKEN_CONNECTED:        'token.connected',
    TOKEN_DISCONNECTED:     'token.disconnected',
    TOKEN_REFRESHED:        'token.refreshed',
    TOKEN_REVOKED:          'token.revoked',

    // Content
    CONTENT_PUBLISHED:      'content.published',
    CONTENT_DELETED:        'content.deleted',

    // CRM
    CRM_LEAD_EXPORTED:        'crm.lead_exported',
    CRM_CONTACT_DELETED:      'crm.contact_deleted',
    CRM_CUSTOMERS_IMPORTED:   'crm.customers_imported',
    CRM_BULK_LIFECYCLE:       'crm.bulk_lifecycle_changed',

    // Billing
    PLAN_CHANGED:           'billing.plan_changed',
    SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',

    // Security
    PERMISSION_OVERRIDDEN:  'security.permission_overridden',
    SUSPICIOUS_ACCESS:      'security.suspicious_access',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

export type AuditSeverity = 'info' | 'warning' | 'critical';

const SEVERITY_MAP: Partial<Record<AuditActionType, AuditSeverity>> = {
    [AuditAction.USER_REMOVED]:           'warning',
    [AuditAction.USER_SUSPENDED]:         'warning',
    [AuditAction.USER_ROLE_CHANGED]:      'warning',
    [AuditAction.BRAND_DELETED]:          'critical',
    [AuditAction.TOKEN_REVOKED]:          'warning',
    [AuditAction.MFA_DISABLED]:           'warning',
    [AuditAction.PERMISSION_OVERRIDDEN]:  'critical',
    [AuditAction.SUSPICIOUS_ACCESS]:      'critical',
    [AuditAction.SUBSCRIPTION_CANCELLED]: 'warning',
    [AuditAction.CRM_LEAD_EXPORTED]:      'info',
};

export interface AuditEntry {
    action: AuditActionType;
    actorId?: string;
    actorEmail?: string;
    targetType?: string;
    targetId?: string;
    brandId?: string;
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
}

// ── Core log function ─────────────────────────────────────────────────────────

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
    try {
        let actorId    = entry.actorId;
        let actorEmail = entry.actorEmail;

        if (!actorId) {
            const { data: { user } } = await supabase.auth.getUser();
            actorId    = user?.id;
            actorEmail = actorEmail ?? user?.email ?? undefined;
        }

        const severity: AuditSeverity = SEVERITY_MAP[entry.action] ?? 'info';

        const { error } = await supabase.from('audit_logs').insert({
            action:       entry.action,
            actor_id:     actorId     ?? null,
            actor_email:  actorEmail  ?? null,
            target_type:  entry.targetType ?? null,
            target_id:    entry.targetId   ?? null,
            brand_id:     entry.brandId    ?? null,
            before_data:  entry.beforeData ?? null,
            after_data:   entry.afterData  ?? null,
            severity,
        });

        if (error) console.warn('[audit] insert error:', error.message);
    } catch (err) {
        console.warn('[audit] unexpected error:', err);
    }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export function auditUserInvited(actorId: string, actorEmail: string, inviteeEmail: string, role: string, brandId?: string) {
    return logAuditEvent({
        action: AuditAction.USER_INVITED,
        actorId, actorEmail,
        targetType: 'user', targetId: inviteeEmail,
        brandId,
        afterData: { email: inviteeEmail, role },
    });
}

export function auditRoleChanged(actorId: string, targetUserId: string, fromRole: string, toRole: string, brandId?: string) {
    return logAuditEvent({
        action: AuditAction.USER_ROLE_CHANGED,
        actorId,
        targetType: 'user', targetId: targetUserId,
        brandId,
        beforeData: { role: fromRole },
        afterData:  { role: toRole },
    });
}

export function auditBrandDeleted(actorId: string, brandId: string, brandName: string) {
    return logAuditEvent({
        action: AuditAction.BRAND_DELETED,
        actorId,
        targetType: 'brand', targetId: brandId,
        brandId,
        beforeData: { name: brandName },
    });
}

export function auditTokenConnected(platform: string, brandId: string) {
    return logAuditEvent({
        action: AuditAction.TOKEN_CONNECTED,
        targetType: 'integration', targetId: platform,
        brandId,
        afterData: { platform },
    });
}

export function auditTokenDisconnected(platform: string, brandId: string) {
    return logAuditEvent({
        action: AuditAction.TOKEN_DISCONNECTED,
        targetType: 'integration', targetId: platform,
        brandId,
        beforeData: { platform },
    });
}

export function auditContentPublished(actorId: string, postId: string, platforms: string[], brandId: string) {
    return logAuditEvent({
        action: AuditAction.CONTENT_PUBLISHED,
        actorId,
        targetType: 'post', targetId: postId,
        brandId,
        afterData: { platforms },
    });
}

export function auditCrmImport(brandId: string, inserted: number, skipped: number, errors: number) {
    return logAuditEvent({
        action: AuditAction.CRM_CUSTOMERS_IMPORTED,
        targetType: 'crm_customers',
        brandId,
        afterData: { inserted, skipped, errors },
    });
}

export function auditCrmBulkLifecycle(brandId: string, count: number, stage: string) {
    return logAuditEvent({
        action: AuditAction.CRM_BULK_LIFECYCLE,
        targetType: 'crm_customers',
        brandId,
        afterData: { count, stage },
    });
}

export function auditCrmExport(brandId: string, count: number) {
    return logAuditEvent({
        action: AuditAction.CRM_LEAD_EXPORTED,
        targetType: 'crm_customers',
        brandId,
        afterData: { count },
    });
}

// ── Read helpers (for admin UI) ───────────────────────────────────────────────

export interface AuditLogRow {
    id: string;
    action: string;
    actor_email: string | null;
    target_type: string | null;
    target_id: string | null;
    brand_id: string | null;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    severity: AuditSeverity;
    created_at: string;
}

export async function getAuditLogs(
    brandId?: string,
    limit = 50,
    severity?: AuditSeverity
): Promise<AuditLogRow[]> {
    let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (brandId) query = query.eq('brand_id', brandId);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) {
        console.error('[audit] getAuditLogs error:', error.message);
        return [];
    }
    return (data ?? []) as AuditLogRow[];
}
