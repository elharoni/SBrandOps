-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Brands Table
create table public.brands (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  industry text,
  logo_url text,
  user_id uuid references auth.users(id)
);

-- Brand Profiles (Settings & Voice)
create table public.brand_profiles (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  values text[],
  key_selling_points text[],
  tone_description text[],
  voice_keywords text[],
  negative_keywords text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Social Accounts
create table public.social_accounts (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  platform text not null, -- 'facebook', 'instagram', 'x', 'linkedin', 'tiktok'
  username text,
  avatar_url text,
  followers_count integer default 0,
  access_token text, -- Encrypted in real app, simplified here
  refresh_token text,
  token_expires_at timestamp with time zone,
  status text default 'connected', -- 'connected', 'expired', 'needs_reauth'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Content Pieces (Content Ops)
create table public.content_pieces (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  title text not null,
  type text not null, -- 'Post', 'Reel', 'Story', 'Article'
  status text default 'ideas', -- 'ideas', 'drafting', 'review', 'approved', 'scheduled', 'published'
  generated_content text,
  assignee_id uuid references auth.users(id),
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Scheduled Posts (Publisher)
create table public.scheduled_posts (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  content text,
  media_urls text[], -- Array of image/video URLs
  platforms text[], -- Array of platforms to publish to
  scheduled_at timestamp with time zone,
  status text default 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Marketing Plans
create table public.marketing_plans (
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

-- =============================================
-- Design Ops Tables
-- =============================================

-- Design Assets (Asset Library)
CREATE TABLE public.design_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    thumbnail_url   TEXT,
    type            TEXT NOT NULL CHECK (type IN ('logo','image','template','video','icon','font')),
    source          TEXT NOT NULL CHECK (source IN ('upload','ai-generated','stock','canva','figma')),
    tags            TEXT[] DEFAULT '{}',
    width           INTEGER,
    height          INTEGER,
    file_size       BIGINT,
    mime_type       TEXT,
    aspect_ratio    TEXT,
    prompt          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Design Workflows (Workflow Templates)
CREATE TABLE public.design_workflows (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    icon             TEXT DEFAULT 'fa-magic',
    category         TEXT NOT NULL,
    formats          JSONB DEFAULT '[]',
    steps            JSONB DEFAULT '[]',
    prompt_template  TEXT,
    use_brand_colors BOOLEAN DEFAULT true,
    use_brand_voice  BOOLEAN DEFAULT true,
    status           TEXT DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
    variants_count   INTEGER DEFAULT 3 CHECK (variants_count IN (1,2,3)),
    usage_count      INTEGER DEFAULT 0,
    last_used_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Design Jobs (Generation History)
CREATE TABLE public.design_jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id          UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    workflow_id       UUID REFERENCES public.design_workflows(id) ON DELETE SET NULL,
    workflow_name     TEXT,
    inputs            JSONB DEFAULT '{}',
    format            JSONB NOT NULL,
    status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','generating','done','error')),
    prompt            TEXT,
    assets            JSONB DEFAULT '[]',
    selected_asset_id UUID,
    error             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS Policies (Security)
-- =============================================
alter table public.brands enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.content_pieces enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.marketing_plans enable row level security;
alter table public.design_assets enable row level security;
alter table public.design_workflows enable row level security;
alter table public.design_jobs enable row level security;

-- Simple policy: Users can see everything for now (Development Mode)
-- In production, you would restrict this to "where user_id = auth.uid()"
create policy "Enable all access for authenticated users" on public.brands for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.brand_profiles for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.social_accounts for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.content_pieces for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.scheduled_posts for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.marketing_plans for all using (auth.role() = 'authenticated');

-- Design Ops RLS — brand ownership check
CREATE POLICY "brand_access" ON public.design_assets
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "brand_access" ON public.design_workflows
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "brand_access" ON public.design_jobs
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
