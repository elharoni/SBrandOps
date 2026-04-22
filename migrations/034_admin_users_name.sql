-- Migration 034: Add name column to admin_users
-- Allows storing display name for admin users separately from email

ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS name text;

-- Backfill: derive name from email for existing rows
UPDATE public.admin_users
SET name = split_part(email, '@', 1)
WHERE name IS NULL;
