import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// GET /api/call-logs - list call logs for the org
export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    const direction = searchParams.get("direction"); // inbound, outbound

    let query = admin
      .from("call_logs")
      .select(
        "id, org_id, direction, caller_number, caller_name, callee_number, call_state, duration_seconds, handoff_id, telnyx_call_control_id, recording_url, started_at, ended_at, created_at"
      )
      .eq("org_id", member.orgId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (direction) {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ call_logs: data ?? [] });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/call-logs - create a new call log
export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const body = await request.json();

    const { data, error } = await admin
      .from("call_logs")
      .insert({
        org_id: member.orgId,
        direction: body.direction || "outbound",
        caller_number: body.caller_number,
        caller_name: body.caller_name,
        callee_number: body.callee_number,
        call_state: body.call_state || "initiated",
        telnyx_call_control_id: body.telnyx_call_control_id,
        telnyx_call_leg_id: body.telnyx_call_leg_id,
        handoff_id: body.handoff_id,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ call_log: data });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/call-logs - update a call log (end call, update state)
export async function PATCH(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: "Call log ID required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    
    if (body.call_state) update.call_state = body.call_state;
    if (body.duration_seconds !== undefined) update.duration_seconds = body.duration_seconds;
    if (body.ended_at) update.ended_at = body.ended_at;
    if (body.recording_url) update.recording_url = body.recording_url;

    const { data, error } = await admin
      .from("call_logs")
      .update(update)
      .eq("id", body.id)
      .eq("org_id", member.orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ call_log: data });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
