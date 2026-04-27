import React, {
    createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useBrandStore } from '../stores/brandStore';
import { supabase } from '../services/supabaseClient';

// ── Platform roles (set only via service-role key, never by frontend) ─────────

const PLATFORM_ROLES = [
    'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_ADMIN',
    'BILLING_ADMIN', 'TECHNICAL_ADMIN', 'SECURITY_ADMIN',
] as const;

type PlatformRole = typeof PLATFORM_ROLES[number];

const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, string[]> = {
    SUPER_ADMIN: ['*'],
    PLATFORM_ADMIN: [
        'platform.dashboard.view',
        'platform.users.view', 'platform.users.create', 'platform.users.update',
        'platform.users.suspend', 'platform.users.unsuspend', 'platform.users.export',
        'platform.workspaces.view', 'platform.workspaces.suspend', 'platform.workspaces.unsuspend',
        'platform.plans.view', 'platform.plans.create', 'platform.plans.update',
        'platform.subscriptions.view', 'platform.subscriptions.update', 'platform.subscriptions.cancel',
        'platform.payments.view', 'platform.invoices.view', 'platform.invoices.refund',
        'platform.feature_flags.view', 'platform.feature_flags.update',
        'platform.system_settings.view', 'platform.system_settings.update',
        'platform.analytics.view',
        'platform.audit_logs.view', 'platform.audit_logs.export',
        'platform.security_logs.view',
        'platform.api_keys.view', 'platform.api_keys.revoke',
        'platform.ai_monitor.view',
        'platform.ai_keys.view', 'platform.ai_keys.create', 'platform.ai_keys.update',
        'platform.ai_keys.delete', 'platform.ai_keys.rotate',
        'platform.queues.view', 'platform.queues.retry', 'platform.queues.purge',
        'platform.system_health.view',
        'platform.support.grant_workspace_access', 'platform.support.revoke_workspace_access',
        'platform.support.view_active_grants',
        'platform.webhooks.view', 'platform.webhooks.create', 'platform.webhooks.update',
        'platform.webhooks.delete', 'platform.webhooks.test',
        'platform.integrations_health.view',
        'platform.email_templates.view', 'platform.email_templates.update',
        'platform.announcements.view', 'platform.announcements.create', 'platform.announcements.delete',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.security.update.own',
        'settings.2fa.enable.own', 'settings.2fa.disable.own',
        'settings.sessions.view.own', 'settings.sessions.revoke.own',
    ],
    SUPPORT_ADMIN: [
        'platform.dashboard.view', 'platform.users.view', 'platform.workspaces.view',
        'platform.support.grant_workspace_access', 'platform.support.revoke_workspace_access',
        'platform.support.view_active_grants',
        'platform.audit_logs.view', 'platform.system_health.view',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.2fa.enable.own', 'settings.sessions.view.own',
    ],
    BILLING_ADMIN: [
        'platform.dashboard.view',
        'platform.subscriptions.view', 'platform.subscriptions.update', 'platform.subscriptions.cancel',
        'platform.payments.view', 'platform.invoices.view', 'platform.invoices.refund',
        'platform.plans.view', 'platform.plans.create', 'platform.plans.update',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.2fa.enable.own', 'settings.sessions.view.own',
    ],
    TECHNICAL_ADMIN: [
        'platform.dashboard.view', 'platform.system_health.view',
        'platform.system_settings.view', 'platform.system_settings.update',
        'platform.queues.view', 'platform.queues.retry', 'platform.queues.purge',
        'platform.ai_monitor.view',
        'platform.ai_keys.view', 'platform.ai_keys.create', 'platform.ai_keys.update',
        'platform.ai_keys.delete', 'platform.ai_keys.rotate',
        'platform.integrations_health.view',
        'platform.webhooks.view', 'platform.webhooks.create', 'platform.webhooks.update',
        'platform.webhooks.delete', 'platform.webhooks.test',
        'platform.audit_logs.view',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.2fa.enable.own', 'settings.sessions.view.own',
    ],
    SECURITY_ADMIN: [
        'platform.dashboard.view', 'platform.security_logs.view',
        'platform.audit_logs.view', 'platform.audit_logs.export',
        'platform.users.view', 'platform.users.suspend', 'platform.users.unsuspend',
        'platform.system_settings.view', 'platform.system_settings.update',
        'platform.api_keys.view', 'platform.api_keys.revoke',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.2fa.enable.own', 'settings.sessions.view.own',
    ],
};

// ── Workspace role → permission key mapping ───────────────────────────────────
// Used until workspace_members + role_permissions tables are created (Phase 2).
// Roles stored in DB as capitalized strings: 'Owner' | 'Admin' | 'Editor' | 'Analyst' | 'Client'

const WORKSPACE_ROLE_PERMISSIONS: Record<string, string[]> = {
    Owner: [
        'workspace.billing.view.own', 'workspace.billing.manage.own',
        'workspace.team.view.own', 'workspace.team.invite.own',
        'workspace.team.update_role.own', 'workspace.team.remove.own',
        'workspace.settings.view.own', 'workspace.settings.update.own',
        'workspace.brands.create', 'workspace.brands.delete', 'workspace.brands.archive',
        'analytics.dashboard.view.brand', 'analytics.reports.view.brand', 'analytics.reports.export.brand',
        'content.create.brand', 'content.update.brand', 'content.delete.brand',
        'content.publish.brand', 'content.approve.brand', 'content.schedule.brand',
        'integrations.health.view.brand', 'integrations.connect.brand', 'integrations.disconnect.brand',
        'ads.campaigns.view.brand', 'ads.campaigns.create.brand', 'ads.campaigns.update.brand',
        'ads.campaigns.delete.brand',
        'seo.projects.view.brand', 'seo.projects.create.brand', 'seo.projects.update.brand',
        'crm.dashboard.view.brand', 'crm.contacts.view.brand', 'crm.contacts.create.brand',
        'crm.contacts.update.brand', 'crm.contacts.delete.brand', 'crm.contacts.export.brand',
        'crm.pipeline.view.brand', 'crm.pipeline.manage.brand',
        'inbox.conversations.view.brand', 'inbox.conversations.reply.brand',
        'inbox.conversations.assign.brand',
        'brand_hub.view.brand', 'brand_hub.update.brand',
        'workflow.tasks.view.own', 'workflow.tasks.create.own',
        'automation.view.brand', 'automation.manage.brand',
        'design.assets.view.brand', 'design.assets.create.brand', 'design.assets.delete.brand',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.security.update.own',
        'settings.2fa.enable.own', 'settings.2fa.disable.own',
        'settings.sessions.view.own', 'settings.sessions.revoke.own', 'settings.sessions.revoke_all.own',
    ],
    Admin: [
        'workspace.team.view.own', 'workspace.team.invite.own', 'workspace.team.update_role.own',
        'workspace.settings.view.own',
        'analytics.dashboard.view.brand', 'analytics.reports.view.brand', 'analytics.reports.export.brand',
        'content.create.brand', 'content.update.brand', 'content.delete.brand',
        'content.publish.brand', 'content.approve.brand', 'content.schedule.brand',
        'integrations.health.view.brand', 'integrations.connect.brand', 'integrations.disconnect.brand',
        'ads.campaigns.view.brand', 'ads.campaigns.create.brand', 'ads.campaigns.update.brand',
        'seo.projects.view.brand', 'seo.projects.create.brand', 'seo.projects.update.brand',
        'crm.dashboard.view.brand', 'crm.contacts.view.brand', 'crm.contacts.create.brand',
        'crm.contacts.update.brand', 'crm.pipeline.view.brand', 'crm.pipeline.manage.brand',
        'inbox.conversations.view.brand', 'inbox.conversations.reply.brand',
        'inbox.conversations.assign.brand',
        'brand_hub.view.brand', 'brand_hub.update.brand',
        'workflow.tasks.view.own', 'workflow.tasks.create.own',
        'design.assets.view.brand', 'design.assets.create.brand',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.security.update.own',
        'settings.2fa.enable.own', 'settings.2fa.disable.own',
        'settings.sessions.view.own', 'settings.sessions.revoke.own',
    ],
    Editor: [
        'analytics.dashboard.view.brand',
        'content.create.brand', 'content.update.brand', 'content.schedule.brand',
        'integrations.health.view.brand',
        'inbox.conversations.view.brand', 'inbox.conversations.reply.brand',
        'brand_hub.view.brand',
        'workflow.tasks.view.own', 'workflow.tasks.create.own',
        'design.assets.view.brand', 'design.assets.create.brand',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.security.update.own',
        'settings.2fa.enable.own', 'settings.2fa.disable.own',
        'settings.sessions.view.own', 'settings.sessions.revoke.own',
    ],
    Analyst: [
        'analytics.dashboard.view.brand', 'analytics.reports.view.brand',
        'ads.campaigns.view.brand',
        'seo.projects.view.brand',
        'inbox.conversations.view.brand',
        'brand_hub.view.brand',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
        'settings.security.view.own', 'settings.2fa.enable.own',
        'settings.sessions.view.own',
    ],
    Client: [
        'analytics.dashboard.view.brand',
        'brand_hub.view.brand',
        'notifications.view.own', 'settings.profile.view.own', 'settings.profile.update.own',
    ],
};

// ── Default plan features (until plan_features table is seeded) ───────────────

const DEFAULT_PLAN_FEATURES: Record<string, boolean | number> = {
    crm_enabled: true,
    inbox_enabled: true,
    ads_enabled: true,
    seo_module_enabled: true,
    automation_enabled: true,
    analytics_enabled: true,
    max_brands: 10,
    max_team_members: 10,
    max_social_accounts: 20,
    ai_credits_monthly: 500_000,
};

// ── Context types ─────────────────────────────────────────────────────────────

interface PermissionContextType {
    permissions: Set<string>;
    planFeatures: Record<string, boolean | number>;
    workspaceRole: string | null;
    isPlatformAdmin: boolean;
    isLoading: boolean;
    hasPermission: (key: string) => boolean;
    hasPlanFeature: (key: string) => boolean | number;
    refresh: () => Promise<void>;
}

const defaultCtx: PermissionContextType = {
    permissions: new Set(),
    planFeatures: DEFAULT_PLAN_FEATURES,
    workspaceRole: null,
    isPlatformAdmin: false,
    isLoading: false,
    hasPermission: () => false,
    hasPlanFeature: (k) => DEFAULT_PLAN_FEATURES[k] ?? false,
    refresh: async () => {},
};

const PermissionContext = createContext<PermissionContextType>(defaultCtx);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PermissionProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const activeBrand = useBrandStore(state => state.activeBrand);

    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [planFeatures, setPlanFeatures] = useState<Record<string, boolean | number>>(DEFAULT_PLAN_FEATURES);
    const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const platformRole = user?.app_metadata?.platform_role as string | undefined;
    const isPlatformAdmin = !!(platformRole && (PLATFORM_ROLES as readonly string[]).includes(platformRole));

    const loadPermissions = useCallback(async () => {
        if (!user || !isAuthenticated) {
            setPermissions(new Set());
            setWorkspaceRole(null);
            return;
        }

        setIsLoading(true);
        try {
            const perms = new Set<string>();

            // 1. Platform-level permissions (from app_metadata — set by service role only)
            if (platformRole === 'SUPER_ADMIN') {
                perms.add('*');
            } else if (platformRole && PLATFORM_ROLE_PERMISSIONS[platformRole as PlatformRole]) {
                PLATFORM_ROLE_PERMISSIONS[platformRole as PlatformRole].forEach(p => perms.add(p));
            }

            // 2. Workspace-level permissions (based on active brand)
            if (activeBrand) {
                // Check brand ownership
                const { data: brandRow } = await supabase
                    .from('brands')
                    .select('user_id')
                    .eq('id', activeBrand.id)
                    .maybeSingle();

                if (brandRow?.user_id === user.id) {
                    // Brand owner gets all Owner permissions
                    (WORKSPACE_ROLE_PERMISSIONS['Owner'] ?? []).forEach(p => perms.add(p));
                    setWorkspaceRole('Owner');
                } else {
                    // Check team membership (user_id match or email match)
                    const { data: member } = await supabase
                        .from('team_members')
                        .select('role, status')
                        .eq('brand_id', activeBrand.id)
                        .or(`user_id.eq.${user.id},invited_email.eq.${user.email ?? ''}`)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (member?.role) {
                        // Normalize: DB may store lowercase ('owner', 'admin')
                        const normalized = member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase();
                        const roleKey = normalized === 'Viewer' ? 'Client' : normalized;
                        (WORKSPACE_ROLE_PERMISSIONS[roleKey] ?? []).forEach(p => perms.add(p));
                        setWorkspaceRole(roleKey);
                    } else {
                        setWorkspaceRole(null);
                    }
                }

                // 3. Plan features — check crm_feature_flags for brand-specific overrides
                try {
                    const { data: flags } = await supabase
                        .from('crm_feature_flags')
                        .select('crm_enabled, analytics_enabled')
                        .eq('brand_id', activeBrand.id)
                        .maybeSingle();

                    if (flags) {
                        setPlanFeatures(prev => ({
                            ...prev,
                            crm_enabled: flags.crm_enabled ?? prev.crm_enabled,
                            analytics_enabled: flags.analytics_enabled ?? prev.analytics_enabled,
                        }));
                    }
                } catch {
                    // Use defaults — crm_feature_flags row may not exist yet
                }
            } else {
                setWorkspaceRole(null);
            }

            setPermissions(perms);
        } catch {
            // On error, keep existing permissions (don't flash AccessDenied)
        } finally {
            setIsLoading(false);
        }
    }, [user, isAuthenticated, activeBrand, platformRole]);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    const hasPermission = useCallback((key: string): boolean => {
        if (permissions.has('*')) return true;
        return permissions.has(key);
    }, [permissions]);

    const hasPlanFeature = useCallback((key: string): boolean | number => {
        return planFeatures[key] ?? false;
    }, [planFeatures]);

    return (
        <PermissionContext.Provider value={{
            permissions,
            planFeatures,
            workspaceRole,
            isPlatformAdmin,
            isLoading,
            hasPermission,
            hasPlanFeature,
            refresh: loadPermissions,
        }}>
            {children}
        </PermissionContext.Provider>
    );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePermissions(): PermissionContextType {
    return useContext(PermissionContext);
}

export function usePermission(key: string): boolean {
    return useContext(PermissionContext).hasPermission(key);
}

export function usePlanFeature(key: string): boolean | number {
    return useContext(PermissionContext).hasPlanFeature(key);
}

export function useIsPlatformAdmin(): boolean {
    return useContext(PermissionContext).isPlatformAdmin;
}
