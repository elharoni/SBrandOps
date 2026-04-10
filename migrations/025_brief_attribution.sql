-- ============================================================
-- SBrandOps — Brief Attribution for Publisher + Analytics
-- ============================================================

alter table if exists public.content_briefs
    add column if not exists watchlist_id uuid references public.competitive_watchlists(id) on delete set null;

alter table if exists public.scheduled_posts
    add column if not exists brief_id uuid references public.content_briefs(id) on delete set null,
    add column if not exists brief_title text,
    add column if not exists watchlist_id uuid references public.competitive_watchlists(id) on delete set null;

create index if not exists idx_content_briefs_watchlist_id on public.content_briefs (watchlist_id);
create index if not exists idx_scheduled_posts_brief_id on public.scheduled_posts (brief_id);
create index if not exists idx_scheduled_posts_watchlist_id on public.scheduled_posts (watchlist_id);
