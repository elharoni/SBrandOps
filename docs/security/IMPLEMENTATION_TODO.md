# SBrandOps — Permissions Implementation Checklist

> Version: 1.0.0 | Last Updated: 2026-04-26
> Priority: P0 = critical/blocking, P1 = high, P2 = medium, P3 = nice-to-have

---

## PHASE 1 — Critical Permissions & Route Guards
**Goal:** Stop unauthenticated/unauthorized access to sensitive pages and APIs.
**Timeline:** Week 1–2

### 1.1 Database — Core Permission Tables

- [ ] **[P0]** Create `workspaces` table (currently missing — brands link directly to users)
  ```sql
  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    slug TEXT UNIQUE NOT NULL,
    plan_id UUID REFERENCES plans(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P0]** Create `workspace_members` table (replaces/extends `team_members`)
  ```sql
  CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    invited_email TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','suspended')),
    invited_by UUID REFERENCES auth.users(id),
    brand_ids UUID[] DEFAULT '{}',
    custom_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT workspace_members_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
  );
  ```

- [ ] **[P0]** Create `roles` table
  ```sql
  CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('platform','workspace','operational')),
    is_system BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P0]** Create `role_permissions` table
  ```sql
  CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_key)
  );
  ```

- [ ] **[P1]** Create `permission_overrides` table (per-user overrides on top of role)
  ```sql
  CREATE TABLE permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P0]** Create `plans` table
  ```sql
  CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    price_monthly NUMERIC(10,2),
    price_annual NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P0]** Create `plan_features` table
  ```sql
  CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id),
    feature_key TEXT NOT NULL,
    feature_value JSONB NOT NULL,
    UNIQUE(plan_id, feature_key)
  );
  ```

- [ ] **[P0]** Create `subscriptions` table
  ```sql
  CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL CHECK (status IN ('active','trialing','past_due','canceled','expired')),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P0]** Seed system roles from ROLE_DEFINITIONS.md
- [ ] **[P0]** Seed system role_permissions from PERMISSION_KEYS.json
- [ ] **[P0]** Seed plans from PLAN_FEATURE_ACCESS.md

### 1.2 Database — Audit Logs

- [ ] **[P0]** Create proper `audit_logs` table (populate it going forward)
  ```sql
  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    before_state JSONB,
    after_state JSONB,
    ip_address INET,
    user_agent TEXT,
    impersonated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX audit_logs_workspace_id_idx ON audit_logs(workspace_id);
  CREATE INDEX audit_logs_actor_id_idx ON audit_logs(actor_id);
  CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
  ```

### 1.3 Database — Row Level Security

- [ ] **[P0]** Add RLS to `workspace_members`: users can only see their own workspace members
  ```sql
  ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "workspace_members_self_access" ON workspace_members
    FOR ALL USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.status = 'active'
      )
    );
  ```

- [ ] **[P0]** Add RLS to `brands`: scoped to workspace membership
  ```sql
  -- Brands belong to workspaces, not directly to users
  -- After migration: brand.workspace_id replaces brand.user_id for RLS
  ```

- [ ] **[P0]** Add RLS to `audit_logs`: only workspace owners and admins can read their own logs

- [ ] **[P1]** Add RLS to `subscriptions`: workspace owner only
- [ ] **[P1]** Add RLS to `permission_overrides`: workspace admins only

### 1.4 Backend — Permission Helper Functions

- [ ] **[P0]** Create `get_user_permissions(user_id, workspace_id)` Postgres function that:
  1. Fetches user's role from `workspace_members`
  2. Fetches all `role_permissions` for that role
  3. Applies any `permission_overrides` (grant or revoke)
  4. Returns a flat array of effective permission keys

- [ ] **[P0]** Create `user_has_permission(user_id, workspace_id, permission_key)` boolean function for use in RLS policies

- [ ] **[P0]** Create `user_has_brand_access(user_id, brand_id)` function that checks workspace membership AND brand scoping

### 1.5 Frontend — Route Guards

- [ ] **[P0]** Create `PermissionContext` (React context) that loads user's effective permissions on login
  - Location: `contexts/PermissionContext.tsx`
  - Loads from `get_user_permissions()` after auth
  - Cached in memory, refreshed on workspace switch

- [ ] **[P0]** Create `usePermission(permissionKey)` hook
  ```typescript
  const canPublish = usePermission('content.publish.brand');
  const canManageTeam = usePermission('workspace.team.invite.own');
  ```

- [ ] **[P0]** Create `usePlanFeature(featureKey)` hook
  ```typescript
  const hasCRM = usePlanFeature('crm_enabled');
  const maxBrands = usePlanFeature('max_brands');
  ```

- [ ] **[P0]** Update `ProtectedRoute` to accept `requiredPermission` and `requiredPlanFeature` props

- [ ] **[P0]** Add permission guard to every route in `BrandRouter.tsx`:
  | Route | Required Permission | Plan Feature |
  |-------|-------------------|--------------|
  | `billing` | `workspace.billing.view.own` | — |
  | `team-management` | `workspace.team.view.own` | — |
  | `ads-ops` | `ads.campaigns.view.brand` | ads enabled |
  | `seo-ops` | `seo.projects.view.brand` | pro+ |
  | `crm/*` | `crm.dashboard.view.brand` | `crm_enabled` |
  | `integrations` | `integrations.health.view.brand` | — |
  | `analytics` | `analytics.dashboard.view.brand` | — |
  | `inbox` | `inbox.conversations.view.brand` | inbox enabled |
  | `workflow` | `workflow.tasks.view.own` | — |
  | `automation` | `automation.view.brand` | pro+ |

- [ ] **[P0]** Add permission guard to all Admin routes in `AdminRouter.tsx`:
  | Route | Required Platform Permission |
  |-------|---------------------------|
  | `admin-dashboard` | `platform.dashboard.view` |
  | `admin-users` | `platform.users.view` |
  | `admin-billing` | `platform.subscriptions.view` |
  | `admin-ai-keys` | `platform.ai_keys.manage` |
  | `admin-logs` | `platform.audit_logs.view` |
  | `admin-system-health` | `platform.system_health.view` |

- [ ] **[P0]** Create `AccessDenied` page component with upgrade prompt when plan-locked
  - Location: `components/shared/AccessDenied.tsx`
  - Show different message for: no permission vs. plan upgrade required

### 1.6 Frontend — Fix isAdmin Logic

- [ ] **[P0]** Replace the fragile `isAdmin` boolean in `App.tsx` (currently checks 5 different metadata paths) with a single authoritative check:
  ```typescript
  // Replace lines 129-135 in App.tsx
  // Read platform role from a dedicated field, not scattered metadata
  const platformRole = user?.app_metadata?.platform_role; // set by backend only
  const isAdmin = ['SUPER_ADMIN','PLATFORM_ADMIN','SUPPORT_ADMIN','BILLING_ADMIN','TECHNICAL_ADMIN','SECURITY_ADMIN'].includes(platformRole);
  ```

- [ ] **[P0]** Ensure `app_metadata.platform_role` is only settable via service-role key (never by frontend)

---

## PHASE 2 — Role Matrix & Team Management
**Goal:** Enforce the full permission matrix for team members.
**Timeline:** Week 3–4

### 2.1 Permission Service

- [ ] **[P1]** Create `services/permissionService.ts`:
  - `getUserPermissions(userId, workspaceId)` — fetch effective permissions
  - `checkPermission(userId, workspaceId, permissionKey)` — boolean check
  - `checkPlanFeature(workspaceId, featureKey)` — boolean/value check
  - `checkBrandAccess(userId, brandId)` — boolean check
  - `getUsersInWorkspace(workspaceId)` — list members with roles
  - `inviteMember(workspaceId, email, role, brandIds?)` — with quota check
  - `updateMemberRole(workspaceId, memberId, newRole, grantedBy)` — with escalation guard
  - `removeMember(workspaceId, memberId)` — with audit log
  - `overridePermission(workspaceId, memberId, permissionKey, granted, reason)` — per-user override

### 2.2 Component-Level Guards

- [ ] **[P1]** Create `<PermissionGuard permission="..." fallback={...}>` component wrapper
  ```tsx
  <PermissionGuard permission="content.publish.brand">
    <PublishButton />
  </PermissionGuard>
  ```

- [ ] **[P1]** Create `<PlanGuard feature="crm_enabled" upgradeMessage="...">` component wrapper

- [ ] **[P1]** Apply `PermissionGuard` to:
  - All delete buttons
  - All publish/approve buttons
  - All connect/disconnect integration buttons
  - All export buttons
  - All invite/manage team buttons
  - All billing/subscription links

- [ ] **[P1]** Hide sidebar nav items based on permissions and plan:
  - CRM nav: hide if `!hasPlanFeature('crm_enabled')`
  - Ads nav: hide if `!hasPermission('ads.campaigns.view.brand')`
  - SEO nav: hide if `!hasPlanFeature('seo_module_enabled')`
  - Billing nav: hide if `!hasPermission('workspace.billing.view.own')`
  - Team nav: hide if `!hasPermission('workspace.team.view.own')`
  - Admin nav: hide if not platform role

### 2.3 Team Management Page

- [ ] **[P1]** Update `SystemPage.tsx` (team management) to:
  - Check `workspace.team.view.own` before rendering
  - Check `workspace.team.invite.own` before showing invite button
  - Only show roles that caller is allowed to grant (prevent escalation)
  - Show seat usage: `X of Y seats used`
  - Show warning when near seat limit
  - Disable invite if seat limit reached (show upgrade prompt)

- [ ] **[P1]** Update `systemService.ts` `inviteUser()` to:
  - Validate caller has `workspace.team.invite.own` permission
  - Validate target role is not higher than caller's role
  - Validate workspace seat quota before inserting
  - Write to `audit_logs` on success

- [ ] **[P1]** Update `systemService.ts` `updateUserRole()` to:
  - Validate caller has `workspace.team.update_role.own`
  - Validate new role is not higher than caller's role
  - Write to `audit_logs`

### 2.4 Brand-Level Scoping

- [ ] **[P1]** Add `brand_ids` array to `workspace_members` — when not empty, member can only see those specific brands
- [ ] **[P1]** Update `BrandsManagePage` to filter brands based on member's `brand_ids` scope
- [ ] **[P1]** Update `BrandRouter` brand selector to only show accessible brands

### 2.5 CRM Roles Integration

- [ ] **[P2]** Unify `crm_roles`/`crm_user_roles` with the new `roles`/`role_permissions` system
  - CRM roles should be workspace-scoped roles that include `crm.*` permissions
  - Remove the separate CRM role tables after migration
  - Map existing CRM roles to new equivalent operational roles

---

## PHASE 3 — Plan-Based Access & Billing Rules
**Goal:** Enforce plan limits and show upgrade prompts throughout the app.
**Timeline:** Week 5–6

### 3.1 Plan Enforcement Service

- [ ] **[P1]** Create `services/planService.ts`:
  - `getWorkspacePlan(workspaceId)` — current plan and features
  - `checkFeatureEnabled(workspaceId, featureKey)` — boolean
  - `checkUsageLimit(workspaceId, limitKey)` — returns `{used, limit, exceeded}`
  - `getUpgradeUrl(workspaceId, feature)` — billing upgrade link

- [ ] **[P1]** Create `hooks/usePlan.ts`:
  - `usePlanFeature(key)` — boolean or value
  - `usePlanUsage(key)` — `{used, limit, percentage}`

### 3.2 Enforce Limits in Backend (Edge Functions)

- [ ] **[P0]** In any brand creation call: validate `brand_count < plan.max_brands`
- [ ] **[P0]** In any team invite call: validate `member_count < plan.max_team_members`
- [ ] **[P0]** In any AI generation call: validate and decrement `ai_credits_used < plan.ai_credits_monthly`
- [ ] **[P1]** In any media upload call: validate `storage_used + file_size < plan.max_storage_gb * 1073741824`
- [ ] **[P1]** In any social account connection: validate `social_count < plan.max_social_accounts`
- [ ] **[P1]** In any automation creation: validate `automation_count < plan.max_automation_rules`

### 3.3 UI Upgrade Prompts

- [ ] **[P2]** Create `<UpgradePrompt feature="crm" />` component
  - Shows when feature is plan-locked
  - Links to billing page with feature highlighted

- [ ] **[P2]** Add usage meters to workspace dashboard:
  - Brands used / limit
  - Team seats used / limit
  - AI credits used this month / limit
  - Storage used / limit

- [ ] **[P2]** Add plan badge to workspace header/sidebar

### 3.4 Trial Expiry

- [ ] **[P1]** Create trial expiry check on login:
  - If `subscription.status = 'trialing'` and `trial_ends_at < now()`: show upgrade modal
  - Lock all paid features gracefully (don't break app, show prompts)
- [ ] **[P1]** Show trial countdown banner: "X days left in your trial"

---

## PHASE 4 — Audit Logs & Approval Workflows
**Goal:** Full traceability and structured approval for sensitive actions.
**Timeline:** Week 7–9

### 4.1 Audit Log Service

- [ ] **[P1]** Create `services/auditService.ts`:
  - `log(action, resource, before?, after?, metadata?)` — write to `audit_logs`
  - Run on every sensitive mutation (not reads)

- [ ] **[P1]** Add audit log calls to these actions:
  | Action | Actor | Log Required |
  |--------|-------|:---:|
  | Brand created/deleted/archived | workspace member | ✅ |
  | Team member invited/removed | workspace admin | ✅ |
  | Role changed | workspace admin | ✅ |
  | Integration connected/disconnected | any | ✅ |
  | Content approved/published | approver | ✅ |
  | Customer data exported | any | ✅ |
  | Customer data deleted | any | ✅ |
  | Billing changed | owner | ✅ |
  | Subscription cancelled | owner | ✅ |
  | Permission override set | admin | ✅ |
  | Platform user impersonated | super admin | ✅ |
  | Support access to workspace | support admin | ✅ |
  | AI credits depleted/reset | system | ✅ |
  | 2FA disabled | user | ✅ |
  | API key created/revoked | any | ✅ |

- [ ] **[P2]** Build Audit Log UI page for Business+ plans:
  - Filterable by: actor, action type, resource, date range
  - Exportable as CSV
  - Shows before/after state for destructive actions

### 4.2 Approval Workflows

- [ ] **[P2]** Create `approval_requests` table:
  ```sql
  CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    brand_id UUID REFERENCES brands(id),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    resource_payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
    approver_id UUID REFERENCES auth.users(id),
    approver_note TEXT,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **[P2]** Implement approval gates for these actions:
  | Action | Approver Role | Timeout |
  |--------|--------------|---------|
  | Publish content (if brand requires approval) | Brand Manager+ | 48h |
  | Delete brand | Account Owner | 24h |
  | Disconnect integration | Workspace Admin | 24h |
  | Export customer data | Workspace Admin | 24h |
  | Change team permissions | Account Owner | — |
  | Campaign brain launch | Brand Manager | 24h |

- [ ] **[P2]** Add notification system for approval requests (email + in-app)

---

## PHASE 5 — Enterprise Custom Roles & Advanced Controls
**Goal:** Enterprise customers can define their own permission model.
**Timeline:** Week 10–14

### 5.1 Custom Role Builder

- [ ] **[P3]** Build `CustomRoleBuilder` UI page (Business+ plan only):
  - List all permission keys from `PERMISSION_KEYS.json`
  - Allow toggling permissions on/off per role
  - Role name, description, tier selection
  - Preview: "This role can..."
  - Save as workspace-scoped role in `roles` table

- [ ] **[P3]** Add per-user permission overrides UI:
  - In team member detail view
  - Show role permissions + ability to add/remove specific permissions
  - Require reason for override
  - Show expiry date option

### 5.2 SSO / SAML

- [ ] **[P3]** Supabase Auth SSO integration for Enterprise:
  - Map IdP groups to SBrandOps roles
  - Auto-provision workspace members on first login
  - Enforce IdP-side permission policies

### 5.3 IP Allowlist

- [ ] **[P3]** Create `workspace_ip_allowlist` table and enforcement in Edge Functions for Enterprise plans

### 5.4 Session Controls

- [ ] **[P3]** Add `workspace_security_policy` table:
  - `session_timeout_minutes`
  - `require_2fa`
  - `ip_allowlist_enabled`
  - `password_min_length`
  - `password_require_special`

- [ ] **[P3]** Enforce session timeout via Supabase Auth JWT expiry settings per workspace

### 5.5 Compliance

- [ ] **[P3]** Data retention policy enforcement (auto-delete logs older than plan limit)
- [ ] **[P3]** GDPR right-to-erasure: `deleteCustomerData` marks data deleted + logs action
- [ ] **[P3]** Generate compliance export (all data for a workspace, GDPR Article 20)

---

## MIGRATION PLAN

### Step 1: Database (Non-Breaking)
1. Create new tables (`workspaces`, `workspace_members`, `roles`, `role_permissions`, `plans`, etc.)
2. Seed system roles and permissions
3. Backfill: for every existing `brand.user_id`, create a workspace + owner membership
4. Backfill: for every existing `team_members` row, create a `workspace_members` row with mapped role
5. Keep old tables active during transition (dual-write)

### Step 2: Backend Middleware
1. Deploy permission check Edge Functions
2. All new API calls validate permissions — old calls still work on old tables
3. Test with staging environment

### Step 3: Frontend Context
1. Add `PermissionContext` and `PlanContext` providers
2. Update `ProtectedRoute`
3. Add guards to highest-risk routes first (billing, team management, delete actions)

### Step 4: Cutover
1. Disable direct writes to old `team_members` table
2. Switch all reads to `workspace_members`
3. Remove `crm_user_roles` + `crm_roles` tables (after CRM role migration)
4. Monitor audit logs for permission denials

---

## TESTING CHECKLIST

### Unit Tests
- [ ] `checkPermission()` returns correct result for each role
- [ ] `checkPlanFeature()` returns correct value for each plan
- [ ] Permission override correctly overrides role permission
- [ ] Role escalation is blocked (cannot grant higher role than own)

### Integration Tests
- [ ] Route guard blocks access for users without permission
- [ ] Route guard allows access for users with permission
- [ ] Plan guard blocks feature for free tier, allows for pro+
- [ ] Seat limit blocks invite when workspace is full
- [ ] Brand limit blocks creation when at plan limit
- [ ] AI credit check blocks generation at zero credits

### Security Tests
- [ ] Frontend-only bypass attempt: user manually navigates to blocked route → sees AccessDenied
- [ ] API-only bypass attempt: user calls Edge Function without proper role → 403
- [ ] Role escalation attempt: member tries to grant WORKSPACE_ADMIN → rejected
- [ ] Cross-workspace access: user tries to access another workspace's brand → rejected by RLS
- [ ] Token access: user tries to read OAuth token values → blocked (no permission)
- [ ] Support access: support admin accesses workspace without ticket → audit log written, access time-limited

### Audit Tests
- [ ] Every sensitive action writes to audit_logs with correct actor and action
- [ ] Impersonation writes impersonator_id to audit_logs
- [ ] Customer data export logs are present and complete
