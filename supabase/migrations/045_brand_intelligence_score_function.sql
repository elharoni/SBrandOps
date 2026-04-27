-- Migration 045: Server-Side Brand Intelligence Score
-- PostgreSQL function + triggers that auto-compute consistency_score

-- ── Core scoring function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_brand_intelligence_score(p_brand_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
    v_score         integer := 0;
    v_profile       record;
    v_knowledge_cnt integer := 0;
    v_social_cnt    integer := 0;
BEGIN
    -- ── Identity (45 pts) ────────────────────────────────────────────────────
    SELECT * INTO v_profile
      FROM public.brand_profiles
     WHERE brand_id = p_brand_id;

    IF FOUND THEN
        -- Brand name (10 pts)
        IF coalesce(length(v_profile.brand_name), 0) > 0 THEN
            v_score := v_score + 10;
        END IF;
        -- Industry (10 pts)
        IF coalesce(length(v_profile.industry), 0) > 0 THEN
            v_score := v_score + 10;
        END IF;
        -- Values array (8 pts)
        IF coalesce(cardinality(v_profile.values), 0) > 0 THEN
            v_score := v_score + 8;
        END IF;
        -- Key selling points (8 pts)
        IF coalesce(cardinality(v_profile.key_selling_points), 0) > 0 THEN
            v_score := v_score + 8;
        END IF;
        -- Extended profile: description (9 pts)
        IF coalesce(length(v_profile.extended_profile->>'description'), 0) > 10 THEN
            v_score := v_score + 9;
        END IF;

        -- ── Voice & Audience (20 pts) ────────────────────────────────────────
        -- Tone description (5 pts)
        IF coalesce(cardinality(v_profile.tone_description), 0) > 0 THEN
            v_score := v_score + 5;
        END IF;
        -- Voice keywords ≥ 3 (5 pts)
        IF coalesce(cardinality(v_profile.voice_keywords), 0) >= 3 THEN
            v_score := v_score + 5;
        END IF;
        -- Brand audiences (10 pts)
        IF coalesce(jsonb_array_length(v_profile.brand_audiences), 0) > 0 THEN
            v_score := v_score + 10;
        END IF;
    END IF;

    -- ── Social connections (15 pts, 5 pts each up to 3) ───────────────────────
    SELECT count(*) INTO v_social_cnt
      FROM public.social_accounts
     WHERE brand_id = p_brand_id
       AND is_active = true;
    v_score := v_score + least(v_social_cnt * 5, 15);

    -- ── Knowledge base (20 pts, 2 pts per entry up to 10 entries) ─────────────
    SELECT count(*) INTO v_knowledge_cnt
      FROM public.brand_knowledge
     WHERE brand_id = p_brand_id
       AND is_active = true;
    v_score := v_score + least(v_knowledge_cnt * 2, 20);

    RETURN least(v_score, 100);
END;
$$;

COMMENT ON FUNCTION public.compute_brand_intelligence_score IS
    'Computes brand intelligence score 0-100 from profile completeness + knowledge count + social connections. Called by triggers automatically.';

-- ── Trigger: recompute on brand_profiles change ───────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_sync_score_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- BEFORE trigger: set NEW.consistency_score before the row is written
    -- Guard: skip if only consistency_score itself changed (prevents recursion)
    IF TG_OP = 'INSERT' OR (
        TG_OP = 'UPDATE' AND (
            OLD.brand_name        IS DISTINCT FROM NEW.brand_name        OR
            OLD.industry          IS DISTINCT FROM NEW.industry          OR
            OLD.values            IS DISTINCT FROM NEW.values            OR
            OLD.key_selling_points IS DISTINCT FROM NEW.key_selling_points OR
            OLD.tone_description  IS DISTINCT FROM NEW.tone_description  OR
            OLD.voice_keywords    IS DISTINCT FROM NEW.voice_keywords    OR
            OLD.brand_audiences   IS DISTINCT FROM NEW.brand_audiences   OR
            OLD.extended_profile  IS DISTINCT FROM NEW.extended_profile
        )
    ) THEN
        NEW.consistency_score := public.compute_brand_intelligence_score(NEW.brand_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_on_profile_change ON public.brand_profiles;
CREATE TRIGGER trg_score_on_profile_change
    BEFORE INSERT OR UPDATE ON public.brand_profiles
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_score_from_profile();

-- ── Trigger: recompute when knowledge entries change ──────────────────────────

CREATE OR REPLACE FUNCTION public.trg_sync_score_from_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_brand_id uuid;
BEGIN
    v_brand_id := coalesce(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.brand_id END,
        OLD.brand_id
    );
    UPDATE public.brand_profiles
       SET consistency_score = public.compute_brand_intelligence_score(v_brand_id)
     WHERE brand_id = v_brand_id;
    RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_score_on_knowledge_change ON public.brand_knowledge;
CREATE TRIGGER trg_score_on_knowledge_change
    AFTER INSERT OR UPDATE OR DELETE ON public.brand_knowledge
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_score_from_knowledge();

-- ── Trigger: recompute when social accounts change ────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_sync_score_from_social()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_brand_id uuid;
BEGIN
    v_brand_id := coalesce(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.brand_id END,
        OLD.brand_id
    );
    UPDATE public.brand_profiles
       SET consistency_score = public.compute_brand_intelligence_score(v_brand_id)
     WHERE brand_id = v_brand_id;
    RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_score_on_social_change ON public.social_accounts;
CREATE TRIGGER trg_score_on_social_change
    AFTER INSERT OR UPDATE OR DELETE ON public.social_accounts
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_score_from_social();
