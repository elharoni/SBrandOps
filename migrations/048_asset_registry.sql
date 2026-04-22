-- ══════════════════════════════════════════════════════════════════════════════
-- 048: Asset Registry — Integration Operating System Foundation
-- يحوّل social_accounts من جدول أسماء إلى سجل أصول ذكي
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. إضافة الأعمدة الجديدة ──────────────────────────────────────────────────

ALTER TABLE public.social_accounts
    ADD COLUMN IF NOT EXISTS asset_type    text DEFAULT 'page' CHECK (asset_type IN (
                                               'page',
                                               'ig_account',
                                               'ad_account',
                                               'pixel',
                                               'store',
                                               'site',
                                               'inbox_channel',
                                               'youtube_channel',
                                               'tiktok_account',
                                               'linkedin_page',
                                               'x_account'
                                           )),
    ADD COLUMN IF NOT EXISTS purposes      text[] NOT NULL DEFAULT '{}',
    -- مثال: '{publishing,inbox,analytics}'
    -- القيم المسموحة: publishing / inbox / analytics / commerce / ads / seo

    ADD COLUMN IF NOT EXISTS market        text,
    -- sa / eg / ae / global / إلخ — اختياري

    ADD COLUMN IF NOT EXISTS is_primary    boolean NOT NULL DEFAULT false,
    -- الأصل الرئيسي لكل نوع + براند

    ADD COLUMN IF NOT EXISTS sync_status   text NOT NULL DEFAULT 'active' CHECK (sync_status IN (
                                               'active',
                                               'needs_reconnect',
                                               'token_expired',
                                               'scope_missing',
                                               'webhook_inactive',
                                               'partial_sync',
                                               'sync_delayed',
                                               'disconnected'
                                           )),
    ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
    ADD COLUMN IF NOT EXISTS sync_error     text,
    ADD COLUMN IF NOT EXISTS webhook_active boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS scopes_granted text[] NOT NULL DEFAULT '{}';

-- ── 2. Index على الحالات الأكثر استخداماً ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_asset_type
    ON public.social_accounts(brand_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_purposes
    ON public.social_accounts USING gin(purposes);

CREATE INDEX IF NOT EXISTS idx_social_accounts_sync_status
    ON public.social_accounts(sync_status)
    WHERE sync_status != 'active';

-- ── 3. View: Integration Health Center ────────────────────────────────────────
-- يُستخدم في صفحة مراقبة حالة الربط

CREATE OR REPLACE VIEW public.integration_health AS
SELECT
    sa.id,
    sa.brand_id,
    sa.platform,
    sa.asset_type,
    sa.username           AS asset_name,
    sa.avatar_url,
    sa.followers_count,
    sa.purposes,
    sa.market,
    sa.is_primary,
    sa.sync_status,
    sa.last_synced_at,
    sa.sync_error,
    sa.webhook_active,
    sa.scopes_granted,
    sa.status             AS connection_status,
    -- هل التوكن سيستهلك قريباً؟
    CASE
        WHEN ot.expires_at IS NULL THEN false
        WHEN ot.expires_at < now() THEN true
        WHEN ot.expires_at < now() + INTERVAL '7 days' THEN true
        ELSE false
    END                   AS token_expiring_soon,
    ot.expires_at         AS token_expires_at,
    ot.is_valid           AS token_is_valid,
    sa.created_at,
    sa.updated_at
FROM public.social_accounts sa
LEFT JOIN public.oauth_tokens ot
    ON ot.social_account_id = sa.id
   AND ot.is_valid = true;

GRANT SELECT ON public.integration_health TO authenticated;

-- ── 4. Function: تحديث sync_status ───────────────────────────────────────────
-- تُستدعى من Edge Functions بعد كل sync

CREATE OR REPLACE FUNCTION public.update_asset_sync_status(
    p_asset_id    uuid,
    p_status      text,
    p_error       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.social_accounts
    SET
        sync_status   = p_status,
        last_synced_at = CASE WHEN p_status = 'active' THEN now() ELSE last_synced_at END,
        sync_error    = p_error,
        updated_at    = now()
    WHERE id = p_asset_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_asset_sync_status(uuid, text, text) TO authenticated;

-- ── 5. بناء قيم افتراضية للبيانات الموجودة ────────────────────────────────────
-- يضع asset_type بناءً على platform الموجودة

UPDATE public.social_accounts
SET asset_type = CASE
    WHEN platform ILIKE '%instagram%' THEN 'ig_account'
    WHEN platform ILIKE '%tiktok%'    THEN 'tiktok_account'
    WHEN platform ILIKE '%linkedin%'  THEN 'linkedin_page'
    WHEN platform ILIKE '%x%'
      OR platform ILIKE '%twitter%'   THEN 'x_account'
    WHEN platform ILIKE '%youtube%'   THEN 'youtube_channel'
    ELSE 'page'
END
WHERE asset_type IS NULL OR asset_type = 'page';

-- purposes افتراضية للحسابات الموجودة: نشر + تحليلات
UPDATE public.social_accounts
SET purposes = ARRAY['publishing', 'analytics']
WHERE purposes = '{}' OR purposes IS NULL;
