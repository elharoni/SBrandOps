-- Migration: 033_data_sync_cron
-- Creates a scheduled task to run the data-sync Edge Function every 12 hours.

-- Enable pg_net and pg_cron if they aren't already enabled (usually enabled by default in Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
    -- The Supabase Edge Function URL. Adjust for your actual project reference ID or dynamic URL.
    -- Assuming a dynamic internal relay or valid service URL.
    -- Warning: Replace 'https://<PROJECT_REF>.supabase.co/functions/v1/data-sync' in production.
    func_url text := current_setting('app.settings.edge_function_base_url', true) || '/data-sync';
    service_role_key text := current_setting('app.settings.service_role_key', true);
BEGIN
    -- If current_setting is missing, standard fallback approach doesn't work universally without explicit hardcoding.
    -- For Supabase cloud environments, users usually provide the exact URL manually when migrating, 
    -- but here we schedule the HTTP POST via pg_net.
    
    IF func_url IS NULL OR func_url = '/data-sync' THEN
        -- Placeholder URL format
        func_url := 'http://kong:8000/functions/v1/data-sync'; -- internal kong resolver
    END IF;

    -- Unschedule anything existing with this name
    PERFORM cron.unschedule('invoke_data_sync_engine');

    -- Schedule the function to run every 12 hours
    -- "0 */12 * * *" means "at minute 0 past every 12th hour".
    PERFORM cron.schedule(
        'invoke_data_sync_engine',
        '0 */12 * * *',
        format(
            $$
            SELECT net.http_post(
                url := '%s',
                headers := '{"Authorization": "Bearer %s", "Content-Type": "application/json"}'::jsonb
            )
            $$,
            func_url,
            COALESCE(service_role_key, 'YOUR_SERVICE_ROLE_KEY')
        )
    );
END $$;
