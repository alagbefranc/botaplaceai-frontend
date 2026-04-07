// ============================================================================
// API Routes for Handoff Rules
// Create, update, delete handoff rules for teams
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";
import type { RuleCondition, ContextConfig } from "@/lib/domain/agent-teams";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET /api/teams/[id]/rules - List handoff rules
// ============================================================================
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { id: teamId } = await params;

    // Verify team belongs to org
    const { data: team, error: teamError } = await admin
      .from("agent_teams")
      .select("id")
      .eq("id", teamId)
      .eq("org_id", member.orgId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const { data: rules, error } = await admin
      .from("handoff_rules")
      .select(`
        id, team_id, source_agent_id, target_agent_id, rule_type, conditions, priority, context_config, enabled,
        source_agent:agents!source_agent_id(id, name),
        target_agent:agents!target_agent_id(id, name)
      `)
      .eq("team_id", teamId)
      .order("priority", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rules: (rules || []).map(mapRule),
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load rules." }, { status: 500 });
  }
}

// ============================================================================
// POST /api/teams/[id]/rules - Create or update a rule
// ============================================================================
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });
    const { id: teamId } = await params;

    // Verify team belongs to org
    const { data: team, error: teamError } = await admin
      .from("agent_teams")
      .select("id")
      .eq("id", teamId)
      .eq("org_id", member.orgId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { id, sourceAgentId, targetAgentId, ruleType, conditions, priority, contextConfig, enabled } = body as {
      id?: string;
      sourceAgentId?: string | null;
      targetAgentId?: string;
      ruleType?: "keyword" | "intent" | "always";
      conditions?: RuleCondition[];
      priority?: number;
      contextConfig?: Partial<ContextConfig>;
      enabled?: boolean;
    };

    if (id) {
      // Update existing rule
      const updatePayload: Record<string, unknown> = {};
      if (sourceAgentId !== undefined) updatePayload.source_agent_id = sourceAgentId;
      if (targetAgentId !== undefined) updatePayload.target_agent_id = targetAgentId;
      if (ruleType !== undefined) updatePayload.rule_type = ruleType;
      if (conditions !== undefined) updatePayload.conditions = conditions;
      if (priority !== undefined) updatePayload.priority = priority;
      if (contextConfig !== undefined) updatePayload.context_config = contextConfig;
      if (enabled !== undefined) updatePayload.enabled = enabled;

      const { data: updated, error: updateError } = await admin
        .from("handoff_rules")
        .update(updatePayload)
        .eq("id", id)
        .eq("team_id", teamId)
        .select(`
          id, team_id, source_agent_id, target_agent_id, rule_type, conditions, priority, context_config, enabled,
          source_agent:agents!source_agent_id(id, name),
          target_agent:agents!target_agent_id(id, name)
        `)
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message ?? "Failed to update rule." },
          { status: 500 }
        );
      }

      return NextResponse.json({ rule: mapRule(updated) });
    }

    // Create new rule
    if (!targetAgentId) {
      return NextResponse.json({ error: "Target agent is required." }, { status: 400 });
    }
    if (!ruleType) {
      return NextResponse.json({ error: "Rule type is required." }, { status: 400 });
    }

    // Verify target agent is a team member
    const { data: targetMember } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("agent_id", targetAgentId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Target agent must be a team member." },
        { status: 400 }
      );
    }

    // Verify source agent is a team member (if specified)
    if (sourceAgentId) {
      const { data: sourceMember } = await admin
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .eq("agent_id", sourceAgentId)
        .maybeSingle();

      if (!sourceMember) {
        return NextResponse.json(
          { error: "Source agent must be a team member." },
          { status: 400 }
        );
      }
    }

    const { data: created, error: createError } = await admin
      .from("handoff_rules")
      .insert({
        team_id: teamId,
        source_agent_id: sourceAgentId || null,
        target_agent_id: targetAgentId,
        rule_type: ruleType,
        conditions: conditions || [],
        priority: priority ?? 0,
        context_config: contextConfig || { include_summary: true, variables: [] },
        enabled: enabled ?? true,
      })
      .select(`
        id, team_id, source_agent_id, target_agent_id, rule_type, conditions, priority, context_config, enabled,
        source_agent:agents!source_agent_id(id, name),
        target_agent:agents!target_agent_id(id, name)
      `)
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create rule." },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: mapRule(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to save rule." }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/teams/[id]/rules - Delete a rule
// ============================================================================
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });
    const { id: teamId } = await params;

    const url = new URL(request.url);
    const ruleId = url.searchParams.get("ruleId")?.trim();

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });
    }

    // Verify team belongs to org
    const { data: team, error: teamError } = await admin
      .from("agent_teams")
      .select("id")
      .eq("id", teamId)
      .eq("org_id", member.orgId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const { error } = await admin
      .from("handoff_rules")
      .delete()
      .eq("id", ruleId)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete rule." }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapRule(row: Record<string, unknown>) {
  const sourceAgent = row.source_agent;
  const targetAgent = row.target_agent;
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    sourceAgentId: row.source_agent_id as string | null,
    targetAgentId: row.target_agent_id as string,
    ruleType: row.rule_type as "keyword" | "intent" | "always",
    conditions: row.conditions as RuleCondition[],
    priority: row.priority as number,
    contextConfig: row.context_config as ContextConfig,
    enabled: row.enabled as boolean,
    sourceAgent: Array.isArray(sourceAgent)
      ? sourceAgent[0]
      : (sourceAgent as { id: string; name: string } | undefined),
    targetAgent: Array.isArray(targetAgent)
      ? targetAgent[0]
      : (targetAgent as { id: string; name: string } | undefined),
  };
}
