# SBrandOps Master Execution Backlog

## Purpose
This file is the working execution backlog for the product.
It combines the platform backlog with the integrations program so the team can pick up work without rebuilding context.

## Current Product Truth
- The public-site and app-shell split is already in place.
- The integrations workspace is now operationally grouped in the UI instead of using fake connect toggles.
- Social publishing connections already have a real flow through `socialAuthService.ts` and `socialAccountService.ts`.
- Non-social integrations still need real end-to-end connection flows even when their UI state is now honest.
- `brand_connections` should be treated as the single source of truth for non-social providers.
- `services/integrationsService.ts` should no longer be used as a fake runtime connection layer.

## Canonical Files For This Program
- `components/pages/IntegrationsPage.tsx`
- `components/pages/AccountsPage.tsx`
- `components/pages/AdsOpsPage.tsx`
- `components/pages/AnalyticsPage.tsx`
- `components/pages/SEOOpsPage.tsx`
- `components/pages/crm/CrmIntegrationsPage.tsx`
- `hooks/useBrandData.ts`
- `services/brandConnectionService.ts`
- `services/socialAuthService.ts`
- `services/socialAccountService.ts`
- `services/shopifyIntegration.ts`
- `services/woocommerceIntegration.ts`
- `services/seoOpsService.ts`
- `services/integrationsService.ts`
- `__tests__/integrationsModel.test.ts`
- `__tests__/socialAccountService.test.ts`

## Track A - Platform And Launch

### Phase 1 - Public Site And Route Split
- [x] Move the authenticated app from `/` to `/app`
- [x] Add public routes for `/`, `/about`, `/pricing`, `/contact`, `/terms`, `/privacy`, `/refunds`, `/cookies`
- [x] Split public shell from app shell
- [x] Create the marketing shell scaffold
- [ ] Finalize Arabic and English marketing copy
- [ ] Add expanded FAQ, testimonials, and proof sections
- [ ] Add a real contact flow or demo request flow

### Phase 2 - Pricing And Billing Architecture
- [ ] Finalize official plans: Starter / Growth / Agency / Enterprise
- [ ] Define usage limits for brands, users, AI tokens, and connected accounts
- [ ] Finalize billing data model for `plans`, `subscriptions`, `payments`, `invoices`, `billing_events`, `tenant_usage`, `coupons`
- [ ] Ship final pricing comparison page
- [ ] Add trial details, monthly-yearly toggle, VAT notes, and cancellation notes

### Phase 3 - Paddle Integration
- [ ] Configure Paddle products and prices
- [ ] Build checkout entry flow from pricing
- [ ] Build webhook handlers for checkout completed, subscription created, subscription updated, payment succeeded, payment failed, subscription canceled, refunded
- [ ] Sync subscription state back to tenant plan and account status
- [ ] Build customer portal flow

### Phase 4 - Admin Billing Center
- [ ] Subscription overview
- [ ] Current plan with renewal date and billing cycle
- [ ] Usage meters for brands, users, and AI
- [ ] Invoices list with download links
- [ ] Payment methods management
- [ ] Upgrade, downgrade, cancel, resume
- [ ] Coupons and promo support
- [ ] Webhook logs screen

### Phase 5 - Legal And Trust
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Refund Policy
- [ ] Cookie Policy
- [x] Billing Policy
- [x] Security and Data Processing page

### Phase 6 - Product Readiness
- [ ] Help Center
- [ ] Blog or changelog
- [ ] System status page
- [ ] Support email and contact workflow
- [ ] Post-subscription onboarding improvements

### Phase 7 - Local Expansion
- [ ] Study Paymob integration
- [ ] Add local payment support for EGP and wallets
- [ ] Support local offers and vouchers

## Track B - Integrations Program

## Program Goals
- Replace all remaining fake integration states with real provider flows or explicit `Coming soon` behavior.
- Make `IntegrationsPage` the orchestration layer for connection status, health, sync state, and provider actions.
- Keep `AccountsPage` focused on social publishing accounts.
- Unify CRM, SEO, analytics, ads, and commerce integrations under one connection model.
- Ensure onboarding and dashboard progress are calculated from real connected state.

## Architecture Decisions
- Use `brand_connections` as the canonical table for non-social providers.
- Keep social publishing accounts in the existing social account model until there is a clear migration plan.
- Store provider assets after connection discovery: ad accounts, analytics properties, stores, websites, channels, folders, files.
- Every provider must support these minimum states: `connected`, `needs_reauth`, `error`, `paused`, `disconnected`.
- Every provider must support these minimum UI fields when available: account name, external ID, last sync time, sync health, last error, linked assets.
- `Disconnect` must always require confirmation.
- `Reconnect` must be provider-specific and not a generic toggle.

## Foundation Work Before Any New Provider
- [x] Remove runtime dependence on `services/integrationsService.ts` for actual connection state
- [x] Document provider enum ownership in `brandConnectionService.ts`
- [x] Standardize provider metadata contract for `last_sync_at`, `sync_health`, `last_error`, `external_account_id`, `display_name`
- [x] Standardize asset persistence contract across ads, analytics, commerce, messaging, and files
- [x] Add a shared service layer for connect, reconnect, disconnect, fetch assets, and status refresh
- [x] Add shared UI helpers for status badges, health chips, error summaries, and sync timestamps
- [ ] Add shared test fixtures for connection states and linked assets
- [x] Audit onboarding, dashboard, and settings flows to ensure they all read real connection state

## Execution Order
| Priority | Group | Provider | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Ads | Google Ads | Next | Highest business value and already affects onboarding logic |
| 2 | Analytics | GA4 | Next | Core reporting dependency |
| 3 | Analytics | Search Console | Next | SEO and search visibility dependency |
| 4 | Commerce & Web | Shopify | Next | Existing integration service already present |
| 5 | Commerce & Web | WooCommerce | Next | Existing integration service already present |
| 6 | Commerce & Web | WordPress | Next | SEO export already exists and needs connection unification |
| 7 | Messaging & Support | WhatsApp Business | Later | Needed for inbox and support workflows |
| 8 | Messaging & Support | Telegram | Later | Bot and alerting workflow |
| 9 | Automation | Slack | Later | Team notifications and approvals |
| 10 | Automation | Zapier | Later | External automations and webhooks |
| 11 | Files & Creative | Google Drive | Later | Asset storage and content workflow |
| 12 | Files & Creative | Figma | Later | Design asset linkage and creative workflow |

## Provider 1 - Google Ads

### Goal
Ship a real Google Ads connection that discovers ad accounts, persists them, and drives Ads Ops and onboarding from live data.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `components/pages/AdsOpsPage.tsx`
- `hooks/useBrandData.ts`

### Tasks
- [x] Add `google_ads` as a fully implemented provider contract if any gaps remain
- [ ] Build the real auth and callback flow
- [x] Persist connection metadata in `brand_connections`
- [x] Discover ad accounts after auth
- [x] Save discovered ad accounts into the ad account layer used by Ads Ops
- [x] Surface account name, external account ID, sync health, last sync time, and last error in `IntegrationsPage`
- [x] Implement `Reconnect`
- [x] Implement confirmed `Disconnect`
- [x] Make onboarding and dashboard ads progress depend on real Google Ads connection state
- [x] Add a manual refresh action for provider assets and status

### Definition Of Done
- [x] A user can connect Google Ads from `IntegrationsPage`
- [ ] Connected ad accounts appear in the UI without fake state
- [ ] Ads Ops can read the selected account from persisted data
- [x] Reauth and disconnect both work
- [x] Sync failures are visible in the page

### Tests
- [ ] Service tests for auth result handling
- [ ] Service tests for ad account discovery and persistence
- [ ] UI tests for connected, error, and needs-reauth states
- [ ] Regression test for dashboard ads progress

## Provider 2 - GA4

### Goal
Connect analytics properties and expose them as the primary analytics source for brand-level reporting.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `components/pages/AnalyticsPage.tsx`

### Tasks
- [x] Build GA4 auth and property discovery
- [x] Persist the provider connection in `brand_connections`
- [x] Persist discovered properties in the analytics property layer
- [x] Expose property name and measurement ID in `IntegrationsPage`
- [x] Add `Reconnect`, confirmed `Disconnect`, and refresh
- [x] Ensure analytics screens consume the saved property
- [x] Surface sync health and last error

### Definition Of Done
- [x] A user can connect GA4
- [x] One or more GA4 properties are discovered and stored
- [x] Analytics views use live GA4 property selection
- [x] Broken auth is visible and recoverable from the page

### Tests
- [ ] Service tests for property discovery
- [ ] Persistence tests for connection and properties
- [ ] UI tests for GA4 status rendering

## Provider 3 - Search Console

### Goal
Connect search properties so SEO workflows stop relying on disconnected or manual state.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `services/seoOpsService.ts`
- `components/pages/IntegrationsPage.tsx`
- `components/pages/SEOOpsPage.tsx`

### Tasks
- [x] Build Search Console auth and property selection
- [x] Persist the connection in `brand_connections`
- [x] Persist the selected sites or properties
- [x] Show linked property, sync health, last sync time, and last error
- [x] Add reconnect, disconnect, and refresh flows
- [x] Wire SEO workflows to the saved Search Console property

### Definition Of Done
- [x] A user can connect Search Console from the integrations workspace
- [x] SEO workflows can read the saved property
- [x] Reauth and disconnect are both supported

### Tests
- [ ] Service tests for property listing and selection
- [ ] UI tests for status and linked property rendering

## Provider 4 - Shopify

### Goal
Turn the existing Shopify integration code into a unified product connection visible in the integrations workspace.

### Existing Touchpoints
- `services/shopifyIntegration.ts`
- `components/pages/crm/CrmIntegrationsPage.tsx`
- `components/pages/IntegrationsPage.tsx`

### Tasks
- [x] Unify Shopify auth with `brand_connections`
- [x] Persist store metadata and domain
- [x] Run an initial sync after connection
- [x] Show store name, domain, sync health, and last sync time in `IntegrationsPage`
- [x] Route any CRM Shopify entry point back to the unified connection model
- [x] Add reconnect, disconnect, and refresh

### Definition Of Done
- [x] A user can connect Shopify once and see it reflected everywhere
- [x] CRM and integrations pages no longer disagree about Shopify state
- [x] The saved store can be reused without asking for credentials again

### Tests
- [ ] Service tests for connect and callback handling
- [ ] Persistence tests for store metadata
- [ ] UI tests for Shopify connected state

## Provider 5 - WooCommerce

### Goal
Replace the isolated WooCommerce path with the same unified connection lifecycle used by other commerce providers.

### Existing Touchpoints
- `services/woocommerceIntegration.ts`
- `components/pages/crm/CrmIntegrationsPage.tsx`
- `components/pages/IntegrationsPage.tsx`

### Tasks
- [x] Unify WooCommerce credentials flow with `brand_connections`
- [x] Validate and persist store URL and account metadata
- [x] Add initial sync and status refresh
- [x] Show store URL, sync health, last sync time, and last error
- [x] Add reconnect and confirmed disconnect

### Definition Of Done
- [x] WooCommerce can be connected from the integrations workspace
- [x] CRM and integrations use the same connection record
- [x] Connection failures are visible and actionable

### Tests
- [ ] Credential validation tests
- [ ] Persistence tests
- [ ] UI tests for connected and error states

## Provider 6 - WordPress

### Goal
Turn WordPress from a page-local export credential flow into a reusable brand-level connection.

### Existing Touchpoints
- `services/seoOpsService.ts`
- `components/pages/SEOOpsPage.tsx`
- `components/pages/IntegrationsPage.tsx`

### Tasks
- [x] Add `wordpress` to the unified connection model if not already defined
- [x] Persist WordPress connection details as a brand-level provider
- [x] Reuse the saved connection in SEO export flows
- [x] Show website, sync health, and last error in `IntegrationsPage`
- [x] Add reconnect, disconnect, and refresh

### Definition Of Done
- [x] WordPress credentials are not re-entered per export session
- [x] SEO export uses the saved brand connection
- [x] Integrations workspace shows real state

### Tests
- [ ] Service tests for saving and reusing WordPress credentials
- [ ] UI tests for WordPress status rendering

## Provider 7 - WhatsApp Business

### Goal
Create a real messaging connection that can later power inbox and support workflows.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `services/inboxService.ts`
- `services/crmInboxService.ts`

### Tasks
- [ ] Add `whatsapp_business` provider support
- [ ] Build auth and account linkage flow
- [ ] Persist phone number or account identity and webhook metadata
- [ ] Show account name or number, health, and last webhook activity
- [ ] Define how inbound events map into inbox or CRM
- [ ] Add reconnect, disconnect, and refresh

### Definition Of Done
- [ ] WhatsApp Business can be connected from the integrations workspace
- [ ] The connection has visible health and account identity
- [ ] The product has a defined message ingestion path

### Tests
- [ ] Service tests for connection metadata persistence
- [ ] Event ingestion tests
- [ ] UI tests for messaging provider status

## Provider 8 - Telegram

### Goal
Support Telegram as a messaging and alerting provider with bot-level configuration.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `services/inboxService.ts`

### Tasks
- [ ] Add `telegram` provider support
- [ ] Support bot token validation
- [ ] Support webhook or polling setup based on the chosen architecture
- [ ] Persist bot identity and status metadata
- [ ] Show bot name, last activity, and health
- [ ] Add reconnect, disconnect, and refresh

### Definition Of Done
- [ ] Telegram bot connection is visible and recoverable from the workspace
- [ ] Connection metadata is persisted at brand level

### Tests
- [ ] Token validation tests
- [ ] Event path tests
- [ ] UI tests for Telegram status

## Provider 9 - Slack

### Goal
Use Slack as a workspace-level notification and approval integration rather than a fake placeholder.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `services/smartNotificationsService.ts`

### Tasks
- [x] Add `slack` provider support
- [x] Build workspace and channel linking flow
- [x] Persist workspace identity and selected channels
- [x] Show workspace and channel in `IntegrationsPage`
- [ ] Define the first notification or approval use case that consumes the connection
- [x] Add reconnect, disconnect, and refresh

### Definition Of Done
- [x] Slack can be connected and a channel can be selected
- [ ] At least one product notification path uses the connection

### Tests
- [ ] Service tests for workspace and channel selection
- [ ] Notification delivery tests
- [ ] UI tests for Slack connected state

## Provider 10 - Zapier

### Goal
Expose a real automation entry point for external workflows.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `services/workflowService.ts`

### Tasks
- [ ] Define whether the integration is webhook-based, API-key-based, or both
- [x] Persist Zapier connection configuration
- [ ] Expose a test trigger or ping action
- [ ] Show last successful trigger or last error in `IntegrationsPage`
- [x] Add disconnect and refresh

### Definition Of Done
- [x] Zapier has a real configuration flow
- [ ] The workspace shows whether the connection actually works

### Tests
- [ ] Config validation tests
- [ ] Trigger delivery tests
- [ ] UI tests for Zapier status

## Provider 11 - Google Drive

### Goal
Connect file storage and brand assets to a reusable Google Drive integration.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- `services/brandHubService.ts`
- `services/storageService.ts`

### Tasks
- [x] Add `google_drive` provider support
- [x] Build auth and folder selection flow
- [x] Persist linked folders and identity metadata
- [x] Show linked folder or account in `IntegrationsPage`
- [ ] Define the first asset workflow that consumes the connection
- [x] Add reconnect, disconnect, and refresh

### Definition Of Done
- [x] Google Drive can be linked to a brand
- [x] The selected folder or account is visible in the workspace
- [ ] At least one brand asset flow uses the connection

### Tests
- [ ] Auth tests
- [ ] Folder selection tests
- [ ] UI tests for Drive status

## Provider 12 - Figma

### Goal
Link design files or teams to the brand so creative workflows can use real source metadata.

### Existing Touchpoints
- `services/brandConnectionService.ts`
- `components/pages/IntegrationsPage.tsx`
- Design and creative workflow surfaces

### Tasks
- [x] Add `figma` provider support
- [x] Build auth and file or team linking flow
- [x] Persist file, project, or team metadata
- [x] Show linked design source in `IntegrationsPage`
- [ ] Define the first real creative workflow that consumes the connection
- [x] Add reconnect, disconnect, and refresh

### Definition Of Done
- [x] Figma can be linked as a real provider
- [x] The linked source is visible in the workspace
- [ ] At least one downstream workflow uses the saved connection

### Tests
- [ ] Auth tests
- [ ] Metadata persistence tests
- [ ] UI tests for Figma status

## Cross-Cutting QA Work
- [ ] Add coverage for `IntegrationsPage` rendering states
- [ ] Add coverage for provider action buttons and confirmation flow
- [ ] Add coverage for connection health and error summaries
- [ ] Add coverage for dashboard and onboarding progress dependencies
- [ ] Add fixture coverage for empty brand, partially connected brand, and failed provider states

## Cleanup Work After Provider Rollout
- [x] Remove or demote `services/integrationsService.ts` to catalog-only responsibilities
- [x] Collapse duplicated integration entry points between CRM pages and `IntegrationsPage`
- [x] Ensure `AccountsPage` is scoped to social publishing and does not compete with the integrations workspace
- [ ] Remove any UI copy that implies a provider works before its real flow exists
- [x] Update onboarding copy to route users into the real provider flow

## Sprint Suggestion

### Now
- [ ] Foundation work for unified connection metadata and shared provider actions
- [ ] Google Ads
- [ ] GA4
- [ ] Search Console

### Next
- [ ] Shopify
- [ ] WooCommerce
- [ ] WordPress

### Later
- [ ] WhatsApp Business
- [ ] Telegram
- [ ] Slack
- [ ] Zapier
- [ ] Google Drive
- [ ] Figma

## New Chat Handoff
Use this prompt in the next chat if you want immediate execution:

`Open EXECUTION_BACKLOG.md and start implementing the Integrations Program from the top of the Now section. Begin with the foundation tasks, then complete Google Ads end-to-end before moving to GA4. Keep brand_connections as the source of truth for non-social providers and update tests as you go.`
