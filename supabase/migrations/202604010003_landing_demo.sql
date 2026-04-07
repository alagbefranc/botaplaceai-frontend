-- ── Landing page demo infrastructure ─────────────────────────────────────────
-- Rate-limit table: prevents a single IP from spamming demo calls
CREATE TABLE IF NOT EXISTS landing_demo_calls (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip         text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_landing_demo_calls_ip_created
  ON landing_demo_calls (ip, created_at);

-- ── Demo agent ────────────────────────────────────────────────────────────────
-- Inserts a shared "Botaplace Demo Agent" into the first organization found.
-- Uses a fixed UUID so env var NEXT_PUBLIC_LANDING_DEMO_AGENT_ID can be set once.
DO $$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org IS NULL THEN
    RAISE NOTICE '[LandingDemo] No organization found — skipping demo agent creation.';
    RETURN;
  END IF;

  INSERT INTO agents (
    id, org_id, name, system_prompt, greeting_message,
    voice, status, channels, settings, analysis_plan
  ) VALUES (
    '00000000-b07a-0000-0000-000000000001',
    v_org,
    'Botaplace Demo Agent',
    'You are Bota, a friendly demo AI agent for Botaplace — an omnichannel AI customer experience platform that lets businesses deploy AI agents across voice, chat, and SMS. Your role is to impress visitors and answer questions about what Botaplace can do. Be concise, warm, and enthusiastic. Keep responses to 2-3 sentences maximum. When asked what you can do, mention: handling customer support, qualifying leads, booking appointments, making outbound calls, and integrating with CRMs like Salesforce and HubSpot. When asked how to get started, tell them to sign up free on the website.',
    'Hi! I''m Bota — your AI demo from Botaplace. I can handle customer support, qualify leads, book appointments, and more. What would you like to know?',
    'female',
    'active',
    ARRAY['chat', 'voice'],
    '{}'::jsonb,
    '{}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '[LandingDemo] Demo agent created for org %', v_org;
END $$;
