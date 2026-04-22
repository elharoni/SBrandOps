-- ═══════════════════════════════════════════════════════════════════
-- Migration 037: Tenant Custom Overrides & Notes
-- ═══════════════════════════════════════════════════════════════════
-- Adds per-tenant override columns so an admin can set custom limits
-- for a specific tenant without changing its subscription plan.
-- ═══════════════════════════════════════════════════════════════════

-- ── Add override columns ─────────────────────────────────────────────────────

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS override_brand_limit  integer,
    ADD COLUMN IF NOT EXISTS override_user_limit   integer,
    ADD COLUMN IF NOT EXISTS override_ai_tokens    bigint,
    ADD COLUMN IF NOT EXISTS notes                 text;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.tenants.override_brand_limit IS
    'Custom brand limit for this tenant. Overrides subscription_plans.max_brands when set.';

COMMENT ON COLUMN public.tenants.override_user_limit IS
    'Custom user limit for this tenant. Overrides subscription_plans.max_users when set.';

COMMENT ON COLUMN public.tenants.override_ai_tokens IS
    'Custom monthly AI token limit for this tenant. Overrides subscription_plans.ai_tokens_monthly when set.';

COMMENT ON COLUMN public.tenants.notes IS
    'Internal admin notes — not visible to the tenant.';

-- ═══════════════════════════════════════════════════════════════════
-- Done! Custom limits are now available in the admin ManageDrawer.
-- ═══════════════════════════════════════════════════════════════════
