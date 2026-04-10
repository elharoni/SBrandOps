import { buildPostAnalyticsInsertPayload, type PostAnalyticsWriteInput } from '../../../services/postAnalyticsPayload.ts';

/**
 * Shared edge-only writer for post analytics.
 *
 * Rule:
 * - Any future edge or cron job that needs to persist per-post analytics must call
 *   this helper instead of writing directly to public.post_analytics.
 * - This keeps attribution fields (brand_id, brief_id, watchlist_id) consistent
 *   across all server-side sync paths.
 */

type SupabaseLike = {
    from: (table: string) => any;
};

type ScheduledPostAttribution = {
    brand_id?: string | null;
    brief_id?: string | null;
    watchlist_id?: string | null;
};

async function resolveAttribution(supabase: SupabaseLike, postId: string): Promise<ScheduledPostAttribution> {
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select('brand_id, brief_id, watchlist_id')
        .eq('id', postId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data ?? {};
}

export async function recordPostAnalytics(
    supabase: SupabaseLike,
    analytics: PostAnalyticsWriteInput,
): Promise<{ ok: true; id?: string | null }> {
    const resolved = (
        !analytics.brandId || analytics.briefId === undefined || analytics.watchlistId === undefined
    )
        ? await resolveAttribution(supabase, analytics.postId)
        : {};

    const payload = buildPostAnalyticsInsertPayload({
        ...analytics,
        brandId: analytics.brandId ?? resolved.brand_id ?? undefined,
        briefId: analytics.briefId ?? resolved.brief_id ?? undefined,
        watchlistId: analytics.watchlistId ?? resolved.watchlist_id ?? undefined,
    });

    const { data, error } = await supabase
        .from('post_analytics')
        .insert(payload)
        .select('id')
        .maybeSingle();

    if (error) {
        throw error;
    }

    return { ok: true, id: data?.id ?? null };
}
