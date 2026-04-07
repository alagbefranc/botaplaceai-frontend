// ============================================================================
// API Routes for Agent Teams
// CRUD operations for teams, members, rules, and variables
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";
import type {
  AgentTeam,
  TeamSettings,
  DEFAULT_TEAM_SETTINGS,
} from "@/lib/domain/agent-teams";

// ============================================================================
// GET /api/teams - List teams or get a specific team
// ============================================================================
export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();

    if (id) {
      // Get single team with members
      const { data: team, error } = await admin
        .from("agent_teams")
        .select(`
          id, org_id, name, description, entry_agent_id, status, settings, created_at, updated_at,
          entry_agent:agents!entry_agent_id(id, name, status)
        `)
        .eq("org_id", member.orgId)
        .eq("id", id)
        .single();

      if (error || !team) {
        return NextResponse.json(
          { error: error?.message ?? "Team not found." },
          { status: 404 }
        );
      }

      // Get team members
      const { data: members } = await admin
        .from("team_members")
        .select(`
          id, team_id, agent_id, role, specialization, position,
          agent:agents(id, name, status, voice)
        `)
        .eq("team_id", id)
        .order("position", { ascending: true });

      // Get handoff rules
      const { data: rules } = await admin
        .from("handoff_rules")
        .select(`
          id, team_id, source_agent_id, target_agent_id, rule_type, conditions, priority, context_config, enabled,
          source_agent:agents!source_agent_id(id, name),
          target_agent:agents!target_agent_id(id, name)
        `)
        .eq("team_id", id)
        .order("priority", { ascending: false });

      // Get context variables
      const { data: contextVariables } = await admin
        .from("team_context_variables")
        .select("id, team_id, name, description, extract_prompt, required, position")
        .eq("team_id", id)
        .order("position", { ascending: true });

      return NextResponse.json({
        team: mapTeamResponse(team, members, rules, contextVariables),
      });
    }

    // List all teams
    const { data, error } = await admin
      .from("agent_teams")
      .select(`
        id, org_id, name, description, entry_agent_id, status, settings, created_at, updated_at,
        entry_agent:agents!entry_agent_id(id, name, status)
      `)
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get member counts for each team
    const teamIds = (data || []).map((t) => t.id);
    const { data: memberCounts } = await admin
      .from("team_members")
      .select("team_id")
      .in("team_id", teamIds);

    const countMap = new Map<string, number>();
    (memberCounts || []).forEach((m) => {
      countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
    });

    return NextResponse.json({
      teams: (data || []).map((team) => ({
        ...mapTeamBasic(team),
        memberCount: countMap.get(team.id) || 0,
      })),
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load teams.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================================
// POST /api/teams - Create or update a team
// ============================================================================
export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { id, name, description, entryAgentId, status, settings } = body as {
      id?: string;
      name?: string;
      description?: string;
      entryAgentId?: string | null;
      status?: "draft" | "active" | "paused";
      settings?: Partial<TeamSettings>;
    };

    if (id) {
      // Update existing team
      const { data: existing, error: existingError } = await admin
        .from("agent_teams")
        .select("id, name, description, entry_agent_id, status, settings")
        .eq("id", id)
        .eq("org_id", member.orgId)
        .single();

      if (existingError || !existing) {
        return NextResponse.json(
          { error: existingError?.message ?? "Team not found." },
          { status: 404 }
        );
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updatePayload.name = name;
      if (description !== undefined) updatePayload.description = description;
      if (entryAgentId !== undefined) updatePayload.entry_agent_id = entryAgentId;
      if (status !== undefined) updatePayload.status = status;
      if (settings !== undefined) {
        updatePayload.settings = {
          ...(existing.settings as TeamSettings),
          ...settings,
        };
      }

      const { data: updated, error: updateError } = await admin
        .from("agent_teams")
        .update(updatePayload)
        .eq("id", id)
        .eq("org_id", member.orgId)
        .select("id, org_id, name, description, entry_agent_id, status, settings, created_at, updated_at")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message ?? "Failed to update team." },
          { status: 500 }
        );
      }

      return NextResponse.json({ team: mapTeamBasic(updated) });
    }

    // Create new team
    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const { data: created, error: createError } = await admin
      .from("agent_teams")
      .insert({
        org_id: member.orgId,
        name,
        description: description || null,
        entry_agent_id: entryAgentId || null,
        status: status || "draft",
        settings: settings || {},
      })
      .select("id, org_id, name, description, entry_agent_id, status, settings, created_at, updated_at")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create team." },
        { status: 500 }
      );
    }

    return NextResponse.json({ team: mapTeamBasic(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to save team.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/teams - Delete a team
// ============================================================================
export async function DELETE(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin"],
    });

    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "Team ID is required." }, { status: 400 });
    }

    const { error } = await admin
      .from("agent_teams")
      .delete()
      .eq("id", id)
      .eq("org_id", member.orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete team.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapTeamBasic(row: Record<string, unknown>): AgentTeam {
  const entryAgent = row.entry_agent;
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    entryAgentId: row.entry_agent_id as string | null,
    status: row.status as "draft" | "active" | "paused",
    settings: (row.settings as TeamSettings) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    entryAgent: Array.isArray(entryAgent)
      ? entryAgent[0]
      : (entryAgent as { id: string; name: string; status: string } | undefined),
  };
}

function mapTeamResponse(
  team: Record<string, unknown>,
  members: unknown[] | null,
  rules: unknown[] | null,
  contextVariables: unknown[] | null
) {
  return {
    ...mapTeamBasic(team),
    members: (members || []).map((m) => {
      const row = m as Record<string, unknown>;
      const agent = row.agent;
      return {
        id: row.id as string,
        teamId: row.team_id as string,
        agentId: row.agent_id as string,
        role: row.role as "entry" | "specialist",
        specialization: row.specialization as string | undefined,
        position: row.position as number,
        agent: Array.isArray(agent)
          ? agent[0]
          : (agent as { id: string; name: string; status: string; voice?: string } | undefined),
      };
    }),
    rules: (rules || []).map((r) => {
      const row = r as Record<string, unknown>;
      const sourceAgent = row.source_agent;
      const targetAgent = row.target_agent;
      return {
        id: row.id as string,
        teamId: row.team_id as string,
        sourceAgentId: row.source_agent_id as string | null,
        targetAgentId: row.target_agent_id as string,
        ruleType: row.rule_type as "keyword" | "intent" | "always",
        conditions: row.conditions as { type: string; value: string; matchType?: string }[],
        priority: row.priority as number,
        contextConfig: row.context_config as { includeSummary: boolean; includeHistory: boolean; variables: string[] },
        enabled: row.enabled as boolean,
        sourceAgent: Array.isArray(sourceAgent)
          ? sourceAgent[0]
          : (sourceAgent as { id: string; name: string } | undefined),
        targetAgent: Array.isArray(targetAgent)
          ? targetAgent[0]
          : (targetAgent as { id: string; name: string } | undefined),
      };
    }),
    contextVariables: (contextVariables || []).map((v) => {
      const row = v as Record<string, unknown>;
      return {
        id: row.id as string,
        teamId: row.team_id as string,
        name: row.name as string,
        description: row.description as string | undefined,
        extractPrompt: row.extract_prompt as string | undefined,
        required: row.required as boolean,
        position: row.position as number,
      };
    }),
  };
}
