-- Allow anonymous access (since we haven't implemented login yet)

-- Brands
drop policy if exists "Enable all access for authenticated users" on public.brands;
create policy "Enable all access for anon" on public.brands for all using (true);

-- Brand Profiles
drop policy if exists "Enable all access for authenticated users" on public.brand_profiles;
create policy "Enable all access for anon" on public.brand_profiles for all using (true);

-- Social Accounts
drop policy if exists "Enable all access for authenticated users" on public.social_accounts;
create policy "Enable all access for anon" on public.social_accounts for all using (true);

-- Content Pieces
drop policy if exists "Enable all access for authenticated users" on public.content_pieces;
create policy "Enable all access for anon" on public.content_pieces for all using (true);

-- Scheduled Posts
drop policy if exists "Enable all access for authenticated users" on public.scheduled_posts;
create policy "Enable all access for anon" on public.scheduled_posts for all using (true);

-- Marketing Plans
drop policy if exists "Enable all access for authenticated users" on public.marketing_plans;
create policy "Enable all access for anon" on public.marketing_plans for all using (true);
