import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { DEFAULT_CUSTOM_INSIGHTS_CONFIG } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

/**
 * GET - Verify Custom Insights System Integration
 * Tests all components are properly wired
 */
export async function GET() {
  const checks: Array<{
    name: string;
    status: "pass" | "fail" | "warn";
    details: string;
  }> = [];

  try {
    // 1. Check auth context
    const { admin, member } = await getOrgMemberContext();
    checks.push({
      name: "Auth Context",
      status: "pass",
      details: `Org ID: ${member.orgId}`,
    });

    // 2. Check default config exists
    if (DEFAULT_CUSTOM_INSIGHTS_CONFIG) {
      checks.push({
        name: "Default Config",
        status: "pass",
        details: JSON.stringify(DEFAULT_CUSTOM_INSIGHTS_CONFIG),
      });
    } else {
      checks.push({
        name: "Default Config",
        status: "fail",
        details: "DEFAULT_CUSTOM_INSIGHTS_CONFIG not found",
      });
    }

    // 3. Check insight_definitions table
    const { data: definitions, error: defError } = await admin
      .from("insight_definitions")
      .select("id, name, insight_type, is_template")
      .eq("org_id", member.orgId)
      .limit(10);

    if (defError) {
      checks.push({
        name: "Insight Definitions Table",
        status: "fail",
        details: defError.message,
      });
    } else {
      checks.push({
        name: "Insight Definitions Table",
        status: "pass",
        details: `Found ${definitions?.length || 0} definitions`,
      });
    }

    // 4. Check insight_groups table
    const { data: groups, error: groupError } = await admin
      .from("insight_groups")
      .select("id, name, webhook_enabled")
      .eq("org_id", member.orgId)
      .limit(10);

    if (groupError) {
      checks.push({
        name: "Insight Groups Table",
        status: "fail",
        details: groupError.message,
      });
    } else {
      checks.push({
        name: "Insight Groups Table",
        status: "pass",
        details: `Found ${groups?.length || 0} groups`,
      });
    }

    // 5. Check templates
    const { data: templates, error: tmplError } = await admin
      .from("insight_definitions")
      .select("id, name, template_category")
      .eq("is_template", true)
      .limit(10);

    if (tmplError) {
      checks.push({
        name: "Industry Templates",
        status: "warn",
        details: tmplError.message,
      });
    } else {
      checks.push({
        name: "Industry Templates",
        status: templates && templates.length > 0 ? "pass" : "warn",
        details: `Found ${templates?.length || 0} templates`,
      });
    }

    // 6. Check agents table has settings column
    const { data: agentSample, error: agentError } = await admin
      .from("agents")
      .select("id, name, settings")
      .eq("org_id", member.orgId)
      .limit(1);

    if (agentError) {
      checks.push({
        name: "Agents Table",
        status: "fail",
        details: agentError.message,
      });
    } else if (agentSample?.length) {
      const hasSettings = agentSample[0]?.settings !== undefined;
      const settings = agentSample[0]?.settings as Record<string, unknown> | null;
      const hasCustomInsights = settings?.custom_insights !== undefined;
      checks.push({
        name: "Agents Table",
        status: "pass",
        details: `Settings column exists: ${hasSettings}, custom_insights configured: ${hasCustomInsights}`,
      });
    } else {
      checks.push({
        name: "Agents Table",
        status: "warn",
        details: "No agents found to verify",
      });
    }

    // 7. Check custom_insight_results table
    const { error: resultsError } = await admin
      .from("custom_insight_results")
      .select("id")
      .limit(1);

    if (resultsError) {
      checks.push({
        name: "Custom Insight Results Table",
        status: "fail",
        details: resultsError.message,
      });
    } else {
      checks.push({
        name: "Custom Insight Results Table",
        status: "pass",
        details: "Table accessible",
      });
    }

    // 8. Check webhook_logs table
    const { error: logsError } = await admin
      .from("webhook_logs")
      .select("id")
      .limit(1);

    if (logsError) {
      checks.push({
        name: "Webhook Logs Table",
        status: "fail",
        details: logsError.message,
      });
    } else {
      checks.push({
        name: "Webhook Logs Table",
        status: "pass",
        details: "Table accessible",
      });
    }

    // Summary
    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.filter((c) => c.status === "fail").length;
    const warned = checks.filter((c) => c.status === "warn").length;

    return NextResponse.json({
      status: failed === 0 ? "healthy" : "issues_found",
      summary: {
        total: checks.length,
        passed,
        failed,
        warned,
      },
      checks,
      definitions: definitions || [],
      groups: groups || [],
    });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/verify error:", err);
    return NextResponse.json({
      status: "error",
      error: err instanceof Error ? err.message : "Internal server error",
      checks,
    }, { status: 500 });
  }
}
