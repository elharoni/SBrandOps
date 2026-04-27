# SBrandOps — Role Definitions

> Version: 1.0.0 | Last Updated: 2026-04-26

---

## Overview

SBrandOps uses a three-tier role hierarchy:

```
Tier 1 — Platform Roles      (manage the SaaS platform itself)
Tier 2 — Workspace Roles     (manage a paying customer's workspace)
Tier 3 — Operational Roles   (execute brand/content/marketing work)
```

Roles are **not** inherited across tiers except where explicitly noted.
A Platform Admin is not automatically a Brand Manager in any workspace.

---

## Tier 1 — Platform Roles

### 1. SUPER_ADMIN

**Purpose:** The highest-authority platform owner. Has unconditional, irrevocable access to every feature, record, user, and setting in the system.

**Scope:** Global — all tenants, workspaces, brands, users.

**Allowed Modules:** ALL — no restrictions.

**Forbidden Modules:** None.

**Sensitive Actions Allowed:**
- Impersonate any user (must trigger audit log)
- Delete any workspace permanently
- Modify any subscription
- View and rotate all OAuth tokens
- Enable/disable system maintenance mode
- Access any audit log
- Manage all platform admin users
- Override any permission for any user

**Best Default Use Case:** Reserved for the founder and lead technical operator. Should have 2FA enforced, and all actions logged. Never share this role.

**Notes:**
- Maximum 3 accounts company-wide.
- All SUPER_ADMIN actions write to `audit_logs` with the `impersonation_flag`.
- SUPER_ADMIN cannot be created via UI — only via direct database seed.

---

### 2. PLATFORM_ADMIN

**Purpose:** Manages the operational health of the platform. Can access customer workspaces only via the support-access mechanism with audit logging.

**Scope:** Platform-wide. Workspace access requires explicit support grant.

**Allowed Modules:**
- Platform dashboard, users, workspaces
- Plans, subscriptions, feature flags
- System settings, system health
- Audit logs, security logs
- API keys (platform-level), webhooks
- AI monitor, queues

**Forbidden Modules:**
- Direct brand content (requires support-access grant)
- Customer billing details without Billing Admin role
- OAuth token values

**Sensitive Actions Allowed:**
- Suspend/unsuspend user accounts
- View platform analytics
- Toggle feature flags
- Access workspace via support mechanism (logged)

**Best Default Use Case:** Head of operations or CTO. Handles platform-level issues not covered by more specialized admins.

---

### 3. SUPPORT_ADMIN

**Purpose:** Provides customer support. Can access a customer workspace in read-only mode to diagnose issues. All access is logged.

**Scope:** Platform-wide view of accounts. Read-only access to workspaces after audit-logged support grant.

**Allowed Modules:**
- Platform users (view only)
- Support inbox
- Workspace access (read-only, with audit log trigger)
- Tickets and customer-reported issues

**Forbidden Modules:**
- Billing and payment data
- OAuth tokens
- Subscription modifications
- Brand deletion
- Team permission changes
- Customer personal data export

**Sensitive Actions Allowed:**
- Read workspace content (audit-logged, time-limited)
- Reply to support tickets on behalf of platform

**Best Default Use Case:** Customer support agents. Multiple agents can hold this role. Access to any workspace auto-expires after 24 hours and requires a ticket reference.

---

### 4. BILLING_ADMIN

**Purpose:** Manages all financial operations — subscriptions, invoices, refunds, plan changes.

**Scope:** Platform-wide billing data.

**Allowed Modules:**
- Platform subscriptions
- Payments
- Invoices
- Plans and pricing
- Platform analytics (billing-focused only)

**Forbidden Modules:**
- Brand content
- User management (beyond billing-related account lookups)
- System settings
- OAuth tokens
- Customer workspace data

**Sensitive Actions Allowed:**
- Issue refunds
- Cancel subscriptions
- Change plan for any workspace
- View all invoices

**Best Default Use Case:** Finance team member managing revenue, refunds, and plan adjustments.

---

### 5. TECHNICAL_ADMIN

**Purpose:** Manages infrastructure — integrations, API keys, webhooks, queues, system health.

**Scope:** Platform infrastructure. No customer data access.

**Allowed Modules:**
- System health
- Queues
- Platform API keys
- Webhooks
- Integration health
- AI provider key management

**Forbidden Modules:**
- Customer billing
- Brand content
- User management
- OAuth tokens (customer-level)

**Sensitive Actions Allowed:**
- Rotate platform API keys
- Manage AI provider keys
- Clear stuck queues
- Toggle system components

**Best Default Use Case:** DevOps or backend engineer managing platform infrastructure.

---

### 6. SECURITY_ADMIN

**Purpose:** Monitors security, reviews audit logs, enforces compliance.

**Scope:** Audit and security logs platform-wide. Can flag/suspend accounts.

**Allowed Modules:**
- Audit logs
- Security logs
- Platform users (suspend/flag)
- Feature flags (security-relevant)

**Forbidden Modules:**
- Brand content
- Billing modifications
- AI keys
- Webhook configuration

**Sensitive Actions Allowed:**
- View full audit trail
- Flag suspicious accounts for review
- Force 2FA on any user
- Export security reports

**Best Default Use Case:** Security officer or compliance manager.

---

## Tier 2 — Workspace / Membership Roles

### 7. ACCOUNT_OWNER

**Purpose:** The paying customer. Owns the workspace, subscription, and all brands within it. Has full control within their workspace.

**Scope:** Their own workspace — all brands, all team members, all data.

**Allowed Modules:** ALL workspace modules.

**Forbidden Modules:**
- Platform admin pages
- Other customers' workspaces

**Sensitive Actions Allowed:**
- Manage subscription and billing
- Invite/remove team members
- Assign and revoke roles
- Connect/disconnect integrations
- Delete brands
- Export all data
- Manage workspace API keys
- Transfer workspace ownership

**Best Default Use Case:** The person who signed up and pays for the subscription. Typically the agency owner, brand director, or entrepreneur.

---

### 8. WORKSPACE_ADMIN

**Purpose:** Operates with near-owner authority within the workspace. Cannot manage billing or transfer ownership.

**Scope:** Full workspace — all brands assigned, team management (cannot grant ACCOUNT_OWNER or WORKSPACE_ADMIN).

**Allowed Modules:** All operational modules. Team management (below WORKSPACE_ADMIN level only).

**Forbidden Modules:**
- Billing and subscription changes
- Workspace deletion
- Ownership transfer

**Sensitive Actions Allowed:**
- Invite team members
- Assign operational roles
- Delete content
- Manage integrations
- Export data

**Best Default Use Case:** Operations manager or lead account manager at an agency who runs day-to-day without needing billing access.

---

## Tier 3 — Operational Roles

> All Tier 3 roles are scoped to the workspace. Each role can be further scoped to specific brands.

---

### 9. BRAND_MANAGER

**Purpose:** Manages one or more specific brands end-to-end. Has full operational control over assigned brands.

**Scope:** Assigned brands only.

**Allowed Modules:**
- Brand hub (full)
- Content ops (full)
- Social ops (full)
- Ads ops (view + brief creation)
- SEO ops (full)
- Analytics (brand-level)
- Inbox (full)
- CRM (view + manage leads/orders)
- Workflow (full)
- Brand Brain (view + update)
- Campaign Brain (full)
- Integrations (connect/disconnect)
- Design (create/approve)

**Forbidden Modules:**
- Billing
- Workspace settings
- Team management
- Platform pages
- Other brands not assigned

**Sensitive Actions Allowed:**
- Publish content
- Connect integrations
- Approve campaigns
- Export brand reports

**Best Default Use Case:** Account manager responsible for a specific client brand.

---

### 10. CONTENT_MANAGER

**Purpose:** Creates, manages, approves, and schedules content for assigned brands.

**Scope:** Assigned brands. Content modules only.

**Allowed Modules:**
- Content ops (full)
- Design (briefs + view)
- Social ops (posts + scheduling, no account management)
- Brand Brain (view only)
- AI tools (content generation)
- Media assets
- Analytics (content metrics only)

**Forbidden Modules:**
- Ads ops
- Billing
- Team management
- Integrations management
- CRM sensitive data
- Inbox (unless explicitly granted)

**Sensitive Actions Allowed:**
- Approve/reject content (if configured)
- Schedule and publish posts

**Best Default Use Case:** Content strategist or copywriter managing a brand's content calendar.

---

### 11. DESIGNER

**Purpose:** Creates visual assets, design briefs, and manages creative output.

**Scope:** Assigned brands. Design and media modules only.

**Allowed Modules:**
- Design ops (full)
- Media assets (upload, manage own)
- AI tools (design prompts only)
- Content ops (view only)

**Forbidden Modules:**
- Analytics (except design performance on dashboard)
- Billing
- Team management
- Integrations
- CRM
- Inbox
- Ads

**Sensitive Actions Allowed:**
- Upload assets
- Generate AI design prompts
- Approve own designs (if configured)

**Best Default Use Case:** Graphic designer or creative professional.

---

### 12. SOCIAL_MEDIA_MANAGER

**Purpose:** Manages social media presence — publishing, scheduling, engagement.

**Scope:** Assigned brands. Social ops and inbox modules.

**Allowed Modules:**
- Social ops (full, except connect/disconnect accounts)
- Inbox (reply + tag, not create lead/order unless granted)
- Content ops (view + publish)
- Analytics (social metrics only)
- Design (view approved assets)

**Forbidden Modules:**
- Billing
- Team management
- Integrations (account connection)
- CRM sensitive data
- Ads

**Sensitive Actions Allowed:**
- Reply to public comments and messages
- Moderate comments (hide/delete)
- Schedule and publish posts

**Best Default Use Case:** Social media manager or community manager.

---

### 13. ADS_MANAGER

**Purpose:** Manages paid advertising strategy, campaign analysis, and optimization briefs.

**Scope:** Assigned brands. Ads ops module only.

**Allowed Modules:**
- Ads ops (full)
- Analytics (ads metrics, financial KPIs if granted)
- Content ops (view ad copy)
- AI tools (ad copy generation)

**Forbidden Modules:**
- Billing
- Team management
- Integrations (account connection)
- CRM sensitive data
- Social ops (inbox/comments)
- Brand identity

**Sensitive Actions Allowed (if plan allows):**
- View spend and ROAS data
- View financial ad metrics
- Export ads reports

**Best Default Use Case:** Paid media specialist or performance marketing manager.

---

### 14. SEO_SPECIALIST

**Purpose:** Manages SEO strategy, keyword research, and technical SEO recommendations.

**Scope:** Assigned brands. SEO module only.

**Allowed Modules:**
- SEO ops (full)
- Analytics (SEO + organic metrics)
- Content ops (SEO content creation)
- AI tools (keyword/content generation)
- Brand Brain (view brand voice/audience)

**Forbidden Modules:**
- Billing
- Team management
- Ads ops
- Integrations management
- CRM
- Social ops (posting)

**Sensitive Actions Allowed:**
- Edit metadata and on-page SEO
- Export SEO reports

**Best Default Use Case:** SEO strategist or technical SEO consultant.

---

### 15. INBOX_AGENT

**Purpose:** Handles customer conversations — replies, tagging, assignment. First-line responder.

**Scope:** Inbox. Can view only assigned conversations unless granted broader access.

**Allowed Modules:**
- Inbox (assigned conversations — view, reply, tag, status change, add notes)
- CRM (view customer profile, not sensitive data)
- AI tools (reply suggestions only)

**Forbidden Modules:**
- Billing
- Team management
- Analytics
- Integrations
- Content ops
- Ads
- Brand identity
- Customer data export

**Sensitive Actions Allowed:**
- Reply to assigned conversations
- Add internal notes
- Change conversation status (open/closed/pending)
- Create CRM lead (if granted)

**Best Default Use Case:** Customer service agent or social media moderator handling inbound messages.

---

### 16. ANALYST

**Purpose:** Reads and exports analytics data. No write access to operational modules.

**Scope:** Assigned brands. Analytics and reports only.

**Allowed Modules:**
- Analytics (full view)
- Reports (view + create + export)
- CRM analytics (view only)
- Ads (view only, no financial data unless granted)

**Forbidden Modules:**
- Content creation
- Billing
- Team management
- Integrations
- Inbox
- Social publishing

**Sensitive Actions Allowed:**
- Export analytics reports
- View performance KPIs
- Create custom reports

**Not Allowed:**
- View financial KPIs unless explicitly granted
- Export customer PII

**Best Default Use Case:** Data analyst, marketing analyst, or reporting manager.

---

### 17. CRM_SALES_AGENT

**Purpose:** Manages CRM pipeline, customers, orders, and sales tasks.

**Scope:** Assigned brands. CRM module only.

**Allowed Modules:**
- CRM (customers, orders, pipeline, tickets — create/update)
- Inbox (view + reply, create lead/order)
- Workflow (own tasks)
- Analytics (sales/CRM metrics only)

**Forbidden Modules:**
- Billing
- Team management
- Integrations
- Content ops
- Ads
- Brand identity
- CRM sensitive data export unless granted

**Sensitive Actions Allowed:**
- Create and update customer records
- Manage orders
- Send CRM automations
- Export own pipeline data (not all customer PII)

**Best Default Use Case:** Sales rep, account executive, or CRM manager.

---

### 18. FINANCE_VIEWER

**Purpose:** Read-only access to financial and billing data within the workspace.

**Scope:** Own workspace. Billing and financial analytics only.

**Allowed Modules:**
- Billing (view invoices only)
- Analytics (financial KPIs — view only)
- Ads (spend and budget data — view only)
- Subscriptions (view only)

**Forbidden Modules:**
- Brand content
- Team management
- Integrations
- CRM customer data
- Social ops

**Sensitive Actions Allowed:** None that modify data.

**Best Default Use Case:** Accountant, finance team member, or CFO who needs spending visibility without operational access.

---

### 19. CLIENT_VIEWER

**Purpose:** External client access to reports and dashboards only. Read-only. White-label capable.

**Scope:** Specific brands explicitly shared. View-only.

**Allowed Modules:**
- Analytics reports (shared brands only)
- Content calendar (view only, if granted)
- Social performance (view only)
- Campaign reports (view only)

**Forbidden Modules:**
- All write operations
- Billing
- Team management
- Integrations
- CRM
- Inbox
- Brand settings
- AI tools

**Sensitive Actions Allowed:** None.

**Best Default Use Case:** The agency's end client who reviews reports and campaign performance. Cannot edit anything. Typically has a branded, simplified dashboard view.

---

### 20. EXTERNAL_CONTRACTOR

**Purpose:** Freelancer or outside vendor who needs temporary access to specific modules.

**Scope:** Explicitly granted only. No default access to anything. Per-module grants required.

**Allowed Modules:** Only what is explicitly granted per session/project.

**Always Forbidden (cannot be granted):**
- Billing
- Subscription management
- Integrations (token access)
- Team management
- Customer data export
- Sensitive customer information
- Audit logs

**Sensitive Actions Allowed:** None by default. Can be granted content creation, design creation, or content scheduling per module.

**Best Default Use Case:** Freelance copywriter, designer, or consultant working on a specific project with a time-limited scope.

---

### 21. VIEWER

**Purpose:** Read-only observer across specified modules.

**Scope:** Assigned brands. View only.

**Allowed Modules (read-only):**
- Content ops (view published content)
- Analytics (basic metrics)
- Social posts (view scheduled/published)
- Brand hub (view brand identity)

**Forbidden Modules:**
- All write, create, delete, approve operations
- Billing
- Team management
- Integrations
- CRM
- Inbox

**Sensitive Actions Allowed:** None.

**Best Default Use Case:** Internal stakeholder, executive, or junior team member observing operations.

---

## Role Hierarchy Summary

```
SUPER_ADMIN
    └── PLATFORM_ADMIN
        ├── SUPPORT_ADMIN
        ├── BILLING_ADMIN
        ├── TECHNICAL_ADMIN
        └── SECURITY_ADMIN

ACCOUNT_OWNER (per workspace)
    └── WORKSPACE_ADMIN
        ├── BRAND_MANAGER
        │   ├── CONTENT_MANAGER
        │   ├── DESIGNER
        │   ├── SOCIAL_MEDIA_MANAGER
        │   ├── ADS_MANAGER
        │   ├── SEO_SPECIALIST
        │   ├── INBOX_AGENT
        │   ├── ANALYST
        │   └── CRM_SALES_AGENT
        ├── FINANCE_VIEWER
        ├── CLIENT_VIEWER
        ├── EXTERNAL_CONTRACTOR
        └── VIEWER
```

**Key Rule:** A role can only grant permissions it possesses. A BRAND_MANAGER cannot grant WORKSPACE_ADMIN. An ACCOUNT_OWNER cannot create PLATFORM_ADMIN. Role escalation attacks must be prevented at both DB and API level.
