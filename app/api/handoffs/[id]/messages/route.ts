import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// GET /api/handoffs/[id]/messages — list messages for a handoff
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { id: handoffId } = await params;

    const { data, error } = await admin
      .from("handoff_messages")
      .select("id, handoff_id, role, content, sender_id, metadata, created_at")
      .eq("handoff_id", handoffId)
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/handoffs/[id]/messages — add a message to a handoff thread
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, user, member } = await getOrgMemberContext();
    const { id: handoffId } = await params;
    const body = (await request.json()) as { content?: string; role?: string };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }

    // Verify this handoff belongs to the org
    const { data: handoff, error: hErr } = await admin
      .from("handoffs")
      .select("id")
      .eq("id", handoffId)
      .eq("org_id", member.orgId)
      .maybeSingle();

    if (hErr || !handoff) {
      return NextResponse.json({ error: "Handoff not found." }, { status: 404 });
    }

    const { data: message, error: mErr } = await admin
      .from("handoff_messages")
      .insert({
        handoff_id: handoffId,
        org_id: member.orgId,
        role: body.role || "agent",
        content: body.content.trim(),
        sender_id: user.id,
      })
      .select("id, handoff_id, role, content, sender_id, created_at")
      .single();

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
