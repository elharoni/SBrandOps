// services/brandKnowledgeService.ts
// قاعدة معرفة البراند الخاصة — المنتجات، الأسئلة الشائعة، السياسات، المنافسين
// هذه هي "الذاكرة الدائمة" للبراند التي تُغذّي عقله في كل طلبات AI

import { supabase } from './supabaseClient';
import { BrandKnowledgeEntry, BrandKnowledgeType } from '../types';

// ── DB row mapper ─────────────────────────────────────────────────────────────

function mapRow(row: any): BrandKnowledgeEntry {
    return {
        id: row.id,
        brandId: row.brand_id,
        type: row.type as BrandKnowledgeType,
        title: row.title,
        content: row.content,
        metadata: row.metadata ?? {},
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getBrandKnowledge(
    brandId: string,
    type?: BrandKnowledgeType,
): Promise<BrandKnowledgeEntry[]> {
    if (!brandId) return [];

    let query = supabase
        .from('brand_knowledge')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (type) query = query.eq('type', type);

    const { data, error } = await query;

    if (error) {
        console.warn('[BrandKnowledge] fetch error:', error.message);
        return [];
    }
    return (data ?? []).map(mapRow);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function addKnowledgeEntry(
    brandId: string,
    entry: Pick<BrandKnowledgeEntry, 'type' | 'title' | 'content' | 'metadata' | 'sortOrder'>,
): Promise<BrandKnowledgeEntry> {
    const { data, error } = await supabase
        .from('brand_knowledge')
        .insert({
            brand_id: brandId,
            type: entry.type,
            title: entry.title,
            content: entry.content,
            metadata: entry.metadata ?? {},
            sort_order: entry.sortOrder ?? 0,
        })
        .select()
        .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to add knowledge entry');
    return mapRow(data);
}

export async function updateKnowledgeEntry(
    brandId: string,
    entryId: string,
    updates: Partial<Pick<BrandKnowledgeEntry, 'title' | 'content' | 'metadata' | 'sortOrder' | 'isActive'>>,
): Promise<void> {
    const { error } = await supabase
        .from('brand_knowledge')
        .update({
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.content !== undefined && { content: updates.content }),
            ...(updates.metadata !== undefined && { metadata: updates.metadata }),
            ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
            ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        })
        .eq('id', entryId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function deleteKnowledgeEntry(brandId: string, entryId: string): Promise<void> {
    const { error } = await supabase
        .from('brand_knowledge')
        .delete()
        .eq('id', entryId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function clearKnowledgeByType(
    brandId: string,
    type: BrandKnowledgeType,
): Promise<void> {
    const { error } = await supabase
        .from('brand_knowledge')
        .delete()
        .eq('brand_id', brandId)
        .eq('type', type);

    if (error) throw new Error(error.message);
}

// ── Format helpers for AI prompts ─────────────────────────────────────────────

export function formatKnowledgeForPrompt(
    entries: BrandKnowledgeEntry[],
    type: BrandKnowledgeType,
): string {
    const filtered = entries.filter(e => e.type === type && e.isActive);
    if (!filtered.length) return 'لا توجد بيانات';
    return filtered.map(e => `• ${e.title}: ${e.content}`).join('\n');
}

// ── Bulk seeding (for onboarding) ─────────────────────────────────────────────

export interface KnowledgeSeed {
    type: BrandKnowledgeType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
}

export async function seedBrandKnowledge(
    brandId: string,
    seeds: KnowledgeSeed[],
): Promise<void> {
    if (!seeds.length) return;

    const rows = seeds.map((s, i) => ({
        brand_id: brandId,
        type: s.type,
        title: s.title,
        content: s.content,
        metadata: s.metadata ?? {},
        sort_order: i,
    }));

    const { error } = await supabase.from('brand_knowledge').insert(rows);
    if (error) throw new Error(error.message);
}
