# SBrandOps — Audit Events Taxonomy

> Version: 2.0.0 | Last Updated: 2026-04-26

---

## Overview

Every event in this taxonomy writes one row to the `audit_logs` table.
Events are categorized by **severity**, **module**, and whether they require **immediate alerting**.

**Severity Levels:**
| Level | Code | Description |
|-------|------|-------------|
| Critical | `CRIT` | Security breach, data destruction, impersonation |
| High | `HIGH` | Sensitive data access, permission changes, deletions |
| Medium | `MED` | Significant mutations (publish, approve, connect) |
| Low | `LOW` | Normal operations (create, update, schedule) |
| Info | `INFO` | Read events logged for compliance (export, view sensitive) |

**Alert Rules:**
- `CRIT` → immediate PagerDuty/Slack alert to security team
- `HIGH` → daily digest email to ACCOUNT_OWNER
- `MED/LOW/INFO` → available in audit log UI only

---

## Audit Log Record Structure

```typescript
interface AuditLogEntry {
  id: string;                    // UUID
  workspace_id: string | null;   // null for platform-level events
  actor_id: string;              // auth.users.id
  actor_email: string;           // denormalized for readability
  actor_role: string;            // role at time of action
  action: string;                // event code from this taxonomy
  resource_type: string | null;  // 'brand', 'content_piece', 'workspace_member', etc.
  resource_id: string | null;    // UUID or string identifier
  resource_name: string | null;  // human-readable name for UI
  before_state: object | null;   // snapshot before destructive action
  after_state: object | null;    // snapshot after action
  metadata: object | null;       // action-specific extra data
  ip_address: string | null;     // from request headers
  user_agent: string | null;     // from request headers
  impersonated_by: string | null;// platform admin ID if acting as another user
  support_ticket_id: string | null; // support access reference
  created_at: string;            // ISO timestamp
}
```

---

## Platform Events

### Authentication & Session

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `auth.login.success` | INFO | — | User logged in | ip_address, user_agent |
| `auth.login.failed` | MED | — | Failed login attempt | ip_address, attempted_email |
| `auth.login.blocked` | HIGH | — | Login blocked (wrong IP / too many attempts) | ip_address, attempt_count |
| `auth.logout` | INFO | — | User logged out | session_duration_minutes |
| `auth.password.changed` | HIGH | — | Password changed | — |
| `auth.password.reset_requested` | MED | — | Password reset email sent | — |
| `auth.2fa.enabled` | MED | — | 2FA enabled by user | method: 'totp'\|'sms' |
| `auth.2fa.disabled` | HIGH | ✅ | 2FA disabled | — |
| `auth.2fa.backup_codes.viewed` | HIGH | — | Backup codes accessed | — |
| `auth.session.revoked` | HIGH | — | Session revoked by user or admin | revoked_session_id |
| `auth.session.all_revoked` | HIGH | ✅ | All sessions revoked | session_count |
| `auth.token.refreshed` | INFO | — | JWT refreshed | — |

### Impersonation (CRITICAL)

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `platform.impersonation.started` | CRIT | ✅ | Platform admin started impersonating user | impersonated_user_id, ticket_reason |
| `platform.impersonation.ended` | CRIT | ✅ | Impersonation session ended | duration_minutes, actions_taken_count |
| `platform.impersonation.action` | CRIT | ✅ | Any action taken while impersonating | impersonated_by always set |

### Platform Administration

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `platform.user.created` | MED | — | New platform user created | new_user_id, role |
| `platform.user.suspended` | HIGH | ✅ | User account suspended | reason |
| `platform.user.unsuspended` | HIGH | ✅ | User account restored | — |
| `platform.user.deleted` | CRIT | ✅ | User account deleted | before_state: user snapshot |
| `platform.user.role.changed` | HIGH | ✅ | Platform role changed | old_role, new_role |
| `platform.user.force_2fa` | HIGH | — | 2FA enforcement applied to user | — |
| `platform.workspace.suspended` | HIGH | ✅ | Entire workspace suspended | reason |
| `platform.workspace.deleted` | CRIT | ✅ | Workspace hard-deleted | before_state: workspace snapshot |
| `platform.plan.created` | MED | — | New pricing plan created | plan_name, price |
| `platform.plan.updated` | MED | — | Plan details changed | before_state, after_state |
| `platform.plan.deleted` | HIGH | — | Plan deleted | before_state |
| `platform.subscription.updated` | HIGH | — | Subscription changed by admin | old_plan, new_plan |
| `platform.subscription.overridden` | HIGH | ✅ | Subscription limits manually overridden | before_limits, after_limits |
| `platform.subscription.cancelled` | HIGH | ✅ | Subscription cancelled by admin | reason |
| `platform.invoice.refunded` | HIGH | — | Invoice refunded | amount, reason |
| `platform.invoice.voided` | HIGH | ✅ | Invoice voided | reason |
| `platform.feature_flag.toggled` | HIGH | — | Feature flag changed platform-wide | flag_name, old_value, new_value |
| `platform.system_settings.updated` | HIGH | ✅ | System settings changed | before_state, after_state |
| `platform.maintenance_mode.enabled` | CRIT | ✅ | Maintenance mode ON | — |
| `platform.maintenance_mode.disabled` | HIGH | ✅ | Maintenance mode OFF | — |
| `platform.api_key.created` | MED | — | Platform API key created | key_name |
| `platform.api_key.revoked` | HIGH | — | Platform API key revoked | key_name |
| `platform.ai_key.created` | HIGH | — | AI provider key added | provider |
| `platform.ai_key.rotated` | HIGH | — | AI key rotated | provider |
| `platform.ai_key.deleted` | HIGH | ✅ | AI key deleted | provider |

### Support Access

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `support.access.granted` | HIGH | ✅ | Support agent granted workspace access | agent_id, workspace_id, ticket_id, expires_at |
| `support.access.revoked` | HIGH | ✅ | Support access manually revoked | agent_id, workspace_id, duration_used |
| `support.access.expired` | MED | — | Support access auto-expired | agent_id, workspace_id |
| `support.access.used` | HIGH | — | Support agent accessed workspace (each time) | agent_id, pages_accessed, ticket_id |

---

## Workspace Events

### Workspace Management

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `workspace.created` | LOW | — | New workspace created | workspace_name |
| `workspace.settings.updated` | MED | — | Workspace settings changed | before_state, after_state |
| `workspace.deleted` | CRIT | ✅ | Workspace deleted | before_state: full workspace snapshot |
| `workspace.ownership.transferred` | CRIT | ✅ | Workspace owner changed | old_owner_id, new_owner_id |
| `workspace.security_policy.updated` | HIGH | ✅ | Security policy changed | before_state, after_state |
| `workspace.ip_allowlist.updated` | HIGH | ✅ | IP allowlist changed | old_ips, new_ips |
| `workspace.api_key.created` | MED | — | Workspace API key created | key_name, scopes |
| `workspace.api_key.revoked` | HIGH | — | Workspace API key revoked | key_name |
| `workspace.export.requested` | HIGH | INFO | Full workspace data export requested | export_format |

### Subscription & Billing (Workspace Level)

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `workspace.subscription.upgraded` | LOW | — | Plan upgraded | old_plan, new_plan |
| `workspace.subscription.downgraded` | HIGH | — | Plan downgraded | old_plan, new_plan |
| `workspace.subscription.cancelled` | HIGH | ✅ | Subscription cancelled by owner | cancellation_reason |
| `workspace.trial.started` | LOW | — | Trial period started | trial_end_date |
| `workspace.trial.expired` | MED | — | Trial expired without upgrade | — |

### Team Management

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `team.member.invited` | MED | — | Team member invited | invited_email, role, brand_ids |
| `team.member.invitation_resent` | LOW | — | Invitation email resent | invited_email |
| `team.member.invitation_cancelled` | MED | — | Invitation cancelled | invited_email |
| `team.member.joined` | LOW | — | Invited member accepted invitation | member_id |
| `team.member.removed` | HIGH | — | Member removed from workspace | removed_member_id, removed_by |
| `team.member.suspended` | HIGH | ✅ | Member access suspended | member_id, reason |
| `team.member.role.changed` | HIGH | ✅ | Member role changed | member_id, old_role, new_role, changed_by |
| `team.member.brand_scope.changed` | HIGH | — | Brand access scope updated | member_id, old_brands, new_brands |
| `team.permissions.override.added` | HIGH | ✅ | Permission override added for member | member_id, permission_key, granted, reason, expires_at |
| `team.permissions.override.removed` | HIGH | — | Permission override removed | member_id, permission_key |
| `team.role.created` | MED | — | Custom role created | role_name |
| `team.role.updated` | HIGH | — | Custom role permissions changed | role_name, before_permissions, after_permissions |
| `team.role.deleted` | HIGH | ✅ | Custom role deleted | role_name, affected_member_count |

---

## Brand Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `brand.created` | LOW | — | New brand created | brand_name, workspace_id |
| `brand.updated` | LOW | — | Brand details updated | brand_id, changed_fields |
| `brand.identity.updated` | MED | — | Brand identity (logo, colors) changed | brand_id, changed_fields |
| `brand.voice.updated` | MED | — | Brand voice/tone updated | brand_id |
| `brand.ai_memory.updated` | MED | — | Brand AI memory updated | brand_id |
| `brand.ai_memory.reset` | HIGH | ✅ | Brand AI memory reset/cleared | brand_id, before_state |
| `brand.archived` | HIGH | — | Brand archived | brand_id, brand_name |
| `brand.restored` | MED | — | Brand restored from archive | brand_id, brand_name |
| `brand.deleted` | CRIT | ✅ | Brand deleted | before_state: full brand snapshot, brand_name |
| `brand.transferred` | CRIT | ✅ | Brand ownership transferred | from_workspace, to_workspace |
| `brand.approval_settings.changed` | MED | — | Content approval requirement changed | old_setting, new_setting |

---

## Content Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `content.created` | INFO | — | Content piece created | content_id, type |
| `content.updated` | INFO | — | Content updated | content_id, changed_fields |
| `content.deleted` | MED | — | Content deleted | content_id, before_state |
| `content.approval.requested` | LOW | — | Approval requested | content_id, requester_id |
| `content.approval.approved` | MED | — | Content approved | content_id, approver_id |
| `content.approval.rejected` | MED | — | Content rejected | content_id, approver_id, reason |
| `content.scheduled` | LOW | — | Content scheduled | content_id, scheduled_at, platform |
| `content.published` | MED | — | Content published | content_id, platform, post_id |
| `content.unpublished` | HIGH | — | Content unpublished/taken down | content_id, platform, reason |
| `content.exported` | HIGH | INFO | Content exported | content_id, export_format |
| `content.version.restored` | MED | — | Old content version restored | content_id, version_number |
| `content.ai_generated` | LOW | — | AI content generation used | content_id, credits_used, model |

---

## Social & Integration Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `social.account.connected` | MED | — | Social account connected | platform, account_name |
| `social.account.disconnected` | HIGH | ✅ | Social account disconnected | platform, account_name, reason |
| `social.account.token.refreshed` | INFO | — | Token refreshed | platform, account_name |
| `social.account.token.expired` | HIGH | ✅ | Token expired (action failed) | platform, account_name |
| `integration.connected` | MED | — | Any integration connected | integration_type, account_name |
| `integration.disconnected` | HIGH | ✅ | Any integration disconnected | integration_type, account_name, reason |
| `integration.sync.manual` | LOW | — | Manual sync triggered | integration_type |
| `integration.sync.failed` | MED | — | Sync failed | integration_type, error_code |

---

## Inbox & Customer Data Events (Sensitive)

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `inbox.conversation.assigned` | INFO | — | Conversation assigned to agent | conversation_id, assigned_to |
| `inbox.conversation.closed` | INFO | — | Conversation closed | conversation_id |
| `inbox.message.replied` | INFO | — | Reply sent | conversation_id, message_length |
| `inbox.lead.created` | LOW | — | Lead created from conversation | conversation_id, lead_id |
| `inbox.order.created` | LOW | — | Order created from conversation | conversation_id, order_id |
| `inbox.customer_data.viewed` | HIGH | INFO | Sensitive customer data viewed | customer_id, accessed_fields |
| `inbox.customer_data.exported` | CRIT | ✅ | Customer data exported | export_format, record_count, requested_by, approved_by |
| `inbox.customer_data.deleted` | CRIT | ✅ | Customer data deleted | customer_id, before_state, deleted_by, approved_by |

---

## CRM Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `crm.customer.created` | LOW | — | New customer created | customer_id |
| `crm.customer.updated` | LOW | — | Customer updated | customer_id, changed_fields |
| `crm.customer.deleted` | CRIT | ✅ | Customer deleted | customer_id, before_state, approved_by |
| `crm.customer.merged` | HIGH | — | Two customers merged | source_id, target_id, merged_by |
| `crm.customer.exported` | CRIT | ✅ | Customer records exported | record_count, export_format, approved_by |
| `crm.customer.imported` | HIGH | — | Customers bulk-imported | record_count, source_format |
| `crm.customer.blacklisted` | HIGH | — | Customer blacklisted | customer_id, reason |
| `crm.sensitive_data.accessed` | HIGH | INFO | Sensitive CRM data accessed | customer_id, accessor_id, accessed_fields |
| `crm.order.refunded` | HIGH | — | Order refunded | order_id, amount, reason, approved_by |
| `crm.order.cancelled` | MED | — | Order cancelled | order_id, reason |
| `crm.segment.exported` | HIGH | INFO | Customer segment exported | segment_id, record_count |
| `crm.automation.enabled` | MED | — | CRM automation enabled | automation_id, automation_name |
| `crm.automation.disabled` | MED | — | CRM automation disabled | automation_id |

---

## Ads Events (Financial Sensitivity)

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `ads.account.connected` | MED | — | Ad account connected | platform, account_id |
| `ads.account.disconnected` | HIGH | ✅ | Ad account disconnected | platform, account_id |
| `ads.campaign.launched` | HIGH | — | Campaign launched | campaign_id, budget, platform |
| `ads.campaign.paused` | MED | — | Campaign paused | campaign_id, reason |
| `ads.financial_data.accessed` | HIGH | INFO | Financial metrics viewed (ROAS/spend) | brand_id, date_range, accessor_id |
| `ads.report.exported` | HIGH | INFO | Ads report exported with financial data | report_id, date_range, includes_financial |

---

## Automation Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `automation.created` | LOW | — | New automation created | automation_id, automation_name, trigger_type |
| `automation.updated` | MED | — | Automation updated | automation_id, changed_fields |
| `automation.deleted` | MED | — | Automation deleted | automation_id, automation_name, before_state |
| `automation.enabled` | MED | — | Automation enabled | automation_id |
| `automation.disabled` | MED | — | Automation disabled | automation_id |
| `automation.executed` | INFO | — | Automation ran | automation_id, trigger, result |
| `automation.failed` | MED | — | Automation execution failed | automation_id, error_code |
| `automation.webhook.received` | INFO | — | Webhook payload received | automation_id, source_ip |

---

## AI Usage Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `ai.content.generated` | INFO | — | AI content generated | brand_id, credits_used, model, tokens |
| `ai.credits.depleted` | HIGH | ✅ | Monthly AI credits hit zero | workspace_id, credits_limit, usage |
| `ai.credits.reset` | LOW | — | Monthly credits reset | new_limit |
| `ai.credits.manually_adjusted` | HIGH | ✅ | Credits manually adjusted by platform admin | old_amount, new_amount, reason |
| `ai.brand_memory.trained` | MED | — | Brand memory training ran | brand_id, tokens_processed |
| `ai.advanced_tools.accessed` | INFO | — | Advanced AI feature accessed | tool_name, brand_id |

---

## Approval Workflow Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `approval.requested` | LOW | — | Approval request created | action_type, resource_id, requester_id, approver_role |
| `approval.approved` | MED | — | Request approved | request_id, approver_id, action_type |
| `approval.rejected` | MED | — | Request rejected | request_id, approver_id, reason |
| `approval.expired` | MED | — | Approval timed out | request_id, action_type |
| `approval.cancelled` | LOW | — | Request cancelled by requester | request_id |

---

## Data Retention & Compliance Events

| Event Code | Severity | Alert | Description | Key Fields |
|-----------|:--------:|:-----:|-------------|------------|
| `compliance.data_export.requested` | HIGH | ✅ | GDPR Article 20 export requested | requested_for, requester_id |
| `compliance.data_export.completed` | HIGH | ✅ | GDPR export completed | file_size, record_count |
| `compliance.right_to_erasure.requested` | CRIT | ✅ | GDPR Article 17 deletion requested | subject_email, requester_id |
| `compliance.right_to_erasure.completed` | CRIT | ✅ | GDPR erasure completed | tables_affected, records_deleted |
| `compliance.data_retention.purged` | HIGH | ✅ | Data retention policy purge ran | records_deleted, oldest_record_date |

---

## Audit Log Retention Policy

| Plan | Retention Period | Export Available |
|------|:---------------:|:---------------:|
| Free / Starter | Not available | ❌ |
| Pro | 30 days (view only) | ❌ |
| Business | 1 year | ✅ CSV |
| Agency | 2 years | ✅ CSV + JSON |
| Enterprise | Unlimited | ✅ All formats |

---

## Audit Log Alerting Rules

```typescript
// Alert severity → notification channel
const ALERT_RULES = {
  CRIT: {
    channels: ['slack_security_channel', 'pagerduty', 'email_security_team'],
    delay: 0,      // immediate
  },
  HIGH: {
    channels: ['slack_security_channel', 'email_account_owner'],
    delay: 0,      // immediate for security events; daily digest for operational HIGH
    digest_daily: true,
  },
  MED: {
    channels: ['email_account_owner'],
    delay: 3600,   // hourly digest
    digest_daily: true,
  },
};

// Events that ALWAYS alert regardless of severity rating
const ALWAYS_ALERT = [
  'platform.impersonation.started',
  'platform.maintenance_mode.enabled',
  'platform.user.deleted',
  'workspace.deleted',
  'brand.deleted',
  'inbox.customer_data.exported',
  'inbox.customer_data.deleted',
  'crm.customer.exported',
  'crm.customer.deleted',
  'compliance.right_to_erasure.requested',
  'auth.2fa.disabled',
  'team.member.role.changed',
  'team.permissions.override.added',
];
```

---

## TypeScript Types

```typescript
// types/audit.ts

export type AuditSeverity = 'CRIT' | 'HIGH' | 'MED' | 'LOW' | 'INFO';

export interface AuditEvent {
  code: string;           // e.g. 'brand.deleted'
  severity: AuditSeverity;
  resourceType: string;   // 'brand', 'workspace_member', etc.
  requiresApproval: boolean;
  sensitiveData: boolean; // true = log before_state
  alertImmediately: boolean;
}

// Service usage:
import { auditService } from '@/services/auditService';

await auditService.log({
  action: 'brand.deleted',
  workspaceId: brand.workspace_id,
  resourceType: 'brand',
  resourceId: brand.id,
  resourceName: brand.name,
  beforeState: brand,        // snapshot before deletion
  metadata: { deletedBy: user.id, approvalRequestId: approvalId },
  req,                       // Express/Deno request for IP/UA extraction
});
```

---

## Audit Service Implementation

```typescript
// services/auditService.ts

export const auditService = {
  async log(params: {
    action: string;
    workspaceId?: string;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
    beforeState?: object;
    afterState?: object;
    metadata?: object;
    req?: Request;
  }): Promise<void> {
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      params.req?.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    const impersonatedBy = params.req?.headers.get('X-Impersonated-By') ?? null;

    await supabaseAdmin.from('audit_logs').insert({
      workspace_id: params.workspaceId,
      actor_id: user?.id,
      actor_email: user?.email,
      actor_role: await getActorRole(user?.id, params.workspaceId),
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      resource_name: params.resourceName,
      before_state: params.beforeState,
      after_state: params.afterState,
      metadata: params.metadata,
      ip_address: params.req?.headers.get('CF-Connecting-IP')
                ?? params.req?.headers.get('X-Forwarded-For'),
      user_agent: params.req?.headers.get('User-Agent'),
      impersonated_by: impersonatedBy,
    });

    // Trigger alert if needed
    const severity = AUDIT_EVENT_SEVERITY_MAP[params.action];
    if (severity === 'CRIT' || ALWAYS_ALERT.includes(params.action)) {
      await alertingService.sendImmediate(params.action, params.workspaceId);
    }
  }
};
```
