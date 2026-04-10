-- Migration 019: SEO Ops tables
-- seo_keywords: keyword research results per brand
-- seo_articles: AI-written SEO articles with scoring

CREATE TABLE IF NOT EXISTS seo_keywords (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    keyword         text NOT NULL,
    search_intent   text DEFAULT 'informational',   -- informational|navigational|commercial|transactional
    difficulty      text DEFAULT 'medium',           -- low|medium|high
    priority_score  int  DEFAULT 50,                 -- 1-100
    monthly_volume  text DEFAULT '',
    notes           text DEFAULT '',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_articles (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    keyword_id       uuid REFERENCES seo_keywords(id) ON DELETE SET NULL,
    keyword          text NOT NULL,
    h1               text DEFAULT '',
    h2s              jsonb DEFAULT '[]',
    intro            text DEFAULT '',
    body             text DEFAULT '',
    faq              jsonb DEFAULT '[]',
    meta_title       text DEFAULT '',
    meta_description text DEFAULT '',
    readability_score int DEFAULT 0,
    keyword_density  numeric(5,2) DEFAULT 0,
    seo_score        int DEFAULT 0,
    word_count       int DEFAULT 0,
    status           text DEFAULT 'draft',   -- draft|optimizing|ready|published
    wp_post_id       int DEFAULT NULL,        -- WordPress post ID after export
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Triggers
CREATE TRIGGER set_seo_keywords_updated_at
    BEFORE UPDATE ON seo_keywords
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_seo_articles_updated_at
    BEFORE UPDATE ON seo_articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own brand SEO keywords"
    ON seo_keywords FOR ALL USING (brand_id = ANY(crm_user_brand_ids()));

CREATE POLICY "Users access own brand SEO articles"
    ON seo_articles FOR ALL USING (brand_id = ANY(crm_user_brand_ids()));
