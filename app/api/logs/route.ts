import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _sb: ReturnType<typeof createClient> | null = null;
function supabase() {
  if (!_sb) _sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  return _sb;
}

// GET /api/logs - Get aggregated conversation logs with events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const eventType = searchParams.get("eventType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");

    // First, try to get conversation events if table exists
    let events: Array<{
      id: string;
      conversation_id: string;
      event_type: string;
      timestamp: string;
      data: Record<string, unknown>;
      latency_ms?: number;
    }> = [];

    try {
      let query = supabase().from("conversation_events")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (conversationId) {
        query = query.eq("conversation_id", conversationId);
      }
      if (eventType) {
        query = query.eq("event_type", eventType);
      }
      if (startDate) {
        query = query.gte("timestamp", startDate);
      }
      if (endDate) {
        query = query.lte("timestamp", endDate);
      }

      const { data, error } = await query;
      if (!error && data) {
        events = data;
      }
    } catch (e) {
      // Table might not exist yet
    }

    // Also get conversations with their messages for a richer log view
    let conversations: Array<{
      id: string;
      agent_id: string;
      channel: string;
      status: string;
      created_at: string;
      ended_at?: string;
      metadata?: Record<string, unknown>;
      agents?: { name: string };
    }> = [];

    try {
      let convQuery = supabase().from("conversations")
        .select("id, agent_id, channel, status, created_at, ended_at, metadata, agents(name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (startDate) {
        convQuery = convQuery.gte("created_at", startDate);
      }
      if (endDate) {
        convQuery = convQuery.lte("created_at", endDate);
      }

      const { data, error } = await convQuery;
      if (!error && data) {
        conversations = data as unknown as typeof conversations;
      }
    } catch (e) {
      // Table might not exist
    }

    // Get messages for recent conversations
    const conversationIds = conversations.slice(0, 20).map((c) => c.id);
    let messages: Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      created_at: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (conversationIds.length > 0) {
      try {
        const { data, error } = await supabase().from("messages")
          .select("id, conversation_id, role, content, created_at, metadata")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true });

        if (!error && data) {
          messages = data;
        }
      } catch (e) {
        // Table might not exist
      }
    }

    // Aggregate stats
    const stats = {
      totalConversations: conversations.length,
      totalEvents: events.length,
      avgLatencyMs: events.length > 0
        ? Math.round(
            events
              .filter((e) => e.latency_ms)
              .reduce((sum, e) => sum + (e.latency_ms || 0), 0) /
              events.filter((e) => e.latency_ms).length || 1
          )
        : 0,
      eventsByType: events.reduce((acc, e) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      events,
      conversations,
      messages,
      stats,
    });
  } catch (err) {
    console.error("Error fetching logs:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
