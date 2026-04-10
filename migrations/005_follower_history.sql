-- Migration 005: Follower History Table for Analytics
-- Run this in Supabase SQL Editor

-- Follower history snapshots (for growth charts)
CREATE TABLE IF NOT EXISTS public.follower_history (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null,
    platform text not null,
    followers_count integer not null default 0,
    recorded_at timestamptz default now() not null
);

-- Index for efficient querying by brand + date range
CREATE INDEX IF NOT EXISTS idx_follower_history_brand_date
    ON public.follower_history(brand_id, recorded_at DESC);

-- RLS
ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage follower history"
    ON public.follower_history FOR ALL
    USING (auth.role() = 'authenticated');
