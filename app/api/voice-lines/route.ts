import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

interface UpdateVoiceLineBody {
  id?: string;
  agentId?: string | null;
  displayLabel?: string | null;
  status?: "active" | "inactive" | "provisioning";
}

export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("phone_numbers")
      .select("id, telnyx_number, display_label, region, status, agent_id, created_at")
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voiceLines: data ?? [] });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load voice lines.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const body = (await request.json().catch(() => null)) as UpdateVoiceLineBody | null;

    if (!body?.id) {
      return NextResponse.json({ error: "Voice line id is required." }, { status: 400 });
    }

    const payload = {
      agent_id: body.agentId ?? null,
      display_label: body.displayLabel ?? null,
      ...(body.status ? { status: body.status } : {}),
    };

    const { data, error } = await admin
      .from("phone_numbers")
      .update(payload)
      .eq("id", body.id)
      .eq("org_id", member.orgId)
      .select("id, telnyx_number, display_label, region, status, agent_id, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to update voice line." }, { status: 500 });
    }

    return NextResponse.json({ voiceLine: data });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to update voice line.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
