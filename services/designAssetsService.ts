// services/designAssetsService.ts
import { supabase } from './supabaseClient';
import { DesignAsset, DesignAssetType, DesignAssetSource } from '../types';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(row: any): DesignAsset {
    return {
        id:           row.id,
        brandId:      row.brand_id,
        name:         row.name,
        url:          row.url,
        thumbnailUrl: row.thumbnail_url ?? undefined,
        type:         row.type as DesignAssetType,
        source:       row.source as DesignAssetSource,
        tags:         Array.isArray(row.tags) ? row.tags : [],
        width:        row.width ?? undefined,
        height:       row.height ?? undefined,
        fileSize:     row.file_size ?? undefined,
        mimeType:     row.mime_type ?? undefined,
        aspectRatio:  row.aspect_ratio ?? undefined,
        prompt:       row.prompt ?? undefined,
        createdAt:    row.created_at,
        updatedAt:    row.updated_at ?? undefined,
    };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getDesignAssets(
    brandId: string,
    filters?: { type?: DesignAssetType; source?: DesignAssetSource }
): Promise<DesignAsset[]> {
    let query = supabase
        .from('design_assets')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (filters?.type)   query = query.eq('type', filters.type);
    if (filters?.source) query = query.eq('source', filters.source);

    const { data, error } = await query;
    if (error) { console.error('getDesignAssets error:', error); return []; }
    return (data || []).map(mapRow);
}

export async function searchDesignAssets(brandId: string, query: string): Promise<DesignAsset[]> {
    const { data, error } = await supabase
        .from('design_assets')
        .select('*')
        .eq('brand_id', brandId)
        .ilike('name', `%${query}%`)
        .order('created_at', { ascending: false });

    if (error) { console.error('searchDesignAssets error:', error); return []; }
    return (data || []).map(mapRow);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDesignAsset(
    brandId: string,
    asset: Omit<DesignAsset, 'id' | 'brandId' | 'createdAt' | 'updatedAt'>
): Promise<DesignAsset> {
    const { data, error } = await supabase
        .from('design_assets')
        .insert({
            brand_id:      brandId,
            name:          asset.name,
            url:           asset.url,
            thumbnail_url: asset.thumbnailUrl ?? null,
            type:          asset.type,
            source:        asset.source,
            tags:          asset.tags ?? [],
            width:         asset.width ?? null,
            height:        asset.height ?? null,
            file_size:     asset.fileSize ?? null,
            mime_type:     asset.mimeType ?? null,
            aspect_ratio:  asset.aspectRatio ?? null,
            prompt:        asset.prompt ?? null,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDesignAsset(
    brandId: string,
    assetId: string,
    updates: Partial<Pick<DesignAsset, 'name' | 'tags' | 'type'>>
): Promise<DesignAsset> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.type !== undefined) payload.type = updates.type;

    const { data, error } = await supabase
        .from('design_assets')
        .update(payload)
        .eq('id', assetId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDesignAsset(brandId: string, assetId: string): Promise<void> {
    const { error } = await supabase
        .from('design_assets')
        .delete()
        .eq('id', assetId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getDesignOpsStats(brandId: string) {
    const { data, error } = await supabase
        .from('design_assets')
        .select('source')
        .eq('brand_id', brandId);

    if (error || !data) return { totalAssets: 0, aiGeneratedCount: 0, uploadedCount: 0 };

    return {
        totalAssets:      data.length,
        aiGeneratedCount: data.filter(d => d.source === 'ai-generated').length,
        uploadedCount:    data.filter(d => d.source === 'upload').length,
    };
}
