-- ============================================================
-- SBrandOps — Schema V4: SEO Operating System
-- ============================================================
-- Entity Hierarchy:
--   Brand → Website → Market/Language → Page → Keyword Cluster
--   → Issue → Task → Change Log → Result
--
-- Additive: safe to run on top of v2 + v3.
-- Uses CREATE TABLE IF NOT EXISTS throughout.
-- ============================================================

-- ── 0. Shared helper (idempotent) ────────────────────────────
-- Re-use crm_user_brand_ids() from v2/v3. Nothing to add here.

-- ============================================================
-- MODULE 1 — SITE MARKETS
-- Multi-market / multi-language per brand website
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_markets (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    website_id      uuid        REFERENCES brand_websites(id) ON DELETE SET NULL,
    market_name     text        NOT NULL,                 -- "Saudi Arabia AR", "UAE EN"
    country_code    char(2),                              -- ISO 3166-1 alpha-2: SA, AE, EG
    language_code   varchar(10),                          -- BCP 47: ar, en, ar-SA
    primary_domain  text,                                 -- https://example.com
    hreflang        varchar(20),                          -- ar-sa, en-ae
    is_primary      boolean     DEFAULT false,
    status          text        DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_markets_brand ON seo_markets(brand_id);

ALTER TABLE seo_markets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_markets' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_markets
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 2 — PAGE INVENTORY
-- Every crawlable/indexable URL belongs to a brand site
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_pages (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    website_id      uuid        REFERENCES brand_websites(id) ON DELETE SET NULL,
    market_id       uuid        REFERENCES seo_markets(id) ON DELETE SET NULL,

    -- Identity
    url             text        NOT NULL,
    page_type       text        DEFAULT 'page'
                    CHECK (page_type IN ('homepage','category','product','blog','landing','tag','author','other')),
    template        text,                                 -- "product-detail", "blog-list"

    -- On-page audit snapshot
    title           text,
    meta_description text,
    h1              text,
    canonical_url   text,
    is_indexable    boolean     DEFAULT true,
    has_noindex     boolean     DEFAULT false,
    has_nofollow    boolean     DEFAULT false,
    in_sitemap      boolean,
    status_code     int,
    word_count      int,
    internal_links_in  int     DEFAULT 0,  -- inbound internal links
    internal_links_out int     DEFAULT 0,  -- outbound internal links
    image_count     int         DEFAULT 0,
    images_missing_alt int      DEFAULT 0,
    schema_types    text[]      DEFAULT '{}',

    -- GSC performance (snapshot, updated by sync)
    clicks_30d      int         DEFAULT 0,
    impressions_30d int         DEFAULT 0,
    ctr_30d         numeric(6,4) DEFAULT 0,
    avg_position_30d numeric(6,2),

    -- Audit state
    last_audited_at timestamptz,
    audit_score     int,        -- 0-100 on-page health score

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    UNIQUE (brand_id, url)
);

CREATE INDEX IF NOT EXISTS idx_seo_pages_brand        ON seo_pages(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_website      ON seo_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_market       ON seo_pages(market_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_indexable    ON seo_pages(brand_id, is_indexable);
CREATE INDEX IF NOT EXISTS idx_seo_pages_type         ON seo_pages(brand_id, page_type);

ALTER TABLE seo_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_pages' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_pages
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 3 — KEYWORD CLUSTERS
-- Topical clusters: pillar + supporting pages
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_keyword_clusters (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    market_id       uuid        REFERENCES seo_markets(id) ON DELETE SET NULL,
    cluster_name    text        NOT NULL,                 -- "iPhone Repair Dubai"
    topic           text,                                 -- broader topic area
    primary_keyword text        NOT NULL,
    intent          text        DEFAULT 'informational'
                    CHECK (intent IN ('informational','navigational','commercial','transactional')),
    pillar_page_id  uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,
    keyword_count   int         GENERATED ALWAYS AS (0) STORED, -- updated via trigger or app
    status          text        DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    notes           text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_clusters_brand ON seo_keyword_clusters(brand_id);

ALTER TABLE seo_keyword_clusters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_keyword_clusters' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_keyword_clusters
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 4 — KEYWORD MAP
-- keyword → intent → target_url → performance
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_keyword_map (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    cluster_id      uuid        REFERENCES seo_keyword_clusters(id) ON DELETE SET NULL,
    market_id       uuid        REFERENCES seo_markets(id) ON DELETE SET NULL,

    -- The keyword itself
    keyword         text        NOT NULL,
    intent          text        DEFAULT 'informational'
                    CHECK (intent IN ('informational','navigational','commercial','transactional')),
    is_branded      boolean     DEFAULT false,
    monthly_volume  int,                                  -- external data (Ahrefs/SEMrush import)
    difficulty      int,                                  -- 0-100

    -- Target assignment
    target_page_id  uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,
    target_url      text,

    -- GSC performance snapshot (synced from seo_query_facts)
    current_position    numeric(6,2),
    impressions_30d     int     DEFAULT 0,
    clicks_30d          int     DEFAULT 0,
    ctr_30d             numeric(6,4) DEFAULT 0,
    -- 30d vs previous 30d deltas
    position_delta      numeric(6,2),                    -- positive = moved up
    impressions_delta   int,
    clicks_delta        int,

    -- Status & ops
    mapping_status  text        DEFAULT 'candidate'
                    CHECK (mapping_status IN ('mapped','candidate','gap','cannibal','orphan','won','lost')),
    cannibalization_url text,                             -- competing page if status=cannibal
    opportunity_score   numeric(8,2),                    -- impressions × (1 - ctr)
    notes           text,
    last_synced_at  timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_kwmap_brand      ON seo_keyword_map(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_kwmap_cluster    ON seo_keyword_map(cluster_id);
CREATE INDEX IF NOT EXISTS idx_seo_kwmap_status     ON seo_keyword_map(brand_id, mapping_status);
CREATE INDEX IF NOT EXISTS idx_seo_kwmap_position   ON seo_keyword_map(brand_id, current_position);
CREATE INDEX IF NOT EXISTS idx_seo_kwmap_opportunity ON seo_keyword_map(brand_id, opportunity_score DESC);

ALTER TABLE seo_keyword_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_keyword_map' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_keyword_map
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 5 — ISSUE TRACKER
-- Auto-detected + manual SEO issues with full workflow
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_issues (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    website_id      uuid        REFERENCES brand_websites(id) ON DELETE SET NULL,
    page_id         uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,

    -- Classification
    issue_type      text        NOT NULL
                    CHECK (issue_type IN ('technical','on-page','content','internal-linking','schema','speed','indexation')),
    category        text,           -- 'canonical','noindex','missing-meta','thin-content','broken-link'
    title           text        NOT NULL,
    description     text,
    affected_url    text,
    affected_count  int         DEFAULT 1,

    -- Priority & severity
    severity        text        DEFAULT 'medium'
                    CHECK (severity IN ('critical','high','medium','low')),
    business_impact text,           -- 'revenue','lead-gen','visibility','crawl-budget'

    -- Workflow
    status          text        DEFAULT 'open'
                    CHECK (status IN ('open','in-progress','resolved','ignored','wont-fix')),
    assignee_user_id uuid       REFERENCES auth.users(id),
    due_date        date,
    detected_at     timestamptz DEFAULT now(),
    resolved_at     timestamptz,
    resolution_notes text,

    -- Detection metadata
    auto_detected   boolean     DEFAULT false,
    detection_source text,      -- 'gsc-sync','url-inspection','manual','audit-run'
    external_ref    text,       -- GSC coverage state or error code

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_issues_brand    ON seo_issues(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_issues_status   ON seo_issues(brand_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_seo_issues_type     ON seo_issues(brand_id, issue_type);
CREATE INDEX IF NOT EXISTS idx_seo_issues_page     ON seo_issues(page_id);

ALTER TABLE seo_issues ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_issues' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_issues
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 6 — CONTENT BRIEFS
-- SEO-ready content briefs with AI generation tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_content_briefs (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    page_id         uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,
    cluster_id      uuid        REFERENCES seo_keyword_clusters(id) ON DELETE SET NULL,

    -- Targeting
    target_keyword  text        NOT NULL,
    secondary_keywords text[]   DEFAULT '{}',
    search_intent   text        DEFAULT 'informational',
    content_type    text        DEFAULT 'article'
                    CHECK (content_type IN ('article','category','product','landing','faq')),
    target_market_id uuid       REFERENCES seo_markets(id),

    -- Brief content
    word_count_target   int     DEFAULT 1000,
    suggested_title     text,
    suggested_meta      text,
    h2_suggestions      jsonb   DEFAULT '[]',   -- [{text, angle, keyword}]
    entities            jsonb   DEFAULT '[]',   -- [{entity, type, importance}]
    faq_suggestions     jsonb   DEFAULT '[]',   -- [{question, answer_hint}]
    internal_links_suggestions jsonb DEFAULT '[]', -- [{anchor, target_url, reason}]
    schema_type         text,
    competitor_urls     text[]  DEFAULT '{}',
    serp_features       text[]  DEFAULT '{}',   -- featured-snippet, people-also-ask, etc.

    -- Workflow
    status          text        DEFAULT 'draft'
                    CHECK (status IN ('draft','in-review','approved','assigned','in-progress','published')),
    assigned_to     uuid        REFERENCES auth.users(id),
    due_date        date,
    priority        text        DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),

    -- AI tracking
    ai_generated    boolean     DEFAULT true,
    ai_model        text,
    created_by      uuid        REFERENCES auth.users(id),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_briefs_brand   ON seo_content_briefs(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_briefs_status  ON seo_content_briefs(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_seo_briefs_cluster ON seo_content_briefs(cluster_id);

ALTER TABLE seo_content_briefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_content_briefs' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_content_briefs
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 7 — CHANGE LOG + IMPACT MEASUREMENT
-- Track every SEO change → measure its business impact
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_change_log (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    page_id         uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,
    issue_id        uuid        REFERENCES seo_issues(id) ON DELETE SET NULL,

    -- What changed
    change_type     text        NOT NULL
                    CHECK (change_type IN ('title','meta','h1','content','internal-links','canonical',
                                           'speed','schema','robots-txt','sitemap','redirect','technical')),
    description     text        NOT NULL,
    changed_url     text,
    changed_by      uuid        REFERENCES auth.users(id),
    changed_at      timestamptz DEFAULT now(),

    -- Baseline snapshot (before change — captured at change_at)
    baseline_clicks     int,
    baseline_impressions int,
    baseline_position   numeric(6,2),
    baseline_indexed_pages int,
    baseline_date       date,

    -- Post-change measurement (captured ~28 days later)
    post_clicks         int,
    post_impressions    int,
    post_position       numeric(6,2),
    post_indexed_pages  int,
    measured_at         timestamptz,

    -- Computed impact: % change in clicks
    clicks_impact_pct   numeric(8,2) GENERATED ALWAYS AS (
        CASE
            WHEN baseline_clicks IS NOT NULL AND baseline_clicks > 0
            THEN ROUND(((post_clicks - baseline_clicks)::numeric / baseline_clicks) * 100, 2)
            ELSE NULL
        END
    ) STORED,

    -- Computed impact: position delta
    position_impact     numeric(6,2) GENERATED ALWAYS AS (
        CASE
            WHEN baseline_position IS NOT NULL AND post_position IS NOT NULL
            THEN ROUND(baseline_position - post_position, 2)  -- positive = moved up
            ELSE NULL
        END
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_seo_changelog_brand   ON seo_change_log(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_changelog_page    ON seo_change_log(page_id);
CREATE INDEX IF NOT EXISTS idx_seo_changelog_date    ON seo_change_log(changed_at DESC);

ALTER TABLE seo_change_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_change_log' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_change_log
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- MODULE 8 — PRE/POST PUBLISH QA CHECKLIST
-- One QA snapshot per page per publish event
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_publish_qa (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id        uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    page_id         uuid        REFERENCES seo_pages(id) ON DELETE SET NULL,
    page_url        text        NOT NULL,
    qa_stage        text        NOT NULL CHECK (qa_stage IN ('pre-publish','post-publish')),

    -- Checks (true = pass, false = fail, null = not checked)
    is_indexable        boolean,
    canonical_correct   boolean,
    title_present       boolean,
    meta_present        boolean,
    h1_present          boolean,
    in_sitemap          boolean,
    internal_links_ok   boolean,
    speed_ok            boolean,
    schema_present      boolean,
    -- Post-publish only
    discovered_by_gsc   boolean,
    indexed_by_gsc      boolean,
    first_impressions   int,
    first_clicks        int,

    qa_score        int,            -- 0-100
    notes           text,
    performed_by    uuid        REFERENCES auth.users(id),
    performed_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_qa_brand ON seo_publish_qa(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_qa_page  ON seo_publish_qa(page_id, qa_stage);

ALTER TABLE seo_publish_qa ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seo_publish_qa' AND policyname='brand_rls') THEN
    CREATE POLICY brand_rls ON seo_publish_qa
      USING (brand_id = ANY(crm_user_brand_ids()));
  END IF;
END $$;


-- ============================================================
-- VIEWS — Read models (no live API calls)
-- ============================================================

-- V1: Opportunities Engine
-- Low CTR, ranking gaps, high impressions / low clicks
CREATE OR REPLACE VIEW v_seo_opportunities AS
SELECT
    spf.brand_id,
    spf.connection_id,
    spf.page_url,
    SUM(spf.impressions)            AS impressions_30d,
    SUM(spf.clicks)                 AS clicks_30d,
    AVG(spf.position)               AS avg_position,
    CASE WHEN SUM(spf.impressions) > 0
         THEN ROUND(SUM(spf.clicks)::numeric / SUM(spf.impressions), 4)
         ELSE 0 END                 AS ctr,
    ROUND(SUM(spf.impressions) * (1 - CASE WHEN SUM(spf.impressions) > 0
         THEN SUM(spf.clicks)::numeric / SUM(spf.impressions) ELSE 0 END), 0)
                                    AS opportunity_score,
    CASE
        WHEN AVG(spf.position) BETWEEN 5  AND 20  THEN 'ranking_gap'
        WHEN (CASE WHEN SUM(spf.impressions) > 0
              THEN SUM(spf.clicks)::numeric / SUM(spf.impressions) ELSE 0 END) < 0.02
             AND SUM(spf.impressions) > 100        THEN 'low_ctr'
        WHEN AVG(spf.position) < 5
             AND SUM(spf.clicks) < 10              THEN 'high_rank_low_traffic'
        ELSE 'monitor'
    END                             AS opportunity_type,
    MAX(spf.fact_date)              AS last_data_date
FROM seo_page_facts spf
WHERE spf.fact_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY spf.brand_id, spf.connection_id, spf.page_url
HAVING SUM(spf.impressions) > 10
ORDER BY opportunity_score DESC;


-- V2: Keyword Cannibalization
-- Multiple pages competing for the same query
CREATE OR REPLACE VIEW v_seo_cannibalization AS
SELECT
    sqf.brand_id,
    sqf.query,
    COUNT(DISTINCT sqf.page_url)    AS competing_pages,
    ARRAY_AGG(DISTINCT sqf.page_url ORDER BY sqf.page_url) AS pages,
    SUM(sqf.impressions)            AS total_impressions,
    SUM(sqf.clicks)                 AS total_clicks,
    MIN(sqf.position)               AS best_position,
    MAX(sqf.fact_date)              AS last_data_date
FROM seo_query_facts sqf
WHERE sqf.fact_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sqf.brand_id, sqf.query
HAVING COUNT(DISTINCT sqf.page_url) >= 2
   AND SUM(sqf.impressions) > 50
ORDER BY total_impressions DESC;


-- V3: Technical Health per Brand/Site
CREATE OR REPLACE VIEW v_seo_technical_health AS
SELECT
    si.brand_id,
    si.website_id,
    COUNT(*) FILTER (WHERE si.status = 'open')          AS open_issues,
    COUNT(*) FILTER (WHERE si.status = 'open' AND si.severity = 'critical') AS critical_open,
    COUNT(*) FILTER (WHERE si.status = 'open' AND si.severity = 'high')     AS high_open,
    COUNT(*) FILTER (WHERE si.status = 'resolved')      AS resolved_issues,
    COUNT(*) FILTER (WHERE si.issue_type = 'technical') AS technical_issues,
    COUNT(*) FILTER (WHERE si.issue_type = 'indexation') AS indexation_issues,
    COUNT(*) FILTER (WHERE si.issue_type = 'on-page')   AS on_page_issues,
    COUNT(*) FILTER (WHERE si.issue_type = 'content')   AS content_issues,
    ROUND(
        100.0 - LEAST(100, (
            COUNT(*) FILTER (WHERE si.status='open' AND si.severity='critical') * 20 +
            COUNT(*) FILTER (WHERE si.status='open' AND si.severity='high') * 10 +
            COUNT(*) FILTER (WHERE si.status='open' AND si.severity='medium') * 3 +
            COUNT(*) FILTER (WHERE si.status='open' AND si.severity='low') * 1
        )::numeric)
    , 0)                                                AS health_score
FROM seo_issues si
GROUP BY si.brand_id, si.website_id;


-- V4: SEO Business Impact (joins with analytics + ads)
-- Connects GSC clicks → GA4 revenue per URL
CREATE OR REPLACE VIEW v_seo_business_impact AS
SELECT
    spf.brand_id,
    spf.page_url,
    SUM(spf.clicks)                 AS seo_clicks_30d,
    SUM(spf.impressions)            AS seo_impressions_30d,
    AVG(spf.position)               AS avg_position_30d,
    -- GA4 page performance
    SUM(apf.sessions)               AS sessions_30d,
    SUM(apf.key_events)             AS conversions_30d,
    SUM(apf.revenue)                AS revenue_30d,
    CASE WHEN SUM(apf.sessions) > 0
         THEN ROUND(SUM(apf.revenue)::numeric / SUM(apf.sessions), 2)
         ELSE 0 END                 AS revenue_per_session,
    -- Engagement
    AVG(apf.avg_engagement_time_sec) AS avg_time_on_page,
    CASE WHEN SUM(apf.sessions) > 0
         THEN ROUND(SUM(apf.bounced_sessions)::numeric / SUM(apf.sessions), 4)
         ELSE NULL END              AS bounce_rate
FROM seo_page_facts spf
LEFT JOIN analytics_page_facts apf
       ON apf.brand_id = spf.brand_id
      AND apf.page_path = regexp_replace(spf.page_url, '^https?://[^/]+', '')
      AND apf.fact_date = spf.fact_date
WHERE spf.fact_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY spf.brand_id, spf.page_url
ORDER BY revenue_30d DESC NULLS LAST, seo_clicks_30d DESC;


-- V5: Content Brief Pipeline
CREATE OR REPLACE VIEW v_seo_brief_pipeline AS
SELECT
    scb.brand_id,
    scb.id,
    scb.target_keyword,
    scb.content_type,
    scb.search_intent,
    scb.status,
    scb.priority,
    scb.due_date,
    scb.word_count_target,
    scb.ai_generated,
    scb.assigned_to,
    skc.cluster_name,
    skc.topic,
    sp.url                          AS target_url,
    sp.clicks_30d,
    sp.impressions_30d,
    scb.created_at
FROM seo_content_briefs scb
LEFT JOIN seo_keyword_clusters skc ON skc.id = scb.cluster_id
LEFT JOIN seo_pages sp              ON sp.id  = scb.page_id
ORDER BY scb.priority = 'critical' DESC,
         scb.priority = 'high' DESC,
         scb.due_date ASC NULLS LAST;


-- ============================================================
-- FUNCTIONS — Auto-detection helpers
-- ============================================================

-- Detect and upsert low-CTR issues from seo_page_facts
CREATE OR REPLACE FUNCTION detect_low_ctr_issues(p_brand_id uuid, p_connection_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted int := 0;
BEGIN
    INSERT INTO seo_issues (
        brand_id, issue_type, category, title, description,
        affected_url, severity, auto_detected, detection_source
    )
    SELECT
        p_brand_id,
        'on-page',
        'low-ctr',
        'Low CTR — ' || page_url,
        'Page has ' || impressions_30d || ' impressions but only ' || ROUND(ctr * 100, 2) || '% CTR. Avg position: ' || ROUND(avg_position, 1),
        page_url,
        CASE WHEN impressions_30d > 1000 THEN 'high' ELSE 'medium' END,
        true,
        'gsc-sync'
    FROM v_seo_opportunities
    WHERE brand_id = p_brand_id
      AND opportunity_type = 'low_ctr'
      AND impressions_30d > 200
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;


-- Compute opportunity_score for keyword map from latest GSC data
CREATE OR REPLACE FUNCTION refresh_keyword_opportunity_scores(p_brand_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE seo_keyword_map km
    SET
        current_position    = sq.avg_position,
        impressions_30d     = sq.total_impressions,
        clicks_30d          = sq.total_clicks,
        ctr_30d             = sq.ctr,
        opportunity_score   = sq.opportunity_score,
        last_synced_at      = now()
    FROM (
        SELECT
            brand_id,
            query,
            AVG(position)         AS avg_position,
            SUM(impressions)      AS total_impressions,
            SUM(clicks)           AS total_clicks,
            CASE WHEN SUM(impressions) > 0
                 THEN ROUND(SUM(clicks)::numeric / SUM(impressions), 4)
                 ELSE 0 END       AS ctr,
            ROUND(SUM(impressions) * (1 - CASE WHEN SUM(impressions) > 0
                 THEN SUM(clicks)::numeric / SUM(impressions) ELSE 0 END), 0)
                                  AS opportunity_score
        FROM seo_query_facts
        WHERE brand_id = p_brand_id
          AND fact_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY brand_id, query
    ) sq
    WHERE km.brand_id = p_brand_id
      AND km.keyword  = sq.query;
END;
$$;
