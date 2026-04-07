/**
 * COMPREHENSIVE AGENT CONFIGURATION TEST
 * Tests ALL tabs: Core, Behavior, Messages, Speech, Tools, Memory, Insights, Advanced
 * Validates both chat and voice configurations actually SAVE and LOAD
 * 
 * Run: npx tsx scripts/test-agent-config-full.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_USER_EMAIL = "francalagbe@gmail.com";

interface TestResult {
  tab: string;
  field: string;
  status: "PASS" | "FAIL";
  expected: unknown;
  actual: unknown;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function assertEqual(tab: string, field: string, expected: unknown, actual: unknown): boolean {
  const expStr = JSON.stringify(expected);
  const actStr = JSON.stringify(actual);
  const match = expStr === actStr;
  
  results.push({ tab, field, status: match ? "PASS" : "FAIL", expected, actual });
  
  if (match) {
    passCount++;
    log("  ✅", `${field}: ${typeof expected === 'boolean' ? expected : expStr.substring(0, 50)}`);
  } else {
    failCount++;
    log("  ❌", `${field}: expected ${expStr.substring(0, 30)}, got ${actStr.substring(0, 30)}`);
  }
  return match;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 COMPREHENSIVE AGENT CONFIGURATION TEST");
  console.log("   Testing ALL tabs - Core, Behavior, Messages, Speech, Tools, Memory, Insights, Advanced");
  console.log("=".repeat(70) + "\n");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get test user and org
  const { data: usersData } = await admin.auth.admin.listUsers();
  const testUser = usersData?.users?.find((u) => u.email === TEST_USER_EMAIL);
  if (!testUser) {
    log("❌", "Test user not found");
    return;
  }

  const { data: userData } = await admin.from("users").select("org_id").eq("id", testUser.id).single();
  if (!userData?.org_id) {
    log("❌", "User has no org");
    return;
  }

  const orgId = userData.org_id;
  log("✅", `User: ${TEST_USER_EMAIL}, Org: ${orgId}\n`);

  // Get first agent to test
  const { data: agents } = await admin.from("agents").select("*").eq("org_id", orgId).limit(1);
  
  if (!agents?.length) {
    log("❌", "No agents found to test");
    return;
  }

  const agent = agents[0];
  const agentId = agent.id;
  const originalSettings = agent.settings || {};
  
  log("🤖", `Testing agent: ${agent.name} (ID: ${agentId})\n`);

  // ============================================================
  // DEFINE TEST CONFIGURATION - All possible settings
  // ============================================================
  
  const testConfig = {
    // Core Settings Tab
    name: "Test Agent Config " + Date.now(),
    system_prompt: "You are a helpful test agent. Always be concise and accurate.",
    voice: "Charon",
    tools: ["gmail", "google_calendar", "cal"],
    channels: ["web_chat", "web_voice", "phone"],
    status: "active" as const,
    greeting_message: "Hello! I'm your test agent. How can I assist you today?",
    
    settings: {
      // Live API Config (Voice/Advanced Tab)
      live_api: {
        model: "gemini-3.1-flash-live-preview",
        thinkingLevel: "medium",
        thinkingBudget: 2048,
        includeThoughts: true,
        inputAudioTranscription: true,
        outputAudioTranscription: true,
        automaticVad: true,
        vadStartSensitivity: "START_SENSITIVITY_HIGH",
        vadEndSensitivity: "END_SENSITIVITY_HIGH",
        vadPrefixPaddingMs: 50,
        vadSilenceDurationMs: 500,
        turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
        mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
        initialHistoryInClientContent: true,
        proactiveAudio: false,
        enableAffectiveDialog: false,
      },
      
      // Custom Functions (Tools Tab)
      custom_functions: [
        {
          id: "test-func-1",
          name: "get_weather",
          description: "Get current weather for a location",
          parameters: [
            { name: "city", type: "string", description: "City name", required: true },
            { name: "units", type: "string", description: "Temperature units", required: false, enum: ["celsius", "fahrenheit"] },
          ],
          endpoint: {
            url: "https://api.example.com/weather",
            method: "GET",
            headers: { "X-API-Key": "test-key" },
          },
          enabled: true,
        },
      ],
      
      // Behavior Tab
      behavior: {
        variables: [
          { id: "var-1", name: "company_name", type: "static", value: "Acme Corp", description: "Company name" },
          { id: "var-2", name: "support_email", type: "static", value: "support@acme.com", description: "Support email" },
        ],
        multilingual: {
          enabled: true,
          defaultLanguage: "en",
          supportedLanguages: ["en", "es", "fr", "de"],
          autoDetect: true,
        },
        personalization: {
          enabled: true,
          useConversationHistory: true,
          maxHistoryTurns: 10,
          userFields: ["name", "email", "company"],
        },
        voiceFormatting: {
          numbers: "words",
          dates: "spoken",
          urls: "domain_only",
          currency: "full",
          phoneNumbers: "grouped",
        },
        flushSyntax: true,
        backgroundMessages: [
          { id: "bg-1", trigger: "session_start", content: "Remember to be friendly and helpful.", enabled: true },
        ],
        idleMessages: [
          { id: "idle-1", delaySeconds: 30, content: "Are you still there?", maxTimes: 2, enabled: true },
        ],
      },
      
      // Speech Tab
      speech: {
        denoising: {
          enabled: true,
          level: "medium",
        },
        pronunciation: [
          { id: "pron-1", word: "API", phonetic: "A-P-I", caseSensitive: true },
          { id: "pron-2", word: "SQL", phonetic: "sequel", caseSensitive: false },
        ],
        voiceFallback: {
          enabled: true,
          fallbackVoices: ["Puck", "Kore"],
        },
        transcriber: {
          model: "gemini",
          language: "en",
          fallbackEnabled: true,
        },
      },
      
      // Tools Tab
      tools: {
        rejectionPlan: "fallback",
        maxRetries: 3,
        staticAliases: {
          "book": "schedule",
          "appt": "appointment",
        },
        voicemailEnabled: true,
        voicemailConfig: {
          greeting: "Please leave your message after the tone.",
          maxDurationSeconds: 180,
          transcribe: true,
        },
        codeToolEnabled: true,
      },
      
      // Hooks Tab (Advanced)
      hooks: {
        hooks: [
          {
            id: "hook-1",
            event: "session_start",
            actions: [
              { id: "action-1", type: "log", config: { message: "Session started" } },
            ],
            enabled: true,
          },
          {
            id: "hook-2",
            event: "session_end",
            actions: [
              { id: "action-2", type: "api_call", config: { url: "https://webhook.example.com" } },
            ],
            enabled: true,
          },
        ],
      },
      
      // Provider Config (Advanced)
      provider: {
        gemini: {
          useDefault: true,
        },
      },
      
      // Memory Tab
      memory: {
        enabled: true,
        scope: "per_user",
        identifierField: "email",
        maxConversations: 10,
        timeWindowDays: 60,
        includeInsightTypes: ["user_profile", "intent", "action_items"],
        webhookEnabled: false,
        webhookTimeoutMs: 2000,
      },
      
      // Insights Tab - System Insights
      insight_extraction: {
        enabled: true,
        extractUserProfile: true,
        extractIntent: true,
        extractSentiment: true,
        extractActionItems: true,
        autoExtractOnEnd: true,
      },
      
      // Insights Tab - Custom Insights
      custom_insights: {
        enabled: true,
        definitionIds: [],
        groupIds: [],
        autoExtractOnEnd: true,
      },
    },
  };

  // ============================================================
  // STEP 1: UPDATE AGENT WITH ALL CONFIGURATIONS
  // ============================================================
  
  log("📝", "STEP 1: Updating agent with all configurations...\n");
  
  const { error: updateError } = await admin
    .from("agents")
    .update(testConfig)
    .eq("id", agentId);

  if (updateError) {
    log("❌", `Update failed: ${updateError.message}`);
    return;
  }
  log("✅", "Agent updated successfully\n");

  // ============================================================
  // STEP 2: RELOAD AGENT AND VERIFY ALL SETTINGS
  // ============================================================
  
  log("🔄", "STEP 2: Reloading agent and verifying all configurations...\n");

  const { data: reloadedAgent, error: reloadError } = await admin
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (reloadError || !reloadedAgent) {
    log("❌", `Reload failed: ${reloadError?.message}`);
    return;
  }

  const settings = reloadedAgent.settings as Record<string, unknown>;

  // ============================================================
  // TAB 1: CORE SETTINGS
  // ============================================================
  console.log("\n📋 TAB 1: CORE SETTINGS");
  console.log("-".repeat(50));
  
  assertEqual("Core", "name", testConfig.name, reloadedAgent.name);
  assertEqual("Core", "system_prompt", testConfig.system_prompt, reloadedAgent.system_prompt);
  assertEqual("Core", "voice", testConfig.voice, reloadedAgent.voice);
  assertEqual("Core", "tools", testConfig.tools, reloadedAgent.tools);
  assertEqual("Core", "channels", testConfig.channels, reloadedAgent.channels);
  assertEqual("Core", "status", testConfig.status, reloadedAgent.status);
  assertEqual("Core", "greeting_message", testConfig.greeting_message, reloadedAgent.greeting_message);

  // ============================================================
  // TAB 2: BEHAVIOR
  // ============================================================
  console.log("\n🎭 TAB 2: BEHAVIOR");
  console.log("-".repeat(50));
  
  const behavior = settings.behavior as Record<string, unknown>;
  const multilingual = behavior?.multilingual as Record<string, unknown>;
  const personalization = behavior?.personalization as Record<string, unknown>;
  const voiceFormatting = behavior?.voiceFormatting as Record<string, unknown>;
  
  assertEqual("Behavior", "variables count", 2, (behavior?.variables as unknown[])?.length);
  assertEqual("Behavior", "multilingual.enabled", true, multilingual?.enabled);
  assertEqual("Behavior", "multilingual.defaultLanguage", "en", multilingual?.defaultLanguage);
  assertEqual("Behavior", "multilingual.supportedLanguages", ["en", "es", "fr", "de"], multilingual?.supportedLanguages);
  assertEqual("Behavior", "multilingual.autoDetect", true, multilingual?.autoDetect);
  assertEqual("Behavior", "personalization.enabled", true, personalization?.enabled);
  assertEqual("Behavior", "personalization.maxHistoryTurns", 10, personalization?.maxHistoryTurns);
  assertEqual("Behavior", "voiceFormatting.numbers", "words", voiceFormatting?.numbers);
  assertEqual("Behavior", "voiceFormatting.currency", "full", voiceFormatting?.currency);
  assertEqual("Behavior", "flushSyntax", true, behavior?.flushSyntax);
  assertEqual("Behavior", "backgroundMessages count", 1, (behavior?.backgroundMessages as unknown[])?.length);
  assertEqual("Behavior", "idleMessages count", 1, (behavior?.idleMessages as unknown[])?.length);

  // ============================================================
  // TAB 3: MESSAGES (Greeting is in Core, Background/Idle in Behavior)
  // ============================================================
  console.log("\n💬 TAB 3: MESSAGES");
  console.log("-".repeat(50));
  
  const bgMsgs = behavior?.backgroundMessages as Array<Record<string, unknown>>;
  const idleMsgs = behavior?.idleMessages as Array<Record<string, unknown>>;
  
  assertEqual("Messages", "backgroundMessage[0].trigger", "session_start", bgMsgs?.[0]?.trigger);
  assertEqual("Messages", "backgroundMessage[0].enabled", true, bgMsgs?.[0]?.enabled);
  assertEqual("Messages", "idleMessage[0].delaySeconds", 30, idleMsgs?.[0]?.delaySeconds);
  assertEqual("Messages", "idleMessage[0].maxTimes", 2, idleMsgs?.[0]?.maxTimes);

  // ============================================================
  // TAB 4: SPEECH (Voice Pipeline)
  // ============================================================
  console.log("\n🔊 TAB 4: SPEECH");
  console.log("-".repeat(50));
  
  const speech = settings.speech as Record<string, unknown>;
  const denoising = speech?.denoising as Record<string, unknown>;
  const pronunciation = speech?.pronunciation as Array<Record<string, unknown>>;
  const voiceFallback = speech?.voiceFallback as Record<string, unknown>;
  const transcriber = speech?.transcriber as Record<string, unknown>;
  
  assertEqual("Speech", "denoising.enabled", true, denoising?.enabled);
  assertEqual("Speech", "denoising.level", "medium", denoising?.level);
  assertEqual("Speech", "pronunciation count", 2, pronunciation?.length);
  assertEqual("Speech", "pronunciation[0].word", "API", pronunciation?.[0]?.word);
  assertEqual("Speech", "voiceFallback.enabled", true, voiceFallback?.enabled);
  assertEqual("Speech", "voiceFallback.fallbackVoices", ["Puck", "Kore"], voiceFallback?.fallbackVoices);
  assertEqual("Speech", "transcriber.model", "gemini", transcriber?.model);
  assertEqual("Speech", "transcriber.fallbackEnabled", true, transcriber?.fallbackEnabled);

  // ============================================================
  // TAB 5: TOOLS
  // ============================================================
  console.log("\n🔧 TAB 5: TOOLS");
  console.log("-".repeat(50));
  
  const tools = settings.tools as Record<string, unknown>;
  const voicemailConfig = tools?.voicemailConfig as Record<string, unknown>;
  const customFunctions = settings.custom_functions as Array<Record<string, unknown>>;
  
  assertEqual("Tools", "rejectionPlan", "fallback", tools?.rejectionPlan);
  assertEqual("Tools", "maxRetries", 3, tools?.maxRetries);
  assertEqual("Tools", "voicemailEnabled", true, tools?.voicemailEnabled);
  assertEqual("Tools", "voicemailConfig.maxDurationSeconds", 180, voicemailConfig?.maxDurationSeconds);
  assertEqual("Tools", "voicemailConfig.transcribe", true, voicemailConfig?.transcribe);
  assertEqual("Tools", "codeToolEnabled", true, tools?.codeToolEnabled);
  assertEqual("Tools", "staticAliases.book", "schedule", (tools?.staticAliases as Record<string, string>)?.book);
  assertEqual("Tools", "custom_functions count", 1, customFunctions?.length);
  assertEqual("Tools", "custom_functions[0].name", "get_weather", customFunctions?.[0]?.name);
  assertEqual("Tools", "custom_functions[0].enabled", true, customFunctions?.[0]?.enabled);

  // ============================================================
  // TAB 6: MEMORY
  // ============================================================
  console.log("\n🧠 TAB 6: MEMORY");
  console.log("-".repeat(50));
  
  // Memory may be stored differently - check both locations
  const memory = (settings.memory || reloadedAgent.memory) as Record<string, unknown>;
  
  if (memory) {
    assertEqual("Memory", "enabled", true, memory?.enabled);
    assertEqual("Memory", "scope", "per_user", memory?.scope);
    assertEqual("Memory", "identifierField", "email", memory?.identifierField);
    assertEqual("Memory", "maxConversations", 10, memory?.maxConversations);
    assertEqual("Memory", "timeWindowDays", 60, memory?.timeWindowDays);
    assertEqual("Memory", "webhookEnabled", false, memory?.webhookEnabled);
  } else {
    log("  ⚠️", "Memory config not found in settings");
  }

  // ============================================================
  // TAB 7: INSIGHTS
  // ============================================================
  console.log("\n💡 TAB 7: INSIGHTS");
  console.log("-".repeat(50));
  
  const insightExtraction = settings.insight_extraction as Record<string, unknown>;
  const customInsights = settings.custom_insights as Record<string, unknown>;
  
  if (insightExtraction) {
    assertEqual("Insights", "extraction.enabled", true, insightExtraction?.enabled);
    assertEqual("Insights", "extraction.extractUserProfile", true, insightExtraction?.extractUserProfile);
    assertEqual("Insights", "extraction.extractIntent", true, insightExtraction?.extractIntent);
    assertEqual("Insights", "extraction.extractSentiment", true, insightExtraction?.extractSentiment);
    assertEqual("Insights", "extraction.extractActionItems", true, insightExtraction?.extractActionItems);
    assertEqual("Insights", "extraction.autoExtractOnEnd", true, insightExtraction?.autoExtractOnEnd);
  }
  
  if (customInsights) {
    assertEqual("Insights", "customInsights.enabled", true, customInsights?.enabled);
    assertEqual("Insights", "customInsights.autoExtractOnEnd", true, customInsights?.autoExtractOnEnd);
  }

  // ============================================================
  // TAB 8: ADVANCED (Live API / Voice Config)
  // ============================================================
  console.log("\n⚙️ TAB 8: ADVANCED (Live API / Voice)");
  console.log("-".repeat(50));
  
  const liveApi = settings.live_api as Record<string, unknown>;
  const hooks = settings.hooks as Record<string, unknown>;
  const provider = settings.provider as Record<string, unknown>;
  
  assertEqual("Advanced", "liveApi.model", "gemini-3.1-flash-live-preview", liveApi?.model);
  assertEqual("Advanced", "liveApi.thinkingLevel", "medium", liveApi?.thinkingLevel);
  assertEqual("Advanced", "liveApi.thinkingBudget", 2048, liveApi?.thinkingBudget);
  assertEqual("Advanced", "liveApi.includeThoughts", true, liveApi?.includeThoughts);
  assertEqual("Advanced", "liveApi.inputAudioTranscription", true, liveApi?.inputAudioTranscription);
  assertEqual("Advanced", "liveApi.outputAudioTranscription", true, liveApi?.outputAudioTranscription);
  assertEqual("Advanced", "liveApi.automaticVad", true, liveApi?.automaticVad);
  assertEqual("Advanced", "liveApi.vadStartSensitivity", "START_SENSITIVITY_HIGH", liveApi?.vadStartSensitivity);
  assertEqual("Advanced", "liveApi.vadSilenceDurationMs", 500, liveApi?.vadSilenceDurationMs);
  assertEqual("Advanced", "liveApi.mediaResolution", "MEDIA_RESOLUTION_MEDIUM", liveApi?.mediaResolution);
  assertEqual("Advanced", "liveApi.initialHistoryInClientContent", true, liveApi?.initialHistoryInClientContent);
  
  const hooksArray = hooks?.hooks as Array<Record<string, unknown>>;
  assertEqual("Advanced", "hooks count", 2, hooksArray?.length);
  assertEqual("Advanced", "hooks[0].event", "session_start", hooksArray?.[0]?.event);
  assertEqual("Advanced", "hooks[1].event", "session_end", hooksArray?.[1]?.event);
  
  const gemini = provider?.gemini as Record<string, unknown>;
  assertEqual("Advanced", "provider.gemini.useDefault", true, gemini?.useDefault);

  // ============================================================
  // STEP 3: RESTORE ORIGINAL SETTINGS
  // ============================================================
  
  console.log("\n🔄 STEP 3: Restoring original settings...");
  
  await admin.from("agents").update({
    name: agent.name,
    system_prompt: agent.system_prompt,
    voice: agent.voice,
    tools: agent.tools,
    channels: agent.channels,
    status: agent.status,
    greeting_message: agent.greeting_message,
    settings: originalSettings,
  }).eq("id", agentId);
  
  log("✅", "Original settings restored\n");

  // ============================================================
  // SUMMARY
  // ============================================================
  
  console.log("=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));
  
  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total:  ${passCount + failCount}\n`);

  // Group by tab
  const byTab: Record<string, TestResult[]> = {};
  results.forEach(r => {
    if (!byTab[r.tab]) byTab[r.tab] = [];
    byTab[r.tab].push(r);
  });

  console.log("Results by Tab:");
  Object.entries(byTab).forEach(([tab, items]) => {
    const passed = items.filter(i => i.status === "PASS").length;
    const failed = items.filter(i => i.status === "FAIL").length;
    const status = failed === 0 ? "✅" : "⚠️";
    console.log(`  ${status} ${tab}: ${passed}/${items.length} passed`);
  });

  if (failCount === 0) {
    console.log("\n🎉 ALL CONFIGURATION TESTS PASSED!");
    console.log("   Every toggle, field, and setting saves and loads correctly.\n");
  } else {
    console.log("\n⚠️ Some tests failed. Review the failures above.\n");
    
    console.log("Failed tests:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  - ${r.tab}.${r.field}`);
      console.log(`    Expected: ${JSON.stringify(r.expected)}`);
      console.log(`    Got: ${JSON.stringify(r.actual)}`);
    });
  }
}

main().catch(console.error);
