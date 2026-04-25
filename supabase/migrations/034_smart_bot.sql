-- Migration 034: Smart Bot Studio
-- Bot personas (AI chatbot configurations per brand)

CREATE TABLE IF NOT EXISTS bot_personas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  avatar_emoji     text        NOT NULL DEFAULT '🤖',
  scenario         text        NOT NULL,  -- sales-closing | lead-qualification | faq | product-advisor | retention | appointment
  personality      text        NOT NULL DEFAULT 'professional',
  language         text        NOT NULL DEFAULT 'arabic',
  persuasion_level int         NOT NULL DEFAULT 2 CHECK (persuasion_level BETWEEN 1 AND 3),
  system_prompt    text,
  greeting_message text,
  closing_message  text,
  trigger_type     text        NOT NULL DEFAULT 'dm-received',
  trigger_keywords text[]      NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'draft',  -- active | paused | draft
  conversation_count int       NOT NULL DEFAULT 0,
  conversion_rate  numeric(5,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_personas_brand_member"
  ON bot_personas
  USING (
    EXISTS (
      SELECT 1 FROM brand_members
      WHERE brand_members.brand_id = bot_personas.brand_id
        AND brand_members.user_id = auth.uid()
    )
  );

-- Bot conversations (each conversation a bot had with a customer)

CREATE TABLE IF NOT EXISTS bot_conversations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  persona_id    uuid        REFERENCES bot_personas(id) ON DELETE SET NULL,
  platform      text        NOT NULL DEFAULT 'instagram',
  customer_name text,
  customer_id   text,
  status        text        NOT NULL DEFAULT 'active',  -- active | closed | escalated | converted
  messages      jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_conversations_brand_member"
  ON bot_conversations
  USING (
    EXISTS (
      SELECT 1 FROM brand_members
      WHERE brand_members.brand_id = bot_conversations.brand_id
        AND brand_members.user_id = auth.uid()
    )
  );

-- Index for fast persona lookups per brand
CREATE INDEX IF NOT EXISTS bot_personas_brand_id_idx ON bot_personas(brand_id);
CREATE INDEX IF NOT EXISTS bot_conversations_brand_id_idx ON bot_conversations(brand_id);
CREATE INDEX IF NOT EXISTS bot_conversations_persona_id_idx ON bot_conversations(persona_id);
