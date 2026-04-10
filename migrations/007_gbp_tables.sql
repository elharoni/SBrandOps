-- Migration 007: Google Business Profile Tables
-- Run this in Supabase SQL Editor

-- GBP Business Info (one per brand)
CREATE TABLE IF NOT EXISTS public.gbp_info (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null unique,
    name text,
    address text,
    phone text,
    website text,
    updated_at timestamptz default now()
);

-- GBP Posts
CREATE TABLE IF NOT EXISTS public.gbp_posts (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null,
    content text not null,
    cta text,           -- 'LearnMore', 'Book', 'Order', 'Shop', 'SignUp', 'CallNow'
    image_url text,
    external_post_id text,  -- Google Business Profile post ID
    created_at timestamptz default now() not null
);

-- GBP Q&A
CREATE TABLE IF NOT EXISTS public.gbp_questions (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null,
    question_text text not null,
    author text,
    answer_text text,
    external_question_id text,
    created_at timestamptz default now() not null
);

-- GBP Reviews
CREATE TABLE IF NOT EXISTS public.gbp_reviews (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade not null,
    author text not null,
    rating integer not null check (rating between 1 and 5),
    comment text,
    reply text,
    external_review_id text,
    created_at timestamptz default now() not null
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gbp_posts_brand ON public.gbp_posts(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_brand ON public.gbp_reviews(brand_id, created_at DESC);

-- RLS
ALTER TABLE public.gbp_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access" ON public.gbp_info FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON public.gbp_posts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON public.gbp_questions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON public.gbp_reviews FOR ALL USING (auth.role() = 'authenticated');
