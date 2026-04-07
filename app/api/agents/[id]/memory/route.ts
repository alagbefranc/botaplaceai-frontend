import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { MemoryConfig, ConversationInsight } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

interface MemoryQueryParams {
  identifier?: string;           // phone, email, or session_id
  identifierType?: string;       // "phone" | "email" | "session_id" | "custom"
  customPath?: string;           // For custom identifier path in metadata
}

interface MemoryContext {
  hasMemory: boolean;
  conversationCount: number;
  insights: Array<{
    conversationId: string;
    extractedAt: string;
    userProfile: ConversationInsight["userProfile"];
    primaryIntent?: string;
    topics: string[];
    sentiment?: string;
    actionItems: ConversationInsight["actionItems"];
    summary?: string;
    keyPoints: string[];
  }>;
  formattedContext: string;      // Ready-to-inject system prompt context
}

function formatMemoryContext(insights: MemoryContext["insights"]): string {
  if (insights.length === 0) {
    return "";
  }

  const lines: string[] = [
    "## Previous Conversation History",
    "",
    "You have spoken with this user before. Here's what you know:",
    "",
  ];

  // Aggregate user profile from all insights (most recent takes priority)
  const profiles = insights.map(i => i.userProfile).filter(p => p && Object.values(p).some(Boolean));
  if (profiles.length > 0) {
    const mergedProfile = profiles.reduce((acc, p) => ({ ...acc, ...p }), {});
    const profileParts: string[] = [];
    if (mergedProfile.name) profileParts.push(`Name: ${mergedProfile.name}`);
    if (mergedProfile.email) profileParts.push(`Email: ${mergedProfile.email}`);
    if (mergedProfile.phone) profileParts.push(`Phone: ${mergedProfile.phone}`);
    if (mergedProfile.company) profileParts.push(`Company: ${mergedProfile.company}`);
    if (mergedProfile.location) profileParts.push(`Location: ${mergedProfile.location}`);
    if (profileParts.length > 0) {
      lines.push("**User Profile:**");
      profileParts.forEach(p => lines.push(`- ${p}`));
      lines.push("");
    }
  }

  // Aggregate topics
  const allTopics = [...new Set(insights.flatMap(i => i.topics))];
  if (allTopics.length > 0) {
    lines.push(`**Previous Topics:** ${allTopics.slice(0, 10).join(", ")}`);
    lines.push("");
  }

  // Aggregate pending action items
  const pendingActions = insights
    .flatMap(i => i.actionItems)
    .filter(a => !a.completed)
    .slice(0, 5);
  if (pendingActions.length > 0) {
    lines.push("**Pending Action Items from Previous Conversations:**");
    pendingActions.forEach(a => lines.push(`- ${a.description}`));
    lines.push("");
  }

  // Most recent interaction summary
  const mostRecent = insights[0];
  if (mostRecent) {
    lines.push(`**Last Interaction:** ${new Date(mostRecent.extractedAt).toLocaleDateString()}`);
    if (mostRecent.summary) {
      lines.push(`**Summary:** ${mostRecent.summary}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    
    // Get query parameters
    const identifier = url.searchParams.get("identifier");
    const identifierType = url.searchParams.get("identifierType") || "session_id";
    const customPath = url.searchParams.get("customPath");

    if (!identifier) {
      return NextResponse.json(
        { error: "identifier query parameter is required" },
        { status: 400 }
      );
    }

    // Fetch agent to get memory config
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id, name, settings")
      .eq("id", agentId)
      .eq("org_id", member.orgId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const settings = agent.settings as { memory?: MemoryConfig } | null;
    const memoryConfig = settings?.memory;

    // Check if memory is enabled
    if (!memoryConfig?.enabled) {
      const emptyResponse: MemoryContext = {
        hasMemory: false,
        conversationCount: 0,
        insights: [],
        formattedContext: "",
      };
      return NextResponse.json(emptyResponse);
    }

    // Build the query based on identifier type
    let conversationsQuery = admin
      .from("conversations")
      .select("id, external_user_id, metadata, started_at")
      .eq("org_id", member.orgId);

    // Apply scope filter
    if (memoryConfig.scope !== "all") {
      conversationsQuery = conversationsQuery.eq("agent_id", agentId);
    }

    // Apply identifier filter based on type
    switch (identifierType) {
      case "phone":
      case "email":
      case "session_id":
        conversationsQuery = conversationsQuery.eq("external_user_id", identifier);
        break;
      case "custom":
        if (customPath) {
          // Query by metadata path
          conversationsQuery = conversationsQuery.filter(
            `metadata->>${customPath}`,
            "eq",
            identifier
          );
        }
        break;
    }

    // Apply time window filter
    if (memoryConfig.timeWindowDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - memoryConfig.timeWindowDays);
      conversationsQuery = conversationsQuery.gte("started_at", cutoffDate.toISOString());
    }

    // Order by most recent and limit
    conversationsQuery = conversationsQuery
      .order("started_at", { ascending: false })
      .limit(memoryConfig.maxConversations);

    const { data: conversations, error: convError } = await conversationsQuery;

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      const emptyResponse: MemoryContext = {
        hasMemory: false,
        conversationCount: 0,
        insights: [],
        formattedContext: "",
      };
      return NextResponse.json(emptyResponse);
    }

    // Fetch insights for these conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: insightsData, error: insightsError } = await admin
      .from("conversation_insights")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("extracted_at", { ascending: false });

    if (insightsError) {
      return NextResponse.json({ error: insightsError.message }, { status: 500 });
    }

    // Transform insights
    const insights: MemoryContext["insights"] = (insightsData || []).map(i => ({
      conversationId: i.conversation_id,
      extractedAt: i.extracted_at,
      userProfile: i.user_profile || {},
      primaryIntent: i.primary_intent,
      topics: i.topics || [],
      sentiment: i.sentiment,
      actionItems: (i.action_items || []).map((item: Record<string, unknown>) => ({
        description: item.description as string,
        assignee: item.assignee as string | undefined,
        dueDate: item.due_date as string | undefined,
        completed: item.completed as boolean | undefined,
      })),
      summary: i.summary,
      keyPoints: i.key_points || [],
    }));

    // Filter insights by included types if specified
    const includeTypes = memoryConfig.includeInsightTypes || [];
    // Currently we include all, but could filter here

    const response: MemoryContext = {
      hasMemory: insights.length > 0,
      conversationCount: conversations.length,
      insights,
      formattedContext: formatMemoryContext(insights),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve memory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST endpoint for webhook-based memory retrieval
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();

    // Fetch agent to get memory config with webhook
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id, name, settings")
      .eq("id", agentId)
      .eq("org_id", member.orgId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const settings = agent.settings as { memory?: MemoryConfig } | null;
    const memoryConfig = settings?.memory;

    if (!memoryConfig?.enabled || !memoryConfig.webhookEnabled || !memoryConfig.webhookUrl) {
      return NextResponse.json(
        { error: "Memory webhook not configured" },
        { status: 400 }
      );
    }

    // Get initialization payload from request body
    const body = await request.json();

    // Call the webhook
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      memoryConfig.webhookTimeoutMs || 1000
    );

    try {
      const webhookResponse = await fetch(memoryConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            record_type: "event",
            id: `evt_${Date.now()}`,
            event_type: "assistant.initialization",
            occurred_at: new Date().toISOString(),
            payload: body,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!webhookResponse.ok) {
        throw new Error(`Webhook returned ${webhookResponse.status}`);
      }

      const webhookData = await webhookResponse.json();
      
      // Return the webhook response which may include dynamic_variables and memory config
      return NextResponse.json({
        success: true,
        dynamicVariables: webhookData.dynamic_variables || {},
        memoryQuery: webhookData.memory?.conversation_query,
        insightQuery: webhookData.memory?.insight_query,
        conversationMetadata: webhookData.conversation?.metadata,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        // Timeout - proceed without webhook response
        return NextResponse.json({
          success: false,
          error: "Webhook timeout",
          dynamicVariables: {},
        });
      }
      throw fetchError;
    }
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Webhook call failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
