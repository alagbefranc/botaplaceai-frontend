import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// GET /api/monitoring/active - Get active sessions
export async function GET(request: NextRequest) {
  try {
    // Get active conversations (not ended)
    // Use explicit relationship hint to avoid ambiguity between agent_id and current_agent_id
    const { data: activeConversations, error: convError } = await supabase
      .from("conversations")
      .select("id, agent_id, channel, status, created_at, metadata, agents!conversations_agent_id_fkey(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);

    if (convError && convError.code !== "42P01") {
      throw convError;
    }

    // Get recent conversations (last hour) for metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentConversations, error: recentError } = await supabase
      .from("conversations")
      .select("id, created_at, ended_at, channel")
      .gte("created_at", oneHourAgo);

    // Calculate metrics
    const activeSessions = (activeConversations || []).map((conv) => {
      const startedAt = new Date(conv.created_at);
      const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
      
      return {
        id: conv.id,
        agentId: conv.agent_id,
        agentName: (conv.agents as unknown as { name: string } | null)?.name || "Unknown",
        channel: conv.channel,
        startedAt: conv.created_at,
        durationSeconds,
        messageCount: 0, // Would need to join with messages
        status: durationSeconds < 60 ? "active" : "idle",
      };
    });

    // Calculate calls per minute (last hour)
    const callsLastHour = recentConversations?.length || 0;
    const callsPerMinute = Math.round((callsLastHour / 60) * 10) / 10;

    // Channel distribution
    const channelCounts: Record<string, number> = {};
    (recentConversations || []).forEach((c) => {
      channelCounts[c.channel] = (channelCounts[c.channel] || 0) + 1;
    });

    return NextResponse.json({
      activeSessions,
      metrics: {
        activeCount: activeSessions.length,
        callsLastHour,
        callsPerMinute,
        channelDistribution: channelCounts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error fetching active sessions:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch active sessions" },
      { status: 500 }
    );
  }
}
