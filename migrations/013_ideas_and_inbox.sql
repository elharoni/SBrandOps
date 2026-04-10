-- Migration 013: Ideas (IdeaOps) & Inbox Conversations
-- ══════════════════════════════════════════════════════

-- Brainstormed ideas (IdeaOps)
CREATE TABLE IF NOT EXISTS public.brainstormed_ideas (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title       text NOT NULL,
    description text,
    platform    text,           -- SocialPlatform enum value
    format      text,           -- 'Reel' | 'Story' | 'Carousel' | 'Post' | etc.
    angle       text,           -- 'Educational' | 'UGC' | 'Interactive' | etc.
    is_saved    boolean NOT NULL DEFAULT false,
    sent_to_content_ops boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_brand_id ON public.brainstormed_ideas(brand_id);

ALTER TABLE public.brainstormed_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand ideas"
    ON public.brainstormed_ideas FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Inbox conversations (social media DMs / comments / mentions)
CREATE TABLE IF NOT EXISTS public.inbox_conversations (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    platform                text NOT NULL,  -- SocialPlatform
    type                    text NOT NULL,  -- 'message' | 'comment' | 'mention'
    external_id             text,           -- platform's own conversation ID
    user_name               text NOT NULL,
    user_handle             text,
    user_avatar_url         text,
    last_message_text       text,
    last_message_at         timestamptz NOT NULL DEFAULT now(),
    is_read                 boolean NOT NULL DEFAULT false,
    assignee                text,
    intent                  text,           -- ConversationIntent
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_brand_id       ON public.inbox_conversations(brand_id);
CREATE INDEX IF NOT EXISTS idx_inbox_last_message   ON public.inbox_conversations(last_message_at DESC);

ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inbox"
    ON public.inbox_conversations FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Inbox messages (individual messages in a conversation)
CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    sender          text NOT NULL DEFAULT 'user', -- 'user' | 'agent'
    text            text NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conv  ON public.inbox_messages(conversation_id);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inbox messages"
    ON public.inbox_messages FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
