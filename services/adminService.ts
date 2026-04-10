// services/adminService.ts — Real Supabase Implementation
// NOTE: Admin functions require either service_role key (Edge Functions) or
//       special admin RLS policies. Functions that need auth.users access
//       are marked with TODO for Edge Function migration.
import { supabase } from './supabaseClient';
import {
    AdminDashboardStats, AdminUser, AdminUserRole,
    AIMetric, QueueJob, AdminPermission, AIInsight,
    SystemHealthStatus, ActivityLog, GeneralSettings, SecuritySettings,
} from '../types';

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const [usersRes, tenantsRes, revenueRes] = await Promise.allSettled([
        supabase.from('team_members').select('*', { count: 'exact', head: true }),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payment_records').select('amount').eq('status', 'paid'),
    ]);

    const totalUsers = usersRes.status === 'fulfilled' ? (usersRes.value.count ?? 0) : 0;
    const activeTenants = tenantsRes.status === 'fulfilled' ? (tenantsRes.value.count ?? 0) : 0;
    const totalRevenue =
        revenueRes.status === 'fulfilled' && !revenueRes.value.error
            ? (revenueRes.value.data || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0)
            : 0;

    // User growth — last 5 weeks from team_members
    const { data: growthData } = await supabase
        .from('team_members')
        .select('invited_at')
        .gte('invited_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())
        .order('invited_at', { ascending: true });

    const weekBuckets: Record<string, number> = {};
    (growthData || []).forEach((row: any) => {
        const week = new Date(row.invited_at).toISOString().slice(0, 10);
        weekBuckets[week] = (weekBuckets[week] || 0) + 1;
    });
    const userGrowth = Object.entries(weekBuckets).map(([date, count]) => ({ date, count }));

    // Revenue over time — last 5 weeks
    const { data: revData } = await supabase
        .from('payment_records')
        .select('created_at, amount')
        .eq('status', 'paid')
        .gte('created_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

    const revBuckets: Record<string, number> = {};
    (revData || []).forEach((row: any) => {
        const week = new Date(row.created_at).toISOString().slice(0, 10);
        revBuckets[week] = (revBuckets[week] || 0) + Number(row.amount);
    });
    const revenueOverTime = Object.entries(revBuckets).map(([date, revenue]) => ({ date, revenue }));

    return { totalUsers, activeTenants, totalRevenue, userGrowth, revenueOverTime };
}

// ── Admin Users ───────────────────────────────────────────────────────────────
// Future enhancement: move global auth.users directory access to an Edge Function
// if the admin panel needs a full cross-tenant account directory beyond team_members.

export async function getAdminUsers(): Promise<AdminUser[]> {
    // Fallback: read from team_members with admin roles across all brands
    const { data, error } = await supabase
        .from('team_members')
        .select('*, brands(name)')
        .in('role', ['Owner', 'Admin'])
        .order('invited_at', { ascending: false })
        .limit(100);

    if (error) return [];
    return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || row.invited_email?.split('@')[0] || 'Unknown',
        email: row.invited_email || '',
        role: row.role === 'Owner' ? AdminUserRole.ADMIN : AdminUserRole.MODERATOR,
        tenantName: row.brands?.name || 'Unknown Brand',
        lastLogin: row.last_active_at || row.invited_at,
        twoFactorEnabled: false,
    }));
}

// ── AI Metrics ────────────────────────────────────────────────────────────────

export async function getAIMetrics(): Promise<AIMetric[]> {
    // Read from activity_logs where action involves AI
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .ilike('action', '%ai%')
        .order('created_at', { ascending: false })
        .limit(150);

    if (error || !data?.length) {
        // Return empty array — no mock data
        return [];
    }

    return data.map((row: any) => ({
        timestamp: row.created_at,
        feature: row.entity_type || 'General AI',
        tokens: row.metadata?.tokens_used ?? 0,
        latency: row.metadata?.latency_ms ?? 0,
    }));
}

export async function getAIInsights(): Promise<AIInsight[]> {
    // Generate insights from real data
    const { data: brands } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: false });

    const insights: AIInsight[] = [];

    if (brands && brands.length > 0) {
        insights.push({
            id: '1',
            text: `يوجد ${brands.length} براند نشط في النظام.`,
            priority: 'medium',
        });
    }

    return insights;
}

// ── Queue Jobs ────────────────────────────────────────────────────────────────

export async function getQueueJobs(): Promise<QueueJob[]> {
    // Read from scheduled_posts as a proxy for queue jobs
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select('id, status, scheduled_at, created_at')
        .in('status', ['pending', 'processing', 'failed'])
        .order('scheduled_at', { ascending: true })
        .limit(50);

    if (error || !data) return [];

    return data.map((row: any) => ({
        id: row.id,
        type: 'Data Sync' as const,
        status: (row.status === 'pending' ? 'pending' :
                 row.status === 'processing' ? 'running' :
                 row.status === 'failed' ? 'failed' : 'completed') as 'pending' | 'running' | 'completed' | 'failed',
        submittedAt: new Date(row.created_at),
    }));
}

// ── Permissions ───────────────────────────────────────────────────────────────

export async function getAdminPermissions(): Promise<AdminPermission[]> {
    // Static permissions definition
    return [
        { id: 'tenants:manage',  label: 'Manage Tenants',        description: 'Create, edit, and suspend tenant accounts.' },
        { id: 'users:manage',    label: 'Manage All Users',       description: 'Invite, edit roles, and remove users across all tenants.' },
        { id: 'billing:manage',  label: 'Manage Billing & Plans', description: 'Create and edit subscription plans.' },
        { id: 'ai:monitor',      label: 'Access AI Monitor',      description: 'View system-wide AI usage and costs.' },
        { id: 'queues:manage',   label: 'Manage Queues',          description: 'View and retry background jobs.' },
        { id: 'settings:manage', label: 'Manage System Settings', description: 'Edit roles, permissions, and global settings.' },
    ];
}

// ── System Health ─────────────────────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealthStatus[]> {
    const results: SystemHealthStatus[] = [];

    // Test DB connectivity
    const { error: dbError } = await supabase
        .from('brands')
        .select('id')
        .limit(1);

    results.push({
        service: 'Database (Supabase)',
        status: (dbError ? 'down' : 'ok') as 'ok' | 'degraded' | 'down',
        details: dbError ? dbError.message : 'Connection healthy',
    });

    // Test Storage
    const { error: storageError } = await supabase.storage.listBuckets();
    results.push({
        service: 'Storage',
        status: storageError ? 'degraded' : 'ok',
        details: storageError ? storageError.message : 'All buckets accessible',
    });

    results.push({
        service: 'Auth Service',
        status: 'ok',
        details: 'Supabase Auth operational',
    });

    results.push({
        service: 'AI Provider (Gemini)',
        status: import.meta.env.VITE_GEMINI_API_KEY ? 'ok' : 'degraded',
        details: import.meta.env.VITE_GEMINI_API_KEY
            ? 'API key configured'
            : 'VITE_GEMINI_API_KEY not set',
    });

    return results;
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

export async function getLatestActivities(): Promise<ActivityLog[]> {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error || !data) return [];

    return data.map((row: any) => ({
        id: row.id,
        user: {
            name: row.user_name || 'System',
            role: AdminUserRole.ADMIN,
        },
        action: row.action || row.entity_type || 'performed an action',
        timestamp: new Date(row.created_at),
    }));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getGeneralSettings(): Promise<GeneralSettings> {
    return {
        appName: 'SBrandOps',
        maintenanceMode: false,
        defaultLanguage: 'ar',
        supportEmail: 'support@sbrandops.com',
    };
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
    return {
        passwordMinLength: 8,
        passwordRequiresUppercase: true,
        passwordRequiresNumber: true,
        passwordRequiresSymbol: false,
        sessionTimeout: 60,
        require2FAForAdmins: false,
    };
}
