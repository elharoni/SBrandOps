-- تحديث جدول scheduled_posts لإضافة حقول جديدة
ALTER TABLE public.scheduled_posts 
ADD COLUMN IF NOT EXISTS instagram_first_comment text,
ADD COLUMN IF NOT EXISTS locations jsonb,
ADD COLUMN IF NOT EXISTS platform_statuses jsonb,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS error_message text;

-- تحديث جدول social_accounts لإضافة حقول إضافية
ALTER TABLE public.social_accounts
ADD COLUMN IF NOT EXISTS platform_user_id text,
ADD COLUMN IF NOT EXISTS platform_username text,
ADD COLUMN IF NOT EXISTS account_type text, -- 'page', 'profile', 'business'
ADD COLUMN IF NOT EXISTS permissions text[],
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- إنشاء جدول للتحليلات (Analytics)
CREATE TABLE IF NOT EXISTS public.post_analytics (
    id uuid default uuid_generate_v4() primary key,
    post_id uuid references public.scheduled_posts(id) on delete cascade not null,
    platform text not null,
    platform_post_id text,
    impressions integer default 0,
    reach integer default 0,
    engagement integer default 0,
    likes integer default 0,
    comments integer default 0,
    shares integer default 0,
    clicks integer default 0,
    saves integer default 0,
    fetched_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء جدول لسجل الأنشطة (Activity Logs)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid default uuid_generate_v4() primary key,
    brand_id uuid references public.brands(id) on delete cascade not null,
    user_id uuid references auth.users(id),
    action text not null, -- 'post_created', 'post_published', 'account_connected', etc.
    entity_type text, -- 'post', 'account', 'brand', etc.
    entity_id uuid,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء جدول للتعليقات والمحادثات (Inbox)
CREATE TABLE IF NOT EXISTS public.inbox_conversations (
    id uuid default uuid_generate_v4() primary key,
    brand_id uuid references public.brands(id) on delete cascade not null,
    platform text not null,
    conversation_type text not null, -- 'message', 'comment', 'mention'
    platform_conversation_id text not null,
    user_name text,
    user_handle text,
    user_avatar_url text,
    last_message text,
    last_message_timestamp timestamp with time zone,
    is_read boolean default false,
    assignee_id uuid references auth.users(id),
    intent text, -- 'purchase_inquiry', 'general_question', 'complaint', etc.
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء جدول للرسائل
CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id uuid default uuid_generate_v4() primary key,
    conversation_id uuid references public.inbox_conversations(id) on delete cascade not null,
    sender text not null, -- 'user' or 'agent'
    message_text text not null,
    platform_message_id text,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء جدول لحملات الإعلانات
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
    id uuid default uuid_generate_v4() primary key,
    brand_id uuid references public.brands(id) on delete cascade not null,
    name text not null,
    platform text not null, -- 'meta', 'google', 'tiktok'
    platform_campaign_id text,
    status text default 'draft', -- 'draft', 'active', 'paused', 'completed'
    goal text, -- 'awareness', 'traffic', 'engagement', 'conversion'
    budget numeric,
    daily_budget numeric,
    start_date date,
    end_date date,
    target_audience jsonb,
    creatives jsonb,
    metrics jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء جدول لخطط التسويق
CREATE TABLE IF NOT EXISTS public.marketing_plan_details (
    id uuid default uuid_generate_v4() primary key,
    plan_id uuid references public.marketing_plans(id) on delete cascade not null,
    target_audience text,
    kpis text[],
    channels text[],
    milestones jsonb,
    tasks jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_brand_id ON public.scheduled_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_id ON public.social_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON public.post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_brand_id ON public.activity_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_brand_id ON public.inbox_conversations(brand_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_id ON public.inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_brand_id ON public.ad_campaigns(brand_id);

-- تفعيل RLS للجداول الجديدة
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_plan_details ENABLE ROW LEVEL SECURITY;

-- إنشاء policies للجداول الجديدة
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.post_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.inbox_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.inbox_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.ad_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable access for all users" ON public.marketing_plan_details FOR ALL USING (true) WITH CHECK (true);

-- إنشاء function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء triggers لتحديث updated_at
DROP TRIGGER IF EXISTS update_inbox_conversations_updated_at ON public.inbox_conversations;
CREATE TRIGGER update_inbox_conversations_updated_at 
    BEFORE UPDATE ON public.inbox_conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at 
    BEFORE UPDATE ON public.ad_campaigns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
