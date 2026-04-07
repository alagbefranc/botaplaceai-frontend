import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { id } = await params;

    const { data: mission, error } = await admin
      .from("missions")
      .select("*, agents(id, name)")
      .eq("id", id)
      .eq("org_id", member.orgId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!mission) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

    // Fetch associated contacts with their call status
    const { data: missionContacts, error: mcError } = await admin
      .from("mission_contacts")
      .select("*, contacts(id, name, phone, email, company)")
      .eq("mission_id", id)
      .order("called_at", { ascending: true, nullsFirst: true });

    if (mcError) return NextResponse.json({ error: mcError.message }, { status: 500 });

    return NextResponse.json({
      mission: {
        ...mission,
        agentName: (mission.agents as { id: string; name: string } | null)?.name ?? null,
      },
      contacts: missionContacts ?? [],
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.objective !== undefined) update.objective = body.objective.trim();
    if (body.agentId !== undefined) update.agent_id = body.agentId ?? null;
    if (body.scheduledAt !== undefined) update.scheduled_at = body.scheduledAt ?? null;
    if (
      body.status !== undefined &&
      ["draft", "scheduled", "running", "completed", "failed", "paused"].includes(body.status)
    ) {
      update.status = body.status;
    }

    const { data, error } = await admin
      .from("missions")
      .update(update)
      .eq("id", id)
      .eq("org_id", member.orgId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

    return NextResponse.json({ mission: data });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to update mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const { id } = await params;

    const { error } = await admin
      .from("missions")
      .delete()
      .eq("id", id)
      .eq("org_id", member.orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
