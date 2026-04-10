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

    return mapBrand(data);
}

// ── deleteBrand ───────────────────────────────────────────────────────────────
export async function deleteBrand(brandId: string): Promise<void> {
    const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

    if (error) {
        console.error('❌ deleteBrand error:', error.message);
        throw new Error(`فشل حذف البراند: ${error.message}`);
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