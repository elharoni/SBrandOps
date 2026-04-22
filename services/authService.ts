import { ensureSupabaseConfigured, supabase } from './supabaseClient';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
}

// --- Sign In ---
export async function signIn(email: string, password: string): Promise<AuthUser> {
    ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = data.user;
    if (!user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error('Email not confirmed');
    }
    return {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        avatarUrl: user.user_metadata?.avatar_url,
    };
}

// --- Sign Up ---
export async function signUp(email: string, password: string, name: string): Promise<void> {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name },
        },
    });
    if (error) throw error;
}

// --- Sign Out ---
export async function signOut(): Promise<void> {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// --- Reset Password (sends email) ---
export async function resetPassword(email: string): Promise<void> {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
}

// --- Update Password (after reset) ---
export async function updatePassword(newPassword: string): Promise<void> {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

// --- Get current session ---
export async function getCurrentSession() {
    ensureSupabaseConfigured();
    const { data } = await supabase.auth.getSession();
    return data.session;
}

// --- Get current user ---
export async function getCurrentUser(): Promise<AuthUser | null> {
    ensureSupabaseConfigured();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
        avatarUrl: data.user.user_metadata?.avatar_url,
    };
}
