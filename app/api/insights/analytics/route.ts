import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// GET - Get analytics data for insights
export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // Default to last 30 days
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get total extractions
    const { count: totalExtractions } = await admin
      .from("custom_insight_results")
      .select("*", { count: "exact", head: true })
      .eq("org_id", member.orgId)
      .gte("extracted_at", start.toISOString())
      .lte("extracted_at", end.toISOString());

    // Get previous period for comparison
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const { count: previousExtractions } = await admin
      .from("custom_insight_results")
      .select("*", { count: "exact", head: true })
      .eq("org_id", member.orgId)
      .gte("extracted_at", previousStart.toISOString())
      .lt("extracted_at", start.toISOString());

    const extractionsChange = previousExtractions && previousExtractions > 0
      ? Math.round(((totalExtractions || 0) - previousExtractions) / previousExtractions * 100)
      : 0;

    // Get system insights for sentiment and satisfaction
    const { data: conversationInsights } = await admin
      .from("conversation_insights")
      .select("sentiment, satisfaction_score, issue_resolved, primary_intent")
      .eq("org_id", member.orgId)
      .gte("extracted_at", start.toISOString())
      .lte("extracted_at", end.toISOString());

    // Calculate averages
    const satisfactionScores = (conversationInsights || [])
      .map((i) => i.satisfaction_score)
      .filter((s): s is number => s !== null && s !== undefined);
    const avgSatisfaction = satisfactionScores.length > 0
      ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
      : 0;

    // Resolution rate
    const resolvedCount = (conversationInsights || []).filter((i) => i.issue_resolved === true).length;
    const totalWithResolution = (conversationInsights || []).filter((i) => i.issue_resolved !== null).length;
    const issueResolutionRate = totalWithResolution > 0
      ? Math.round((resolvedCount / totalWithResolution) * 100)
      : 0;

    // Top intents
    const intentCounts: Record<string, number> = {};
    (conversationInsights || []).forEach((i) => {
      if (i.primary_intent) {
        intentCounts[i.primary_intent] = (intentCounts[i.primary_intent] || 0) + 1;
      }
    });
    const topIntents = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sentiment distribution
    const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    (conversationInsights || []).forEach((i) => {
      if (i.sentiment && sentimentCounts[i.sentiment] !== undefined) {
        sentimentCounts[i.sentiment]++;
      }
    });
    const sentimentDistribution = [
      { type: "Positive", value: sentimentCounts.positive },
      { type: "Neutral", value: sentimentCounts.neutral },
      { type: "Negative", value: sentimentCounts.negative },
      { type: "Mixed", value: sentimentCounts.mixed },
    ];

    // Extractions trend (daily)
    const { data: customResults } = await admin
      .from("custom_insight_results")
      .select("extracted_at")
      .eq("org_id", member.orgId)
      .gte("extracted_at", start.toISOString())
      .lte("extracted_at", end.toISOString())
      .order("extracted_at", { ascending: true });

    const trendMap: Record<string, number> = {};
    (customResults || []).forEach((r) => {
      const date = new Date(r.extracted_at).toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });
    const extractionsTrend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent extractions
    const { data: recentResults } = await admin
      .from("custom_insight_results")
      .select(`
        id,
        conversation_id,
        definition_id,
        result,
        extracted_at,
        insight_definitions!inner(name)
      `)
      .eq("org_id", member.orgId)
      .order("extracted_at", { ascending: false })
      .limit(20);

    const recentExtractions = (recentResults || []).map((r) => {
      const definitions = r.insight_definitions as unknown;
      const name = Array.isArray(definitions)
        ? (definitions[0] as { name: string })?.name
        : (definitions as { name: string })?.name;
      return {
        id: r.id,
        conversationId: r.conversation_id,
        insightName: name || "Unknown",
        extractedAt: r.extracted_at,
        sentiment: (r.result as Record<string, unknown>)?.sentiment as string | undefined,
        satisfactionScore: (r.result as Record<string, unknown>)?.satisfaction_score as number | undefined,
      };
    });

    return NextResponse.json({
      totalExtractions: totalExtractions || 0,
      extractionsChange,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      satisfactionChange: 0,
      issueResolutionRate,
      resolutionChange: 0,
      topIntents,
      sentimentDistribution,
      extractionsTrend,
      recentExtractions,
    });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
