-- Migration 052: Separate AI provider keys per service
-- Allows distinct API keys for content, design, and video generation

-- Drop the old CHECK constraint (provider values were limited)
ALTER TABLE public.ai_provider_keys
    DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_check;

-- Re-add with extended allowed values
ALTER TABLE public.ai_provider_keys
    ADD CONSTRAINT ai_provider_keys_provider_check
    CHECK (provider IN (
        -- generic (fallback) keys
        'gemini', 'openai', 'anthropic', 'stability', 'replicate',
        -- service-specific Gemini keys
        'gemini-content', 'gemini-design', 'gemini-video',
        -- service-specific OpenAI keys
        'openai-image', 'openai-video'
    ));
