-- 031_brand_documents.sql
-- مكتبة تعلم البراند — وثائق مصدر الذكاء

CREATE TABLE IF NOT EXISTS brand_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id       UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    doc_type       TEXT NOT NULL DEFAULT 'other',
    -- 'brand_book' | 'sample_content' | 'competitor_analysis' | 'market_research' | 'style_guide' | 'other'
    content        TEXT NOT NULL,
    char_count     INTEGER GENERATED ALWAYS AS (char_length(content)) STORED,
    extracted_summary  TEXT,
    fields_found       JSONB DEFAULT '{}'::jsonb,
    completeness_score INTEGER DEFAULT 0,
    memory_entries_saved INTEGER DEFAULT 0,
    knowledge_entries_saved INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE brand_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_documents_owner" ON brand_documents
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        brand_id IN (
            SELECT id FROM brands WHERE user_id = auth.uid()
        )
    );

CREATE INDEX idx_brand_documents_brand_id ON brand_documents(brand_id);
