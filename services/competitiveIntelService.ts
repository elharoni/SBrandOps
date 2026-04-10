import { CompetitiveWatchlist, PublisherBrief, SocialPlatform } from '../types';
import { supabase } from './supabaseClient';

type CompetitiveWatchlistRow = {
    id: string;
    brand_id: string;
    name: string;
    query: string;
    competitors: string[] | null;
    keywords: string[] | null;
    last_run_at: string | null;
    created_at: string;
};

type ContentBriefRow = {
    id: string;
    brand_id: string;
    watchlist_id: string | null;
    source: 'social-search' | 'content-ops';
    title: string;
    query: string | null;
    objective: string;
    angle: string;
    competitors: string[] | null;
    keywords: string[] | null;
    hashtags: string[] | null;
    suggested_platforms: string[] | null;
    cta: string | null;
    notes: string[] | null;
    created_at: string;
};

const mapCompetitiveWatchlistRow = (row: CompetitiveWatchlistRow): CompetitiveWatchlist => ({
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    query: row.query,
    competitors: row.competitors ?? [],
    keywords: row.keywords ?? [],
    createdAt: row.created_at,
    lastRunAt: row.last_run_at ?? undefined,
});

const mapContentBriefRow = (row: ContentBriefRow): PublisherBrief => ({
    id: row.id,
    brandId: row.brand_id,
    watchlistId: row.watchlist_id ?? undefined,
    source: row.source,
    title: row.title,
    query: row.query ?? undefined,
    objective: row.objective,
    angle: row.angle,
    competitors: row.competitors ?? [],
    keywords: row.keywords ?? [],
    hashtags: row.hashtags ?? [],
    suggestedPlatforms: ((row.suggested_platforms ?? []) as string[]).filter(Boolean) as SocialPlatform[],
    cta: row.cta ?? undefined,
    notes: row.notes ?? [],
    createdAt: row.created_at,
});

export async function getCompetitiveWatchlists(brandId: string): Promise<CompetitiveWatchlist[]> {
    const { data, error } = await supabase
        .from('competitive_watchlists')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching competitive watchlists:', error);
        return [];
    }

    return ((data || []) as CompetitiveWatchlistRow[]).map(mapCompetitiveWatchlistRow);
}

export async function createCompetitiveWatchlist(
    brandId: string,
    watchlist: Omit<CompetitiveWatchlist, 'id' | 'brandId' | 'createdAt'>
): Promise<CompetitiveWatchlist> {
    const { data, error } = await supabase
        .from('competitive_watchlists')
        .insert([{
            brand_id: brandId,
            name: watchlist.name,
            query: watchlist.query,
            competitors: watchlist.competitors,
            keywords: watchlist.keywords,
            last_run_at: watchlist.lastRunAt ?? null,
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating competitive watchlist:', error);
        throw error;
    }

    return mapCompetitiveWatchlistRow(data as CompetitiveWatchlistRow);
}

export async function touchCompetitiveWatchlist(brandId: string, watchlistId: string): Promise<void> {
    const { error } = await supabase
        .from('competitive_watchlists')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', watchlistId)
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error updating watchlist timestamp:', error);
        throw error;
    }
}

export async function deleteCompetitiveWatchlist(brandId: string, watchlistId: string): Promise<void> {
    const { error } = await supabase
        .from('competitive_watchlists')
        .delete()
        .eq('id', watchlistId)
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error deleting competitive watchlist:', error);
        throw error;
    }
}

export async function saveContentBrief(brandId: string, brief: PublisherBrief): Promise<PublisherBrief> {
    const { data, error } = await supabase
        .from('content_briefs')
        .insert([{
            brand_id: brandId,
            watchlist_id: brief.watchlistId ?? null,
            source: brief.source,
            title: brief.title,
            query: brief.query ?? null,
            objective: brief.objective,
            angle: brief.angle,
            competitors: brief.competitors,
            keywords: brief.keywords,
            hashtags: brief.hashtags,
            suggested_platforms: brief.suggestedPlatforms,
            cta: brief.cta ?? null,
            notes: brief.notes,
            metadata: {},
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error saving content brief:', error);
        throw error;
    }

    return mapContentBriefRow(data as ContentBriefRow);
}

export async function getContentBriefs(brandId: string): Promise<PublisherBrief[]> {
    const { data, error } = await supabase
        .from('content_briefs')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching content briefs:', error);
        return [];
    }

    return ((data || []) as ContentBriefRow[]).map(mapContentBriefRow);
}
