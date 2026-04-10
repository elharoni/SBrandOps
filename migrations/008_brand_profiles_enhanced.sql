-- Migration 008: Enhanced Brand Profiles Table
-- Run this in Supabase SQL Editor

-- Add missing columns to brand_profiles if they don't exist
ALTER TABLE public.brand_profiles
    ADD COLUMN IF NOT EXISTS brand_name text,
    ADD COLUMN IF NOT EXISTS industry text,
    ADD COLUMN IF NOT EXISTS style_guidelines text[],
    ADD COLUMN IF NOT EXISTS tone_strength numeric default 0.5,
    ADD COLUMN IF NOT EXISTS tone_sentiment numeric default 0.5,
    ADD COLUMN IF NOT EXISTS voice_guidelines jsonb default '{"dos": [], "donts": []}',
    ADD COLUMN IF NOT EXISTS brand_audiences jsonb default '[]',
    ADD COLUMN IF NOT EXISTS consistency_score integer default 0,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Ensure unique constraint on brand_id for upsert to work
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'brand_profiles_brand_id_key'
    ) THEN
        ALTER TABLE public.brand_profiles ADD CONSTRAINT brand_profiles_brand_id_key UNIQUE (brand_id);
    END IF;
END $$;

-- Add RLS policy if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'brand_profiles' AND policyname = 'Authenticated access brand profiles'
    ) THEN
        CREATE POLICY "Authenticated access brand profiles"
            ON public.brand_profiles FOR ALL
            USING (auth.role() = 'authenticated');
    END IF;
END $$;
