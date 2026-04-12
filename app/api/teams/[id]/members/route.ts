// ============================================================================
// API Routes for Team Members
// Add, update, remove agents from teams
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET /api/teams/[id]/members - List team members
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

    const { data: members, error } = await admin
      .from("team_members")
      .select(`
        id, team_id, agent_id, role, specialization, position,
        agent:agents(id, name, status, voice, avatar_url)
      `)
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      members: (members || []).map(mapMember),
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load members." }, { status: 500 });
  }
}

// ============================================================================
// POST /api/teams/[id]/members - Add or update a team member
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
      .select("id, entry_agent_id")
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

    const { id, agentId, role, specialization, position } = body as {
      id?: string;
      agentId?: string;
      role?: "entry" | "specialist";
      specialization?: string;
      position?: number;
    };

    if (id) {
      // Update existing member
      const updatePayload: Record<string, unknown> = {};
      if (role !== undefined) updatePayload.role = role;
      if (specialization !== undefined) updatePayload.specialization = specialization;
      if (position !== undefined) updatePayload.position = position;

      const { data: updated, error: updateError } = await admin
        .from("team_members")
        .update(updatePayload)
        .eq("id", id)
        .eq("team_id", teamId)
        .select(`
          id, team_id, agent_id, role, specialization, position,
          agent:agents(id, name, status, voice, avatar_url)
        `)
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message ?? "Failed to update member." },
          { status: 500 }
        );
      }

      // If setting as entry, update the team's entry_agent_id
      if (role === "entry") {
        await admin
          .from("agent_teams")
          .update({ entry_agent_id: updated.agent_id })
          .eq("id", teamId);

        // Reset other members to specialist
        await admin
          .from("team_members")
          .update({ role: "specialist" })
          .eq("team_id", teamId)
          .neq("id", id);
      }

      return NextResponse.json({ member: mapMember(updated) });
    }

    // Add new member
    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required." }, { status: 400 });
    }

    // Verify agent belongs to org
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id, name")
      .eq("id", agentId)
      .eq("org_id", member.orgId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    // Check if already a member
    const { data: existing } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Agent is already a team member." },
        { status: 400 }
      );
    }

    // Get max position
    const { data: maxPos } = await admin
      .from("team_members")
      .select("position")
      .eq("team_id", teamId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = position ?? ((maxPos?.position ?? -1) + 1);

    const { data: created, error: createError } = await admin
      .from("team_members")
      .insert({
        team_id: teamId,
        agent_id: agentId,
        role: role || "specialist",
        specialization: specialization || null,
        position: newPosition,
      })
      .select(`
        id, team_id, agent_id, role, specialization, position,
        agent:agents(id, name, status, voice, avatar_url)
      `)
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to add member." },
        { status: 500 }
      );
    }

    // If setting as entry, update the team's entry_agent_id
    if (role === "entry") {
      await admin
        .from("agent_teams")
        .update({ entry_agent_id: agentId })
        .eq("id", teamId);

      // Reset other members to specialist
      await admin
        .from("team_members")
        .update({ role: "specialist" })
        .eq("team_id", teamId)
        .neq("id", created.id);
    }

    return NextResponse.json({ member: mapMember(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to save member." }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/teams/[id]/members - Remove a member
// ============================================================================
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });
    const { id: teamId } = await params;

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId")?.trim();
    const memberId = url.searchParams.get("memberId")?.trim();

    if (!agentId && !memberId) {
      return NextResponse.json(
        { error: "Agent ID or Member ID is required." },
        { status: 400 }
      );
    }

    // Verify team belongs to org
    const { data: team, error: teamError } = await admin
      .from("agent_teams")
      .select("id, entry_agent_id")
      .eq("id", teamId)
      .eq("org_id", member.orgId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    let query = admin.from("team_members").delete().eq("team_id", teamId);

    if (memberId) {
      query = query.eq("id", memberId);
    } else if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If removed agent was entry agent, clear the entry_agent_id
    if (agentId === team.entry_agent_id) {
      await admin
        .from("agent_teams")
        .update({ entry_agent_id: null })
        .eq("id", teamId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapMember(row: Record<string, unknown>) {
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
}
