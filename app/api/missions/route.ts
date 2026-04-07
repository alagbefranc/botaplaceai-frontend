import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const agentId = searchParams.get("agentId")?.trim() ?? "";
    const sortField = searchParams.get("sortField") ?? "created_at";
    const sortDir = searchParams.get("sortDir") === "ascend";

    let query = admin
      .from("missions")
      .select(
        "id, name, objective, agent_id, status, total_contacts, completed_calls, successful_calls, failed_calls, scheduled_at, started_at, completed_at, result_summary, created_at, updated_at, agents(id, name)",
        { count: "exact" }
      )
      .eq("org_id", member.orgId);

    if (search) {
      query = query.or(`name.ilike.%${search}%,objective.ilike.%${search}%`);
    }
    if (status) query = query.eq("status", status);
    if (agentId) query = query.eq("agent_id", agentId);

    const allowedSorts = ["name", "status", "total_contacts", "scheduled_at", "created_at", "completed_at"];
    const safeSort = allowedSorts.includes(sortField) ? sortField : "created_at";
    query = query
      .order(safeSort, { ascending: sortDir })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const missions = (data ?? []).map((m) => {
      const agents = (m.agents as unknown) as { id: string; name: string } | { id: string; name: string }[] | null;
      const agentObj = Array.isArray(agents) ? agents[0] : agents;
      return {
        ...m,
        agentName: agentObj?.name ?? null,
      };
    });

    return NextResponse.json({ missions, total: count ?? 0, page, pageSize });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load missions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim() || !body?.objective?.trim()) {
      return NextResponse.json({ error: "name and objective are required." }, { status: 400 });
    }

    // Validate agent belongs to this org
    if (body.agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id")
        .eq("id", body.agentId)
        .eq("org_id", member.orgId)
        .maybeSingle();
      if (!agent) {
        return NextResponse.json({ error: "Agent not found or not in your org." }, { status: 400 });
      }
    }

    const contactIds: string[] = Array.isArray(body.contactIds) ? body.contactIds : [];

    const { data: mission, error: missionError } = await admin
      .from("missions")
      .insert({
        org_id: member.orgId,
        name: body.name.trim(),
        objective: body.objective.trim(),
        agent_id: body.agentId ?? null,
        status: "draft",
        total_contacts: contactIds.length,
        scheduled_at: body.scheduledAt ?? null,
      })
      .select()
      .single();

    if (missionError || !mission) {
      return NextResponse.json({ error: missionError?.message ?? "Failed to create mission." }, { status: 500 });
    }

    // Insert mission_contacts join records
    if (contactIds.length > 0) {
      const joinRecords = contactIds.map((cid: string) => ({
        mission_id: mission.id,
        contact_id: cid,
        org_id: member.orgId,
        call_status: "pending",
      }));
      await admin.from("mission_contacts").insert(joinRecords);
    }

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
