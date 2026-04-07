import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// GET /api/handoffs — list handoffs for the org
export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, accepted, resolved, expired
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    let query = admin
      .from("handoffs")
      .select(
        "id, org_id, conversation_id, agent_id, status, channel, reason, department, priority, summary, caller_number, call_control_id, call_leg_id, assigned_to, accepted_at, resolved_at, metadata, created_at"
      )
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ handoffs: data ?? [] });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// PATCH /api/handoffs — update a handoff (accept, resolve, assign)
export async function PATCH(request: Request) {
  try {
    const { admin, user, member } = await getOrgMemberContext();
    const body = (await request.json()) as {
      id?: string;
      action?: "accept" | "resolve" | "expire";
      resolution_note?: string;
    };

    if (!body.id || !body.action) {
      return NextResponse.json({ error: "Missing id or action." }, { status: 400 });
    }

    const now = new Date().toISOString();
    let update: Record<string, unknown> = {};

    switch (body.action) {
      case "accept":
        update = {
          status: "accepted",
          assigned_to: user.id,
          accepted_at: now,
        };
        break;
      case "resolve":
        update = {
          status: "resolved",
          resolved_at: now,
        };
        // Optionally add resolution note as a handoff message
        if (body.resolution_note) {
          await admin.from("handoff_messages").insert({
            handoff_id: body.id,
            org_id: member.orgId,
            role: "system",
            content: `Resolved: ${body.resolution_note}`,
            sender_id: user.id,
          });
        }
        break;
      case "expire":
        update = { status: "expired" };
        break;
      default:
        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("handoffs")
      .update(update)
      .eq("id", body.id)
      .eq("org_id", member.orgId)
      .select("id, status, assigned_to, accepted_at, resolved_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ handoff: data });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
