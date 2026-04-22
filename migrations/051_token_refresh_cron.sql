-- ══════════════════════════════════════════════════════════════════════════════
-- 051: Token Refresh — daily pg_cron job
-- يشغّل Edge Function كل يوم الساعة 3 صباحاً UTC
--
-- Prerequisites:
--   1. pg_net extension enabled (Dashboard → Extensions → pg_net)
--   2. pg_cron extension enabled (Dashboard → Extensions → pg_cron)
--   3. CRON_SECRET secret added in Supabase Edge Function secrets
--   4. token-refresh Edge Function deployed
--
-- To get your project ref: Dashboard URL → https://app.supabase.com/project/<REF>
-- Replace YOUR_PROJECT_REF below with the actual value before running.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Remove old job if re-running this migration ───────────────────────────────
SELECT cron.unschedule('token-refresh-daily') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'token-refresh-daily'
);

-- ── Schedule: daily at 03:00 UTC ─────────────────────────────────────────────
SELECT cron.schedule(
    'token-refresh-daily',
    '0 3 * * *',
    $$
    SELECT net.http_post(
        url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/token-refresh',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
        ),
        body    := '{}'::jsonb
    ) AS request_id;
    $$
);

-- ── Store CRON_SECRET in app config (run once, replace value) ─────────────────
-- After adding CRON_SECRET to Edge Function secrets, also expose it here:
--
--   ALTER DATABASE postgres SET app.cron_secret = 'your-secret-here';
--
-- This lets pg_cron read it via current_setting('app.cron_secret', true).
-- The value must match the CRON_SECRET env var in your Edge Function secrets.
