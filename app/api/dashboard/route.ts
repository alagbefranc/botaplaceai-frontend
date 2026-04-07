import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    const [usersRes, conversationsRes, messagesRes, agentsRes, phoneLinesRes, toolsRes, knowledgeRes] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }).eq("org_id", member.orgId),
      admin
        .from("conversations")
        .select("id, duration_seconds", { count: "exact" })
        .eq("org_id", member.orgId)
        .order("started_at", { ascending: false })
        .limit(200),
      admin
        .from("messages")
        .select("id, conversation:conversations!inner(org_id)", { count: "exact" })
        .eq("conversations.org_id", member.orgId)
        .limit(1),
      admin
        .from("agents")
        .select("id, name, status, created_at")
        .eq("org_id", member.orgId)
        .order("updated_at", { ascending: false })
        .limit(1),
      admin
        .from("phone_numbers")
        .select("id, status")
        .eq("org_id", member.orgId),
      admin
        .from("tool_connections")
        .select("id, toolkit, status")
        .eq("org_id", member.orgId),
      admin
        .from("knowledge_bases")
        .select("id", { count: "exact", head: true })
        .eq("org_id", member.orgId),
    ]);

    if (usersRes.error || conversationsRes.error || messagesRes.error || agentsRes.error || phoneLinesRes.error || toolsRes.error || knowledgeRes.error) {
      return NextResponse.json(
        {
          error:
            usersRes.error?.message ??
            conversationsRes.error?.message ??
            messagesRes.error?.message ??
            agentsRes.error?.message ??
            phoneLinesRes.error?.message ??
            toolsRes.error?.message ??
            knowledgeRes.error?.message ??
            "Failed to load dashboard data.",
        },
        { status: 500 },
      );
    }

    const conversationRows = conversationsRes.data ?? [];

    const totalDuration = conversationRows.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
    const avgDurationMinutes = conversationRows.length > 0 ? totalDuration / conversationRows.length / 60 : 0;

    const toolConnections = toolsRes.data ?? [];
    const connectedToolkits = new Set(
      toolConnections
        .filter((tool) => tool.status === "connected" || tool.status === "pending")
        .map((tool) => tool.toolkit),
    );

    const hasPhoneLine = (phoneLinesRes.data ?? []).some((line) =>
      ["active", "provisioning"].includes(line.status ?? "inactive"),
    );

    const latestAgent = agentsRes.data?.[0] ?? null;

    return NextResponse.json({
      stats: {
        users: usersRes.count ?? 0,
        conversations: conversationsRes.count ?? 0,
        messages: messagesRes.count ?? 0,
        avgDurationMinutes,
      },
      setupProgress: {
        agents: Boolean(latestAgent),
        knowledge: (knowledgeRes.count ?? 0) > 0,
        workflows: connectedToolkits.size > 0,
        objects: false,
      },
      channels: {
        whatsapp: false,
        voice: hasPhoneLine,
        sms: false,
        teams: connectedToolkits.has("teams"),
        slack: connectedToolkits.has("slack"),
        email: connectedToolkits.has("gmail") || connectedToolkits.has("email"),
      },
      resume: latestAgent
        ? {
            agentId: latestAgent.id,
            title: `Continue building ${latestAgent.name}`,
            preview: "Your latest draft is ready to finalize and deploy.",
            timestamp: latestAgent.created_at,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load dashboard data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
