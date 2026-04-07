import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InsightGroup } from "@/lib/domain/agent-builder";

interface InsightResult {
  definitionId: string;
  name: string;
  result: Record<string, unknown>;
}

interface WebhookPayload {
  event_type: "insight.extracted";
  conversation_id: string;
  insight_group_id: string;
  insight_group_name: string;
  insights: InsightResult[];
  extracted_at: string;
}

/**
 * Deliver insight extraction results to a webhook URL
 */
export async function deliverInsightWebhook(
  group: InsightGroup,
  conversationId: string,
  orgId: string,
  results: InsightResult[]
): Promise<{ success: boolean; error?: string }> {
  if (!group.webhookEnabled || !group.webhookUrl) {
    return { success: false, error: "Webhook not enabled or URL not configured" };
  }

  const admin = getSupabaseAdminClient();

  const payload: WebhookPayload = {
    event_type: "insight.extracted",
    conversation_id: conversationId,
    insight_group_id: group.id || "",
    insight_group_name: group.name,
    insights: results,
    extracted_at: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(group.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AI-Insights-Webhook/1.0",
        "X-Insight-Group-ID": group.id || "",
        "X-Conversation-ID": conversationId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    responseStatus = response.status;

    try {
      responseBody = await response.text();
    } catch {
      responseBody = "(unable to read response body)";
    }

    success = response.ok;
    if (!success) {
      errorMessage = `Webhook returned status ${response.status}`;
    }
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      errorMessage = "Webhook request timed out";
    } else {
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }
  }

  // Log the delivery attempt
  try {
    await admin.from("insight_webhook_logs").insert({
      group_id: group.id,
      conversation_id: conversationId,
      org_id: orgId,
      payload,
      response_status: responseStatus,
      response_body: responseBody?.slice(0, 5000), // Limit stored response
      success,
      error_message: errorMessage,
    });
  } catch (logError) {
    console.error("Failed to log webhook delivery:", logError);
  }

  return { success, error: errorMessage };
}

/**
 * Get all insight groups that contain a specific insight definition
 */
export async function getGroupsForInsight(
  insightDefinitionId: string,
  orgId: string
): Promise<InsightGroup[]> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("insight_groups")
    .select("*")
    .eq("org_id", orgId)
    .eq("webhook_enabled", true)
    .contains("insight_ids", [insightDefinitionId]);

  if (error) {
    console.error("Failed to get groups for insight:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    webhookUrl: row.webhook_url,
    webhookEnabled: row.webhook_enabled,
    insightIds: row.insight_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Deliver insights to all relevant webhook groups
 */
export async function deliverInsightsToGroups(
  conversationId: string,
  orgId: string,
  results: InsightResult[]
): Promise<{ delivered: number; failed: number }> {
  const admin = getSupabaseAdminClient();

  // Get all enabled webhook groups
  const { data: groups, error } = await admin
    .from("insight_groups")
    .select("*")
    .eq("org_id", orgId)
    .eq("webhook_enabled", true);

  if (error || !groups) {
    console.error("Failed to get webhook groups:", error);
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const row of groups) {
    const group: InsightGroup = {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      webhookUrl: row.webhook_url,
      webhookEnabled: row.webhook_enabled,
      insightIds: row.insight_ids || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Filter results to only include insights in this group
    const groupResults = results.filter((r) =>
      group.insightIds.includes(r.definitionId)
    );

    if (groupResults.length === 0) {
      continue; // No matching insights for this group
    }

    const result = await deliverInsightWebhook(group, conversationId, orgId, groupResults);

    if (result.success) {
      delivered++;
    } else {
      failed++;
    }
  }

  return { delivered, failed };
}
