import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/calls/history
 * Fetches call history from the database for the user's organization
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    
    const { data: calls, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[CallHistory API] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match UI format
    const formattedCalls = (calls || []).map((call) => ({
      id: call.id,
      number: call.direction === "outbound" ? call.callee_number : call.caller_number,
      direction: call.direction,
      duration: call.duration_seconds || 0,
      timestamp: call.started_at || call.created_at,
      status: mapCallState(call.call_state, call.metadata?.hangup_cause),
      callerId: call.caller_number,
      callee: call.callee_number,
      recordingUrl: call.recording_url,
    }));

    return NextResponse.json({
      calls: formattedCalls,
      total: formattedCalls.length,
    });
  } catch (error) {
    console.error("[CallHistory API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch call history" }, { status: 500 });
  }
}

function mapCallState(state: string, hangupCause?: string): "completed" | "missed" | "failed" {
  if (state === "completed" || state === "hangup") {
    if (hangupCause === "no_answer") return "missed";
    if (hangupCause === "normal_clearing" || hangupCause === "user_busy") return "completed";
    return "completed";
  }
  if (state === "failed" || state === "rejected") return "failed";
  if (state === "ringing" || state === "initiated") return "missed";
  return "missed";
}
