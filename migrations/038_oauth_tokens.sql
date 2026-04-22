-- ============================================================
-- Migration 038: OAuth Tokens Store
-- يخزّن توكنات الاتصال الحقيقي بالمنصات الاجتماعية بشكل آمن
-- كل براند → كل منصة → كل Page/Account له توكن مستقل
-- ============================================================

-- ── دالة مشتركة: تحديث updated_at تلقائياً ──────────────────
-- نعيد تعريفها هنا بـ CREATE OR REPLACE لأنها قد لا تكون موجودة
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    social_account_id   UUID        REFERENCES public.social_accounts(id) ON DELETE SET NULL,

    -- بيانات المزوّد
    provider            TEXT        NOT NULL,  -- 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'google'
    provider_account_id TEXT        NOT NULL,  -- Page ID أو User ID من المنصة
    provider_username   TEXT,                  -- @handle للعرض فقط
    provider_name       TEXT,                  -- اسم الصفحة/الحساب

    -- التوكنات (يُنصح بتشفيرها في منتج الإنتاج عبر pgp_sym_encrypt)
    access_token        TEXT        NOT NULL,
    refresh_token       TEXT,
    token_type          TEXT        NOT NULL DEFAULT 'bearer',
    scopes              TEXT[]      NOT NULL DEFAULT '{}',

    -- صلاحية التوكن
    expires_at          TIMESTAMPTZ,
    is_valid            BOOLEAN     NOT NULL DEFAULT true,
    last_refresh_at     TIMESTAMPTZ,
    refresh_fail_count  INTEGER     NOT NULL DEFAULT 0,  -- كم مرة فشل الـ refresh

    -- بيانات إضافية من الـ OAuth response
    raw_metadata        JSONB       NOT NULL DEFAULT '{}',

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- منع التكرار: نفس البراند × نفس المزوّد × نفس الـ Account
    CONSTRAINT uq_oauth_tokens_brand_provider_account
        UNIQUE (brand_id, provider, provider_account_id)
);

-- ── Indexes ─────────────────────────────────────────────────
-- بحث سريع أثناء النشر
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_brand_provider
    ON public.oauth_tokens (brand_id, provider);

-- مراقبة التوكنات التي ستنتهي قريباً (للـ refresh تلقائي)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expiry
    ON public.oauth_tokens (expires_at ASC)
    WHERE is_valid = true AND expires_at IS NOT NULL;

-- ربط بالحساب الاجتماعي
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_social_account
    ON public.oauth_tokens (social_account_id);

-- ── Trigger: auto-update updated_at ─────────────────────────
CREATE OR REPLACE TRIGGER trg_oauth_tokens_updated_at
    BEFORE UPDATE ON public.oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_tokens_brand_owner"
    ON public.oauth_tokens FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── Helper Function: جلب توكن نشط لمنصة معينة ──────────────
CREATE OR REPLACE FUNCTION public.get_valid_oauth_token(
    p_brand_id   UUID,
    p_provider   TEXT,
    p_account_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    token_id            UUID,
    access_token        TEXT,
    refresh_token       TEXT,
    provider_account_id TEXT,
    expires_at          TIMESTAMPTZ,
    scopes              TEXT[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        id,
        access_token,
        refresh_token,
        provider_account_id,
        expires_at,
        scopes
    FROM public.oauth_tokens
    WHERE brand_id  = p_brand_id
      AND provider  = p_provider
      AND is_valid  = true
      AND (p_account_id IS NULL OR provider_account_id = p_account_id)
      AND (expires_at IS NULL OR expires_at > now() + INTERVAL '5 minutes')
    ORDER BY created_at DESC
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_valid_oauth_token(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.oauth_tokens IS
    'يخزّن توكنات OAuth لكل منصة اجتماعية لكل براند — أساس النشر الحقيقي';
