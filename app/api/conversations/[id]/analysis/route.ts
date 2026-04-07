import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { GoogleGenAI } from "@google/genai";
import type { AnalysisPlan, CallAnalysisResult, SuccessEvaluationRubric } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// Default prompts (match the call analysis spec)
const DEFAULT_SUMMARY_PROMPT =
  "You are an expert note-taker. You will be given a transcript of a call. Summarize the call in 2-3 sentences, if applicable.";

const DEFAULT_STRUCTURED_DATA_PROMPT =
  "You are an expert data extractor. You will be given a transcript of a call. Extract structured data per the JSON Schema.";

const DEFAULT_SUCCESS_EVAL_PROMPT =
  "You are an expert call evaluator. You will be given a transcript of a call and the system prompt of the AI participant. " +
  "Determine if the call was successful based on the objectives inferred from the system prompt.";

function getGeminiKey(): string | undefined {
  return (
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY
  );
}

function buildSuccessEvalInstruction(rubric: SuccessEvaluationRubric): string {
  switch (rubric) {
    case "NumericScale":
      return "Return a single integer from 1 to 10 representing overall call success (10 = excellent).";
    case "DescriptiveScale":
      return "Return exactly one of: Excellent, Good, Fair, Poor — based on overall call success.";
    case "PassFail":
      return "Return exactly true or false — was the call successful?";
    case "PercentageScale":
      return "Return a single integer from 0 to 100 representing the success percentage.";
    case "LikertScale":
      return "Return exactly one of: Strongly Agree, Agree, Neutral, Disagree, Strongly Disagree — regarding whether the call met its objectives.";
    case "AutomaticRubric":
      return "Break down success by specific criteria. Return a JSON object with each criterion as a key and a score/verdict as the value.";
    default:
      return "Return exactly true or false — was the call successful?";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("conversations")
      .select("call_analysis")
      .eq("id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ analysis: null });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analysis: data?.call_analysis ?? null });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch analysis." }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

    const geminiKey = getGeminiKey();
    if (!geminiKey) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    // 1. Fetch conversation + agent
    const { data: conv, error: convError } = await admin
      .from("conversations")
      .select("id, agent_id, org_id")
      .eq("id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    // 2. Fetch agent's analysis_plan + system_prompt
    const { data: agentRow } = await admin
      .from("agents")
      .select("analysis_plan, system_prompt")
      .eq("id", conv.agent_id)
      .eq("org_id", member.orgId)
      .maybeSingle();

    const analysisPlan: AnalysisPlan = (agentRow?.analysis_plan as AnalysisPlan) ?? {};
    const systemPrompt: string = agentRow?.system_prompt ?? "";

    // 3. Fetch messages + build transcript
    const { data: messages } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: "Not enough messages to analyze." }, { status: 400 });
    }

    interface MsgRow { role: string; content: string | null }
    const transcript = messages
      .filter((m: MsgRow) => m.content && (m.role === "user" || m.role === "assistant"))
      .map((m: MsgRow) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    if (transcript.length < 40) {
      return NextResponse.json({ error: "Transcript too short to analyze." }, { status: 400 });
    }

    const genAI = new GoogleGenAI({ apiKey: geminiKey });
    const model = "gemini-3-flash-preview";

    const result: CallAnalysisResult = {
      analyzedAt: new Date().toISOString(),
      model,
    };

    // 4a. Summary
    const summaryPrompt = analysisPlan.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT;
    const summaryResp = await genAI.models.generateContent({
      model,
      contents: `${summaryPrompt}\n\nTRANSCRIPT:\n${transcript}\n\nProvide only the summary, no extra text.`,
    });
    result.summary = summaryResp.text?.trim() ?? undefined;

    // 4b. Structured data (only if a schema is defined)
    if (analysisPlan.structuredDataSchema && Object.keys(analysisPlan.structuredDataSchema).length > 0) {
      const sdPrompt = analysisPlan.structuredDataPrompt?.trim() || DEFAULT_STRUCTURED_DATA_PROMPT;
      const schemaStr = JSON.stringify(analysisPlan.structuredDataSchema, null, 2);
      const sdResp = await genAI.models.generateContent({
        model,
        contents: `${sdPrompt}\n\nJSON Schema:\n${schemaStr}\n\nTRANSCRIPT:\n${transcript}\n\nReturn only valid JSON matching the schema, nothing else.`,
        config: { responseMimeType: "application/json" },
      });
      try {
        result.structuredData = JSON.parse(sdResp.text ?? "{}") as Record<string, unknown>;
      } catch {
        result.structuredData = { raw: sdResp.text };
      }
    }

    // 4c. Success evaluation
    const rubric: SuccessEvaluationRubric = analysisPlan.successEvaluationRubric ?? "PassFail";
    const evalPrompt = analysisPlan.successEvaluationPrompt?.trim() || DEFAULT_SUCCESS_EVAL_PROMPT;
    const rubricInstruction = buildSuccessEvalInstruction(rubric);

    const evalResp = await genAI.models.generateContent({
      model,
      contents: `${evalPrompt}\n\nAGENT SYSTEM PROMPT:\n${systemPrompt}\n\nTRANSCRIPT:\n${transcript}\n\n${rubricInstruction}`,
    });

    const evalText = evalResp.text?.trim() ?? "";

    if (rubric === "PassFail") {
      result.successEvaluation = evalText.toLowerCase().includes("true");
    } else if (rubric === "NumericScale" || rubric === "PercentageScale") {
      const num = parseInt(evalText.replace(/[^\d]/g, ""), 10);
      result.successEvaluation = isNaN(num) ? evalText : num;
    } else if (rubric === "AutomaticRubric") {
      try {
        result.successEvaluation = JSON.parse(evalText) as Record<string, unknown>;
      } catch {
        result.successEvaluation = evalText;
      }
    } else {
      result.successEvaluation = evalText;
    }
    result.rubric = rubric;

    // 5. Store in conversations.call_analysis
    await admin
      .from("conversations")
      .update({ call_analysis: result })
      .eq("id", conversationId);

    return NextResponse.json({ analysis: result });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[CallAnalysis] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
