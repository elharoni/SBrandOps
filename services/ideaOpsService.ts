// services/ideaOpsService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { BrainstormedIdea, SocialPlatform } from '../types';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToIdea(row: any): BrainstormedIdea {
    return {
        title: row.title,
        description: row.description || '',
        platform: row.platform as SocialPlatform,
        format: row.format || '',
        angle: row.angle || '',
    };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getBrainstormedIdeas(brandId: string): Promise<BrainstormedIdea[]> {
    const { data, error } = await supabase
        .from('brainstormed_ideas')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('getBrainstormedIdeas error:', error);
        return [];
    }
    return (data || []).map(mapRowToIdea);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function addBrainstormedIdea(
    brandId: string,
    idea: BrainstormedIdea
): Promise<BrainstormedIdea> {
    const { data, error } = await supabase
        .from('brainstormed_ideas')
        .insert({
            brand_id: brandId,
            title: idea.title,
            description: idea.description,
            platform: idea.platform,
            format: idea.format,
            angle: idea.angle,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRowToIdea(data);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteIdea(brandId: string, title: string): Promise<void> {
    const { error } = await supabase
        .from('brainstormed_ideas')
        .delete()
        .eq('brand_id', brandId)
        .eq('title', title);

    if (error) throw new Error(error.message);
}

// ── Mark as sent to Content Ops ───────────────────────────────────────────────

export async function markIdeaSentToContentOps(brandId: string, title: string): Promise<void> {
    const { error } = await supabase
        .from('brainstormed_ideas')
        .update({ sent_to_content_ops: true })
        .eq('brand_id', brandId)
        .eq('title', title);

    if (error) throw new Error(error.message);
}
