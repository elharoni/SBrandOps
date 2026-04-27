# SBrandOps — Advanced Permissions System Blueprint

> Version: 1.0.0 | Last Updated: 2026-04-26
> Author: Architecture Review — SBrandOps Security Design

---

## 1. Executive Summary

This document defines the complete permissions architecture for SBrandOps — a multi-tenant AI-powered brand operating system.

The current system uses:
- A single `isAdmin` boolean (fragile, inconsistent across 5 metadata paths)
- `team_members` table with 5 roles (Owner/Admin/Editor/Analyst/Client) that are **never enforced** in the frontend or backend
- RLS policies that only check `brand.user_id = auth.uid()` — team members cannot even access brands they're invited to
- No workspace abstraction (brands link directly to users, making multi-user collaboration architecturally broken)
- No plan-based feature gating beyond a single seat count check

The new system introduces:
- 21 named roles across 3 tiers
- 200+ granular permission keys following the `module.action.scope` convention
- Workspace-first architecture (brands belong to workspaces, not individual users)
- Plan-based feature flags enforced at both DB and frontend level
- Audit logs for all sensitive actions
- Approval workflows for high-risk operations

---

## 2. Permission System Overview

### 2.1 System Type

SBrandOps uses a **hybrid RBAC + ABAC + Plan-based** system:

| Layer | Type | Enforced By |
|-------|------|-------------|
| Role-Based (RBAC) | Static permissions per role | `role_permissions` table + RLS |
| Attribute-Based (ABAC) | Dynamic checks (brand scope, ownership) | Edge Function middleware |
| Plan-Based (PBAC) | Feature access tied to subscription | `plan_features` table + frontend hooks |
| Ownership-Based | Creator can edit own records | `created_by` column checks |

### 2.2 Permission Naming Convention

```
permission_key = module.action.scope
```

- **module**: the functional area (`brand`, `content`, `social`, `ads`, `analytics`, etc.)
- **action**: the operation (`view`, `create`, `update`, `delete`, `approve`, `export`, `publish`, `connect`, etc.)
- **scope**: who/what is being accessed (`all`, `workspace`, `brand`, `assigned`, `own`)

**Scope Hierarchy (broadest to narrowest):**
```
all > workspace > brand > assigned > own
```

A user with `content.update.brand` can update any content in their assigned brand.
A user with `content.update.own` can only update content they personally created.

**Examples:**
```
brand.view.workspace          → see all brands in the workspace
brand.view.assigned           → see only brands you're explicitly assigned to
content.create.brand          → create content in any assigned brand
content.update.own            → edit only your own content pieces
inbox.conversations.view.assigned → see only conversations assigned to you
analytics.financial_kpis.view.brand → see financial KPIs in any assigned brand
```

---

## 3. User & Role Hierarchy

### 3.1 Three-Tier Role System

```
╔══════════════════════════════════════════╗
║  TIER 1 — PLATFORM ROLES                ║
║  (manage the SaaS platform itself)      ║
║  ─────────────────────────────────────  ║
║  SUPER_ADMIN                            ║
║  PLATFORM_ADMIN                         ║
║  SUPPORT_ADMIN                          ║
║  BILLING_ADMIN                          ║
║  TECHNICAL_ADMIN                        ║
║  SECURITY_ADMIN                         ║
╚══════════════════════════════════════════╝
              ║ cannot access unless granted
╔══════════════════════════════════════════╗
║  TIER 2 — WORKSPACE ROLES               ║
║  (manage a paying customer's workspace) ║
║  ─────────────────────────────────────  ║
║  ACCOUNT_OWNER                          ║
║  WORKSPACE_ADMIN                        ║
╚══════════════════════════════════════════╝
              ║ scoped to workspace
╔══════════════════════════════════════════╗
║  TIER 3 — OPERATIONAL ROLES             ║
║  (execute brand/marketing work)         ║
║  ─────────────────────────────────────  ║
║  BRAND_MANAGER                          ║
║  CONTENT_MANAGER                        ║
║  DESIGNER                               ║
║  SOCIAL_MEDIA_MANAGER                   ║
║  ADS_MANAGER                            ║
║  SEO_SPECIALIST                         ║
║  INBOX_AGENT                            ║
║  ANALYST                                ║
║  CRM_SALES_AGENT                        ║
║  FINANCE_VIEWER                         ║
║  CLIENT_VIEWER                          ║
║  EXTERNAL_CONTRACTOR                    ║
║  VIEWER                                 ║
╚══════════════════════════════════════════╝
```

### 3.2 Key Rules

1. **No cross-tier elevation.** A PLATFORM_ADMIN is not automatically an ACCOUNT_OWNER anywhere. Roles must be explicitly granted per tier.

2. **Role cannot grant what it doesn't have.** A WORKSPACE_ADMIN cannot grant ACCOUNT_OWNER. A BRAND_MANAGER cannot invite team members.

3. **Platform roles cannot access customer data by default.** SUPPORT_ADMIN needs explicit, time-limited, audit-logged grants to read workspace data.

4. **SUPER_ADMIN is never created via the UI.** Only via service-role DB seed.

5. **Platform role is stored in `app_metadata.platform_role`** — which can only be set via the service-role key, not by any frontend call.

---

## 4. Data Model

### 4.1 Core Tables & Relationships

```
auth.users (Supabase managed)
    │
    ├─── workspaces (1 user can own multiple workspaces)
    │        │
    │        ├─── subscriptions → plans → plan_features
    │        │
    │        ├─── workspace_members (links users to workspaces with roles)
    │        │        └─── permission_overrides (per-user overrides)
    │        │
    │        ├─── brands (1 workspace can have multiple brands)
    │        │        ├─── brand_profiles
    │        │        ├─── oauth_tokens (encrypted)
    │        │        ├─── social_accounts
    │        │        ├─── content_pieces
    │        │        ├─── design_assets
    │        │        ├─── analytics_snapshots
    │        │        ├─── crm_customers
    │        │        └─── inbox_conversations
    │        │
    │        └─── audit_logs (workspace-scoped activity trail)
    │
    └─── roles (system roles are global; custom roles are workspace-scoped)
             └─── role_permissions (maps roles to permission keys)
```

### 4.2 Critical Table: `workspaces`

The most important structural change. Currently **missing** — brands link directly to `auth.users.id`. This prevents multi-user collaboration from working at the data level.

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID REFERENCES plans(id),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 Critical Table: `workspace_members`

Replaces `team_members`. Links a user to a workspace with a role and optional brand restrictions.

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),       -- NULL if invite is pending
  invited_email TEXT,                            -- used before user registers
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  brand_ids UUID[] DEFAULT '{}',                 -- empty = access all brands in workspace
  invited_by UUID REFERENCES auth.users(id),
  custom_permissions JSONB DEFAULT '{}',         -- legacy field, use permission_overrides
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Table: `roles`

System roles have `is_system = true` and `workspace_id = NULL`.
Custom roles (Business+ plan) have `workspace_id` set.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('platform', 'workspace', 'operational')),
  is_system BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 Table: `role_permissions`

Maps roles to permission keys. System roles are seeded. Custom roles are built by workspace admins.

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_key)
);
```

### 4.6 Table: `permission_overrides`

Allows ACCOUNT_OWNER and WORKSPACE_ADMIN to grant or revoke specific permissions for a single user, on top of their role.

```sql
CREATE TABLE permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL,    -- true = grant extra, false = revoke from role
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,      -- optional time limit
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.7 Table: `plans` & `plan_features`

Defines what each plan includes. Checked at runtime by the plan service.

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,   -- 'free', 'starter', 'pro', 'business', 'agency', 'enterprise'
  slug TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC(10,2),
  price_annual NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  feature_key TEXT NOT NULL,   -- e.g. 'max_brands', 'crm_enabled', 'ai_credits_monthly'
  feature_value JSONB NOT NULL, -- e.g. 3, true, "full"
  UNIQUE(plan_id, feature_key)
);
```

### 4.8 Table: `audit_logs`

Append-only table. Never update or delete rows. Contains full state snapshots for destructive actions.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,         -- e.g. 'brand.deleted', 'member.invited', 'content.published'
  resource_type TEXT,           -- 'brand', 'content_piece', 'workspace_member'
  resource_id TEXT,
  before_state JSONB,           -- snapshot before destructive action
  after_state JSONB,            -- snapshot after action
  ip_address INET,
  user_agent TEXT,
  impersonated_by UUID REFERENCES auth.users(id),  -- set when platform admin acts as user
  support_ticket_id TEXT,       -- set when support admin accesses workspace
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.9 Tenant Isolation Rules

Every table that stores brand or workspace data must enforce tenant isolation:

1. **Via RLS:** Every query must include a workspace/brand scope check.
2. **Via helper function:** `user_has_brand_access(uid, brand_id)` checks workspace membership AND brand_ids scope.
3. **Via Edge Functions:** All write operations validate caller's permission before touching the DB.
4. **No cross-workspace joins** are ever permitted in application code.

---

## 5. Permission Evaluation Logic

### 5.1 Effective Permission Calculation

When checking if a user has permission X:

```
1. Get user's role from workspace_members.role
2. Fetch all permission_keys for that role from role_permissions
3. Fetch permission_overrides for this workspace_member:
   - For each override where granted=true: ADD permission
   - For each override where granted=false: REMOVE permission
4. Final set = (role_permissions + granted_overrides) - revoked_overrides
5. Check if permission_key is in final set
```

As a Postgres function:
```sql
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_workspace_id UUID)
RETURNS TEXT[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH member AS (
    SELECT id, role FROM workspace_members
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id AND status = 'active'
    LIMIT 1
  ),
  role_perms AS (
    SELECT rp.permission_key
    FROM role_permissions rp
    JOIN roles r ON r.name = (SELECT role FROM member) AND (r.workspace_id = p_workspace_id OR r.is_system = true)
    WHERE r.id = rp.role_id
  ),
  overrides AS (
    SELECT permission_key, granted
    FROM permission_overrides po
    WHERE po.workspace_member_id = (SELECT id FROM member)
      AND (expires_at IS NULL OR expires_at > now())
  )
  SELECT array_agg(DISTINCT permission_key) FROM (
    SELECT permission_key FROM role_perms
    WHERE permission_key NOT IN (SELECT permission_key FROM overrides WHERE granted = false)
    UNION
    SELECT permission_key FROM overrides WHERE granted = true
  ) effective_perms;
$$;
```

### 5.2 Brand Access Check

```sql
CREATE OR REPLACE FUNCTION user_has_brand_access(p_user_id UUID, p_brand_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN brands b ON b.workspace_id = wm.workspace_id
    WHERE wm.user_id = p_user_id
      AND b.id = p_brand_id
      AND wm.status = 'active'
      AND (
        wm.brand_ids = '{}'      -- empty = access all brands
        OR p_brand_id = ANY(wm.brand_ids)
      )
  );
$$;
```

---

## 6. Frontend Guard Logic

### 6.1 Context Architecture

```
App
 └── AuthProvider (Supabase session)
      └── WorkspaceProvider (current workspace selection)
           └── PermissionProvider (effective permissions for current workspace)
                └── PlanProvider (plan features for current workspace)
                     └── Routes / Pages
```

### 6.2 PermissionContext

```typescript
// contexts/PermissionContext.tsx
interface PermissionContextValue {
  permissions: string[];           // effective permission keys
  hasPermission: (key: string) => boolean;
  hasBrandAccess: (brandId: string) => boolean;
  isLoading: boolean;
}

// On workspace change: reload permissions
// On role change (realtime subscription): reload permissions
```

### 6.3 PlanContext

```typescript
// contexts/PlanContext.tsx
interface PlanContextValue {
  plan: Plan;
  features: Record<string, any>;   // feature_key → feature_value
  hasFeature: (key: string) => boolean;
  getLimit: (key: string) => number;  // -1 = unlimited
  getUsage: (key: string) => Promise<number>;
}
```

### 6.4 Route Guard Pattern

```typescript
// components/routing/ProtectedRoute.tsx
interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredPlanFeature?: string;
  fallback?: ReactNode;   // defaults to <AccessDenied />
  children: ReactNode;
}

// Usage in BrandRouter.tsx:
<Route path="ads-ops" element={
  <ProtectedRoute
    requiredPermission="ads.campaigns.view.brand"
    requiredPlanFeature="ads_enabled"
  >
    <AdsOpsPage />
  </ProtectedRoute>
} />
```

### 6.5 Component-Level Guard

```typescript
// components/shared/PermissionGuard.tsx
<PermissionGuard permission="content.publish.brand">
  <PublishButton onClick={handlePublish} />
</PermissionGuard>

// PlanGuard with upgrade prompt:
<PlanGuard feature="crm_enabled" upgradeMessage="CRM is available on Pro plan and above.">
  <CrmDashboard />
</PlanGuard>
```

### 6.6 Access Denied Screen

When a user navigates to a locked route, show:
- For **no permission**: "You don't have access to this feature. Contact your workspace admin."
- For **plan locked**: "This feature requires the [Pro] plan. [Upgrade Now →]"
- For **trial expired**: "Your trial has ended. [Start a Subscription →]"

Never show a blank page or unhandled error.

---

## 7. Backend Middleware Logic

### 7.1 Edge Function Permission Pattern

Every sensitive Edge Function must follow this pattern:

```typescript
// Standard permission check middleware for Edge Functions
async function requirePermission(
  req: Request,
  supabaseClient: SupabaseClient,
  permissionKey: string,
  workspaceId: string
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error } = await supabaseClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  // Super admin bypass
  if (user.app_metadata?.platform_role === 'SUPER_ADMIN') {
    return { userId: user.id };
  }

  // Check workspace permission
  const { data: hasPermission } = await supabaseClient.rpc('user_has_permission', {
    p_user_id: user.id,
    p_workspace_id: workspaceId,
    p_permission_key: permissionKey
  });

  if (!hasPermission) return new Response('Forbidden', { status: 403 });
  return { userId: user.id };
}
```

### 7.2 Plan Feature Check Middleware

```typescript
async function requirePlanFeature(
  supabaseClient: SupabaseClient,
  workspaceId: string,
  featureKey: string
): Promise<boolean | Response> {
  const { data } = await supabaseClient
    .from('plan_features')
    .select('feature_value')
    .eq('feature_key', featureKey)
    .eq('plan_id', supabaseClient
      .from('subscriptions')
      .select('plan_id')
      .eq('workspace_id', workspaceId)
      .single()
    )
    .single();

  const value = data?.feature_value;
  if (!value || value === false || value === 0) {
    return new Response('Plan upgrade required', { status: 402 });
  }
  return true;
}
```

### 7.3 Quota Check Middleware

```typescript
async function checkQuota(
  supabaseClient: SupabaseClient,
  workspaceId: string,
  quotaKey: 'max_brands' | 'max_team_members' | 'ai_credits_monthly',
  currentCount: number
): Promise<boolean | Response> {
  const limit = await getPlanLimit(supabaseClient, workspaceId, quotaKey);
  if (limit !== -1 && currentCount >= limit) {
    return new Response(
      JSON.stringify({ error: 'quota_exceeded', limit, current: currentCount }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return true;
}
```

---

## 8. API Protection Rules

### 8.1 Endpoint Permission Map

| Endpoint / Function | Required Permission | Plan Feature | Audit Log |
|---------------------|--------------------|--------------|---------:|
| `POST /brands` | `brand.create.workspace` | quota: max_brands | ✅ |
| `DELETE /brands/:id` | `brand.delete.workspace` | — | ✅ |
| `POST /content` | `content.create.brand` | — | — |
| `POST /content/:id/publish` | `content.publish.brand` | — | ✅ |
| `POST /social/connect` | `social.accounts.connect.brand` | quota: max_social_accounts | ✅ |
| `DELETE /social/:id` | `social.accounts.disconnect.brand` | — | ✅ |
| `POST /ai/generate` | `ai.content.generate.brand` | quota: ai_credits | — |
| `POST /workspace/invite` | `workspace.team.invite.own` | quota: max_team_members | ✅ |
| `PUT /workspace/member/:id/role` | `workspace.team.update_role.own` | — | ✅ |
| `DELETE /workspace/member/:id` | `workspace.team.remove.own` | — | ✅ |
| `GET /analytics` | `analytics.dashboard.view.brand` | analytics_level | — |
| `POST /analytics/export` | `analytics.reports.export.brand` | export_enabled | ✅ |
| `GET /crm/customers` | `crm.customers.view.brand` | crm_enabled | — |
| `DELETE /crm/customers/:id` | `crm.customers.delete.brand` | crm_enabled | ✅ |
| `GET /crm/customers/export` | `crm.customers.export.brand` | export_enabled | ✅ |
| `POST /inbox/reply` | `inbox.messages.reply.brand` or `.assigned` | inbox enabled | — |
| `POST /inbox/export` | `inbox.customer_data.export.brand` | export_enabled | ✅ |
| `DELETE /oauth/tokens/:id` | `integrations.*.disconnect.brand` | — | ✅ |
| `GET /oauth/tokens/:id/value` | **Never expose — always blocked** | — | ✅ |
| `POST /billing/cancel` | `workspace.subscription.manage.own` | — | ✅ |
| `POST /platform/impersonate` | `platform.users.impersonate` | — | ✅ |
| `GET /platform/audit-logs` | `platform.audit_logs.view` | — | — |

### 8.2 Sensitive Actions Rules

1. **OAuth token values** are **never returned** via any API. Even SUPER_ADMIN cannot retrieve raw token values through the application — only via direct DB access with audit.

2. **Export endpoints** always write to `audit_logs` before streaming the response.

3. **Delete endpoints** always read and store `before_state` in `audit_logs` before deleting.

4. **Impersonation** writes `impersonated_by` to every `audit_log` entry during the session.

5. **AI generation** decrements `ai_credits_used` in a transaction. If credits are zero, return 429 with an upgrade prompt.

---

## 9. Security Rules & Edge Cases

### 9.1 Core Security Rules

**R1 — Platform isolation:** Platform admins (PLATFORM_ADMIN, SUPPORT_ADMIN, etc.) cannot access any workspace data unless:
- For SUPPORT_ADMIN: access is granted via a support ticket mechanism with audit logging and 24h expiry
- For other platform roles: never, unless SUPER_ADMIN grants explicit access

**R2 — Workspace isolation:** Users in workspace A can never read, write, or delete data in workspace B. Enforced at RLS level using workspace_id checks.

**R3 — Brand scoping:** When `workspace_members.brand_ids` is non-empty, the user can only access those specific brands. RLS and the helper function `user_has_brand_access()` enforce this.

**R4 — Token protection:** OAuth tokens are stored encrypted (migration 021). The `oauth_tokens` table:
- Has no RLS policy allowing SELECT of the `access_token` or `refresh_token` columns via the anon key
- Token values are only accessed by Edge Functions using the service-role key
- No frontend code ever handles raw token values

**R5 — Delete protection:** Records cannot be hard-deleted without:
- The caller having an explicit `*.delete.*` permission key
- A pre-delete audit log entry with `before_state` snapshot

**R6 — Export protection:** Customer PII exports require:
- `export_enabled` plan feature = true
- `inbox.customer_data.export.brand` or `crm.customers.export.brand` permission
- Audit log entry

**R7 — AI memory scoping:** Brand Brain data (`brand_documents`, AI memory) is scoped to `brand_id`. It is never shared across workspaces. Only users with `brand.ai_memory.view.assigned` can read it.

**R8 — Financial data protection:** ROAS, CPA, spend data requires `ads.financial_metrics.view.brand` — separate from basic `ads.campaigns.view.brand`. This is configurable per member by the ACCOUNT_OWNER.

**R9 — Role escalation prevention:** When granting a role, the system checks that the granting user's own role is strictly higher in the hierarchy than the role being granted. A WORKSPACE_ADMIN cannot create another WORKSPACE_ADMIN; only ACCOUNT_OWNER can.

**R10 — Metadata trust:** `user_metadata` is user-editable. `app_metadata` requires service-role. Platform roles must only ever be read from `app_metadata.platform_role`.

### 9.2 Edge Cases

**EC1 — Workspace owner leaves:** ACCOUNT_OWNER cannot leave a workspace — they must transfer ownership to another workspace member first, or delete the workspace.

**EC2 — Invited member hasn't registered:** `workspace_members.user_id` is NULL for pending invites. The invite token maps to `invited_email`. On registration, Supabase Auth trigger populates `user_id`. Until then, the member has no access.

**EC3 — User in multiple workspaces:** A single `auth.users` account can be a member of multiple workspaces with different roles in each. `PermissionContext` reloads when the active workspace changes.

**EC4 — Deleted brand with active content:** Soft-delete brands (add `deleted_at` column). Hard delete only after 30-day grace period. This prevents accidental data loss.

**EC5 — Plan downgrade:** If workspace downgrades from Business to Pro:
- Existing custom roles remain readable but cannot be edited (plan lock)
- Members exceeding the new seat limit become `suspended` status (not deleted)
- Brands exceeding the new limit become archived (not deleted)

**EC6 — Support access expiry:** When SUPPORT_ADMIN's 24h workspace access expires, all active sessions are terminated silently. The next request returns 403.

**EC7 — Concurrent permission changes:** If a user is mid-session when their role is changed, the next API call will use the new permissions (checked fresh from DB). The frontend resyncs via Supabase Realtime on `workspace_members` table changes.

---

## 10. Approval Workflow

### 10.1 Actions Requiring Approval

Some actions require explicit approval by a higher-authority role before execution:

| Action | Requested By | Approver | Timeout | On Timeout |
|--------|-------------|---------|---------|-----------|
| Publish content (if brand approval mode on) | CONTENT_MANAGER+ | BRAND_MANAGER+ | 48h | Expires, stays in draft |
| Delete brand | WORKSPACE_ADMIN | ACCOUNT_OWNER | 24h | Auto-denied |
| Disconnect integration | BRAND_MANAGER | WORKSPACE_ADMIN | 24h | Auto-denied |
| Export customer data | Any role with export | WORKSPACE_ADMIN+ | 24h | Auto-denied |
| Change team permissions | WORKSPACE_ADMIN | ACCOUNT_OWNER | — | No timeout |
| Campaign launch (Brain) | BRAND_MANAGER | WORKSPACE_ADMIN | 24h | Auto-denied |
| Delete customer data | Any | WORKSPACE_ADMIN | 24h | Auto-denied |

### 10.2 Approval Flow

```
Requester submits action
    → Creates approval_request record (status=pending)
    → Notifies approver (in-app + email)
    → Action is blocked pending approval

Approver approves:
    → approval_request.status = 'approved'
    → approval_request.approver_id = approver.id
    → Original action executes
    → Audit log: action + approval chain

Approver rejects:
    → approval_request.status = 'rejected'
    → Requester notified
    → No action executed
    → Audit log: rejection reason

Timeout:
    → Background job sets status = 'expired'
    → Requester notified
```

---

## 11. Frontend Page Access Map

| Page / Route | Who Can See | Who Can Edit | Who Can Approve | Who Can Export | What if Denied |
|---|---|---|---|---|---|
| `dashboard` | All workspace members | Own widgets only | — | — | Redirect to login |
| `brands-manage` | AO, WA | AO, WA | AO (delete) | — | AccessDenied |
| `brand-hub` | BM, CM, DE, SM, AO, WA | BM, AO, WA | — | — | AccessDenied |
| `content-ops` | BM, CM, SM, SE, AO, WA | CM, BM, SE | BM, AO, WA | BM, AO, WA | AccessDenied |
| `social-ops/publisher` | BM, SM, CM, AO, WA | SM, BM | BM, WA | — | AccessDenied |
| `social-ops/accounts` | AO, WA, BM | AO, WA | — | — | AccessDenied |
| `ads-ops` | AM, BM, AO, WA | AM, BM | BM, WA | AM, BM | Plan lock if not enabled |
| `seo-ops` | SE, BM, AO, WA | SE, BM | — | SE, BM | Plan lock |
| `analytics` | All (filtered by role) | Custom reports: AN, BM, WA | — | AN, BM, WA | Filtered view |
| `inbox` | SM, IA, CS, BM, WA, AO | SM, IA, CS, BM | BM, WA (assign) | AO, WA | AccessDenied |
| `crm/*` | CS, BM, AO, WA | CS, BM | — | AO, WA | Plan lock |
| `workflow` | All operational | Own tasks | BM, WA | — | Own tasks only |
| `integrations` | BM, AO, WA | AO, WA | WA (disconnect) | — | AccessDenied |
| `billing` | AO, FV (view) | AO | — | AO | AccessDenied |
| `team-management` | AO, WA | AO, WA | — | — | AccessDenied |
| `brand-brain` | BM, CM, SE, AO, WA | BM, AO, WA | — | — | AccessDenied |
| `campaign-brain` | BM, AM, AO, WA | BM, AM | WA, AO | BM, WA | AccessDenied |
| `admin-*` | Platform roles only | By specific admin role | — | SEC, SA | Redirect to workspace |

---

## 12. Current Problems Found

### Critical (must fix immediately):

1. **isAdmin uses 5 inconsistent metadata paths** — can be confused by malformed tokens. Consolidate to `app_metadata.platform_role` only.

2. **team_members roles are never enforced** — an Editor in the DB has the same access as an Owner in practice. The entire role system is decorative.

3. **No workspace table** — brands link to `user_id`. If you invite a team member to a brand, they see it only because of the `brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())` RLS. Team members literally cannot see brands they're invited to because RLS fails for them.

4. **All authenticated users with a selected brand can reach all brand routes** — there are zero frontend permission checks in `BrandRouter.tsx` beyond being authenticated.

5. **Admin pages have no per-page permission checks** — all 10 admin pages are accessible to anyone with `isAdmin = true`. Support admins can see AI provider keys. Billing admins can see security logs.

6. **systemService.ts inviteUser() has no authorization check** — any authenticated user can call this and potentially invite people.

7. **`app_metadata` vs `user_metadata`** — the current code checks `user.user_metadata.is_admin` which is user-editable. Anyone can set this in their own profile.

### High Priority:

8. **No plan enforcement** — `crm_feature_flags` table exists but is never checked in the UI. Users on free tier can access CRM routes.

9. **No AI credit tracking** — AI generation can be called unlimited times. No rate limiting or credit deduction visible.

10. **API keys have no scopes** — generated API keys in `api_keys` table have no permission restrictions. They grant full brand access.

11. **CRM roles defined but disconnected** — `crm_roles` and `crm_user_roles` tables exist but are a parallel system never unified with `team_members` roles.

12. **OAuth token access is not audited** — when tokens are used/refreshed, no audit trail.

### Medium Priority:

13. **No content ownership tracking** — `content_pieces` has no `created_by` column. "Own only" permission scope cannot be enforced.

14. **Support access to workspace has no mechanism** — there is no support-access grant flow, no audit log trigger, no time limit. Support admins either get full access or none.

15. **Approval workflows not implemented** — `brand.delete.workspace` shows `✅*` (requires approval) in the matrix but no approval mechanism exists.

---

## 13. Implementation Priority Summary

### Phase 1 (Week 1–2): Stop the bleeding
- Fix `isAdmin` metadata check
- Add `workspaces` table and migrate brands
- Protect admin routes with per-page permission checks
- Add `PermissionContext` and basic route guards to sensitive routes (billing, team, admin)
- Block frontend calls to `systemService` without authorization

### Phase 2 (Week 3–4): Make roles real
- Implement full `workspace_members` table with enforced roles
- Add `roles` + `role_permissions` tables seeded from this blueprint
- Build `PermissionGuard` component and apply to all action buttons
- Hide sidebar nav items by role and plan
- Add brand-scoping to member access

### Phase 3 (Week 5–6): Plan enforcement
- Build `PlanContext` and `usePlanFeature` hook
- Enforce limits in backend (AI credits, seat count, brand count, social accounts)
- Add upgrade prompts throughout UI
- Handle trial expiry gracefully

### Phase 4 (Week 7–9): Audit and approvals
- Populate `audit_logs` for all sensitive mutations
- Build approval workflow for content publish, brand delete, customer export
- Build audit log UI for Business+ plans
- Add support-access mechanism with time limit and audit

### Phase 5 (Week 10–14): Enterprise
- Custom role builder UI
- Per-user permission overrides UI
- SSO / SAML for Enterprise
- IP allowlist
- Session timeout policies
- Compliance export (GDPR)
