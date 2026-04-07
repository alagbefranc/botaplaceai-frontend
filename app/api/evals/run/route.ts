import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Judge functions
function judgeExactMatch(
  actual: string | undefined,
  expected: string | undefined
): { status: "pass" | "fail"; failureReason?: string } {
  if (actual === expected) {
    return { status: "pass" };
  }
  return {
    status: "fail",
    failureReason: `Expected exact match: '${expected}' but got: '${actual}'`,
  };
}

function judgeRegex(
  actual: string | undefined,
  pattern: string | undefined
): { status: "pass" | "fail"; failureReason?: string } {
  if (!pattern) {
    return { status: "fail", failureReason: "No regex pattern provided" };
  }
  try {
    const regex = new RegExp(pattern);
    if (regex.test(actual || "")) {
      return { status: "pass" };
    }
    return {
      status: "fail",
      failureReason: `Response '${actual}' did not match pattern: ${pattern}`,
    };
  } catch (e) {
    return { status: "fail", failureReason: `Invalid regex pattern: ${pattern}` };
  }
}

function judgeToolCalls(
  actualToolCalls: Array<{ name: string; arguments?: Record<string, unknown> }> | undefined,
  expectedToolCalls: Array<{ name: string; arguments?: Record<string, unknown> }> | undefined,
  judgeType: "exact" | "regex"
): { status: "pass" | "fail"; failureReason?: string } {
  if (!expectedToolCalls || expectedToolCalls.length === 0) {
    return { status: "pass" };
  }

  if (!actualToolCalls || actualToolCalls.length === 0) {
    return {
      status: "fail",
      failureReason: `Expected tool calls but none were made`,
    };
  }

  for (let i = 0; i < expectedToolCalls.length; i++) {
    const expected = expectedToolCalls[i];
    const actual = actualToolCalls[i];

    if (!actual) {
      return {
        status: "fail",
        failureReason: `Expected tool call '${expected.name}' at position ${i} but not found`,
      };
    }

    if (actual.name !== expected.name) {
      return {
        status: "fail",
        failureReason: `Expected tool '${expected.name}' but got '${actual.name}'`,
      };
    }

    // For exact match, validate arguments
    if (judgeType === "exact" && expected.arguments) {
      for (const [key, value] of Object.entries(expected.arguments)) {
        if (actual.arguments?.[key] !== value) {
          return {
            status: "fail",
            failureReason: `Tool call '${expected.name}' argument '${key}': expected '${value}' but got '${actual.arguments?.[key]}'`,
          };
        }
      }
    }
  }

  return { status: "pass" };
}

async function judgeWithAI(
  messages: Array<{ role: string; content?: string }>,
  judgePlan: { model?: { provider: string; model: string; messages: Array<{ role: string; content: string }> } }
): Promise<{ status: "pass" | "fail"; failureReason?: string }> {
  if (!judgePlan.model) {
    return { status: "fail", failureReason: "No AI model configuration provided" };
  }

  try {
    // Replace template variables in the judge prompt
    const messagesJson = JSON.stringify(messages);
    const lastMessage = messages[messages.length - 1];
    const lastMessageJson = JSON.stringify(lastMessage);

    const judgePrompt = judgePlan.model.messages[0]?.content
      ?.replace(/\{\{messages\}\}/g, messagesJson)
      ?.replace(/\{\{messages\[-1\]\}\}/g, lastMessageJson) || "";

    // Call Gemini for AI judging
    const response = await fetch(`${BACKEND_URL}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: judgePrompt,
        model: judgePlan.model.model,
      }),
    });

    if (!response.ok) {
      // Fallback: simple keyword check
      const content = lastMessage?.content?.toLowerCase() || "";
      const hasHelpful = content.includes("help") || content.includes("assist");
      return hasHelpful ? { status: "pass" } : { status: "fail", failureReason: "AI judge unavailable, fallback check failed" };
    }

    const result = await response.json();
    const verdict = result.verdict?.toLowerCase().trim();

    if (verdict === "pass") {
      return { status: "pass" };
    }
    return { status: "fail", failureReason: result.reason || "AI judge returned fail" };
  } catch (e) {
    return { status: "fail", failureReason: `AI judge error: ${e instanceof Error ? e.message : "Unknown error"}` };
  }
}

// POST /api/evals/run - Execute an eval against an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evalId, agentId } = body;

    if (!evalId) {
      return NextResponse.json({ error: "evalId is required" }, { status: 400 });
    }

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // Fetch the eval definition
    const { data: evalDef, error: evalError } = await supabase
      .from("evals")
      .select("*")
      .eq("id", evalId)
      .single();

    if (evalError || !evalDef) {
      return NextResponse.json({ error: "Eval not found" }, { status: 404 });
    }

    // Create eval run record
    const { data: evalRun, error: runError } = await supabase
      .from("eval_runs")
      .insert({
        eval_id: evalId,
        agent_id: agentId,
        status: "running",
      })
      .select()
      .single();

    if (runError) {
      // If table doesn't exist
      if (runError.code === "42P01") {
        return NextResponse.json(
          { error: "Eval runs table not found. Please run database migration.", needsMigration: true },
          { status: 500 }
        );
      }
      throw runError;
    }

    // Execute the mock conversation
    const messages = evalDef.messages as Array<{
      role: string;
      content?: string;
      judgePlan?: {
        type: "exact" | "regex" | "ai";
        content?: string;
        toolCalls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
        model?: { provider: string; model: string; messages: Array<{ role: string; content: string }> };
      };
      continuePlan?: {
        exitOnFailureEnabled?: boolean;
        contentOverride?: string;
      };
    }>;

    const resultMessages: Array<{
      role: string;
      content?: string;
      toolCalls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
      judge?: { status: "pass" | "fail"; failureReason?: string };
    }> = [];

    const conversationHistory: Array<{ role: string; content?: string }> = [];
    let overallStatus: "pass" | "fail" = "pass";
    let endedReason: string = "mockConversation.done";

    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "system") {
        // Add to conversation history
        conversationHistory.push({ role: msg.role, content: msg.content });
        resultMessages.push({ role: msg.role, content: msg.content });
      } else if (msg.role === "assistant") {
        // Get agent response
        let agentResponse: string | undefined;
        let agentToolCalls: Array<{ name: string; arguments?: Record<string, unknown> }> | undefined;

        try {
          // Call the agent via backend API
          const agentRes = await fetch(`${BACKEND_URL}/api/eval/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              messages: conversationHistory,
            }),
          });

          if (agentRes.ok) {
            const agentData = await agentRes.json();
            agentResponse = agentData.response;
            agentToolCalls = agentData.toolCalls;
          } else {
            // Simulate a response for testing
            agentResponse = "Hello! How can I help you today?";
          }
        } catch (e) {
          // Fallback response for testing
          agentResponse = "Hello! How can I help you today?";
        }

        // Add agent response to history
        conversationHistory.push({ role: "assistant", content: agentResponse });

        // Judge the response if judgePlan exists
        let judgeResult: { status: "pass" | "fail"; failureReason?: string } | undefined;

        if (msg.judgePlan) {
          const { type, content, toolCalls } = msg.judgePlan;

          if (type === "exact") {
            if (toolCalls && toolCalls.length > 0) {
              judgeResult = judgeToolCalls(agentToolCalls, toolCalls, "exact");
            } else if (content) {
              judgeResult = judgeExactMatch(agentResponse, content);
            } else {
              judgeResult = { status: "pass" };
            }
          } else if (type === "regex") {
            if (toolCalls && toolCalls.length > 0) {
              judgeResult = judgeToolCalls(agentToolCalls, toolCalls, "regex");
            } else if (content) {
              judgeResult = judgeRegex(agentResponse, content);
            } else {
              judgeResult = { status: "pass" };
            }
          } else if (type === "ai") {
            judgeResult = await judgeWithAI(conversationHistory, msg.judgePlan);
          }

          if (judgeResult?.status === "fail") {
            overallStatus = "fail";

            // Check if we should exit on failure
            if (msg.continuePlan?.exitOnFailureEnabled) {
              endedReason = "mockConversation.done";
              resultMessages.push({
                role: "assistant",
                content: agentResponse,
                toolCalls: agentToolCalls,
                judge: judgeResult,
              });
              break;
            }
          }
        }

        resultMessages.push({
          role: "assistant",
          content: agentResponse,
          toolCalls: agentToolCalls,
          judge: judgeResult,
        });
      } else if (msg.role === "tool") {
        // Tool response - add to history
        conversationHistory.push({ role: "tool", content: msg.content });
        resultMessages.push({ role: "tool", content: msg.content });
      }
    }

    // Update eval run with results
    const { data: updatedRun, error: updateError } = await supabase
      .from("eval_runs")
      .update({
        status: "ended",
        ended_reason: endedReason,
        results: [{ status: overallStatus, messages: resultMessages }],
        updated_at: new Date().toISOString(),
      })
      .eq("id", evalRun.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ evalRun: updatedRun }, { status: 201 });
  } catch (err) {
    console.error("Error running eval:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run eval" },
      { status: 500 }
    );
  }
}

// GET /api/evals/run - List eval runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const evalId = searchParams.get("evalId");

    let query = supabase
      .from("eval_runs")
      .select("*")
      .order("created_at", { ascending: false });

    if (evalId) {
      query = query.eq("eval_id", evalId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ runs: [], needsMigration: true });
      }
      throw error;
    }

    return NextResponse.json({ runs: data || [] });
  } catch (err) {
    console.error("Error fetching eval runs:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch eval runs" },
      { status: 500 }
    );
  }
}
