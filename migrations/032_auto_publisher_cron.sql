-- Migration: 032_auto_publisher_cron.sql
-- Description: Schedule Auto Publisher via pg_cron

-- 1. Ensure pg_cron & pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Drop the existing job if it exists (so we can recreate it safely)
DO $$
DECLARE
    jobid bigint;
BEGIN
    SELECT jobid INTO jobid FROM cron.job WHERE jobname = 'auto-publisher-minute-cron';
    IF FOUND THEN
        PERFORM cron.unschedule(jobid);
    END IF;
END $$;

-- 3. Schedule the pg_cron job to invoke the auto-publisher Edge Function every minute
-- NOTE: Please replace YOUR_SUPABASE_PROJECT_URL and YOUR_SERVICE_ROLE_KEY below 
-- before running this in production, or let your Supabase Environment Variables handle it if called via HTTP.
SELECT cron.schedule(
  'auto-publisher-minute-cron',  -- name of the cron job
  '* * * * *',                   -- cron schedule (every minute)
  $$
  SELECT net.http_post(
      url := 'https://' || current_setting('custom.project_ref', true) || '.supabase.co/functions/v1/auto-publisher',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('custom.service_role_key', true)
      )
  );
  $$
);

/*
Usage Note:
If `current_setting('custom.project_ref', true)` is not set dynamically in your DB cluster, you can hardcode the URL:
   url := 'https://your-project-ref.supabase.co/functions/v1/auto-publisher',
   headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-service-role-key"}'::jsonb
*/
