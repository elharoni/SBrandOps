ALTER TABLE public.post_analytics
ADD COLUMN IF NOT EXISTS brief_id uuid REFERENCES public.content_briefs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS watchlist_id uuid REFERENCES public.competitive_watchlists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_post_analytics_brief_id ON public.post_analytics(brief_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_watchlist_id ON public.post_analytics(watchlist_id);

CREATE OR REPLACE FUNCTION public.sync_post_analytics_attribution()
RETURNS trigger AS $$
DECLARE
    derived_brief_id uuid;
    derived_watchlist_id uuid;
BEGIN
    SELECT
        sp.brief_id,
        COALESCE(sp.watchlist_id, cb.watchlist_id)
    INTO derived_brief_id, derived_watchlist_id
    FROM public.scheduled_posts sp
    LEFT JOIN public.content_briefs cb ON cb.id = sp.brief_id
    WHERE sp.id = NEW.post_id;

    IF NEW.brief_id IS NULL THEN
        NEW.brief_id := derived_brief_id;
    END IF;

    IF NEW.watchlist_id IS NULL THEN
        NEW.watchlist_id := derived_watchlist_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_analytics_sync_attribution ON public.post_analytics;
CREATE TRIGGER trg_post_analytics_sync_attribution
    BEFORE INSERT OR UPDATE ON public.post_analytics
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_post_analytics_attribution();

UPDATE public.post_analytics pa
SET
    brief_id = COALESCE(pa.brief_id, sp.brief_id),
    watchlist_id = COALESCE(pa.watchlist_id, sp.watchlist_id, cb.watchlist_id)
FROM public.scheduled_posts sp
LEFT JOIN public.content_briefs cb ON cb.id = sp.brief_id
WHERE sp.id = pa.post_id
  AND (
      pa.brief_id IS DISTINCT FROM COALESCE(pa.brief_id, sp.brief_id)
      OR pa.watchlist_id IS DISTINCT FROM COALESCE(pa.watchlist_id, sp.watchlist_id, cb.watchlist_id)
  );

DROP FUNCTION IF EXISTS public.get_brief_performance_rollups(uuid, timestamptz);
CREATE OR REPLACE FUNCTION public.get_brief_performance_rollups(
    p_brand_id uuid,
    p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
    brief_id uuid,
    watchlist_id uuid,
    title text,
    objective text,
    angle text,
    linked_posts bigint,
    published_posts bigint,
    scheduled_posts bigint,
    platform_spread integer,
    total_impressions bigint,
    total_reach bigint,
    total_engagement bigint,
    total_clicks bigint,
    total_likes bigint,
    total_comments bigint,
    total_shares bigint,
    total_saves bigint,
    last_published_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    WITH scoped_briefs AS (
        SELECT
            cb.id,
            cb.watchlist_id,
            cb.title,
            cb.objective,
            cb.angle
        FROM public.content_briefs cb
        WHERE cb.brand_id = p_brand_id
    ),
    scoped_posts AS (
        SELECT
            sp.id,
            sp.brief_id,
            COALESCE(sp.watchlist_id, cb.watchlist_id) AS watchlist_id,
            LOWER(COALESCE(sp.status, '')) AS status,
            sp.platforms,
            sp.published_at,
            sp.created_at
        FROM public.scheduled_posts sp
        LEFT JOIN public.content_briefs cb ON cb.id = sp.brief_id
        WHERE sp.brand_id = p_brand_id
          AND (p_since IS NULL OR COALESCE(sp.published_at, sp.created_at) >= p_since)
    ),
    latest_analytics AS (
        SELECT DISTINCT ON (pa.post_id, pa.platform)
            pa.post_id,
            COALESCE(pa.brief_id, sp.brief_id) AS brief_id,
            COALESCE(pa.watchlist_id, sp.watchlist_id) AS watchlist_id,
            COALESCE(pa.impressions, 0)::bigint AS impressions,
            COALESCE(pa.reach, 0)::bigint AS reach,
            COALESCE(pa.engagement, 0)::bigint AS engagement,
            COALESCE(pa.clicks, 0)::bigint AS clicks,
            COALESCE(pa.likes, 0)::bigint AS likes,
            COALESCE(pa.comments, 0)::bigint AS comments,
            COALESCE(pa.shares, 0)::bigint AS shares,
            COALESCE(pa.saves, 0)::bigint AS saves
        FROM public.post_analytics pa
        JOIN scoped_posts sp ON sp.id = pa.post_id
        ORDER BY pa.post_id, pa.platform, pa.fetched_at DESC NULLS LAST, pa.created_at DESC
    ),
    platform_spread AS (
        SELECT
            sp.brief_id,
            COUNT(DISTINCT platform_name)::integer AS platform_spread
        FROM scoped_posts sp
        CROSS JOIN LATERAL unnest(COALESCE(sp.platforms, '{}'::text[])) AS platform_name
        WHERE sp.brief_id IS NOT NULL
        GROUP BY sp.brief_id
    )
    SELECT
        sb.id AS brief_id,
        sb.watchlist_id,
        sb.title,
        sb.objective,
        sb.angle,
        COUNT(DISTINCT sp.id)::bigint AS linked_posts,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'published')::bigint AS published_posts,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'scheduled')::bigint AS scheduled_posts,
        COALESCE(ps.platform_spread, 0) AS platform_spread,
        COALESCE(SUM(la.impressions), 0)::bigint AS total_impressions,
        COALESCE(SUM(la.reach), 0)::bigint AS total_reach,
        COALESCE(SUM(la.engagement), 0)::bigint AS total_engagement,
        COALESCE(SUM(la.clicks), 0)::bigint AS total_clicks,
        COALESCE(SUM(la.likes), 0)::bigint AS total_likes,
        COALESCE(SUM(la.comments), 0)::bigint AS total_comments,
        COALESCE(SUM(la.shares), 0)::bigint AS total_shares,
        COALESCE(SUM(la.saves), 0)::bigint AS total_saves,
        MAX(sp.published_at) AS last_published_at
    FROM scoped_briefs sb
    LEFT JOIN scoped_posts sp ON sp.brief_id = sb.id
    LEFT JOIN latest_analytics la ON la.post_id = sp.id
    LEFT JOIN platform_spread ps ON ps.brief_id = sb.id
    GROUP BY sb.id, sb.watchlist_id, sb.title, sb.objective, sb.angle, ps.platform_spread
    ORDER BY total_engagement DESC, published_posts DESC, linked_posts DESC;
$$;

DROP FUNCTION IF EXISTS public.get_watchlist_performance_rollups(uuid, timestamptz);
CREATE OR REPLACE FUNCTION public.get_watchlist_performance_rollups(
    p_brand_id uuid,
    p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
    watchlist_id uuid,
    name text,
    query text,
    briefs_count bigint,
    linked_posts bigint,
    published_posts bigint,
    scheduled_posts bigint,
    platform_spread integer,
    total_impressions bigint,
    total_reach bigint,
    total_engagement bigint,
    total_clicks bigint,
    last_published_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    WITH scoped_watchlists AS (
        SELECT
            cw.id,
            cw.name,
            cw.query
        FROM public.competitive_watchlists cw
        WHERE cw.brand_id = p_brand_id
    ),
    scoped_briefs AS (
        SELECT
            cb.id,
            cb.watchlist_id
        FROM public.content_briefs cb
        WHERE cb.brand_id = p_brand_id
    ),
    scoped_posts AS (
        SELECT
            sp.id,
            COALESCE(sp.watchlist_id, cb.watchlist_id) AS watchlist_id,
            LOWER(COALESCE(sp.status, '')) AS status,
            sp.platforms,
            sp.published_at,
            sp.created_at
        FROM public.scheduled_posts sp
        LEFT JOIN public.content_briefs cb ON cb.id = sp.brief_id
        WHERE sp.brand_id = p_brand_id
          AND (p_since IS NULL OR COALESCE(sp.published_at, sp.created_at) >= p_since)
    ),
    latest_analytics AS (
        SELECT DISTINCT ON (pa.post_id, pa.platform)
            pa.post_id,
            COALESCE(pa.watchlist_id, sp.watchlist_id) AS watchlist_id,
            COALESCE(pa.impressions, 0)::bigint AS impressions,
            COALESCE(pa.reach, 0)::bigint AS reach,
            COALESCE(pa.engagement, 0)::bigint AS engagement,
            COALESCE(pa.clicks, 0)::bigint AS clicks
        FROM public.post_analytics pa
        JOIN scoped_posts sp ON sp.id = pa.post_id
        ORDER BY pa.post_id, pa.platform, pa.fetched_at DESC NULLS LAST, pa.created_at DESC
    ),
    platform_spread AS (
        SELECT
            sp.watchlist_id,
            COUNT(DISTINCT platform_name)::integer AS platform_spread
        FROM scoped_posts sp
        CROSS JOIN LATERAL unnest(COALESCE(sp.platforms, '{}'::text[])) AS platform_name
        WHERE sp.watchlist_id IS NOT NULL
        GROUP BY sp.watchlist_id
    )
    SELECT
        sw.id AS watchlist_id,
        sw.name,
        sw.query,
        COUNT(DISTINCT sb.id)::bigint AS briefs_count,
        COUNT(DISTINCT sp.id)::bigint AS linked_posts,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'published')::bigint AS published_posts,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'scheduled')::bigint AS scheduled_posts,
        COALESCE(ps.platform_spread, 0) AS platform_spread,
        COALESCE(SUM(la.impressions), 0)::bigint AS total_impressions,
        COALESCE(SUM(la.reach), 0)::bigint AS total_reach,
        COALESCE(SUM(la.engagement), 0)::bigint AS total_engagement,
        COALESCE(SUM(la.clicks), 0)::bigint AS total_clicks,
        MAX(sp.published_at) AS last_published_at
    FROM scoped_watchlists sw
    LEFT JOIN scoped_briefs sb ON sb.watchlist_id = sw.id
    LEFT JOIN scoped_posts sp ON sp.watchlist_id = sw.id
    LEFT JOIN latest_analytics la ON la.post_id = sp.id
    LEFT JOIN platform_spread ps ON ps.watchlist_id = sw.id
    GROUP BY sw.id, sw.name, sw.query, ps.platform_spread
    ORDER BY total_engagement DESC, published_posts DESC, linked_posts DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_brief_performance_rollups(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_watchlist_performance_rollups(uuid, timestamptz) TO authenticated;
