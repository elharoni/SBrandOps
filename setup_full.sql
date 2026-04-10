-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Tables (Schema)
create table if not exists public.brands (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  industry text,
  logo_url text,
  user_id uuid references auth.users(id)
);

create table if not exists public.brand_profiles (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  values text[],
  key_selling_points text[],
  tone_description text[],
  voice_keywords text[],
  negative_keywords text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.social_accounts (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  platform text not null,
  username text,
  avatar_url text,
  followers_count integer default 0,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  status text default 'connected',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.content_pieces (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  title text not null,
  type text not null,
  status text default 'ideas',
  generated_content text,
  assignee_id uuid references auth.users(id),
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.scheduled_posts (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  content text,
  media_urls text[],
  platforms text[],
  scheduled_at timestamp with time zone,
  status text default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.marketing_plans (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  name text not null,
  objective text,
  start_date date,
  end_date date,
  budget numeric,
  status text default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS & Policies (Allow Anon Access for Dev)
alter table public.brands enable row level security;
drop policy if exists "Enable access for all users" on public.brands;
create policy "Enable access for all users" on public.brands for all using (true) with check (true);

alter table public.brand_profiles enable row level security;
drop policy if exists "Enable access for all users" on public.brand_profiles;
create policy "Enable access for all users" on public.brand_profiles for all using (true) with check (true);

alter table public.social_accounts enable row level security;
drop policy if exists "Enable access for all users" on public.social_accounts;
create policy "Enable access for all users" on public.social_accounts for all using (true) with check (true);

alter table public.content_pieces enable row level security;
drop policy if exists "Enable access for all users" on public.content_pieces;
create policy "Enable access for all users" on public.content_pieces for all using (true) with check (true);

alter table public.scheduled_posts enable row level security;
drop policy if exists "Enable access for all users" on public.scheduled_posts;
create policy "Enable access for all users" on public.scheduled_posts for all using (true) with check (true);

alter table public.marketing_plans enable row level security;
drop policy if exists "Enable access for all users" on public.marketing_plans;
create policy "Enable access for all users" on public.marketing_plans for all using (true) with check (true);

-- 4. Insert Seed Data
INSERT INTO public.brands (id, name, logo_url, industry)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Confort-Tex', 'https://picsum.photos/seed/brandlogo/100', 'Textiles'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Eco Threads', 'https://picsum.photos/seed/ecothreads/100', 'Fashion')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.brand_profiles (brand_id, values, key_selling_points, tone_description)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ARRAY['Quality', 'Comfort'], ARRAY['Memory Foam', 'Cooling Tech'], ARRAY['Professional', 'Warm'])
ON CONFLICT DO NOTHING;

INSERT INTO public.social_accounts (brand_id, platform, username, status, followers_count)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'facebook', 'ConfortTexSA', 'connected', 45000),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'instagram', 'confort.tex', 'connected', 63000)
ON CONFLICT DO NOTHING;

INSERT INTO public.content_pieces (brand_id, title, type, status, generated_content)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Summer Sale Post', 'Post', 'ideas', 'Great summer deals coming soon!'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'New Product Video', 'Reel', 'drafting', 'Video script for new pillow launch...')
ON CONFLICT DO NOTHING;
