-- ============================================================
-- Migration 032: Captions + Media Assets
-- ============================================================
-- captions: versioned caption records per content item per platform
-- media_assets: all generated/uploaded images and media files
-- ============================================================

-- ── captions ─────────────────────────────────────────────────────────────────
-- Stores versioned caption variants for each content item + platform combination

CREATE TABLE IF NOT EXISTS captions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,

    platform        TEXT NOT NULL DEFAULT 'instagram',
    version         INTEGER NOT NULL DEFAULT 1,
    caption_text    TEXT NOT NULL,
    headline        TEXT,
    hashtags        TEXT[] DEFAULT '{}',
    cta             TEXT,
    alt_text        TEXT,
    char_count      INTEGER GENERATED ALWAYS AS (char_length(caption_text)) STORED,
    language        TEXT NOT NULL DEFAULT 'ar',   -- 'ar' | 'en'
    is_selected     BOOLEAN NOT NULL DEFAULT false,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_captions_brand   ON captions (brand_id);
CREATE INDEX IF NOT EXISTS idx_captions_item    ON captions (content_item_id);
CREATE INDEX IF NOT EXISTS idx_captions_selected ON captions (content_item_id, platform) WHERE is_selected = true;

ALTER TABLE captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY captions_brand_access ON captions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM brands WHERE brands.id = captions.brand_id AND brands.user_id = auth.uid()
    ));

-- ── media_assets ──────────────────────────────────────────────────────────────
-- Canonical store for all generated or uploaded media used in content items

CREATE TABLE IF NOT EXISTS media_assets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_item_id     UUID REFERENCES content_items(id) ON DELETE SET NULL,
    design_prompt_id    UUID REFERENCES design_prompts(id) ON DELETE SET NULL,

    name                TEXT NOT NULL DEFAULT 'Untitled Asset',
    url                 TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'image',   -- 'image' | 'video' | 'gif'
    source              TEXT NOT NULL DEFAULT 'ai',      -- 'ai' | 'upload' | 'stock'
    provider            TEXT,                            -- 'imagen' | 'pollinations' | 'gemini' | null
    ai_score            INTEGER,                         -- 0-100 AI visual quality score
    aspect_ratio        TEXT DEFAULT '1:1',
    width               INTEGER,
    height              INTEGER,
    prompt              TEXT,                            -- the prompt used to generate
    tags                TEXT[] DEFAULT '{}',
    is_selected         BOOLEAN NOT NULL DEFAULT false,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_brand    ON media_assets (brand_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_item     ON media_assets (content_item_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_selected ON media_assets (content_item_id) WHERE is_selected = true;

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_assets_brand_access ON media_assets
    FOR ALL USING (EXISTS (
        SELECT 1 FROM brands WHERE brands.id = media_assets.brand_id AND brands.user_id = auth.uid()
    ));

COMMENT ON TABLE captions     IS 'Versioned caption records per content item + platform';
COMMENT ON TABLE media_assets IS 'All AI-generated and uploaded media assets for content items';
