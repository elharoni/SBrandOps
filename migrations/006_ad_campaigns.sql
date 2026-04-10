-- Migration 006: Ad Campaigns Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null,
    name text not null,
    platform text not null,          -- 'Meta', 'TikTok', 'Google'
    status text default 'Draft',     -- 'Active', 'Paused', 'Completed', 'Draft'
    goal text not null,              -- 'Awareness', 'Traffic', 'Engagement', 'Conversion'
    budget numeric default 0,
    daily_budget numeric,
    spend numeric default 0,
    roas numeric default 0,
    cpa numeric default 0,
    ctr numeric default 0,
    impressions bigint default 0,
    conversions integer default 0,
    start_date timestamptz,
    end_date timestamptz,
    creatives jsonb default '[]',
    recommendation jsonb,
    external_campaign_id text,       -- ID from Meta/TikTok/Google Ads
    created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_brand
    ON public.ad_campaigns(brand_id, created_at DESC);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage ad campaigns"
    ON public.ad_campaigns FOR ALL
    USING (auth.role() = 'authenticated');
