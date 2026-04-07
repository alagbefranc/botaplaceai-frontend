import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      const { data: conversation, error: conversationError } = await admin
        .from("conversations")
        .select("id, agent_id, channel, external_user_id, started_at, ended_at, duration_seconds, metadata")
        .eq("org_id", member.orgId)
        .eq("id", conversationId)
        .single();

      if (conversationError || !conversation) {
        return NextResponse.json(
          { error: conversationError?.message ?? "Conversation not found." },
          { status: 404 },
        );
      }

      // Fetch agent name
      let agentName = "Unknown Agent";
      if (conversation.agent_id) {
        const { data: agentData } = await admin
          .from("agents")
          .select("name")
          .eq("id", conversation.agent_id)
          .single();
        if (agentData?.name) agentName = agentData.name;
      }

      const { data: messages, error: messagesError } = await admin
        .from("messages")
        .select("id, role, content, audio_url, tool_calls, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        return NextResponse.json({ error: messagesError.message }, { status: 500 });
      }

      return NextResponse.json({
        conversation: { ...conversation, agentName },
        messages: messages ?? [],
      });
    }

    const { data: conversations, error: conversationsError } = await admin
      .from("conversations")
      .select("id, agent_id, channel, external_user_id, started_at, ended_at, duration_seconds")
      .eq("org_id", member.orgId)
      .order("started_at", { ascending: false })
      .limit(200);

    if (conversationsError) {
      return NextResponse.json({ error: conversationsError.message }, { status: 500 });
    }

    const conversationRows = conversations ?? [];

    const agentIds = Array.from(
      new Set(
        conversationRows
          .map((row) => row.agent_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    const [agentsRes, messagesRes] = await Promise.all([
      agentIds.length > 0
        ? admin.from("agents").select("id, name").in("id", agentIds)
        : Promise.resolve({ data: [], error: null }),
      conversationRows.length > 0
        ? admin
            .from("messages")
            .select("conversation_id, role, content")
            .in(
              "conversation_id",
              conversationRows.map((row) => row.id),
            )
            .limit(50000)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (agentsRes.error || messagesRes.error) {
      return NextResponse.json(
        { error: agentsRes.error?.message ?? messagesRes.error?.message ?? "Failed to load conversations." },
        { status: 500 },
      );
    }

    const agentMap = new Map((agentsRes.data ?? []).map((agent) => [agent.id, agent.name]));

    const messagesByConversation = new Map<
      string,
      { role: string; content: string | null }[]
    >();

    for (const message of messagesRes.data ?? []) {
      const conversationMessages = messagesByConversation.get(message.conversation_id) ?? [];
      conversationMessages.push({
        role: message.role,
        content: message.content,
      });
      messagesByConversation.set(message.conversation_id, conversationMessages);
    }

    const result = conversationRows.map((row) => {
      const rowMessages = messagesByConversation.get(row.id) ?? [];
      return {
        id: row.id,
        agent: row.agent_id ? agentMap.get(row.agent_id) ?? "Unknown Agent" : "Unassigned",
        channel: row.channel,
        user: row.external_user_id ?? "anonymous",
        durationSeconds: row.duration_seconds ?? (
          row.ended_at && row.started_at
            ? Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000)
            : 0
        ),
        messagesCount: rowMessages.length,
        date: row.started_at,
        preview:
          rowMessages.length > 0
            ? rowMessages
                .slice(-2)
                .map((item) => `${item.role}: ${item.content ?? ""}`)
                .join("\n")
            : "No messages recorded.",
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load conversations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
