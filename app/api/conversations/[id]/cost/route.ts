import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// Gemini pricing per million tokens (in cents)
const GEMINI_PRICING: Record<string, { input: number; output: number } | { perMinute: number }> = {
  "gemini-1.5-flash": { input: 7.5, output: 30 },
  "gemini-1.5-flash-8b": { input: 3.75, output: 15 },
  "gemini-1.5-pro": { input: 125, output: 500 },
  "gemini-2.0-flash": { input: 10, output: 40 },
  "gemini-2.0-flash-lite": { input: 7.5, output: 30 },
  "gemini-2.0-flash-live": { perMinute: 35 },
  "gemini-3.1-flash-live-preview": { perMinute: 35 },
};

interface UsageLogRow {
  input_tokens: number | null;
  output_tokens: number | null;
  tokens_used: number;
  cost_cents: number;
  model: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface CostBreakdown {
  conversationId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  baseCostCents: number;
  markupPercentage: number;
  markupCents: number;
  totalCostCents: number;
  durationMinutes: number;
  model: string;
  usageLogs: Array<{
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    model: string;
    createdAt: string;
  }>;
  pricing: {
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    isLive: boolean;
    perMinutePrice?: number;
  };
}

function formatCost(cents: number): string {
  if (cents < 100) {
    return `$0.${cents.toString().padStart(2, "0")}`;
  }
  const dollars = Math.floor(cents / 100);
  const remainingCents = cents % 100;
  return `$${dollars}.${remainingCents.toString().padStart(2, "0")}`;
}

function getPricingInfo(model: string) {
  const pricing = GEMINI_PRICING[model];
  
  if (!pricing) {
    return {
      inputPricePerMillion: 7.5,
      outputPricePerMillion: 30,
      isLive: false,
    };
  }
  
  if ("perMinute" in pricing) {
    return {
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      isLive: true,
      perMinutePrice: pricing.perMinute,
    };
  }
  
  return {
    inputPricePerMillion: pricing.input,
    outputPricePerMillion: pricing.output,
    isLive: false,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

    // Verify conversation belongs to org
    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("id, duration_seconds")
      .eq("id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch all usage logs for this conversation
    const { data: usageLogs, error: usageError } = await admin
      .from("usage_logs")
      .select("input_tokens, output_tokens, tokens_used, cost_cents, model, duration_seconds, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500 });
    }

    // Get organization markup percentage
    const { data: org } = await admin
      .from("organizations")
      .select("metadata")
      .eq("id", member.orgId)
      .single();

    const metadata = org?.metadata as Record<string, unknown> | null;
    const markupPercentage = typeof metadata?.billing_markup_percentage === "number" 
      ? metadata.billing_markup_percentage 
      : 0;

    // If no usage logs, return empty cost breakdown
    if (!usageLogs || usageLogs.length === 0) {
      const breakdown: CostBreakdown = {
        conversationId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        baseCostCents: 0,
        markupPercentage,
        markupCents: 0,
        totalCostCents: 0,
        durationMinutes: (conversation.duration_seconds || 0) / 60,
        model: "unknown",
        usageLogs: [],
        pricing: getPricingInfo("gemini-1.5-flash"),
      };

      return NextResponse.json({
        cost: breakdown,
        formatted: {
          baseCost: formatCost(0),
          markup: formatCost(0),
          totalCost: formatCost(0),
        },
      });
    }

    // Aggregate usage data
    const logs = usageLogs as UsageLogRow[];
    const totals = logs.reduce(
      (acc, log) => ({
        inputTokens: acc.inputTokens + (log.input_tokens || 0),
        outputTokens: acc.outputTokens + (log.output_tokens || 0),
        totalTokens: acc.totalTokens + (log.tokens_used || 0),
        baseCostCents: acc.baseCostCents + (log.cost_cents || 0),
        durationSeconds: acc.durationSeconds + (log.duration_seconds || 0),
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, baseCostCents: 0, durationSeconds: 0 }
    );

    // Get the primary model used
    const model = logs.find(l => l.model)?.model || "gemini-1.5-flash";
    
    // Calculate markup
    const markupCents = Math.ceil(totals.baseCostCents * (markupPercentage / 100));
    const totalCostCents = totals.baseCostCents + markupCents;

    const breakdown: CostBreakdown = {
      conversationId,
      totalInputTokens: totals.inputTokens,
      totalOutputTokens: totals.outputTokens,
      totalTokens: totals.totalTokens,
      baseCostCents: totals.baseCostCents,
      markupPercentage,
      markupCents,
      totalCostCents,
      durationMinutes: totals.durationSeconds / 60,
      model,
      usageLogs: logs.map(log => ({
        inputTokens: log.input_tokens || 0,
        outputTokens: log.output_tokens || 0,
        costCents: log.cost_cents || 0,
        model: log.model || "unknown",
        createdAt: log.created_at,
      })),
      pricing: getPricingInfo(model),
    };

    return NextResponse.json({
      cost: breakdown,
      formatted: {
        baseCost: formatCost(totals.baseCostCents),
        markup: formatCost(markupCents),
        totalCost: formatCost(totalCostCents),
      },
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch cost data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
