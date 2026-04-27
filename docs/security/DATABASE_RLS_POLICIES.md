# SBrandOps — Complete Database RLS Policies

> Version: 2.0.0 | Last Updated: 2026-04-26
> All policies assume the new schema with `workspaces` and `workspace_members` tables.
> Run after the base tables exist. Test each policy in isolation before production deploy.

---

## Core Helper Functions

These functions are used by every RLS policy. Create them first.

```sql
-- ============================================================
-- HELPER 1: Get all workspace IDs the current user belongs to
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- ============================================================
-- HELPER 2: Get all brand IDs accessible to current user
-- Respects brand_ids scoping on workspace_members
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_brand_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT b.id
  FROM brands b
  JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
  WHERE wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND (
      wm.brand_ids = '{}'::uuid[]    -- empty = access all brands
      OR b.id = ANY(wm.brand_ids)    -- or in explicit brand list
    );
$$;

-- ============================================================
-- HELPER 3: Check if user has a specific permission key
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission(
  p_workspace_id UUID,
  p_permission_key TEXT
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN roles r ON r.name = wm.role
      AND (r.workspace_id = p_workspace_id OR r.is_system = true)
    JOIN role_permissions rp ON rp.role_id = r.id
      AND rp.permission_key = p_permission_key
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      -- Check that permission is not revoked by an override
      AND NOT EXISTS (
        SELECT 1 FROM permission_overrides po
        WHERE po.workspace_member_id = wm.id
          AND po.permission_key = p_permission_key
          AND po.granted = false
          AND (po.expires_at IS NULL OR po.expires_at > now())
      )
    UNION
    -- Check if permission is explicitly granted via override
    SELECT 1
    FROM workspace_members wm2
    JOIN permission_overrides po ON po.workspace_member_id = wm2.id
      AND po.permission_key = p_permission_key
      AND po.granted = true
      AND (po.expires_at IS NULL OR po.expires_at > now())
    WHERE wm2.user_id = auth.uid()
      AND wm2.workspace_id = p_workspace_id
      AND wm2.status = 'active'
  );
$$;

-- ============================================================
-- HELPER 4: Check if user is a platform admin (any platform role)
-- ============================================================
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'platform_role') IS NOT NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'platform_role') != '';
$$;

-- ============================================================
-- HELPER 5: Check if user is super admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'SUPER_ADMIN';
$$;

-- ============================================================
-- HELPER 6: Get current user's role in a workspace
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_workspace_role(p_workspace_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM workspace_members
  WHERE user_id = auth.uid()
    AND workspace_id = p_workspace_id
    AND status = 'active'
  LIMIT 1;
$$;

-- ============================================================
-- HELPER 7: Check if user owns or is assigned to a record
-- ============================================================
CREATE OR REPLACE FUNCTION is_owner_or_assigned(
  p_created_by UUID,
  p_assigned_to UUID
) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT auth.uid() = p_created_by OR auth.uid() = p_assigned_to;
$$;
```

---

## Workspaces Table

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Members can see their own workspace(s)
CREATE POLICY "workspaces_member_select" ON workspaces
  FOR SELECT USING (
    id IN (SELECT get_user_workspace_ids())
    OR is_platform_admin()
  );

-- Only ACCOUNT_OWNER can update workspace
CREATE POLICY "workspaces_owner_update" ON workspaces
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR is_super_admin()
  );

-- Any authenticated user can create a workspace (subject to plan limits in app layer)
CREATE POLICY "workspaces_authenticated_insert" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only ACCOUNT_OWNER or super admin can delete (soft-delete via status field)
CREATE POLICY "workspaces_owner_delete" ON workspaces
  FOR DELETE USING (
    owner_id = auth.uid()
    OR is_super_admin()
  );
```

---

## Workspace Members Table

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Members can see all members in their workspace
CREATE POLICY "workspace_members_same_workspace_select" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    OR is_platform_admin()
  );

-- Only ACCOUNT_OWNER and WORKSPACE_ADMIN can insert (invite)
CREATE POLICY "workspace_members_admin_insert" ON workspace_members
  FOR INSERT WITH CHECK (
    user_has_permission(workspace_id, 'workspace.team.invite.own')
    OR is_super_admin()
  );

-- ACCOUNT_OWNER and WORKSPACE_ADMIN can update; user can update own record (status, last_active)
CREATE POLICY "workspace_members_update" ON workspace_members
  FOR UPDATE USING (
    -- User updates their own record (last_active, notification prefs)
    user_id = auth.uid()
    -- Admins update others
    OR user_has_permission(workspace_id, 'workspace.team.update_role.own')
    OR is_super_admin()
  );

-- Only ACCOUNT_OWNER and WORKSPACE_ADMIN can remove members
CREATE POLICY "workspace_members_admin_delete" ON workspace_members
  FOR DELETE USING (
    user_has_permission(workspace_id, 'workspace.team.remove.own')
    OR is_super_admin()
  );
```

---

## Brands Table

```sql
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Users can only see brands in their workspaces (respecting brand_ids scoping)
CREATE POLICY "brands_workspace_member_select" ON brands
  FOR SELECT USING (
    id IN (SELECT get_user_brand_ids())
    OR is_platform_admin()
  );

-- Only ACCOUNT_OWNER and WORKSPACE_ADMIN can create brands
CREATE POLICY "brands_admin_insert" ON brands
  FOR INSERT WITH CHECK (
    user_has_permission(workspace_id, 'brand.create.workspace')
    OR is_super_admin()
  );

-- ACCOUNT_OWNER, WORKSPACE_ADMIN, BRAND_MANAGER (assigned) can update
CREATE POLICY "brands_update" ON brands
  FOR UPDATE USING (
    (id IN (SELECT get_user_brand_ids())
     AND user_has_permission(workspace_id, 'brand.update.assigned'))
    OR user_has_permission(workspace_id, 'brand.update.workspace')
    OR is_super_admin()
  );

-- Only ACCOUNT_OWNER (or super admin) can delete — soft delete via archived_at
CREATE POLICY "brands_owner_delete" ON brands
  FOR DELETE USING (
    user_has_permission(workspace_id, 'brand.delete.workspace')
    OR is_super_admin()
  );
```

---

## Brand Profiles Table

```sql
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_profiles_member_select" ON brand_profiles
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "brand_profiles_update" ON brand_profiles
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'brand.identity.update.assigned'
    )
  );

CREATE POLICY "brand_profiles_insert" ON brand_profiles
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
  );
```

---

## Content Pieces Table

```sql
ALTER TABLE content_pieces ENABLE ROW LEVEL SECURITY;

-- All brand members can view content
CREATE POLICY "content_view" ON content_pieces
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
  );

-- Members with create permission can insert
CREATE POLICY "content_insert" ON content_pieces
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'content.create.brand'
    )
  );

-- Update: brand-wide or own only
CREATE POLICY "content_update" ON content_pieces
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      -- Brand-wide update permission
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'content.update.brand'
      )
      -- Or own-only update (requires ABAC state check in app layer)
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'content.update.own'
        )
      )
    )
  );

-- Delete: brand-wide or own only
CREATE POLICY "content_delete" ON content_pieces
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'content.delete.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'content.delete.own'
        )
      )
    )
  );
```

---

## Design Assets Table

```sql
ALTER TABLE design_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_assets_select" ON design_assets
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "design_assets_insert" ON design_assets
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'design.create_brief.brand'
    )
  );

CREATE POLICY "design_assets_update" ON design_assets
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'design.update_brief.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'design.update_brief.own'
        )
      )
    )
  );

CREATE POLICY "design_assets_delete" ON design_assets
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'design.delete_brief.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'design.delete_brief.own'
        )
      )
    )
  );
```

---

## OAuth Tokens Table

```sql
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Token VALUES are never exposed via RLS.
-- Only status/metadata is readable. The actual token columns
-- (access_token, refresh_token) are only read by Edge Functions
-- using the service-role key — never by the authenticated anon key.

-- Users can see token STATUS (not values) for their brands
CREATE POLICY "oauth_tokens_status_select" ON oauth_tokens
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    -- IMPORTANT: Application layer must strip access_token and refresh_token
    -- from responses. Add a VIEW or use column-level security below.
  );

-- Only service role (Edge Functions) can insert/update/delete tokens
-- By NOT creating insert/update/delete policies, we block all client writes.
-- Edge Functions use service_role key which bypasses RLS.

-- Column-level security: prevent reading raw token values
-- (Supabase does not support column-level RLS natively,
--  so enforce this via a view or in the Edge Function response filter)
COMMENT ON COLUMN oauth_tokens.access_token IS 'NEVER expose to frontend. Edge Function only.';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'NEVER expose to frontend. Edge Function only.';
COMMENT ON COLUMN oauth_tokens.token_secret IS 'NEVER expose to frontend. Edge Function only.';
```

---

## Social Accounts Table

```sql
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_select" ON social_accounts
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'social.accounts.view.brand'
    )
  );

CREATE POLICY "social_accounts_insert" ON social_accounts
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'social.accounts.connect.brand'
    )
  );

CREATE POLICY "social_accounts_update" ON social_accounts
  FOR UPDATE USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "social_accounts_delete" ON social_accounts
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'social.accounts.disconnect.brand'
    )
  );
```

---

## Scheduled Posts Table

```sql
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_posts_select" ON scheduled_posts
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "scheduled_posts_insert" ON scheduled_posts
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'social.posts.schedule.brand'
    )
  );

CREATE POLICY "scheduled_posts_delete" ON scheduled_posts
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'social.posts.delete_scheduled.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'social.posts.delete_scheduled.own'
        )
      )
    )
  );
```

---

## Analytics Snapshots Table

```sql
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_snapshots_select" ON analytics_snapshots
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'analytics.dashboard.view.brand'
    )
  );

-- Only service role (sync functions) can write analytics data
-- No insert/update policies = client cannot write, only service_role key can
```

---

## Inbox Conversations Table

```sql
ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_conversations_select" ON inbox_conversations
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      -- Full inbox access
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'inbox.conversations.view.brand'
      )
      -- Or assigned-only access
      OR (
        assigned_to = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'inbox.conversations.view.assigned'
        )
      )
    )
  );

CREATE POLICY "inbox_conversations_update" ON inbox_conversations
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'inbox.conversations.status_change.brand'
      )
      OR (
        assigned_to = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'inbox.conversations.status_change.assigned'
        )
      )
    )
  );
```

---

## Inbox Messages Table

```sql
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_messages_select" ON inbox_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM inbox_conversations
      WHERE brand_id IN (SELECT get_user_brand_ids())
        AND (
          user_has_permission(
            (SELECT workspace_id FROM brands WHERE id = brand_id),
            'inbox.messages.view.brand'
          )
          OR (
            assigned_to = auth.uid()
            AND user_has_permission(
              (SELECT workspace_id FROM brands WHERE id = brand_id),
              'inbox.messages.view.assigned'
            )
          )
        )
    )
  );

CREATE POLICY "inbox_messages_insert" ON inbox_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT ic.id FROM inbox_conversations ic
      WHERE ic.brand_id IN (SELECT get_user_brand_ids())
        AND (
          user_has_permission(
            (SELECT workspace_id FROM brands b WHERE b.id = ic.brand_id),
            'inbox.messages.reply.brand'
          )
          OR (
            ic.assigned_to = auth.uid()
            AND user_has_permission(
              (SELECT workspace_id FROM brands b WHERE b.id = ic.brand_id),
              'inbox.messages.reply.assigned'
            )
          )
        )
    )
  );
```

---

## CRM Customers Table

```sql
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_customers_select" ON crm_customers
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'crm.customers.view.brand'
    )
  );

CREATE POLICY "crm_customers_insert" ON crm_customers
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'crm.customers.create.brand'
    )
  );

CREATE POLICY "crm_customers_update" ON crm_customers
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'crm.customers.update.brand'
      )
      OR (
        assigned_to = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'crm.customers.update.assigned'
        )
      )
    )
  );

-- Hard delete requires service-role; soft delete (deleted_at) via UPDATE policy
CREATE POLICY "crm_customers_delete" ON crm_customers
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'crm.customers.delete.brand'
    )
    -- ABAC: also requires approval_request record in app layer
  );
```

---

## CRM Orders Table

```sql
ALTER TABLE crm_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_orders_select" ON crm_orders
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'crm.orders.view.brand'
    )
  );

CREATE POLICY "crm_orders_insert" ON crm_orders
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'crm.orders.create.brand'
    )
  );

CREATE POLICY "crm_orders_update" ON crm_orders
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'crm.orders.update.brand'
      )
      OR (
        assigned_to = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'crm.orders.update.assigned'
        )
      )
    )
  );
```

---

## CRM Tasks / Workflow Tasks Table

```sql
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_tasks_select" ON crm_tasks
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      -- Full brand task view
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'workflow.tasks.view.brand'
      )
      -- Assigned tasks only
      OR (
        assigned_to = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'workflow.tasks.view.assigned'
        )
      )
      -- Own tasks only
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'workflow.tasks.view.own'
        )
      )
    )
  );

CREATE POLICY "crm_tasks_insert" ON crm_tasks
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'workflow.tasks.create.brand'
      )
      OR user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'workflow.tasks.create.own'
      )
    )
  );

CREATE POLICY "crm_tasks_update" ON crm_tasks
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'workflow.tasks.update.brand'
      )
      OR (assigned_to = auth.uid())
      OR (created_by = auth.uid())
    )
  );

CREATE POLICY "crm_tasks_delete" ON crm_tasks
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'workflow.tasks.delete.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'workflow.tasks.delete.own'
        )
        AND status IN ('draft', 'open')  -- ABAC state check in DB
      )
    )
  );
```

---

## Campaign Brain Briefs Table

```sql
ALTER TABLE campaign_brain_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_brain_briefs_select" ON campaign_brain_briefs
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "campaign_brain_briefs_insert" ON campaign_brain_briefs
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'campaign_brain.briefs.create.brand'
    )
  );

CREATE POLICY "campaign_brain_briefs_update" ON campaign_brain_briefs
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'campaign_brain.briefs.update.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'campaign_brain.briefs.update.own'
        )
      )
    )
  );

CREATE POLICY "campaign_brain_briefs_delete" ON campaign_brain_briefs
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'campaign_brain.briefs.delete.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'campaign_brain.briefs.delete.own'
        )
      )
    )
  );
```

---

## Media Assets Table

```sql
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_select" ON media_assets
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY "media_assets_insert" ON media_assets
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'media.assets.upload.brand'
    )
  );

CREATE POLICY "media_assets_update" ON media_assets
  FOR UPDATE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'media.assets.update.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'media.assets.update.own'
        )
      )
    )
  );

CREATE POLICY "media_assets_delete" ON media_assets
  FOR DELETE USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND (
      user_has_permission(
        (SELECT workspace_id FROM brands WHERE id = brand_id),
        'media.assets.delete.brand'
      )
      OR (
        created_by = auth.uid()
        AND user_has_permission(
          (SELECT workspace_id FROM brands WHERE id = brand_id),
          'media.assets.delete.own'
        )
      )
    )
  );
```

---

## Support Chat & Smart Bot Tables

```sql
ALTER TABLE support_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bot_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bot_executions ENABLE ROW LEVEL SECURITY;

-- Support chat: only workspace members of the relevant brand
CREATE POLICY "support_chat_brand_access" ON support_chat_conversations
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

-- Smart bot: only BRAND_MANAGER+ can view/manage
CREATE POLICY "smart_bot_workflows_select" ON smart_bot_workflows
  FOR SELECT USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'automation.view.brand'
    )
  );

CREATE POLICY "smart_bot_workflows_write" ON smart_bot_workflows
  FOR ALL USING (
    brand_id IN (SELECT get_user_brand_ids())
    AND user_has_permission(
      (SELECT workspace_id FROM brands WHERE id = brand_id),
      'automation.create.brand'
    )
  );
```

---

## Roles & Role Permissions Tables

```sql
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- All workspace members can read roles (to understand team structure)
CREATE POLICY "roles_member_select" ON roles
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    OR workspace_id IS NULL   -- system roles visible to all authenticated users
    OR is_platform_admin()
  );

-- Only ACCOUNT_OWNER (or WA with permission) can manage custom roles
CREATE POLICY "roles_admin_write" ON roles
  FOR ALL USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND user_has_permission(workspace_id, 'workspace.roles.create.own')
    AND is_system = false   -- system roles are immutable
  );

-- Role permissions follow the same rules
CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND (r.workspace_id IN (SELECT get_user_workspace_ids()) OR r.workspace_id IS NULL)
    )
  );

CREATE POLICY "role_permissions_write" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND r.workspace_id IN (SELECT get_user_workspace_ids())
        AND r.is_system = false
        AND user_has_permission(r.workspace_id, 'workspace.roles.update.own')
    )
  );
```

---

## Permission Overrides Table

```sql
ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;

-- Workspace admins can see overrides for their workspace
CREATE POLICY "permission_overrides_select" ON permission_overrides
  FOR SELECT USING (
    workspace_member_id IN (
      SELECT wm.id FROM workspace_members wm
      WHERE wm.workspace_id IN (SELECT get_user_workspace_ids())
        AND user_has_permission(wm.workspace_id, 'workspace.team.view.own')
    )
    -- Also allow user to see their own overrides
    OR workspace_member_id IN (
      SELECT id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only ACCOUNT_OWNER or WORKSPACE_ADMIN can create overrides
CREATE POLICY "permission_overrides_insert" ON permission_overrides
  FOR INSERT WITH CHECK (
    workspace_member_id IN (
      SELECT wm.id FROM workspace_members wm
      WHERE wm.workspace_id IN (SELECT get_user_workspace_ids())
        AND user_has_permission(wm.workspace_id, 'workspace.team.update_permissions.own')
    )
  );
```

---

## Plans & Subscriptions Tables

```sql
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans are readable by all authenticated users (needed for upgrade prompts)
CREATE POLICY "plans_public_select" ON plans
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Plan features readable by all (needed for feature gating)
CREATE POLICY "plan_features_public_select" ON plan_features
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Platform admins can write plans
CREATE POLICY "plans_admin_write" ON plans
  FOR ALL USING (is_platform_admin());

-- Subscriptions: only workspace members can see their own
CREATE POLICY "subscriptions_workspace_select" ON subscriptions
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    OR is_platform_admin()
  );

-- Only service_role (billing webhooks) or platform admins can write
CREATE POLICY "subscriptions_admin_write" ON subscriptions
  FOR ALL USING (is_platform_admin());
```

---

## Audit Logs Table

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ACCOUNT_OWNER and WORKSPACE_ADMIN can view their workspace's logs (Business+ plan only enforced at app layer)
CREATE POLICY "audit_logs_workspace_select" ON audit_logs
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND user_has_permission(workspace_id, 'workspace.audit_logs.view.own')
    OR is_platform_admin()
  );

-- ONLY service_role can insert (all writes go through Edge Functions)
-- No INSERT policy for authenticated users = audit logs are immutable from client side

-- NEVER allow UPDATE or DELETE on audit_logs
-- (no policies = no access for anon/authenticated keys)
```

---

## Approval Requests Table

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID REFERENCES brands(id),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  resource_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  approver_id UUID REFERENCES auth.users(id),
  approver_note TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see own requests; approvers can see pending requests in their workspace
CREATE POLICY "approval_requests_select" ON approval_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR (
      workspace_id IN (SELECT get_user_workspace_ids())
      AND user_has_permission(workspace_id, 'approval_requests.view.brand')
    )
  );

CREATE POLICY "approval_requests_insert" ON approval_requests
  FOR INSERT WITH CHECK (
    requester_id = auth.uid()
    AND workspace_id IN (SELECT get_user_workspace_ids())
  );

-- Only designated approvers can update status
CREATE POLICY "approval_requests_update" ON approval_requests
  FOR UPDATE USING (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND user_has_permission(workspace_id, 'approval_requests.approve.brand')
  );
```

---

## Support Access Grants Table

```sql
CREATE TABLE IF NOT EXISTS support_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  granted_to UUID NOT NULL REFERENCES auth.users(id),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  ticket_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read_only',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE support_access_grants ENABLE ROW LEVEL SECURITY;

-- Only platform admins and the granted support agent can see grants
CREATE POLICY "support_grants_select" ON support_access_grants
  FOR SELECT USING (
    granted_to = auth.uid()
    OR is_platform_admin()
  );

-- Only platform admins can create/revoke grants
CREATE POLICY "support_grants_write" ON support_access_grants
  FOR ALL USING (is_platform_admin());
```

---

## Performance Indexes for RLS Queries

```sql
-- Critical for get_user_workspace_ids() and get_user_brand_ids()
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_status
  ON workspace_members(user_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user
  ON workspace_members(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_brands_workspace_id
  ON brands(workspace_id);

-- For assigned-to queries (inbox, tasks, CRM)
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned_to
  ON inbox_conversations(assigned_to);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to
  ON crm_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_created_by
  ON crm_tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_crm_customers_assigned_to
  ON crm_customers(assigned_to);

-- For content ownership
CREATE INDEX IF NOT EXISTS idx_content_pieces_created_by
  ON content_pieces(created_by);

-- For audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created
  ON audit_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs(actor_id, created_at DESC);

-- For permission checks
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_key
  ON role_permissions(role_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_member_key
  ON permission_overrides(workspace_member_id, permission_key)
  WHERE expires_at IS NULL OR expires_at > now();
```
