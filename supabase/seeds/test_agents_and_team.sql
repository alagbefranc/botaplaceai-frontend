-- ============================================================================
-- Seed Script: Create Test Agents with Industry Insights and Team
-- Run this in Supabase SQL editor after running the insight_templates.sql seed
-- ============================================================================

-- First, ensure we have the insight templates (run insight_templates.sql first if needed)

-- Get the org_id for francalagbe@gmail.com
DO $$
DECLARE
  v_org_id uuid;
  v_sales_agent_id uuid;
  v_support_agent_id uuid;
  v_team_id uuid;
  v_lead_qual_id uuid;
  v_objection_id uuid;
  v_csat_id uuid;
  v_ticket_id uuid;
BEGIN
  -- Get the organization ID (assumes user has an org)
  SELECT o.id INTO v_org_id
  FROM organizations o
  JOIN org_members om ON o.id = om.org_id
  JOIN users u ON om.user_id = u.id
  WHERE u.email = 'francalagbe@gmail.com'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found for francalagbe@gmail.com';
  END IF;

  RAISE NOTICE 'Found org_id: %', v_org_id;

  -- Get template insight IDs
  SELECT id INTO v_lead_qual_id FROM insight_definitions WHERE name = 'Lead Qualification' AND is_template = true LIMIT 1;
  SELECT id INTO v_objection_id FROM insight_definitions WHERE name = 'Objection Handling' AND is_template = true LIMIT 1;
  SELECT id INTO v_csat_id FROM insight_definitions WHERE name = 'CSAT Survey' AND is_template = true LIMIT 1;
  SELECT id INTO v_ticket_id FROM insight_definitions WHERE name = 'Ticket Classification' AND is_template = true LIMIT 1;

  RAISE NOTICE 'Lead Qualification template: %', v_lead_qual_id;
  RAISE NOTICE 'Objection Handling template: %', v_objection_id;
  RAISE NOTICE 'CSAT Survey template: %', v_csat_id;
  RAISE NOTICE 'Ticket Classification template: %', v_ticket_id;

  -- ============================================================================
  -- Create Sales Agent
  -- ============================================================================
  INSERT INTO agents (
    org_id,
    name,
    system_prompt,
    voice,
    channels,
    tools,
    status,
    greeting_message,
    settings
  ) VALUES (
    v_org_id,
    'Sales Agent - Lead Qualifier',
    'You are a professional Sales Agent specializing in lead qualification and objection handling.

Your responsibilities:
1. Qualify leads using BANT criteria (Budget, Authority, Need, Timeline)
2. Handle objections professionally and empathetically
3. Identify pain points and propose relevant solutions
4. Schedule follow-up meetings when appropriate
5. Maintain a consultative, not pushy, approach

Guidelines:
- Always ask about budget early in the conversation
- Identify decision-makers vs. influencers
- Listen actively and address concerns thoroughly
- Document objections and how they were resolved
- End calls with clear next steps

Remember: Building trust is more important than closing fast.',
    'Puck',
    ARRAY['web_chat', 'web_voice', 'phone'],
    ARRAY['googlecalendar', 'gmail'],
    'active',
    'Hello! I''m here to learn about your needs and see how we might help. What challenges are you currently facing?',
    jsonb_build_object(
      'behavior', jsonb_build_object(
        'responseLength', 'balanced',
        'tone', 'professional',
        'multilingual', jsonb_build_object('enabled', true, 'autoDetect', true, 'defaultLanguage', 'en', 'supportedLanguages', ARRAY['en', 'fr', 'es'])
      ),
      'speech', jsonb_build_object(
        'speechModel', 'gemini-2.5-flash-preview-native-audio',
        'voiceId', 'Puck',
        'voiceProvider', 'google',
        'vadConfig', jsonb_build_object('threshold', 0.5, 'prefix_padding_ms', 300, 'silence_duration_ms', 700)
      ),
      'custom_insights', jsonb_build_object(
        'enabled', true,
        'definitionIds', ARRAY[v_lead_qual_id, v_objection_id]
      ),
      'guardrails', jsonb_build_object(
        'outputTopics', jsonb_build_object(
          'enabled', true,
          'topics', ARRAY['harassment', 'violence', 'illicit_and_harmful_activity']
        ),
        'inputTopics', jsonb_build_object(
          'enabled', true,
          'topics', ARRAY['platform_integrity_jailbreaking']
        )
      )
    )
  )
  RETURNING id INTO v_sales_agent_id;

  RAISE NOTICE 'Created Sales Agent: %', v_sales_agent_id;

  -- ============================================================================
  -- Create Support Agent
  -- ============================================================================
  INSERT INTO agents (
    org_id,
    name,
    system_prompt,
    voice,
    channels,
    tools,
    status,
    greeting_message,
    settings
  ) VALUES (
    v_org_id,
    'Support Agent - CSAT Focused',
    'You are a Customer Support Agent focused on delivering excellent service and ensuring customer satisfaction.

Your responsibilities:
1. Resolve customer issues efficiently and empathetically
2. Classify tickets by category and priority
3. Collect customer satisfaction feedback
4. Escalate critical issues when necessary
5. Document all interactions thoroughly

Guidelines:
- Start by understanding the full context of the issue
- Apologize for any inconvenience sincerely
- Provide step-by-step solutions when applicable
- Always confirm the issue is resolved before ending
- Ask for feedback and suggestions for improvement

Priority Classification:
- Critical: Service outage, security issues, data loss
- High: Billing errors, account access issues
- Medium: Feature questions, general bugs
- Low: General inquiries, feature requests

Remember: Every interaction is an opportunity to turn a frustrated customer into a loyal advocate.',
    'Charon',
    ARRAY['web_chat', 'web_voice', 'sms'],
    ARRAY['gmail', 'slack'],
    'active',
    'Hi there! I''m here to help resolve any issues you''re experiencing. How can I assist you today?',
    jsonb_build_object(
      'behavior', jsonb_build_object(
        'responseLength', 'balanced',
        'tone', 'friendly',
        'multilingual', jsonb_build_object('enabled', true, 'autoDetect', true, 'defaultLanguage', 'en', 'supportedLanguages', ARRAY['en', 'fr', 'es', 'de'])
      ),
      'speech', jsonb_build_object(
        'speechModel', 'gemini-2.5-flash-preview-native-audio',
        'voiceId', 'Charon',
        'voiceProvider', 'google',
        'vadConfig', jsonb_build_object('threshold', 0.5, 'prefix_padding_ms', 300, 'silence_duration_ms', 700)
      ),
      'custom_insights', jsonb_build_object(
        'enabled', true,
        'definitionIds', ARRAY[v_csat_id, v_ticket_id]
      ),
      'guardrails', jsonb_build_object(
        'outputTopics', jsonb_build_object(
          'enabled', true,
          'topics', ARRAY['harassment', 'self_harm', 'violence']
        ),
        'inputTopics', jsonb_build_object(
          'enabled', true,
          'topics', ARRAY['platform_integrity_jailbreaking']
        )
      ),
      'tools', jsonb_build_object(
        'escalation', jsonb_build_object(
          'enabled', true,
          'rules', jsonb_build_array(
            jsonb_build_object(
              'id', 'explicit_request',
              'trigger', 'explicit_request',
              'enabled', true,
              'config', '{}'::jsonb,
              'action', jsonb_build_object(
                'priority', 'normal',
                'department', 'support',
                'message', 'I understand you''d like to speak with a human agent. Let me connect you right away.'
              )
            ),
            jsonb_build_object(
              'id', 'sentiment',
              'trigger', 'sentiment',
              'enabled', true,
              'config', jsonb_build_object('sentimentThreshold', -0.6),
              'action', jsonb_build_object(
                'priority', 'high',
                'department', 'support',
                'message', 'I sense this hasn''t been the best experience. Let me connect you with someone who can help.'
              )
            ),
            jsonb_build_object(
              'id', 'keyword',
              'trigger', 'keyword',
              'enabled', true,
              'config', jsonb_build_object('keywords', jsonb_build_array(
                jsonb_build_object('id', 'cancel', 'phrase', 'cancel my account', 'priority', 'urgent', 'department', 'billing'),
                jsonb_build_object('id', 'manager', 'phrase', 'speak to manager', 'priority', 'high', 'department', 'management'),
                jsonb_build_object('id', 'refund', 'phrase', 'full refund', 'priority', 'high', 'department', 'billing')
              )),
              'action', jsonb_build_object(
                'priority', 'high',
                'department', 'support',
                'message', 'I''m going to connect you with a specialist who can help you with this.'
              )
            ),
            jsonb_build_object(
              'id', 'retry_limit',
              'trigger', 'retry_limit',
              'enabled', true,
              'config', jsonb_build_object('maxRetries', 3),
              'action', jsonb_build_object(
                'priority', 'normal',
                'department', 'support',
                'message', 'I apologize for the difficulty. Let me transfer you to a specialist.'
              )
            )
          ),
          'defaultDepartment', 'support',
          'defaultPriority', 'normal',
          'confirmBeforeTransfer', true,
          'maxWaitTimeSeconds', 300
        ),
        'holdMusic', jsonb_build_object(
          'enabled', true,
          'type', 'preset',
          'presetId', 'classical_1',
          'volume', 50,
          'loopAnnouncement', true,
          'announcementIntervalSeconds', 30,
          'estimatedWaitMessage', true
        )
      )
    )
  )
  RETURNING id INTO v_support_agent_id;

  RAISE NOTICE 'Created Support Agent: %', v_support_agent_id;

  -- ============================================================================
  -- Create Team: Omnichannel Sales & Support Team
  -- ============================================================================
  INSERT INTO agent_teams (
    org_id,
    name,
    description,
    entry_agent_id,
    status,
    settings
  ) VALUES (
    v_org_id,
    'Omnichannel Sales & Support Team',
    'A multi-agent team handling both sales inquiries and customer support. Sales Agent qualifies leads while Support Agent handles post-sale issues.',
    v_sales_agent_id,
    'active',
    jsonb_build_object(
      'allowSelfHandoff', false,
      'requireConfirmation', false,
      'preserveContext', true,
      'maxHandoffs', 3
    )
  )
  RETURNING id INTO v_team_id;

  RAISE NOTICE 'Created Team: %', v_team_id;

  -- ============================================================================
  -- Add Team Members
  -- ============================================================================
  
  -- Add Sales Agent as entry agent
  INSERT INTO team_members (team_id, agent_id, role, specialization, position)
  VALUES (v_team_id, v_sales_agent_id, 'entry', 'sales', 1);

  -- Add Support Agent as specialist
  INSERT INTO team_members (team_id, agent_id, role, specialization, position)
  VALUES (v_team_id, v_support_agent_id, 'specialist', 'support', 2);

  RAISE NOTICE 'Added team members';

  -- ============================================================================
  -- Create Handoff Rules
  -- ============================================================================

  -- Rule: Handoff to Support when customer mentions issue/problem/help/support
  INSERT INTO handoff_rules (
    team_id,
    source_agent_id,
    target_agent_id,
    rule_type,
    conditions,
    priority,
    context_config,
    enabled
  ) VALUES (
    v_team_id,
    v_sales_agent_id,
    v_support_agent_id,
    'keyword',
    '[
      {"type": "keyword", "value": "support", "matchType": "contains"},
      {"type": "keyword", "value": "issue", "matchType": "contains"},
      {"type": "keyword", "value": "problem", "matchType": "contains"},
      {"type": "keyword", "value": "help", "matchType": "contains"},
      {"type": "keyword", "value": "broken", "matchType": "contains"},
      {"type": "keyword", "value": "not working", "matchType": "contains"}
    ]'::jsonb,
    80,
    '{"includeSummary": true, "includeHistory": true, "variables": ["customer_name", "issue_type"]}'::jsonb,
    true
  );

  -- Rule: Handoff to Sales when support customer shows purchase interest
  INSERT INTO handoff_rules (
    team_id,
    source_agent_id,
    target_agent_id,
    rule_type,
    conditions,
    priority,
    context_config,
    enabled
  ) VALUES (
    v_team_id,
    v_support_agent_id,
    v_sales_agent_id,
    'keyword',
    '[
      {"type": "keyword", "value": "upgrade", "matchType": "contains"},
      {"type": "keyword", "value": "pricing", "matchType": "contains"},
      {"type": "keyword", "value": "purchase", "matchType": "contains"},
      {"type": "keyword", "value": "buy", "matchType": "contains"},
      {"type": "keyword", "value": "interested in", "matchType": "contains"}
    ]'::jsonb,
    70,
    '{"includeSummary": true, "includeHistory": true, "variables": ["customer_name", "product_interest"]}'::jsonb,
    true
  );

  RAISE NOTICE 'Created handoff rules';

  -- ============================================================================
  -- Create Team Context Variables
  -- ============================================================================
  INSERT INTO team_context_variables (team_id, name, description, extract_prompt, required, position) VALUES
    (v_team_id, 'customer_name', 'Customer name for personalization', 'Extract the customer name from the conversation', true, 1),
    (v_team_id, 'issue_type', 'Type of issue or inquiry', 'Identify the main issue category (billing, technical, account, general)', false, 2),
    (v_team_id, 'product_interest', 'Products the customer is interested in', 'List products or features the customer mentioned interest in', false, 3);

  RAISE NOTICE 'Created context variables';

  -- Final summary
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SETUP COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Sales Agent ID: %', v_sales_agent_id;
  RAISE NOTICE 'Support Agent ID: %', v_support_agent_id;
  RAISE NOTICE 'Team ID: %', v_team_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Sales Agent insights: Lead Qualification, Objection Handling';
  RAISE NOTICE 'Support Agent insights: CSAT Survey, Ticket Classification';
  RAISE NOTICE '';
  RAISE NOTICE 'Team entry point: Sales Agent';
  RAISE NOTICE 'Handoff rules configured for both directions';
  RAISE NOTICE '============================================';

END $$;
