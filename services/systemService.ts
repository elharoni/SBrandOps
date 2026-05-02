// services/systemService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { User, UserRole, SubscriptionPlan, PaymentRecord, ActiveSession, ApiKey } from '../types';
import { getBillingOverview } from './billingManagementService';
import { auditUserInvited, auditRoleChanged } from './auditService';

// ── Type for getSystemData return ─────────────────────────────────────────────
export interface SystemData {
    users: User[];
    subscription: SubscriptionPlan;
    paymentHistory: PaymentRecord[];
    activeSessions: ActiveSession[];
    apiKeys: ApiKey[];
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToUser(row: any): User {
    return {
        id: row.id,
        name: row.name || row.invited_email?.split('@')[0] || 'Unknown',
        email: row.invited_email || '',
        avatarUrl: row.avatar_url || `https://picsum.photos/seed/${row.id}/100`,
        role: (row.role as UserRole) || UserRole.Editor,
        lastActive: row.last_active_at ? new Date(row.last_active_at) : new Date(),
    };
}

function mapRowToApiKey(row: any): ApiKey {
    return {
        id: row.id,
        name: row.name,
        prefix: row.key_prefix,
        createdAt: new Date(row.created_at),
        lastUsed: row.last_used_at ? new Date(row.last_used_at) : null,
    };
}

// ── Default fallback subscription ────────────────────────────────────────────

function defaultSubscription(): SubscriptionPlan {
    return {
        name: 'Starter Plan',
        price: 29,
        currency: 'USD',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        limits: { users: 2, brands: 1, aiTokens: 1_000_000 },
        usage: { users: 1, brands: 1 },
    };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getSystemData(brandId: string): Promise<SystemData> {
    const [membersRes, keysRes, billingRes] = await Promise.allSettled([
        supabase
            .from('team_members')
            .select('*')
            .eq('brand_id', brandId)
            .order('invited_at', { ascending: true }),
        supabase
            .from('api_keys')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false }),
        getBillingOverview(brandId),
    ]);

    const users: User[] =
        membersRes.status === 'fulfilled' && !membersRes.value.error
            ? (membersRes.value.data || []).map(mapRowToUser)
            : [];

    const apiKeys: ApiKey[] =
        keysRes.status === 'fulfilled' && !keysRes.value.error
            ? (keysRes.value.data || []).map(mapRowToApiKey)
            : [];

    const billingOverview =
        billingRes.status === 'fulfilled'
            ? billingRes.value
            : null;

    const paymentHistory: PaymentRecord[] = billingOverview?.paymentHistory ?? [];

    // Active sessions — use Supabase auth admin API
    // (Fallback: show current session only since we can't list all sessions from client)
    const { data: sessionData } = await supabase.auth.getSession();
    const activeSessions: ActiveSession[] = sessionData?.session
        ? [{
            id: sessionData.session.access_token.substring(0, 8),
            device: navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser',
            location: 'Current Location',
            ip: '—',
            lastAccessed: new Date(),
            isCurrent: true,
        }]
        : [];

    return {
        users,
        subscription: billingOverview?.subscription ?? defaultSubscription(),
        paymentHistory,
        activeSessions,
        apiKeys,
    };
}

// ── Team Management ───────────────────────────────────────────────────────────

// ── Role hierarchy (lower number = fewer privileges) ─────────────────────────
const ROLE_HIERARCHY: Record<string, number> = {
    Client: 1, Analyst: 2, Editor: 3, Admin: 4, Owner: 5,
    // lowercase aliases from DB default
    client: 1, analyst: 2, editor: 3, admin: 4, owner: 5, viewer: 1,
};

export async function inviteUser(brandId: string, email: string, role: UserRole): Promise<User> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('غير مصرح: يجب تسجيل الدخول');

    // ── Permission check: caller must be Owner or Admin of this brand ─────────
    const { data: brandRow } = await supabase
        .from('brands')
        .select('user_id')
        .eq('id', brandId)
        .maybeSingle();

    const isOwner = brandRow?.user_id === user.id;

    if (!isOwner) {
        const { data: callerMember } = await supabase
            .from('team_members')
            .select('role, status')
            .eq('brand_id', brandId)
            .or(`user_id.eq.${user.id},invited_email.eq.${user.email ?? ''}`)
            .eq('status', 'active')
            .maybeSingle();

        const callerRole = callerMember?.role ?? '';
        if (!['Owner', 'Admin', 'owner', 'admin'].includes(callerRole)) {
            throw new Error('ليس لديك صلاحية دعوة أعضاء جدد. يجب أن تكون Owner أو Admin.');
        }

        // ── Role escalation guard: cannot grant a role higher than own ────────
        const callerLevel = ROLE_HIERARCHY[callerRole] ?? 0;
        const newRoleLevel = ROLE_HIERARCHY[role] ?? 0;
        if (newRoleLevel > callerLevel) {
            throw new Error(`لا يمكنك منح دور أعلى من دورك الحالي (${callerRole}).`);
        }
    }

    // ── Seat quota check ──────────────────────────────────────────────────────
    {
        const { data: tenantRow } = await supabase
            .from('tenants')
            .select('subscription_plans(max_users)')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (tenantRow) {
            const limit: number | null =
                (tenantRow.subscription_plans as { max_users?: number } | null)?.max_users ?? null;
            if (limit !== null) {
                const { count } = await supabase
                    .from('team_members')
                    .select('id', { count: 'exact', head: true })
                    .eq('brand_id', brandId)
                    .in('status', ['active', 'pending']);

                if ((count ?? 0) >= limit) {
                    const err = new Error(
                        `لقد وصلت للحد الأقصى من المستخدمين (${limit}). يرجى الترقية للخطة التالية.`,
                    );
                    (err as any).code = 'QUOTA_USERS';
                    (err as any).current = count ?? 0;
                    (err as any).max = limit;
                    throw err;
                }
            }
        }
    }

    const { data, error } = await supabase
        .from('team_members')
        .insert({
            brand_id: brandId,
            invited_email: email,
            name: email.split('@')[0],
            role: role,
            status: 'pending',
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    void auditUserInvited(user.id, user.email ?? '', email, role, brandId);
    return mapRowToUser(data);
}

export async function updateUserRole(brandId: string, userId: string, newRole: UserRole): Promise<User> {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) throw new Error('غير مصرح: يجب تسجيل الدخول');

    // ── Permission check: caller must be Owner or Admin ───────────────────────
    const { data: brandRow } = await supabase
        .from('brands')
        .select('user_id')
        .eq('id', brandId)
        .maybeSingle();

    const isOwner = brandRow?.user_id === caller.id;

    if (!isOwner) {
        const { data: callerMember } = await supabase
            .from('team_members')
            .select('role, status')
            .eq('brand_id', brandId)
            .or(`user_id.eq.${caller.id},invited_email.eq.${caller.email ?? ''}`)
            .eq('status', 'active')
            .maybeSingle();

        const callerRole = callerMember?.role ?? '';
        if (!['Owner', 'Admin', 'owner', 'admin'].includes(callerRole)) {
            throw new Error('ليس لديك صلاحية تغيير أدوار الأعضاء.');
        }

        // Cannot promote someone to a role higher than your own
        const callerLevel = ROLE_HIERARCHY[callerRole] ?? 0;
        const newRoleLevel = ROLE_HIERARCHY[newRole] ?? 0;
        if (newRoleLevel > callerLevel) {
            throw new Error(`لا يمكنك منح دور أعلى من دورك الحالي (${callerRole}).`);
        }
    }

    // Read old role before update for audit trail
    const { data: prevRow } = await supabase
        .from('team_members')
        .select('role')
        .eq('id', userId)
        .eq('brand_id', brandId)
        .maybeSingle();
    const oldRole = prevRow?.role ?? 'unknown';

    const { data, error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', userId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    void auditRoleChanged(caller.id, userId, oldRole, newRole, brandId);
    return mapRowToUser(data);
}

export async function deleteUser(brandId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', userId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function revokeSession(_brandId: string, _sessionId: string): Promise<void> {
    // For the current user's own session, sign out globally
    // Full multi-session revocation requires Supabase Admin API (Edge Function)
    await supabase.auth.signOut({ scope: 'global' });
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function generateApiKey(
    brandId: string,
    name: string
): Promise<{ newKey: ApiKey; fullSecret: string }> {
    const fullSecret = `sbrapi_${crypto.randomUUID().replace(/-/g, '')}`;
    const prefix = `${fullSecret.substring(0, 12)}...`;

    // Hash the key (simple approach — in production use bcrypt via Edge Function)
    const encoder = new TextEncoder();
    const data = encoder.encode(fullSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: row, error } = await supabase
        .from('api_keys')
        .insert({
            brand_id: brandId,
            name,
            key_prefix: prefix,
            key_hash: keyHash,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    return {
        newKey: mapRowToApiKey(row),
        fullSecret,
    };
}

export async function deleteApiKey(brandId: string, keyId: string): Promise<void> {
    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}
