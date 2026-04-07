import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

interface ConversationRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  channel: string | null;
  agent_id: string | null;
  external_user_id: string | null;
  agents?: { name: string }[] | { name: string } | null;
}

interface MessageRow {
  id: string;
  role: string;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  created_at: string;
}

// GET - Get comprehensive analytics data
export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Previous period for comparison
    const periodDuration = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodDuration);
    const previousEnd = start;

    // ============================================
    // CURRENT PERIOD DATA
    // ============================================

    // Get conversations with agent info (explicitly specify the relationship)
    const { data: conversations, count: totalConversations, error: convError } = await admin
      .from("conversations")
      .select("id, started_at, ended_at, duration_seconds, channel, agent_id, external_user_id, agents!conversations_agent_id_fkey(name)", { count: "exact" })
      .eq("org_id", member.orgId)
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString())
      .order("started_at", { ascending: true });

    // Debug: Check total conversations without date filter
    const { count: allTimeCount } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", member.orgId);

    console.log("Analytics debug:", {
      orgId: member.orgId,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      filteredCount: totalConversations,
      allTimeCount,
      convError: convError?.message,
    });

    if (convError) {
      console.error("Error fetching conversations:", convError);
    }

    const conversationRows = (conversations || []) as ConversationRow[];

    // Get messages for tool usage analysis (only tool calls)
    const conversationIds = conversationRows.map((c) => c.id);
    let toolMessages: MessageRow[] = [];
    if (conversationIds.length > 0) {
      const { data: messages } = await admin
        .from("messages")
        .select("id, role, tool_name, tool_args, created_at")
        .in("conversation_id", conversationIds)
        .eq("role", "tool")
        .not("tool_name", "is", null);
      toolMessages = (messages || []) as MessageRow[];
    }

    // ============================================
    // PREVIOUS PERIOD DATA (for comparison)
    // ============================================

    const { count: previousConversations } = await admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", member.orgId)
      .gte("started_at", previousStart.toISOString())
      .lt("started_at", previousEnd.toISOString());

    // ============================================
    // CALCULATE METRICS
    // ============================================

    // 1. Total conversations change
    const conversationsChange = previousConversations && previousConversations > 0
      ? Math.round(((totalConversations || 0) - previousConversations) / previousConversations * 100)
      : 0;

    // 2. Average duration
    const completedConversations = conversationRows.filter((c) => c.duration_seconds && c.duration_seconds > 0);
    const totalDuration = completedConversations.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgDurationSeconds = completedConversations.length > 0
      ? Math.round(totalDuration / completedConversations.length)
      : 0;

    // 3. Automation rate (conversations that have ended_at - meaning they completed)
    const completedConvos = conversationRows.filter((c) => c.ended_at !== null).length;
    const automationRate = conversationRows.length > 0
      ? Math.round((completedConvos / conversationRows.length) * 100)
      : 0;

    // 4. Conversations by channel
    const channelCounts: Record<string, number> = {};
    conversationRows.forEach((c) => {
      const channel = c.channel || "unknown";
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });
    const channelColors: Record<string, string> = {
      web_chat: "#6C5CE7",
      web_voice: "#06B6D4",
      phone: "#22C55E",
      sms: "#F59E0B",
      unknown: "#9CA3AF",
    };
    const byChannel = Object.entries(channelCounts).map(([channel, count]) => ({
      channel: channel.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      conversations: count,
      color: channelColors[channel] || "#6C5CE7",
    }));

    // 5. Conversations by agent
    const agentCounts: Record<string, { name: string; count: number }> = {};
    conversationRows.forEach((c) => {
      if (c.agent_id) {
        const agentsData = c.agents;
        const agentName = Array.isArray(agentsData) 
          ? agentsData[0]?.name 
          : agentsData?.name || "Unknown Agent";
        if (!agentCounts[c.agent_id]) {
          agentCounts[c.agent_id] = { name: agentName || "Unknown Agent", count: 0 };
        }
        agentCounts[c.agent_id].count++;
      }
    });
    const byAgent = Object.values(agentCounts)
      .map((a) => ({ agent: a.name, conversations: a.count }))
      .sort((a, b) => b.conversations - a.conversations);

    // 6. Daily trend
    const dailyCounts: Record<string, number> = {};
    conversationRows.forEach((c) => {
      const date = new Date(c.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    
    // Fill in missing days
    const dailyTrend: Array<{ date: string; conversations: number }> = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyTrend.push({
        date: dateStr,
        conversations: dailyCounts[dateStr] || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    // 7. Tool usage statistics
    const toolStats: Record<string, { calls: number; successCount: number; totalTime: number }> = {};
    toolMessages.forEach((m) => {
      const toolName = m.tool_name || "unknown";
      if (!toolStats[toolName]) {
        toolStats[toolName] = { calls: 0, successCount: 0, totalTime: 0 };
      }
      toolStats[toolName].calls++;
      // Assume success if no error in args
      const args = m.tool_args || {};
      if (!args.error) {
        toolStats[toolName].successCount++;
      }
    });
    const toolUsage = Object.entries(toolStats)
      .map(([tool, stats]) => ({
        key: tool,
        tool,
        timesCalled: stats.calls,
        successRate: stats.calls > 0 ? Math.round((stats.successCount / stats.calls) * 1000) / 10 : 0,
        avgResponseTime: "< 1s", // Would need actual timing data
      }))
      .sort((a, b) => b.timesCalled - a.timesCalled);

    // 8. Unique users (by external_user_id)
    const uniqueUsers = new Set(conversationRows.map((c) => c.external_user_id).filter(Boolean));

    // 9. Get CSAT from conversation_insights if available
    const { data: insightData } = await admin
      .from("conversation_insights")
      .select("satisfaction_score")
      .eq("org_id", member.orgId)
      .gte("extracted_at", start.toISOString())
      .lte("extracted_at", end.toISOString())
      .not("satisfaction_score", "is", null);

    const satisfactionScores = (insightData || [])
      .map((i) => i.satisfaction_score)
      .filter((s): s is number => s !== null && s !== undefined);
    const avgCsat = satisfactionScores.length > 0
      ? Math.round((satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length) * 10) / 10
      : null;

    // 10. Hourly distribution for heatmap
    const hourlyDistribution: number[] = new Array(24).fill(0);
    conversationRows.forEach((c) => {
      const hour = new Date(c.started_at).getHours();
      hourlyDistribution[hour]++;
    });

    return NextResponse.json({
      summary: {
        totalConversations: totalConversations || 0,
        allTimeConversations: allTimeCount || 0,
        conversationsChange,
        avgDurationSeconds,
        automationRate,
        csatScore: avgCsat,
        uniqueUsers: uniqueUsers.size,
        totalToolCalls: toolMessages.length,
      },
      byChannel,
      byAgent,
      dailyTrend,
      toolUsage,
      hourlyDistribution,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics data" }, { status: 500 });
  }
}
