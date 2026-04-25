-- ============================================================
-- Migration 030: Campaign Brain — AI Marketing Operating System
-- ============================================================
-- Tables:
--   goals, campaigns, content_plans, content_items,
--   creative_briefs, design_prompts, approvals,
--   publishing_jobs, platform_posts, performance_records,
--   ai_feedback_logs
-- All tables are scoped by brand_id (multi-tenant via RLS)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM (
        'draft', 'active', 'paused', 'completed', 'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE content_item_status AS ENUM (
        'draft',
        'brief_ready',
        'design_in_progress',
        'design_ready',
        'caption_ready',
        'needs_review',
        'approved',
        'scheduled',
        'publishing',
        'published',
        'publish_failed',
        'performance_tracked',
        'needs_optimization'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE approval_decision AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── goals ─────────────────────────────────────────────────────────────────────
-- Brand-level marketing goals that campaigns are tied to
CREATE TABLE IF NOT EXISTS goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    goal_type       TEXT NOT NULL DEFAULT 'awareness',
    -- awareness | engagement | leads | sales | retention | loyalty
    kpis            JSONB NOT NULL DEFAULT '[]',
    -- [{metric: "reach", target: 50000, unit: "impressions"}]
    target_date     DATE,
    status          TEXT NOT NULL DEFAULT 'active',  -- active | completed | paused | cancelled
    progress        NUMERIC(5,2) DEFAULT 0,          -- 0-100
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_brand        ON goals (brand_id);
CREATE INDEX IF NOT EXISTS idx_goals_brand_status ON goals (brand_id, status);

-- ── campaigns ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    goal_id             UUID REFERENCES goals(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    name                TEXT NOT NULL,
    description         TEXT,
    status              campaign_status NOT NULL DEFAULT 'draft',

    -- AI-generated strategy stored as structured JSON
    strategy_data       JSONB DEFAULT '{}',
    -- {
    --   positioning: string,
    --   messaging_pillars: string[],
    --   target_segments: string[],
    --   tone: string,
    --   hooks: string[],
    --   content_mix: {educational: %, promotional: %, entertaining: %}
    -- }

    start_date          DATE,
    end_date            DATE,
    budget              NUMERIC(12,2),
    currency            TEXT DEFAULT 'SAR',

    platforms           TEXT[] DEFAULT '{}',   -- instagram, facebook, twitter, tiktok, linkedin
    content_count       INTEGER DEFAULT 0,     -- total planned content items
    published_count     INTEGER DEFAULT 0,
    health_score        INTEGER DEFAULT 0,     -- 0-100 AI-calculated campaign health

    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_brand          ON campaigns (brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_status   ON campaigns (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_goal           ON campaigns (goal_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates          ON campaigns (brand_id, start_date, end_date);

-- ── content_plans ─────────────────────────────────────────────────────────────
-- One content plan per campaign — the editorial calendar
CREATE TABLE IF NOT EXISTS content_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    description     TEXT,

    -- AI-generated calendar structure
    calendar_data   JSONB DEFAULT '[]',
    -- [{week: 1, theme: string, posts: [{day, platform, content_type, topic}]}]

    total_items     INTEGER DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft',   -- draft | active | locked
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_content_plans_brand    ON content_plans (brand_id);
CREATE INDEX IF NOT EXISTS idx_content_plans_campaign ON content_plans (campaign_id);

-- ── content_items ─────────────────────────────────────────────────────────────
-- Individual pieces of content within a campaign plan
CREATE TABLE IF NOT EXISTS content_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    content_plan_id     UUID REFERENCES content_plans(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    title               TEXT NOT NULL,
    content_type        TEXT NOT NULL DEFAULT 'post',
    -- post | story | reel | carousel | video | ad | email

    platform            TEXT NOT NULL DEFAULT 'instagram',
    -- instagram | facebook | twitter | tiktok | linkedin | youtube

    status              content_item_status NOT NULL DEFAULT 'draft',

    -- The core content fields
    caption             TEXT,
    media_asset_id      UUID,   -- references media_assets(id) when implemented
    media_url           TEXT,

    -- AI context fields
    brief_data          JSONB DEFAULT '{}',
    -- {objective, target_segment, key_message, tone, hooks, cta, reference_posts}
    design_prompt       TEXT,
    brand_fit_score     INTEGER,  -- 0-100 from AI post review

    -- Scheduling
    scheduled_at        TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,

    -- Tracking
    sort_order          INTEGER DEFAULT 0,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_items_brand       ON content_items (brand_id);
CREATE INDEX IF NOT EXISTS idx_content_items_campaign    ON content_items (campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_items_plan        ON content_items (content_plan_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status      ON content_items (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled   ON content_items (brand_id, scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_platform    ON content_items (brand_id, platform, status);

-- ── creative_briefs ────────────────────────────────────────────────────────────
-- AI-generated creative brief per content item
CREATE TABLE IF NOT EXISTS creative_briefs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Brief structure
    objective           TEXT NOT NULL,
    target_segment      TEXT,
    key_message         TEXT NOT NULL,
    tone                TEXT,
    hooks               JSONB DEFAULT '[]',    -- string[]
    cta                 TEXT,
    reference_posts     JSONB DEFAULT '[]',    -- {url, note}[]
    visual_direction    TEXT,
    negative_space      TEXT,    -- what to avoid

    -- Slide structure for design team
    slide_structure     JSONB DEFAULT '[]',
    -- [{slide: 1, headline: string, subtext: string, visual_note: string, cta: string}]

    version             INTEGER DEFAULT 1,
    is_approved         BOOLEAN DEFAULT false,
    approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (content_item_id)
);

CREATE INDEX IF NOT EXISTS idx_creative_briefs_brand   ON creative_briefs (brand_id);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_item    ON creative_briefs (content_item_id);

-- ── design_prompts ─────────────────────────────────────────────────────────────
-- AI-generated image prompts derived from a creative brief
CREATE TABLE IF NOT EXISTS design_prompts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    creative_brief_id   UUID REFERENCES creative_briefs(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- The actual prompt sent to image generation
    prompt_text         TEXT NOT NULL,
    negative_prompt     TEXT,

    -- Generation metadata
    model               TEXT DEFAULT 'imagen-3.0-generate-002',
    aspect_ratio        TEXT DEFAULT '1:1',    -- 1:1 | 9:16 | 16:9 | 4:5
    style_preset        TEXT,
    brand_style_hint    TEXT,    -- derived from brandProfile voice keywords

    -- Results
    generated_image_url TEXT,
    generation_status   TEXT DEFAULT 'pending',  -- pending | generating | done | failed
    generation_error    TEXT,
    generated_at        TIMESTAMPTZ,

    version             INTEGER DEFAULT 1,
    is_selected         BOOLEAN DEFAULT false,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_prompts_brand ON design_prompts (brand_id);
CREATE INDEX IF NOT EXISTS idx_design_prompts_item  ON design_prompts (content_item_id);

-- ── approvals ─────────────────────────────────────────────────────────────────
-- Approval workflow for content items
CREATE TABLE IF NOT EXISTS approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    decision            approval_decision NOT NULL DEFAULT 'pending',
    review_type         TEXT NOT NULL DEFAULT 'content',
    -- content | design | compliance | final

    notes               TEXT,
    changes_requested   JSONB DEFAULT '[]',  -- string[] — specific change requests
    reviewed_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_brand       ON approvals (brand_id);
CREATE INDEX IF NOT EXISTS idx_approvals_item        ON approvals (content_item_id);
CREATE INDEX IF NOT EXISTS idx_approvals_reviewer    ON approvals (reviewer_id, decision);
CREATE INDEX IF NOT EXISTS idx_approvals_pending     ON approvals (brand_id, decision) WHERE decision = 'pending';

-- ── publishing_jobs ────────────────────────────────────────────────────────────
-- Tracks the actual publish operation for each content item
CREATE TABLE IF NOT EXISTS publishing_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    platform            TEXT NOT NULL,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL DEFAULT 'queued',
    -- queued | running | success | failed | cancelled | retry

    attempts            INTEGER DEFAULT 0,
    max_attempts        INTEGER DEFAULT 3,
    last_attempt_at     TIMESTAMPTZ,
    last_error          TEXT,

    -- Result from the platform API
    platform_post_id    TEXT,   -- ID returned by platform on success
    platform_url        TEXT,
    published_at        TIMESTAMPTZ,

    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_brand       ON publishing_jobs (brand_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_item        ON publishing_jobs (content_item_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_scheduled   ON publishing_jobs (brand_id, scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_status      ON publishing_jobs (brand_id, status);

-- ── platform_posts ─────────────────────────────────────────────────────────────
-- Canonical record of a published post with live metrics snapshot
CREATE TABLE IF NOT EXISTS platform_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID REFERENCES content_items(id) ON DELETE SET NULL,
    publishing_job_id   UUID REFERENCES publishing_jobs(id) ON DELETE SET NULL,

    platform            TEXT NOT NULL,
    platform_post_id    TEXT NOT NULL,
    platform_url        TEXT,
    caption             TEXT,
    media_urls          JSONB DEFAULT '[]',

    published_at        TIMESTAMPTZ NOT NULL,

    -- Engagement metrics (updated by sync jobs)
    reach               INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    likes               INTEGER DEFAULT 0,
    comments            INTEGER DEFAULT 0,
    shares              INTEGER DEFAULT 0,
    saves               INTEGER DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    video_views         INTEGER DEFAULT 0,
    profile_visits      INTEGER DEFAULT 0,

    -- Derived metrics
    engagement_rate     NUMERIC(6,4) DEFAULT 0,  -- (likes+comments+shares+saves) / reach
    click_through_rate  NUMERIC(6,4) DEFAULT 0,

    -- Revenue attribution
    revenue_attributed  NUMERIC(12,2) DEFAULT 0,
    conversions         INTEGER DEFAULT 0,

    last_synced_at      TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (platform, platform_post_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_posts_brand       ON platform_posts (brand_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_item        ON platform_posts (content_item_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform    ON platform_posts (brand_id, platform, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_posts_engagement  ON platform_posts (brand_id, engagement_rate DESC);

-- ── performance_records ───────────────────────────────────────────────────────
-- Point-in-time performance snapshots for time-series analytics
CREATE TABLE IF NOT EXISTS performance_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    platform_post_id    UUID REFERENCES platform_posts(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    snapshot_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    period              TEXT NOT NULL DEFAULT 'daily',  -- hourly | daily | weekly | monthly

    -- Metrics snapshot
    reach               INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    likes               INTEGER DEFAULT 0,
    comments            INTEGER DEFAULT 0,
    shares              INTEGER DEFAULT 0,
    saves               INTEGER DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    video_views         INTEGER DEFAULT 0,
    engagement_rate     NUMERIC(6,4) DEFAULT 0,

    -- AI analysis of this period
    ai_insights         JSONB DEFAULT '{}',
    -- {summary: string, top_driver: string, decline_reason: string, recommendation: string}

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_records_brand     ON performance_records (brand_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_records_post      ON performance_records (platform_post_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_records_campaign  ON performance_records (campaign_id, snapshot_at DESC);

-- ── ai_feedback_logs ──────────────────────────────────────────────────────────
-- Records every user interaction with AI-generated content (used / edited / rejected)
-- Feeds back into brand memory for continuous learning
CREATE TABLE IF NOT EXISTS ai_feedback_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content_item_id     UUID REFERENCES content_items(id) ON DELETE SET NULL,

    -- What was generated
    generation_type     TEXT NOT NULL,
    -- caption | image_prompt | brief | strategy | schedule | variation | post_review

    -- What happened to it
    signal              TEXT NOT NULL,
    -- used | edited | rejected | approved | scheduled | published

    -- Content snapshot at time of feedback
    original_content    TEXT,
    edited_content      TEXT,    -- populated if signal = 'edited'
    edit_distance       INTEGER, -- approximate character diff

    -- Context
    skill_id            TEXT,    -- from skillEngine SKILL_REGISTRY
    platform            TEXT,
    model_used          TEXT,

    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_brand    ON ai_feedback_logs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_signal   ON ai_feedback_logs (brand_id, signal);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type     ON ai_feedback_logs (brand_id, generation_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_item     ON ai_feedback_logs (content_item_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE TRIGGER goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER content_plans_updated_at
    BEFORE UPDATE ON content_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER content_items_updated_at
    BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER creative_briefs_updated_at
    BEFORE UPDATE ON creative_briefs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER approvals_updated_at
    BEFORE UPDATE ON approvals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER publishing_jobs_updated_at
    BEFORE UPDATE ON publishing_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER platform_posts_updated_at
    BEFORE UPDATE ON platform_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE goals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_briefs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_prompts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_brand_access ON goals
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = goals.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY campaigns_brand_access ON campaigns
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = campaigns.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY content_plans_brand_access ON content_plans
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_plans.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY content_items_brand_access ON content_items
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_items.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY creative_briefs_brand_access ON creative_briefs
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = creative_briefs.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY design_prompts_brand_access ON design_prompts
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = design_prompts.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY approvals_brand_access ON approvals
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = approvals.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY publishing_jobs_brand_access ON publishing_jobs
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = publishing_jobs.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY platform_posts_brand_access ON platform_posts
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = platform_posts.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY performance_records_brand_access ON performance_records
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = performance_records.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY ai_feedback_logs_brand_access ON ai_feedback_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = ai_feedback_logs.brand_id AND brands.user_id = auth.uid()));

-- ── Helper: get campaign health score ────────────────────────────────────────
-- Calculates a 0-100 health score based on content completion rate and avg engagement
CREATE OR REPLACE FUNCTION get_campaign_health(p_campaign_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
    SELECT LEAST(100, GREATEST(0,
        ROUND(
            -- 50% weight: content completion ratio
            0.5 * (
                CASE WHEN c.content_count > 0
                THEN (c.published_count::NUMERIC / c.content_count) * 100
                ELSE 0 END
            )
            +
            -- 50% weight: average brand_fit_score of items
            0.5 * COALESCE((
                SELECT AVG(ci.brand_fit_score)
                FROM content_items ci
                WHERE ci.campaign_id = p_campaign_id
                  AND ci.brand_fit_score IS NOT NULL
            ), 50)
        )::INTEGER
    ))
    FROM campaigns c
    WHERE c.id = p_campaign_id;
$$;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE goals               IS 'Brand-level marketing goals that campaigns are aligned to';
COMMENT ON TABLE campaigns           IS 'Campaign containers with AI strategy and health scoring';
COMMENT ON TABLE content_plans       IS 'AI-generated editorial calendar per campaign';
COMMENT ON TABLE content_items       IS 'Individual content pieces with 13-state lifecycle';
COMMENT ON TABLE creative_briefs     IS 'AI-generated creative briefs per content item';
COMMENT ON TABLE design_prompts      IS 'Image generation prompts derived from creative briefs';
COMMENT ON TABLE approvals           IS 'Multi-stage approval workflow for content items';
COMMENT ON TABLE publishing_jobs     IS 'Scheduled publish operations with retry tracking';
COMMENT ON TABLE platform_posts      IS 'Published posts with live engagement metrics';
COMMENT ON TABLE performance_records IS 'Time-series performance snapshots for analytics';
COMMENT ON TABLE ai_feedback_logs    IS 'User feedback signals on AI-generated content for memory learning';
