import { NextRequest, NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// GET /api/logs - Conversation logs scoped to the authenticated org
export async function GET(request: NextRequest) {
  try {
    const { admin, member } = await getOrgMemberContext();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);

    // Fetch conversations (schema uses started_at not created_at, no status column)
    let convQuery = admin
      .from("conversations")
      .select("id, agent_id, channel, started_at, ended_at, duration_seconds, metadata, agents(name)")
      .eq("org_id", member.orgId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (conversationId) convQuery = convQuery.eq("id", conversationId);
    if (startDate) convQuery = convQuery.gte("started_at", startDate);
    if (endDate) convQuery = convQuery.lte("started_at", endDate);

    const { data: rawConversations, error: convError } = await convQuery;

    if (convError) {
      console.error("[Logs] conversations query error:", convError.message);
    }

    // Normalize: map started_at → created_at and derive status from ended_at
    const conversations = (rawConversations ?? []).map((c) => ({
      id: c.id,
      agent_id: c.agent_id,
      channel: c.channel,
      created_at: c.started_at,           // page expects created_at
      ended_at: c.ended_at ?? undefined,
      duration_seconds: c.duration_seconds,
      status: c.ended_at ? "ended" : "active",
      metadata: c.metadata,
      agents: c.agents,
    }));

    // Fetch messages for the returned conversations
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
      const { data: msgData, error: msgError } = await admin
        .from("messages")
        .select("id, conversation_id, role, content, created_at, metadata")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true });

      if (msgError) {
        console.error("[Logs] messages query error:", msgError.message);
      }
      messages = msgData ?? [];
    }

    // conversation_events table may not exist — skip silently
    const events: unknown[] = [];

    const stats = {
      totalConversations: conversations.length,
      totalEvents: events.length,
      avgLatencyMs: 0,
      eventsByType: {} as Record<string, number>,
      activeConversations: conversations.filter((c) => c.status === "active").length,
      endedConversations: conversations.filter((c) => c.status === "ended").length,
    };

    return NextResponse.json({ events, conversations, messages, stats });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch logs";
    console.error("[Logs] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
