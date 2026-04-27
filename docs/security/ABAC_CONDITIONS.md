# SBrandOps — ABAC Conditions (Attribute-Based Access Control)

> Version: 2.0.0 | Last Updated: 2026-04-26

---

## Overview

RBAC alone is not sufficient for a production SaaS. Having a permission key in your role is **necessary but not sufficient** for many operations. ABAC adds **runtime conditions** that are evaluated on top of the role check.

**Evaluation order:**
```
1. Is user authenticated?                      → 401 if not
2. Is workspace active (not suspended)?        → 403 if suspended
3. Does user have the permission key?          → 403 if not
4. Do all ABAC conditions pass?                → 403 or 402 if not
5. Is plan feature enabled?                    → 402 (upgrade) if not
6. Is quota within limits?                     → 429 if exceeded
7. Execute action + write audit log
```

---

## ABAC Condition Types

| Type | Code | Description |
|------|------|-------------|
| Resource Ownership | `OWNS` | Record was created by this user |
| Resource Assignment | `ASSIGNED` | Record is assigned to this user |
| Resource State | `STATE` | Record must be in a specific status |
| Brand Scope | `BRAND_SCOPE` | User is scoped to this specific brand |
| Integration Active | `INTEGRATION_ACTIVE` | Platform integration must be connected and token valid |
| Plan Feature | `PLAN` | Workspace plan must include this feature |
| Quota | `QUOTA` | Usage must be below the limit |
| Time Window | `TIME` | Access is time-limited (e.g. support grants) |
| 2FA Verified | `2FA` | Action requires 2FA verified in current session |
| Approval Required | `APPROVAL` | Resource state requires prior approval |
| Workspace Status | `WS_STATUS` | Workspace must be active |
| Brand Assignment | `BRAND_ACCESS` | User must have explicit brand access |
| Sensitive Data Grant | `SENSITIVE` | Sensitive data must be explicitly granted |
| Escalation Guard | `ESCALATION` | Cannot grant a role higher than own |

---

## Per-Action ABAC Conditions

### BRAND MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View brand | `brand.view.assigned` | `BRAND_ACCESS`: brand_id ∈ member.brand_ids OR member.brand_ids = '{}' |
| Create brand | `brand.create.workspace` | `PLAN.QUOTA`: brand_count < plan.max_brands |
| Delete brand | `brand.delete.workspace` | `APPROVAL`: requires ACCOUNT_OWNER approval request; `2FA`: session must have 2FA verified |
| Archive brand | `brand.archive.workspace` | `STATE`: brand.status ≠ 'archived' |
| Restore brand | `brand.restore.workspace` | `STATE`: brand.status = 'archived'; `PLAN.QUOTA`: brand_count < plan.max_brands |
| Update AI memory | `brand.ai_memory.update.assigned` | `PLAN`: plan.brand_brain_enabled = true |
| Reset AI memory | `brand.ai_memory.reset.assigned` | `2FA`: verified; `APPROVAL`: requires WORKSPACE_ADMIN approval |

---

### CONTENT MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View content | `content.view.brand` | `BRAND_ACCESS` |
| Create content | `content.create.brand` | `BRAND_ACCESS`; `WS_STATUS`: workspace.status = 'active' |
| Update content (brand) | `content.update.brand` | `BRAND_ACCESS`; `STATE`: content.status ≠ 'published' (cannot edit live content directly) |
| Update content (own) | `content.update.own` | `OWNS`: content.created_by = auth.uid(); `STATE`: content.status ∈ ['draft','review','rejected'] |
| Delete content (own) | `content.delete.own` | `OWNS`: content.created_by = auth.uid(); `STATE`: content.status ∈ ['draft','rejected'] |
| Approve content | `content.approve.brand` | `STATE`: content.status = 'review'; `BRAND_ACCESS` |
| Reject content | `content.reject.brand` | `STATE`: content.status = 'review' |
| Publish content | `content.publish.brand` | `BRAND_ACCESS`; **CONDITIONAL**: IF brand.require_content_approval = true THEN `STATE`: content.status = 'approved'; IF false THEN content.status ∈ ['draft','approved'] |
| Unpublish content | `content.unpublish.brand` | `STATE`: content.status = 'published'; `2FA` for sensitive brands |
| Request approval | `content.request_approval.own` | `OWNS`; `STATE`: content.status = 'draft' |
| Recall approval | `content.recall_approval.own` | `OWNS`; `STATE`: content.status = 'review' (not yet approved/rejected) |
| AI generate | `content.ai_generate.brand` | `PLAN.QUOTA`: ai_credits_used < ai_credits_monthly |
| Export content | `content.export.brand` | `PLAN`: plan.export_enabled = true |
| Restore version | `content.restore_version.own` | `OWNS`; source version must exist in version_history |

**Content Status State Machine:**
```
draft → review (request_approval) → approved (approve) → published (publish)
                                  ↘ rejected (reject) → draft
draft → published (direct, if brand.require_content_approval = false)
published → unpublished (unpublish)
```

---

### DESIGN MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| Update brief (own) | `design.update_brief.own` | `OWNS`; `STATE`: design.status ∈ ['draft','revision_requested'] |
| Delete brief (own) | `design.delete_brief.own` | `OWNS`; `STATE`: design.status ∈ ['draft','rejected'] |
| Approve design | `design.approve.brand` | `STATE`: design.status = 'review' |
| Send to publish | `design.send_to_publish.brand` | `STATE`: design.status = 'approved' |
| Request approval | `design.request_approval.own` | `OWNS`; `STATE`: design.status = 'draft' |
| Export design | `design.export.own` | `OWNS` OR role ≥ BRAND_MANAGER; `PLAN`: plan.export_enabled = true |

---

### SOCIAL MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| Publish post | `social.posts.publish.brand` | `INTEGRATION_ACTIVE`: social_account.token_status = 'valid'; platform not rate-limited |
| Schedule post | `social.posts.schedule.brand` | `INTEGRATION_ACTIVE`: account connected; scheduled_at must be future |
| Boost post | `social.posts.boost.brand` | `INTEGRATION_ACTIVE`: ads account connected; `PLAN`: ads_enabled = true |
| Connect account | `social.accounts.connect.brand` | `PLAN.QUOTA`: social_account_count < plan.max_social_accounts |
| Disconnect account | `social.accounts.disconnect.brand` | `APPROVAL`: requires WORKSPACE_ADMIN approval IF account has scheduled posts |
| Reply (assigned) | `social.conversations.view.assigned` | `ASSIGNED`: conversation.assigned_to = auth.uid() |
| Snooze (assigned) | `social.conversations.snooze.assigned` | `ASSIGNED` |
| Close (assigned) | `social.conversations.close.assigned` | `ASSIGNED` |
| Create order from conversation | `social.conversations.create_order.brand` | `PLAN`: crm_enabled = true |
| Manage inbox rules | `social.inbox_rules.create.brand` | `PLAN`: inbox_level ∈ ['full'] |

---

### ADS MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View financial metrics | `ads.financial_metrics.view.brand` | `SENSITIVE`: explicit grant OR role ≥ WORKSPACE_ADMIN; `PLAN`: ads_enabled = true |
| View ROAS | `ads.roas.view.brand` | Same as financial_metrics |
| View spend | `ads.spend.view.brand` | `PLAN`: ads_enabled = true |
| Launch campaign | `ads.campaigns.launch.brand` | `INTEGRATION_ACTIVE`: ad account connected; `APPROVAL`: if campaign budget > workspace.ad_approval_threshold |
| Connect ad account | `ads.accounts.connect.brand` | `PLAN.QUOTA`: ad_account_count < plan.max_ad_accounts |
| Export ads reports | `ads.reports.export.brand` | `PLAN`: export_enabled = true |
| Create audience | `ads.audience.create.brand` | `INTEGRATION_ACTIVE`: platform connected |

---

### SEO MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| All SEO actions | any `seo.*` | `PLAN`: seo_module_enabled = true |
| Generate keywords | `seo.keywords.generate.brand` | `PLAN.QUOTA`: ai_credits_used < ai_credits_monthly |
| Run site audit | `seo.site_audit.run.brand` | `INTEGRATION_ACTIVE`: website connected |
| View Search Console | `seo.search_console.view.brand` | `INTEGRATION_ACTIVE`: search_console connected |

---

### ANALYTICS MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View Google Analytics | `analytics.google.view.brand` | `INTEGRATION_ACTIVE`: google_analytics connected |
| View ads analytics | `analytics.ads.view.brand` | `INTEGRATION_ACTIVE`: at least one ad account connected |
| View financial KPIs | `analytics.financial_kpis.view.brand` | `SENSITIVE`: explicit grant OR role ≥ WORKSPACE_ADMIN |
| View team productivity | `analytics.team_productivity.view.workspace` | role ≥ WORKSPACE_ADMIN |
| Export reports | `analytics.reports.export.brand` | `PLAN`: export_enabled = true |
| Share public link | `analytics.reports.share_public_link.brand` | `PLAN`: share_reports_enabled = true |
| AI-generate report | `ai.reports.generate.brand` | `PLAN.QUOTA`: ai_credits_used < ai_credits_monthly |

---

### INBOX MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View inbox (all) | `inbox.conversations.view.brand` | `PLAN`: inbox_level ∈ ['full'] |
| View inbox (assigned) | `inbox.conversations.view.assigned` | `ASSIGNED`: conversation.assigned_to = auth.uid() |
| Reply (assigned) | `inbox.messages.reply.assigned` | `ASSIGNED`; conversation.status ≠ 'closed' |
| Export customer data | `inbox.customer_data.export.brand` | `PLAN`: export_enabled = true; `APPROVAL`: requires WORKSPACE_ADMIN; `2FA`: verified; AUDIT logged |
| Delete customer data | `inbox.customer_data.delete.brand` | `APPROVAL`: requires ACCOUNT_OWNER; `2FA`: verified; `STATE`: compliance check; AUDIT logged |
| View sensitive data | `inbox.sensitive_data.view.brand` | `SENSITIVE`: explicit ACCOUNT_OWNER grant in permission_overrides |
| Create lead from inbox | `inbox.leads.create.brand` | `PLAN`: crm_enabled = true |
| Bulk action | `inbox.conversations.bulk_action.brand` | `PLAN`: inbox_level = 'full'; max 100 records per call |

---

### CRM MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| All CRM actions | any `crm.*` | `PLAN`: crm_enabled = true |
| View sensitive data | `crm.customers.sensitive_data.view.brand` | `SENSITIVE`: explicit ACCOUNT_OWNER grant |
| Delete customer | `crm.customers.delete.brand` | `APPROVAL`: ACCOUNT_OWNER; `2FA`: verified; AUDIT logged |
| Export customers | `crm.customers.export.brand` | `PLAN`: export_enabled = true; `APPROVAL`: WORKSPACE_ADMIN; AUDIT logged |
| Import customers | `crm.customers.import.brand` | `PLAN.QUOTA`: customer_count + import_count < plan.max_customers |
| Merge customers | `crm.customers.merge.brand` | `STATE`: both customers must exist and not be blacklisted |
| Update (assigned) | `crm.customers.update.assigned` | `ASSIGNED`: customer.assigned_to = auth.uid() |
| Pipeline move (assigned) | `crm.pipeline.move_stage.assigned` | `ASSIGNED`: deal.assigned_to = auth.uid() |
| Refund order | `crm.orders.refund.brand` | `APPROVAL`: WORKSPACE_ADMIN; AUDIT logged |
| Escalate ticket | `crm.tickets.escalate.assigned` | `ASSIGNED`; ticket.status ≠ 'closed' |
| Manage automations | `crm.automations.create.brand` | `PLAN`: crm_automations_enabled = true |

---

### WORKFLOW MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| View all tasks | `workflow.tasks.view.brand` | role ≥ BRAND_MANAGER |
| Complete (own) | `workflow.tasks.complete.own` | `OWNS` OR `ASSIGNED`; task.status ≠ 'completed' |
| Complete (assigned) | `workflow.tasks.complete.assigned` | `ASSIGNED`; task.status ≠ 'completed' |
| Approve task | `workflow.tasks.approve.brand` | `STATE`: task.status = 'pending_approval'; role ≥ BRAND_MANAGER |
| Assign task | `workflow.tasks.assign.brand` | target member must be in workspace and active |
| Delete task (own) | `workflow.tasks.delete.own` | `OWNS`; task.status ∈ ['draft','open'] (cannot delete completed tasks) |
| Manage automation rules | `workflow.automation_rules.create.brand` | `PLAN.QUOTA`: automation_count < plan.max_automation_rules |

---

### AUTOMATION MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| All automation actions | any `automation.*` | `PLAN`: automation_enabled = true |
| Create automation | `automation.create.brand` | `PLAN.QUOTA`: automation_count < plan.max_automation_rules |
| Enable/disable (own) | `automation.enable.own` | `OWNS` |
| Test automation | `automation.test.brand` | Must not be enabled in production during test |
| Access webhook data | `automation.webhook_data.access.brand` | `PLAN`: webhook_enabled = true |

---

### AI MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| All AI generation | any `ai.*.generate.*` | `PLAN.QUOTA`: ai_credits_used + 1 ≤ ai_credits_monthly; credit decremented atomically |
| Advanced AI tools | `ai.advanced_tools.access.brand` | `PLAN`: advanced_ai_enabled = true |
| Train brand memory | `ai.brand_memory.train.brand` | `PLAN`: brand_brain_enabled = true; role ≥ BRAND_MANAGER |
| Select AI model | `ai.model_select.brand` | `PLAN`: advanced_ai_enabled = true |
| Manage AI credits | `ai.credits.manage.workspace` | role ≥ ACCOUNT_OWNER |

---

### INTEGRATIONS MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| Connect any platform | `integrations.*.connect.brand` | `PLAN.QUOTA`: social_account_count < plan.max_social_accounts (for social); OAuth flow must complete successfully |
| Disconnect platform | `integrations.*.disconnect.brand` | `APPROVAL`: WORKSPACE_ADMIN if account has active scheduled posts or running automations |
| View token value | `integrations.tokens.value.view` | **ALWAYS BLOCKED** — even SUPER_ADMIN cannot retrieve raw token values via API. DB-only access via service-role key. AUDIT logged on any access. |
| Refresh token | `integrations.tokens.refresh.brand` | `INTEGRATION_ACTIVE`: token must be expired or near expiry |
| Manual sync | `integrations.*.sync.brand` | Rate limited: max 1 sync per 5 minutes per account |

---

### WORKSPACE MODULE

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| Invite member | `workspace.team.invite.own` | `PLAN.QUOTA`: member_count < plan.max_team_members; caller cannot invite to a role higher than their own |
| Update role | `workspace.team.update_role.own` | `ESCALATION`: new_role tier must be < caller's role tier; cannot demote ACCOUNT_OWNER |
| Delete workspace | `workspace.delete.own` | role = ACCOUNT_OWNER only; `2FA`: verified; `APPROVAL`: explicit confirmation step; AUDIT logged; 30-day soft-delete grace period |
| Manage security policy | `workspace.security_policy.manage.own` | `PLAN`: advanced_permissions_enabled = true |
| Manage IP allowlist | `workspace.ip_allowlist.manage.own` | `PLAN`: ip_allowlist_enabled = true (Enterprise only) |
| Export all data | `workspace.export.manage.own` | `2FA`: verified; AUDIT logged; background job (no synchronous streaming) |

---

### PLATFORM MODULE (Admin)

| Action | Permission Key | Required ABAC Conditions |
|--------|---------------|--------------------------|
| Impersonate user | `platform.users.impersonate` | role = SUPER_ADMIN only; `2FA`: verified; AUDIT logged with `impersonated_by`; session auto-expires after 1 hour |
| Support workspace access | `platform.support.grant_workspace_access` | role ∈ [SUPPORT_ADMIN, PLATFORM_ADMIN]; requires `ticket_id`; grants are read-only; auto-expire after 24h; AUDIT logged |
| Toggle maintenance mode | `platform.maintenance_mode.enable` | role = SUPER_ADMIN only; `2FA`: verified |
| Override subscription limits | `platform.subscriptions.override_limits` | role ∈ [BILLING_ADMIN, PLATFORM_ADMIN]; AUDIT logged |
| Issue refund | `platform.invoices.refund` | role ∈ [BILLING_ADMIN, PLATFORM_ADMIN]; amount ≤ original payment |
| Delete workspace (platform) | `platform.workspaces.delete` | role ∈ [SUPER_ADMIN, PLATFORM_ADMIN]; `2FA`; `APPROVAL`: second platform admin; 30-day soft-delete |
| Force 2FA on user | `platform.users.force_2fa` | role ∈ [SECURITY_ADMIN, PLATFORM_ADMIN] |

---

## Quota Enforcement Table

| Quota Key | Plan Limit Source | Check Location | On Exceed |
|-----------|------------------|----------------|-----------|
| `max_brands` | `plan_features.max_brands` | Before brand creation | HTTP 429, show upgrade |
| `max_team_members` | `plan_features.max_team_members` | Before invite | HTTP 429, show seat limit UI |
| `ai_credits_monthly` | `plan_features.ai_credits_monthly` | Before every AI call (atomic decrement) | HTTP 429, show credits UI |
| `max_social_accounts` | `plan_features.max_social_accounts` | Before OAuth connect | HTTP 429, show upgrade |
| `max_ad_accounts` | `plan_features.max_ad_accounts` | Before ad account connect | HTTP 429 |
| `max_storage_gb` | `plan_features.max_storage_gb` | Before media upload | HTTP 413, show storage UI |
| `max_automation_rules` | `plan_features.max_automation_rules` | Before automation create | HTTP 429 |
| `max_customers` | `plan_features.max_customers` | Before CRM customer create | HTTP 429 |

---

## Sensitive Data Grant Table

These fields require an explicit `permission_overrides` record (`granted=true`) in addition to the role permission key. The ACCOUNT_OWNER grants them per-member.

| Data | Permission Key | Default | Override Required By |
|------|---------------|---------|---------------------|
| Customer PII (phone, email) | `inbox.sensitive_data.view.brand` | ❌ off | ACCOUNT_OWNER |
| Customer financial details | `crm.customers.sensitive_data.view.brand` | ❌ off | ACCOUNT_OWNER |
| Ad financial metrics (ROAS/CPA) | `ads.financial_metrics.view.brand` | ✅ on for ADS_MANAGER | ACCOUNT_OWNER can revoke |
| Team productivity analytics | `analytics.team_productivity.view.workspace` | ❌ off (below WA) | ACCOUNT_OWNER |
| Workspace audit logs | `workspace.audit_logs.view.own` | ❌ off (below WA) | ACCOUNT_OWNER |
| Customer data export | `inbox.customer_data.export.brand` | ❌ off (below WA) | WORKSPACE_ADMIN+ |

---

## Condition Evaluation Pseudocode (Edge Function)

```typescript
async function checkABAC(
  userId: string,
  permissionKey: string,
  resourceId: string,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<{ allowed: boolean; reason?: string }> {

  const conditions = ABAC_CONDITION_MAP[permissionKey];
  if (!conditions) return { allowed: true }; // no ABAC needed

  for (const condition of conditions) {
    switch (condition.type) {

      case 'OWNS':
        const { data: resource } = await supabase
          .from(condition.table)
          .select('created_by')
          .eq('id', resourceId)
          .single();
        if (resource?.created_by !== userId)
          return { allowed: false, reason: 'not_owner' };
        break;

      case 'ASSIGNED':
        const { data: assignment } = await supabase
          .from(condition.table)
          .select('assigned_to')
          .eq('id', resourceId)
          .single();
        if (assignment?.assigned_to !== userId)
          return { allowed: false, reason: 'not_assigned' };
        break;

      case 'STATE':
        const { data: record } = await supabase
          .from(condition.table)
          .select('status')
          .eq('id', resourceId)
          .single();
        if (!condition.allowed_states.includes(record?.status))
          return { allowed: false, reason: `invalid_state:${record?.status}` };
        break;

      case 'PLAN':
        const { data: feature } = await supabase.rpc('get_plan_feature', {
          p_workspace_id: workspaceId,
          p_feature_key: condition.feature_key
        });
        if (!feature || feature === false || feature === 0)
          return { allowed: false, reason: 'plan_upgrade_required' };
        break;

      case 'QUOTA':
        const { data: usage } = await supabase.rpc('get_usage', {
          p_workspace_id: workspaceId,
          p_quota_key: condition.quota_key
        });
        const limit = await getPlanLimit(workspaceId, condition.quota_key);
        if (limit !== -1 && usage >= limit)
          return { allowed: false, reason: 'quota_exceeded' };
        break;

      case 'TIME':
        const { data: grant } = await supabase
          .from('support_access_grants')
          .select('expires_at')
          .eq('workspace_id', workspaceId)
          .eq('granted_to', userId)
          .single();
        if (!grant || new Date(grant.expires_at) < new Date())
          return { allowed: false, reason: 'access_grant_expired' };
        break;

      case 'SENSITIVE':
        const { data: override } = await supabase
          .from('permission_overrides')
          .select('granted, expires_at')
          .eq('permission_key', permissionKey)
          .eq('granted', true)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (!override)
          return { allowed: false, reason: 'sensitive_data_grant_required' };
        break;

      case 'ESCALATION':
        const roleTier = await getRoleTier(userId, workspaceId);
        const targetTier = ROLE_TIER_MAP[condition.target_role];
        if (targetTier >= roleTier)
          return { allowed: false, reason: 'role_escalation_blocked' };
        break;
    }
  }

  return { allowed: true };
}
```

---

## ABAC Condition Map (Seed Data)

```typescript
// Used by checkABAC() above
const ABAC_CONDITION_MAP: Record<string, ABACCondition[]> = {
  'content.update.own':        [{ type: 'OWNS', table: 'content_pieces' }, { type: 'STATE', table: 'content_pieces', allowed_states: ['draft','review','rejected'] }],
  'content.delete.own':        [{ type: 'OWNS', table: 'content_pieces' }, { type: 'STATE', table: 'content_pieces', allowed_states: ['draft','rejected'] }],
  'content.publish.brand':     [{ type: 'STATE', table: 'content_pieces', allowed_states: ['approved','draft'], conditional_on: 'brand.require_content_approval' }],
  'content.approve.brand':     [{ type: 'STATE', table: 'content_pieces', allowed_states: ['review'] }],
  'content.ai_generate.brand': [{ type: 'QUOTA', quota_key: 'ai_credits_monthly' }],
  'content.export.brand':      [{ type: 'PLAN', feature_key: 'export_enabled' }],

  'design.update_brief.own':   [{ type: 'OWNS', table: 'design_assets' }, { type: 'STATE', table: 'design_assets', allowed_states: ['draft','revision_requested'] }],
  'design.approve.brand':      [{ type: 'STATE', table: 'design_assets', allowed_states: ['review'] }],
  'design.send_to_publish.brand': [{ type: 'STATE', table: 'design_assets', allowed_states: ['approved'] }],

  'social.posts.publish.brand': [{ type: 'INTEGRATION_ACTIVE', check: 'social_account_token_valid' }],
  'social.accounts.connect.brand': [{ type: 'QUOTA', quota_key: 'max_social_accounts' }],

  'ads.financial_metrics.view.brand': [{ type: 'SENSITIVE', permission_key: 'ads.financial_metrics.view.brand' }, { type: 'PLAN', feature_key: 'ads_enabled' }],
  'ads.campaigns.launch.brand': [{ type: 'INTEGRATION_ACTIVE', check: 'ad_account_connected' }],

  'analytics.financial_kpis.view.brand': [{ type: 'SENSITIVE', permission_key: 'analytics.financial_kpis.view.brand' }],
  'analytics.reports.export.brand': [{ type: 'PLAN', feature_key: 'export_enabled' }],
  'analytics.google.view.brand': [{ type: 'INTEGRATION_ACTIVE', check: 'google_analytics_connected' }],

  'inbox.conversations.view.assigned': [{ type: 'ASSIGNED', table: 'inbox_conversations' }],
  'inbox.messages.reply.assigned': [{ type: 'ASSIGNED', table: 'inbox_conversations' }],
  'inbox.customer_data.export.brand': [{ type: 'PLAN', feature_key: 'export_enabled' }, { type: 'SENSITIVE', permission_key: 'inbox.customer_data.export.brand' }],
  'inbox.sensitive_data.view.brand': [{ type: 'SENSITIVE', permission_key: 'inbox.sensitive_data.view.brand' }],

  'crm.customers.sensitive_data.view.brand': [{ type: 'SENSITIVE', permission_key: 'crm.customers.sensitive_data.view.brand' }],
  'crm.customers.export.brand': [{ type: 'PLAN', feature_key: 'export_enabled' }, { type: 'SENSITIVE', permission_key: 'crm.customers.export.brand' }],
  'crm.customers.delete.brand': [{ type: 'APPROVAL', approver_role: 'ACCOUNT_OWNER' }],
  'crm.customers.import.brand': [{ type: 'QUOTA', quota_key: 'max_customers' }],

  'workflow.tasks.complete.own':      [{ type: 'OWNS', table: 'crm_tasks' }, { type: 'STATE', table: 'crm_tasks', allowed_states: ['open','in_progress'] }],
  'workflow.tasks.complete.assigned': [{ type: 'ASSIGNED', table: 'crm_tasks' }, { type: 'STATE', table: 'crm_tasks', allowed_states: ['open','in_progress'] }],
  'workflow.tasks.delete.own':        [{ type: 'OWNS', table: 'crm_tasks' }, { type: 'STATE', table: 'crm_tasks', allowed_states: ['draft','open'] }],

  'ai.content.generate.brand':        [{ type: 'QUOTA', quota_key: 'ai_credits_monthly' }],
  'ai.strategy.generate.brand':       [{ type: 'QUOTA', quota_key: 'ai_credits_monthly' }],
  'ai.reports.generate.brand':        [{ type: 'QUOTA', quota_key: 'ai_credits_monthly' }],
  'ai.advanced_tools.access.brand':   [{ type: 'PLAN', feature_key: 'advanced_ai_enabled' }],
  'ai.brand_memory.train.brand':      [{ type: 'PLAN', feature_key: 'brand_brain_enabled' }],

  'automation.create.brand':          [{ type: 'QUOTA', quota_key: 'max_automation_rules' }],
  'automation.webhook_data.access.brand': [{ type: 'PLAN', feature_key: 'webhook_enabled' }],

  'brand.create.workspace':           [{ type: 'QUOTA', quota_key: 'max_brands' }],
  'brand.delete.workspace':           [{ type: 'APPROVAL', approver_role: 'ACCOUNT_OWNER' }],
  'brand.ai_memory.update.assigned':  [{ type: 'PLAN', feature_key: 'brand_brain_enabled' }],

  'workspace.team.invite.own':        [{ type: 'QUOTA', quota_key: 'max_team_members' }, { type: 'ESCALATION' }],
  'workspace.team.update_role.own':   [{ type: 'ESCALATION' }],
  'workspace.delete.own':             [{ type: 'APPROVAL', approver_role: 'ACCOUNT_OWNER' }],

  'platform.users.impersonate':       [{ type: 'TIME', max_duration_minutes: 60 }],
  'platform.support.grant_workspace_access': [{ type: 'TIME', max_duration_hours: 24, requires_ticket_id: true }],
};
```
