-- 048_audit_logs.sql
-- Security audit log table for sensitive operations (role changes, token ops, user management, brand deletion)

CREATE TABLE IF NOT EXISTS audit_logs (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    action        text        NOT NULL,
    actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email   text,
    target_type   text,
    target_id     text,
    brand_id      uuid,   -- FK to brands(id) added once that table exists
    before_data   jsonb,
    after_data    jsonb,
    ip_address    inet,
    user_agent    text,
    severity      text        NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Partition index: brand-scoped queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_created  ON audit_logs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created  ON audit_logs (actor_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action         ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity       ON audit_logs (severity) WHERE severity IN ('warning', 'critical');

-- Auto-purge logs older than 90 days (kept lighter than activity_logs)
CREATE OR REPLACE FUNCTION purge_old_audit_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$;

-- RLS ──────────────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins: full read
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'platform_admin_read_audit') THEN
        CREATE POLICY platform_admin_read_audit ON audit_logs
            FOR SELECT USING (
                (auth.jwt() ->> 'app_metadata')::jsonb ->> 'platform_role' IN (
                    'SUPER_ADMIN','PLATFORM_ADMIN','SECURITY_ADMIN','TECHNICAL_ADMIN'
                )
            );
    END IF;
END $$;

-- Authenticated users may insert audit entries for their own actions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'auth_user_insert_own_audit') THEN
        CREATE POLICY auth_user_insert_own_audit ON audit_logs
            FOR INSERT WITH CHECK (actor_id = auth.uid());
    END IF;
END $$;
