import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const { id } = await params;

    const { data: mission, error } = await admin
      .from("missions")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", member.orgId)
      .maybeSingle();

    if (error || !mission) {
      return NextResponse.json({ error: "Mission not found." }, { status: 404 });
    }

    if (mission.status !== "running") {
      return NextResponse.json({ error: "Only running missions can be paused." }, { status: 400 });
    }

    // Set calling contacts back to pending so they can be retried after resume
    await admin
      .from("mission_contacts")
      .update({ call_status: "pending" })
      .eq("mission_id", id)
      .eq("call_status", "calling");

    const { error: updateError } = await admin
      .from("missions")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", member.orgId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ paused: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to pause mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
