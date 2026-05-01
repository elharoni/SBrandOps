-- 047_brand_documents_ai_analysis.sql
-- Persist Brand Hub uploaded file analysis metadata from OpenAI Responses API

ALTER TABLE public.brand_documents
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS file_type TEXT,
    ADD COLUMN IF NOT EXISTS analysis_provider TEXT,
    ADD COLUMN IF NOT EXISTS analysis_model TEXT,
    ADD COLUMN IF NOT EXISTS analysis_json JSONB,
    ADD COLUMN IF NOT EXISTS detected_language TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_brand_documents_updated_at ON public.brand_documents;
CREATE TRIGGER trg_brand_documents_updated_at
    BEFORE UPDATE ON public.brand_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.brand_documents.file_name IS
    'Original uploaded file name used for Brand Hub analysis.';
COMMENT ON COLUMN public.brand_documents.file_type IS
    'MIME type of the uploaded file used for Brand Hub analysis.';
COMMENT ON COLUMN public.brand_documents.analysis_provider IS
    'AI provider that analyzed the Brand Hub uploaded file.';
COMMENT ON COLUMN public.brand_documents.analysis_model IS
    'Model used for Brand Hub uploaded file analysis.';
COMMENT ON COLUMN public.brand_documents.analysis_json IS
    'Structured brand intelligence extracted from uploaded brand files.';
COMMENT ON COLUMN public.brand_documents.detected_language IS
    'Primary language detected in the uploaded brand file.';
