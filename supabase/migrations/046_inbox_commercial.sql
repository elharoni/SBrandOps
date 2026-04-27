-- Migration 046: Inbox Commercial Intelligence
-- Adds reply logging, lead scoring, opportunity pipeline, and follow-up reminders

-- ── inbox_reply_logs ──────────────────────────────────────────────────────────
-- Idempotency guard + audit log for every outbound reply attempt
create table if not exists inbox_reply_logs (
    id                   uuid primary key default gen_random_uuid(),
    brand_id             uuid not null references brands(id) on delete cascade,
    conversation_id      uuid,                          -- null for sm:: conversations
    target_external_id   text,                          -- comment_id / post_id targeted
    idempotency_key      text not null,
    reply_mode           text not null default 'dm',   -- dm | public_comment_reply | private_comment_reply | ad_comment_reply
    message              text not null,
    status               text not null default 'pending', -- pending | sent | failed
    platform_message_id  text,
    reply_method         text,
    error_code           text,
    error_message        text,
    created_by           uuid references auth.users(id),
    created_at           timestamptz default now(),
    unique (brand_id, idempotency_key)
);

alter table inbox_reply_logs enable row level security;
create policy "brand_member_reply_logs" on inbox_reply_logs
    using (brand_id in (select id from brands where user_id = auth.uid()));

create index if not exists idx_reply_logs_brand_conv
    on inbox_reply_logs (brand_id, conversation_id);

-- ── inbox_commercial_intelligence ─────────────────────────────────────────────
-- Per-conversation lead scoring, product interest, next best action
create table if not exists inbox_commercial_intelligence (
    id                   uuid primary key default gen_random_uuid(),
    brand_id             uuid not null references brands(id) on delete cascade,
    conversation_id      text not null,                 -- text to support sm:: ids
    lead_score           int not null default 0 check (lead_score between 0 and 100),
    commercial_intent    text,                          -- purchase_inquiry | price_check | order_intent | warranty | complaint | general
    product_interest     text,
    estimated_value      numeric not null default 0,
    close_probability    int not null default 0 check (close_probability between 0 and 100),
    expected_revenue     numeric generated always as (estimated_value * close_probability / 100.0) stored,
    next_best_action     text,                          -- reply_price | ask_size | create_lead | create_order | follow_up | hide_comment | escalate_support
    loss_risk            text,                          -- none | low | medium | high
    item_type            text not null default 'dm',   -- dm | facebook_comment | instagram_comment | ad_comment | mention | story_reply
    ad_campaign_id       text,
    ad_set_id            text,
    ad_id                text,
    ad_post_id           text,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now(),
    unique (brand_id, conversation_id)
);

alter table inbox_commercial_intelligence enable row level security;
create policy "brand_member_commercial_intel" on inbox_commercial_intelligence
    using (brand_id in (select id from brands where user_id = auth.uid()));

create index if not exists idx_commercial_intel_brand
    on inbox_commercial_intelligence (brand_id, lead_score desc);

-- ── inbox_opportunities ───────────────────────────────────────────────────────
-- Sales pipeline per conversation
create table if not exists inbox_opportunities (
    id                   uuid primary key default gen_random_uuid(),
    brand_id             uuid not null references brands(id) on delete cascade,
    conversation_id      text not null,
    crm_customer_id      uuid,
    title                text not null default 'فرصة بيع',
    stage                text not null default 'new_inquiry',
    -- stages: new_inquiry | qualified_lead | price_sent | negotiation | order_confirmed | payment_pending | closed_won | closed_lost
    value                numeric not null default 0,
    probability          int not null default 50 check (probability between 0 and 100),
    source               text,                          -- facebook_comment | instagram_dm | ad_comment | mention
    platform             text,
    product_interest     text,
    assigned_to          uuid references auth.users(id),
    expected_close_date  date,
    status               text not null default 'open', -- open | won | lost | on_hold
    lost_reason          text,
    notes                text,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now()
);

alter table inbox_opportunities enable row level security;
create policy "brand_member_opportunities" on inbox_opportunities
    using (brand_id in (select id from brands where user_id = auth.uid()));

create index if not exists idx_opportunities_brand_stage
    on inbox_opportunities (brand_id, stage, status);

-- ── inbox_followups ───────────────────────────────────────────────────────────
-- Scheduled follow-up reminders per conversation
create table if not exists inbox_followups (
    id                   uuid primary key default gen_random_uuid(),
    brand_id             uuid not null references brands(id) on delete cascade,
    conversation_id      text not null,
    crm_customer_id      uuid,
    followup_type        text not null default 'manual', -- manual | price_sent | no_response | post_order
    due_at               timestamptz not null,
    message_template     text,
    status               text not null default 'pending', -- pending | done | overdue | cancelled
    assigned_to          uuid references auth.users(id),
    completed_at         timestamptz,
    created_at           timestamptz default now()
);

alter table inbox_followups enable row level security;
create policy "brand_member_followups" on inbox_followups
    using (brand_id in (select id from brands where user_id = auth.uid()));

create index if not exists idx_followups_brand_due
    on inbox_followups (brand_id, due_at, status);

-- ── inbox_moderation_actions ──────────────────────────────────────────────────
-- Audit log for hide/delete/spam comment actions
create table if not exists inbox_moderation_actions (
    id                   uuid primary key default gen_random_uuid(),
    brand_id             uuid not null references brands(id) on delete cascade,
    conversation_id      text,
    platform             text not null,
    action               text not null, -- hide | unhide | delete | mark_spam | mark_negative
    target_external_id   text not null,
    status               text not null default 'pending', -- pending | done | failed
    performed_by         uuid references auth.users(id),
    error_message        text,
    created_at           timestamptz default now()
);

alter table inbox_moderation_actions enable row level security;
create policy "brand_member_moderation" on inbox_moderation_actions
    using (brand_id in (select id from brands where user_id = auth.uid()));
