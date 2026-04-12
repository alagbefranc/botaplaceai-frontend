import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { getGeminiApiKey, getGeminiApiKeyEnvNames } from "@/lib/server/gemini-api-key";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface CopilotChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context: {
    pageType: string;
    pageDescription: string;
    agentId?: string;
    missionId?: string;
    teamId?: string;
    isAuthenticated: boolean;
  };
  agentConfig?: {
    name: string;
    systemPrompt: string;
    voice: string;
    tools: string[];
    channels: string[];
    greeting: string;
    liveApi?: Record<string, unknown>;
    memoryEnabled?: boolean;
    guardrailsEnabled?: boolean;
    escalationEnabled?: boolean;
  };
}

// Try models in fallback order
async function generateWithFallback(
  ai: GoogleGenAI,
  geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemPrompt: string,
  temperature: number,
  maxOutputTokens: number
): Promise<{ stream: AsyncGenerator<import("@google/genai").GenerateContentResponse, any, any>; usedModel: string }> {
  const modelsToTry = [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
  ];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const streamPromise = ai.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens,
        },
      });
      
      const stream = await streamPromise;
      
      // Test if the stream works
      const testIterator = stream[Symbol.asyncIterator]();
      await Promise.race([
        testIterator.next(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Model timeout")), 5000)
        ),
      ]);
      
      // Recreate stream for actual use
      const workingStream = await ai.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens,
        },
      });
      
      console.log(`[CopilotChat] Using model: ${model}`);
      return { stream: workingStream, usedModel: model };
    } catch (error) {
      console.warn(`[CopilotChat] Model ${model} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All models failed");
}

function buildSystemPrompt(context: CopilotChatRequest["context"], agentConfig?: CopilotChatRequest["agentConfig"]): string {
  let prompt = `You are an AI Workspace Copilot for the Botaplace AI platform — an Omnichannel AI Agent Platform that enables voice, chat, SMS, and WhatsApp AI agents.

CURRENT CONTEXT:
- Page: ${context.pageType}
- Description: ${context.pageDescription}
- User Status: ${context.isAuthenticated ? "Authenticated" : "Guest"}
${context.agentId ? `- Current Agent ID: ${context.agentId}` : ""}${context.missionId ? `\n- Current Mission ID: ${context.missionId}` : ""}${context.teamId ? `\n- Current Team ID: ${context.teamId}` : ""}

Your capabilities:
1. Explain what the current page is for and how to use it effectively
2. See the user's actual data and configuration on this page
3. Help troubleshoot issues and suggest fixes
4. Guide users through setup and configuration step by step
5. Answer questions about features, best practices, and how things connect
6. Suggest configuration improvements based on what you see

Guidelines:
- Be concise, direct, and context-aware
- When you see the user's data, reference specific items (e.g. agent names, mission names, contact counts)
- If something looks misconfigured, proactively flag it and explain how to fix it
- For troubleshooting, ask one clarifying question at a time
- If the user is building an agent on the home page, guide them step by step using [SET_X] tokens
- Use [VOICE_PICKER], [TOOL_PICKER], [CHANNEL_PICKER], [AGENT_SUMMARY] tokens when appropriate for agent building
- If guest, remind them of limitations (1 agent max) but don't be pushy about signup
- Always explain WHY a setting matters, not just what it does

`;

  if (agentConfig) {
    prompt += `\nCURRENT AGENT CONFIGURATION:\n${JSON.stringify(agentConfig, null, 2)}\n`;
  }

  // Page-specific guidance
  switch (context.pageType) {
    case "home":
      prompt += `\nOn the home page, you help users build a COMPLETE, production-ready AI agent step by step.

You MUST use SPECIAL TOKENS to update the agent configuration. Follow these steps IN ORDER:

**Step 1 - BUSINESS**: Ask "What's your company name and what do you sell or do?" When they answer:
- Output: [SET_PURPOSE:Company: <name>. Business: <what they do>]
- Then immediately ask the next question (do NOT wait)

**Step 2 - CUSTOMER QUESTIONS**: Ask "What are the top 3 things your customers usually ask about?" When they answer:
- Append to purpose: Output: [SET_PURPOSE:Company: <name>. Business: <what they do>. Common customer questions: <their answer>]
- Then ask the next question

**Step 3 - AGENT ROLE**: Ask what specific job this agent should handle (e.g. answer support questions, book appointments, qualify leads). When they answer:
- Output: [SET_PURPOSE:Company: <name>. Business: <what they do>. Common questions: <questions>. Agent role: <role>]

**Step 4 - NAME**: Suggest a name based on their business and agent role. When confirmed:
- Output: [SET_NAME:Agent Name Here]

**Step 5 - PERSONALITY**: Ask about tone (professional, friendly, casual, empathetic). When they answer:
- Generate a detailed system prompt (4-6 sentences) using ALL context collected so far:
  company name, what they sell, common customer questions, agent role, and tone.
  Make it specific — mention the company name, products/services, and what the agent can help with.
- Output: [SET_PROMPT:The full system prompt you generated]
- Then output: [VOICE_PICKER]

**Step 6 - VOICE**: After voice picker, acknowledge their selection:
- Output: [SET_VOICE:selected_voice_id]
- Then output: [TOOL_PICKER]

**Step 7 - TOOLS**: After tool selection:
- Output: [SET_TOOLS:tool1,tool2,tool3]
- Then output: [CHANNEL_PICKER]

**Step 8 - CHANNELS**: After channel selection:
- Output: [SET_CHANNELS:channel1,channel2]
- Then ask about the greeting message

**Step 9 - GREETING**: Ask "What should the agent say when a customer starts a conversation?" When they answer (or suggest one based on the business context if they ask):
- Output: [SET_GREETING:the greeting message]
- Then ask about memory

**Step 10 - MEMORY**: Ask "Should this agent remember repeat customers across conversations? (yes/no)" When they answer:
- Output: [SET_MEMORY:true] or [SET_MEMORY:false]
- Then ask about escalation

**Step 11 - ESCALATION**: Ask "Should the agent hand off to a human when a customer is frustrated or asks to speak to someone? (yes/no)" When they answer:
- Output: [SET_ESCALATION:true] or [SET_ESCALATION:false]
- Then ask about guardrails

**Step 12 - GUARDRAILS**: Ask "Are there topics this agent must never discuss? (e.g. competitors, pricing, legal — or say 'none')" When they answer:
- If they mention topics, output: [SET_GUARDRAILS:enabled]
- If they say none, output: [SET_GUARDRAILS:disabled]
- Then output: [AGENT_SUMMARY]

**Step 13 - COMPLETE**: When user confirms the summary or says deploy:
- Output: [AGENT_READY]

RULES:
1. Ask ONE question at a time
2. Be concise — 1-2 sentences max
3. ALWAYS output the [SET_X:value] token immediately when a step is confirmed
4. Keep moving — don't ask unnecessary follow-ups
5. If user skips a step or says "skip" / "default", use sensible defaults and move on
6. Use the company name and business context naturally throughout the conversation`;
      break;
    case "agent-detail":
      prompt += `\nOn the agent detail page, help the user configure any aspect of the agent across all tabs:
- Core Settings: name, system prompt, voice, channels
- Behavior: communication style, language, idle messages
- Messages: greeting message, hold messages
- Speech: transcriber model, background noise, voice personality
- Tools: which tools to enable, custom functions
- Knowledge: manage knowledge base documents
- Memory: enable/disable, conversation window, scope
- Insights: what data to extract from conversations
- Security: guardrails topics to block
- Escalation: when/how to transfer to humans
- Advanced: Gemini Live API model and settings
Suggest specific config changes, explain settings, and guide them to the right tab.`;
      break;
    case "knowledge-base":
      prompt += `\nOn the knowledge base page, help with document management, ingestion troubleshooting, and optimization for better RAG performance.`;
      break;
    case "conversations":
      prompt += `\nOn the conversations page, help analyze transcripts, identify patterns, suggest training improvements, and review escalation reasons.`;
      break;
    case "analytics":
      prompt += `\nOn the analytics page, help interpret metrics, identify trends, and suggest optimizations based on the data.`;
      break;
    case "phone-numbers":
      prompt += `\nPHONE NUMBERS PAGE — Voice line management.

This page lets users:
- Buy new phone numbers from Telnyx (local, toll-free, international)
- Port existing numbers from other carriers
- Assign numbers to agents (an agent needs a number to make/receive calls)
- Configure voicemail and call routing

Setup checklist:
1. At least one phone number must be provisioned
2. Each voice-enabled agent needs a number assigned to it
3. The Telnyx connection ID must be configured in Settings
4. Numbers must be in E.164 format (e.g. +1234567890)

Help users understand why they need numbers and how to assign them to agents.`;
      break;
    case "missions":
      prompt += `\nMISSIONS PAGE — Outbound call campaign management.

This page lets users:
- Create outbound call missions (campaigns) that use an AI agent to call a list of contacts
- Assign an agent to handle all the calls
- Add contacts from their contact database
- Schedule missions for later or launch immediately
- Track mission progress and results

Setup checklist:
1. The user needs at least one agent with a phone number assigned
2. They need contacts imported into the Contacts page first
3. Each mission needs: a name, an objective (what the agent should accomplish on each call), an agent, and contacts
4. The mission objective becomes part of the agent's system prompt during calls

Common issues:
- "No phone number assigned" — the agent needs a number in Phone Numbers
- "No pending contacts" — all contacts already called, or mission already completed
- Mission stuck on "running" — this auto-resolves when all calls finish

Help users create effective missions with clear objectives.`;
      break;
    case "mission-detail":
      prompt += `\nMISSION DETAIL PAGE — Individual mission monitoring.

This page shows:
- Mission status, progress, and timeline
- Call outcomes (completed, failed, no answer) with a donut chart
- Average call duration and success rate
- Full call log with transcripts and AI summaries
- Result summary when mission completes

Help users:
- Understand what the call results mean
- Identify why calls failed or went unanswered
- Suggest improvements for the next mission (better objective, different time, agent prompt changes)
- Explain the difference between "completed" (answered) and "no_answer" calls`;
      break;
    case "contacts":
      prompt += `\nCONTACTS PAGE — Contact database management.

This page lets users:
- Add individual contacts (name, phone, email, company)
- Import contacts via CSV upload
- View and manage all contacts
- Contacts are used in Missions for outbound campaigns

CSV import format:
- Required columns: name, phone
- Optional: email, company
- Phone should be in E.164 format (+1234567890) or the system will try to parse it

Help users import and organize contacts for use with missions.`;
      break;
    case "teams":
      prompt += `\nTEAMS PAGE — Agent team management.

Teams let users combine multiple agents to handle complex workflows:
- A "router" agent triages incoming requests
- Specialized agents handle specific tasks (billing, tech support, sales)
- The router decides which agent should handle each conversation

Setup steps:
1. Create a team with a name and description
2. Add agents as members with roles (lead, member, specialist)
3. Configure routing strategy

Help users understand when they need teams vs single agents.`;
      break;
    case "team-detail":
      prompt += `\nTEAM DETAIL PAGE — Individual team configuration.

Help users:
- Add/remove agents from the team
- Configure agent roles and specialties
- Set up routing rules
- Test the team configuration`;
      break;
    case "messages":
      prompt += `\nMESSAGES PAGE — Inbox and multi-channel messaging.

This page shows all conversations across channels (web chat, SMS, WhatsApp, voice transcripts).
Users can:
- View conversation threads
- See which agent handled each conversation
- Review transcripts and message history
- Filter by channel, agent, or date

Help users navigate their conversations and identify patterns.`;
      break;
    case "evals":
      prompt += `\nAGENT TESTING (EVALS) PAGE — Automated agent evaluation.

This page lets users:
- Create test scenarios with expected outcomes
- Run automated tests against their agents
- Compare agent responses to expected answers
- Track quality scores over time

Help users set up meaningful tests that catch real issues.`;
      break;
    case "insights":
      prompt += `\nAI INSIGHTS PAGE — Automated conversation intelligence.

This page shows AI-extracted insights from conversations:
- Sentiment analysis (positive, neutral, negative)
- Common topics and themes
- Escalation reasons and patterns
- Customer satisfaction indicators

Help users understand their data and act on insights.`;
      break;
    case "widget":
      prompt += `\nWIDGET PAGE — Embeddable chat widget configuration.

The widget lets users add an AI chat agent to any website:
- Customize colors, position, and branding
- Choose which agent powers the widget
- Generate embed code (script tag)
- Configure auto-greetings and behavior

Help users configure and deploy the widget on their site.`;
      break;
    case "settings":
      prompt += `\nSETTINGS PAGE — Platform configuration.

This page covers:
- Organization details (name, logo)
- API keys (Telnyx, Gemini, etc.)
- Billing and subscription management
- Team member management and roles

Help users configure their platform correctly.`;
      break;
    case "agents":
      prompt += `\nAGENTS LIST PAGE — Agent management overview.

This page shows all AI agents with:
- Status (active, draft, paused)
- Model being used
- Channels enabled
- Quick actions (edit, delete, duplicate)

Help users understand their agent lineup and suggest improvements.`;
      break;
    case "live-calls":
      prompt += `\nLIVE CALLS PAGE — Real-time call monitoring.

Shows active voice calls in real-time:
- Call state (ringing, connected, on hold)
- Duration and caller info
- Which agent is handling each call
- Option to listen in or take over

Help users monitor call quality and intervene when needed.`;
      break;
    case "apps":
      prompt += `\nAPPS PAGE — Third-party integrations.

Connected apps extend agent capabilities:
- CRM integrations (HubSpot, Salesforce)
- Calendar booking (Cal.com, Google Calendar)
- Custom webhooks and APIs
- Tool configuration for agents

Help users set up and troubleshoot integrations.`;
      break;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `Missing Gemini key. Set one of: ${getGeminiApiKeyEnvNames().join(", ")}.`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as CopilotChatRequest;
    const { messages, context, agentConfig } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If authenticated, fetch page-specific data so copilot can see the config
    let contextData: Record<string, unknown> = {};
    if (context.isAuthenticated) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Agent detail
          if (context.agentId) {
            const { data: agent } = await supabase
              .from("agents")
              .select("*")
              .eq("id", context.agentId)
              .single();
            if (agent) contextData.agent = agent;
          }

          // Agent list
          if (context.pageType === "agents") {
            const { data: agents } = await supabase
              .from("agents")
              .select("id, name, status, model, channels, created_at")
              .order("created_at", { ascending: false })
              .limit(20);
            if (agents) contextData.agents = agents;
            contextData.agentCount = agents?.length ?? 0;
          }

          // Mission detail
          if (context.missionId) {
            const { data: mission } = await supabase
              .from("missions")
              .select("*, agents(id, name)")
              .eq("id", context.missionId)
              .single();
            if (mission) contextData.mission = mission;

            const { data: contacts } = await supabase
              .from("mission_contacts")
              .select("id, call_status, call_duration, ai_summary")
              .eq("mission_id", context.missionId);
            if (contacts) {
              const statusCounts: Record<string, number> = {};
              for (const c of contacts) {
                statusCounts[c.call_status] = (statusCounts[c.call_status] ?? 0) + 1;
              }
              contextData.missionContacts = { total: contacts.length, statusBreakdown: statusCounts };
            }
          }

          // Missions list
          if (context.pageType === "missions") {
            const { data: missions } = await supabase
              .from("missions")
              .select("id, name, status, total_contacts, completed_calls, successful_calls, failed_calls, created_at")
              .order("created_at", { ascending: false })
              .limit(10);
            if (missions) contextData.missions = missions;
          }

          // Team detail
          if (context.teamId) {
            const { data: team } = await supabase
              .from("agent_teams")
              .select("*")
              .eq("id", context.teamId)
              .single();
            if (team) contextData.team = team;

            const { data: members } = await supabase
              .from("agent_team_members")
              .select("*, agents(id, name, status)")
              .eq("team_id", context.teamId);
            if (members) contextData.teamMembers = members;
          }

          // Teams list
          if (context.pageType === "teams") {
            const { data: teams } = await supabase
              .from("agent_teams")
              .select("id, name, description, created_at")
              .order("created_at", { ascending: false })
              .limit(10);
            if (teams) contextData.teams = teams;
          }

          // Contacts
          if (context.pageType === "contacts") {
            const { count } = await supabase
              .from("contacts")
              .select("id", { count: "exact", head: true });
            contextData.contactCount = count ?? 0;
          }

          // Phone numbers
          if (context.pageType === "phone-numbers") {
            const { data: numbers } = await supabase
              .from("phone_numbers")
              .select("id, telnyx_number, agent_id, agents(id, name), status")
              .limit(20);
            if (numbers) contextData.phoneNumbers = numbers;
          }

          // Conversations overview
          if (context.pageType === "conversations" || context.pageType === "messages") {
            const { count } = await supabase
              .from("conversations")
              .select("id", { count: "exact", head: true });
            contextData.conversationCount = count ?? 0;
          }
        }
      } catch (error) {
        console.warn("[CopilotChat] Failed to fetch context data:", error);
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(context, agentConfig) + 
      (Object.keys(contextData).length > 0 ? `\n\nADDITIONAL CONTEXT:\n${JSON.stringify(contextData, null, 2)}` : "");

    const geminiMessages = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const { stream: response } = await generateWithFallback(
      ai,
      geminiMessages,
      systemPrompt,
      0.7,
      2048
    );

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text || "";
            if (text) {
              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[CopilotChat] Streaming error:", errMsg);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[CopilotChat] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
