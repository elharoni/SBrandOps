-- Enable UUID extension (just in case)
create extension if not exists "uuid-ossp";

-- 1. Clean up existing data (optional, be careful)
-- truncate table public.brands cascade;

-- 2. Insert a Brand
INSERT INTO public.brands (id, name, logo_url, industry)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Confort-Tex', 'https://picsum.photos/seed/brandlogo/100', 'Textiles'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Eco Threads', 'https://picsum.photos/seed/ecothreads/100', 'Fashion');

-- 3. Insert Brand Profile (Voice & Settings)
INSERT INTO public.brand_profiles (brand_id, values, key_selling_points, tone_description)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ARRAY['Quality', 'Comfort'], ARRAY['Memory Foam', 'Cooling Tech'], ARRAY['Professional', 'Warm']);

-- 4. Insert Social Accounts
INSERT INTO public.social_accounts (brand_id, platform, username, status, followers_count)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'facebook', 'ConfortTexSA', 'connected', 45000),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'instagram', 'confort.tex', 'connected', 63000);

-- 5. Insert Content Pieces
INSERT INTO public.content_pieces (brand_id, title, type, status, generated_content)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Summer Sale Post', 'Post', 'ideas', 'Great summer deals coming soon!'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'New Product Video', 'Reel', 'drafting', 'Video script for new pillow launch...');

-- 6. Fix RLS (Ensure Anon access is allowed for now)
alter table public.brands enable row level security;
create policy "Enable access for all users" on public.brands for all using (true) with check (true);

alter table public.brand_profiles enable row level security;
create policy "Enable access for all users" on public.brand_profiles for all using (true) with check (true);

alter table public.social_accounts enable row level security;
create policy "Enable access for all users" on public.social_accounts for all using (true) with check (true);

alter table public.content_pieces enable row level security;
create policy "Enable access for all users" on public.content_pieces for all using (true) with check (true);
