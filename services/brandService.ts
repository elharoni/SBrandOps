import { Brand } from '../types';
import { supabase } from './supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const logoFor = (name: string, url?: string | null) =>
    url || `https://picsum.photos/seed/${name.toLowerCase().replace(/\s+/g, '')}/100`;

const mapBrand = (row: any): Brand => ({
    id: row.id,
    name: row.name,
    logoUrl: logoFor(row.name, row.logo_url),
});

// ── getBrands ─────────────────────────────────────────────────────────────────
// RLS on `brands` table filters automatically to current user's brands
export async function getBrands(): Promise<Brand[]> {
    const { data, error } = await supabase
        .from('brands')
        .select('id, name, logo_url, industry')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ getBrands error:', error.message);
        return [];
    }
    return (data || []).map(mapBrand);
}

// ── addBrand ──────────────────────────────────────────────────────────────────
// Requires authenticated user — user_id is NOT NULL in schema_v2
export async function addBrand(name: string, industry?: string, logoUrl?: string): Promise<Brand> {
    // Get current user ID — required by schema NOT NULL constraint & RLS
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error('يجب تسجيل الدخول أولاً لإضافة براند');
    }

    // ── Brand quota check ──────────────────────────────────────────────────
    const { data: tenantRow } = await supabase
        .from('tenants')
        .select('brands_count, subscription_plans(max_brands)')
        .eq('owner_id', user.id)
        .maybeSingle();

    if (tenantRow) {
        const limit: number | null =
            (tenantRow.subscription_plans as { max_brands?: number } | null)?.max_brands ?? null;
        const count: number = tenantRow.brands_count ?? 0;
        if (limit !== null && count >= limit) {
            throw new Error(
                `لقد وصلت للحد الأقصى من البراندات (${limit}). يرجى الترقية للخطة التالية.`
            );
        }
    }

    const insertData: Record<string, unknown> = {
        name,
        user_id: user.id,
    };
    if (industry) insertData.industry = industry;
    if (logoUrl)  insertData.logo_url  = logoUrl;

    const { data, error } = await supabase
        .from('brands')
        .insert([insertData])
        .select('id, name, logo_url')
        .single();

    if (error) {
        console.error('❌ addBrand error:', error.message);
        throw new Error(`فشل إنشاء البراند: ${error.message}`);
    }

    // Increment tenant brands_count (fire-and-forget — quota check already happened)
    void supabase
        .from('tenants')
        .update({ brands_count: (tenantRow?.brands_count ?? 0) + 1 })
        .eq('owner_id', user.id)
        .then(() => {}, () => {});

    return mapBrand(data);
}

// ── deleteBrand ───────────────────────────────────────────────────────────────
export async function deleteBrand(brandId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

    if (error) {
        console.error('❌ deleteBrand error:', error.message);
        throw new Error(`فشل حذف البراند: ${error.message}`);
    }

    // Decrement tenant brands_count (fire-and-forget)
    if (user) {
        void supabase.rpc('decrement_tenant_brands_count', { p_owner_id: user.id })
            .then(() => {}, () => {});
    }
}

// ── updateBrand ───────────────────────────────────────────────────────────────
export async function updateBrand(brandId: string, updates: { name?: string; industry?: string; logoUrl?: string }): Promise<Brand> {
    const payload: Record<string, unknown> = {};
    if (updates.name)     payload.name      = updates.name;
    if (updates.industry) payload.industry  = updates.industry;
    if (updates.logoUrl)  payload.logo_url  = updates.logoUrl;

    const { data, error } = await supabase
        .from('brands')
        .update(payload)
        .eq('id', brandId)
        .select('id, name, logo_url')
        .single();

    if (error) {
        console.error('❌ updateBrand error:', error.message);
        throw new Error(`فشل تحديث البراند: ${error.message}`);
    }

    return mapBrand(data);
}