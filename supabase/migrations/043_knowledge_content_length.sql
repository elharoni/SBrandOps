-- ============================================================
-- Migration 043: Knowledge Content Length Constraint (P4-05)
-- ============================================================
-- محتوى طويل يتجاوز حد توكنات Gemini ويسبب أخطاء صامتة.
-- الحد: 3000 حرف — كافٍ لأي مدخل معرفة واحد.
-- NOT VALID: يُطبَّق على الصفوف الجديدة فقط، بدون فحص القديمة.
-- ============================================================

ALTER TABLE brand_knowledge
    ADD CONSTRAINT chk_knowledge_content_length
        CHECK (char_length(content) <= 3000)
        NOT VALID;

COMMENT ON CONSTRAINT chk_knowledge_content_length ON brand_knowledge
    IS 'يمنع إدخال محتوى يتجاوز 3000 حرف — حد أمان توكنات Gemini';
