-- Migration 011: Team Members & API Keys
-- ══════════════════════════════════════════════

-- Team members (brand-level users)
CREATE TABLE IF NOT EXISTS public.team_members (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_email text NOT NULL,
    name          text,
    role          text NOT NULL DEFAULT 'viewer',
    -- role: 'owner' | 'admin' | 'editor' | 'viewer'
    status        text NOT NULL DEFAULT 'pending',
    -- status: 'active' | 'pending' | 'suspended'
    avatar_url    text,
    last_active_at timestamptz,
    invited_at    timestamptz NOT NULL DEFAULT now(),
    accepted_at   timestamptz,
    UNIQUE(brand_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_brand_id ON public.team_members(brand_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id  ON public.team_members(user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners manage team members"
    ON public.team_members FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- API Keys (hashed, never stored plain)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        text NOT NULL,
    key_prefix  text NOT NULL,   -- e.g. "sbrapi_1a2b"
    key_hash    text NOT NULL,   -- sha256 of the full key
    last_used_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_brand_id ON public.api_keys(brand_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners manage api keys"
    ON public.api_keys FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
