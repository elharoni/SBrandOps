-- Migration 054: Brand Agent System
-- ═══════════════════════════════════════════════════════════════════════════════
-- جداول وكيل البراند الذكي
-- brand_agent_configs  — إعدادات الوكيل لكل براند (لهجة، ردود تلقائية، شيفتات)
-- brand_agent_logs     — سجل كل رد أو إجراء قام به الوكيل (إحصائيات + تتبع)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. brand_agent_configs ────────────────────────────────────────────────────
-- سجل واحد لكل براند — يُحدَّث عبر UPSERT بـ brand_id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_agent_configs (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- ── Reply mode ──────────────────────────────────────────────────────────
    auto_reply_comments     boolean     NOT NULL DEFAULT true,
    -- تلقائي للتعليقات (Facebook / Instagram / إعلانات)
    auto_reply_dms          boolean     NOT NULL DEFAULT false,
    -- تلقائي للرسائل الخاصة (DM) — مُوصى بـ false للحساسية
    auto_reply_suggested    boolean     NOT NULL DEFAULT true,
    -- اقتراح فقط (حتى في التلقائي يظهر في لوحة الوكيل)

    -- ── Shift mode ──────────────────────────────────────────────────────────
    shift_mode              text        NOT NULL DEFAULT 'bot',
    -- 'bot' = الوكيل نشط | 'human' = المودريتور أخذ الشيفت → الوكيل مساعد فقط
    shift_started_at        timestamptz,
    shift_moderator_name    text,

    -- ── Voice & dialect ─────────────────────────────────────────────────────
    dialect                 text        NOT NULL DEFAULT 'modern_standard',
    -- gulf | egyptian | levantine | modern_standard | english | bilingual
    custom_dialect_note     text,
    -- ملاحظة مخصصة يضيفها المستخدم عن أسلوب البوت
    active_persona_id       uuid,
    -- ربط بشخصية SmartBot محددة (اختياري)

    -- ── Escalation keywords ─────────────────────────────────────────────────
    escalation_keywords     text[]      NOT NULL DEFAULT '{}',
    -- إذا وجدت أي كلمة → يوقف التلقائي ويصعّد

    -- ── Working hours ────────────────────────────────────────────────────────
    working_hours_enabled   boolean     NOT NULL DEFAULT false,
    working_hours_start     smallint    NOT NULL DEFAULT 9  CHECK (working_hours_start BETWEEN 0 AND 23),
    working_hours_end       smallint    NOT NULL DEFAULT 23 CHECK (working_hours_end   BETWEEN 0 AND 23),
    working_hours_timezone  text        NOT NULL DEFAULT 'Asia/Riyadh',

    -- ── Timestamps ──────────────────────────────────────────────────────────
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    -- ── Constraints ─────────────────────────────────────────────────────────
    CONSTRAINT brand_agent_configs_brand_id_unique UNIQUE (brand_id),
    CONSTRAINT brand_agent_configs_shift_mode_chk
        CHECK (shift_mode IN ('bot', 'human')),
    CONSTRAINT brand_agent_configs_dialect_chk
        CHECK (dialect IN ('gulf', 'egyptian', 'levantine', 'modern_standard', 'english', 'bilingual'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_agent_configs_brand
    ON public.brand_agent_configs(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_agent_configs_shift
    ON public.brand_agent_configs(shift_mode)
    WHERE shift_mode = 'human';
-- useful for: "كم من البراندات في وضع الشيفت الآن؟"

-- updated_at trigger (only if set_updated_at function exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'set_updated_at'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_brand_agent_configs_updated_at'
    ) THEN
        CREATE TRIGGER set_brand_agent_configs_updated_at
            BEFORE UPDATE ON public.brand_agent_configs
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- RLS
ALTER TABLE public.brand_agent_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN
        CREATE POLICY "Users manage own brand agent configs"
            ON public.brand_agent_configs FOR ALL
            USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
            WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ── 2. brand_agent_logs ───────────────────────────────────────────────────────
-- سجل لكل إجراء قام به الوكيل:
--   auto_replied  → أرسل رداً تلقائياً
--   suggested     → عرض اقتراحاً (المستخدم يختار)
--   escalated     → صعّد للإنسان
--   skipped       → لم يتصرف (ساعات عمل / shift / بدون جلسة)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_agent_logs (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    conversation_id     uuid,
    -- nullable: قد يُسجَّل قبل ربط المحادثة / أو محادثة social_messages
    social_thread_id    text,
    -- للمحادثات من social_messages (تبدأ بـ sm::)

    -- ── Action ──────────────────────────────────────────────────────────────
    action              text        NOT NULL,
    -- auto_replied | suggested | escalated | skipped
    decision            text        NOT NULL DEFAULT 'suggest_only',
    -- القرار الذي اتخذه الـ engine: auto_send | suggest_only | escalate

    -- ── Payload ─────────────────────────────────────────────────────────────
    reply_text          text,
    -- الرد الذي أُرسل / اقتُرح (nullable للإجراءات غير النصية)
    reply_style         text,
    -- warm | direct | sales | null
    confidence          smallint,
    -- 0–100 من الـ AI

    -- ── Context snapshot ────────────────────────────────────────────────────
    item_type           text,
    -- dm | facebook_comment | instagram_comment | ad_comment | ...
    platform            text,
    -- Facebook | Instagram | X | ...
    shift_mode          text        NOT NULL DEFAULT 'bot',
    -- snapshot: كان في وضع bot أم human عند التسجيل؟
    dialect_used        text,
    -- اللهجة المستخدمة عند التوليد

    -- ── Extra metadata ───────────────────────────────────────────────────────
    metadata            jsonb       NOT NULL DEFAULT '{}',
    -- أي بيانات إضافية (escalation_keyword, crm_action, ...)

    created_at          timestamptz NOT NULL DEFAULT now(),

    -- ── Constraints ─────────────────────────────────────────────────────────
    CONSTRAINT brand_agent_logs_action_chk
        CHECK (action IN ('auto_replied', 'suggested', 'escalated', 'skipped')),
    CONSTRAINT brand_agent_logs_decision_chk
        CHECK (decision IN ('auto_send', 'suggest_only', 'escalate')),
    CONSTRAINT brand_agent_logs_confidence_chk
        CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_agent_logs_brand
    ON public.brand_agent_logs(brand_id, created_at DESC);
-- الأكثر استخداماً: getBrandAgentStats يفلتر بـ brand_id + created_at

CREATE INDEX IF NOT EXISTS idx_brand_agent_logs_conv
    ON public.brand_agent_logs(conversation_id)
    WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_agent_logs_action
    ON public.brand_agent_logs(brand_id, action);
-- لحساب: كم auto_replied vs suggested vs escalated


-- RLS
ALTER TABLE public.brand_agent_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN
        CREATE POLICY "Users view own brand agent logs"
            ON public.brand_agent_logs FOR SELECT
            USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY "Service role insert brand agent logs"
            ON public.brand_agent_logs FOR INSERT
            WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ── 3. Seed default configs for all existing brands ───────────────────────────
-- يُنشئ إعداداً افتراضياً لكل براند موجود — يتجاهل إذا موجود مسبقاً
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.brand_agent_configs (brand_id, escalation_keywords)
SELECT
    b.id,
    ARRAY['مشرف','مدير','شكوى','مشكلة','استرداد','supervisor','manager','complaint','refund']
FROM public.brands b
WHERE NOT EXISTS (
    SELECT 1 FROM public.brand_agent_configs c WHERE c.brand_id = b.id
);

-- ── 4. Realtime: enable for brand_agent_logs (for live stats) ─────────────────

DO $$
BEGIN
    BEGIN
        -- Only runs if supabase_realtime publication exists
        ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_agent_logs;
    EXCEPTION WHEN OTHERS THEN
        -- Handles: publication not found OR table already in publication
        NULL;
    END;
END $$;

-- ── 5. Helper view: agent_stats_30d ──────────────────────────────────────────
-- View مريح لاستعلامات الإحصائيات — يستبدل aggregate queries متكررة

CREATE OR REPLACE VIEW public.brand_agent_stats_30d AS
SELECT
    brand_id,
    COUNT(*) FILTER (WHERE action IN ('auto_replied', 'suggested'))   AS total_replies,
    COUNT(*) FILTER (WHERE action = 'auto_replied')                   AS auto_replies,
    COUNT(*) FILTER (WHERE action = 'suggested')                      AS suggested_replies,
    COUNT(*) FILTER (WHERE action = 'escalated')                      AS escalations,
    COUNT(*) FILTER (WHERE action = 'skipped')                        AS skipped,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)                AS today_replies,
    MAX(created_at)                                                    AS last_activity_at
FROM public.brand_agent_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY brand_id;

COMMENT ON VIEW public.brand_agent_stats_30d IS
    'ملخص إحصائيات وكيل البراند — آخر 30 يوم — يُستخدم في BrandAgentPage';

-- ── Done ──────────────────────────────────────────────────────────────────────
-- للتطبيق:
--   supabase db push  (إذا Supabase CLI)
--   أو ارفع الملف يدوياً في Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
