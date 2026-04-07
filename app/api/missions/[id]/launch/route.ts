import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

const TELNYX_API = "https://api.telnyx.com/v2";

// Backend server URL — this is the Gemini Live voice path (not the Next.js
// basic TTS path). Calls routed here will use the agent's real configured voice.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function telnyxAction(callControlId: string, action: string, body: Record<string, unknown>) {
  const apiKey = process.env.TELNYX_API_KEY;
  const res = await fetch(`${TELNYX_API}/calls/${callControlId}/actions/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const { id } = await params;

    // Fetch mission with agent and pending contacts
    const { data: mission, error: mError } = await admin
      .from("missions")
      .select("*, agents(id, name, greeting_message, voice)")
      .eq("id", id)
      .eq("org_id", member.orgId)
      .maybeSingle();

    if (mError || !mission) {
      return NextResponse.json({ error: "Mission not found." }, { status: 404 });
    }

    if (!["draft", "scheduled", "paused"].includes(mission.status)) {
      return NextResponse.json(
        { error: `Cannot launch a mission in '${mission.status}' status.` },
        { status: 400 }
      );
    }

    if (!mission.agent_id) {
      return NextResponse.json({ error: "Mission has no agent assigned." }, { status: 400 });
    }

    // Find assigned phone number for the agent
    const { data: phoneNumber } = await admin
      .from("phone_numbers")
      .select("telnyx_number")
      .eq("agent_id", mission.agent_id)
      .eq("org_id", member.orgId)
      .maybeSingle();

    if (!phoneNumber?.telnyx_number) {
      return NextResponse.json(
        { error: "No phone number assigned to this agent. Assign a number in agent settings." },
        { status: 400 }
      );
    }

    const fromNumber = phoneNumber.telnyx_number;

    // Fetch pending contacts for this mission
    const { data: pendingContacts, error: pcError } = await admin
      .from("mission_contacts")
      .select("id, contact_id, contacts(id, name, phone)")
      .eq("mission_id", id)
      .eq("call_status", "pending");

    if (pcError) {
      return NextResponse.json({ error: pcError.message }, { status: 500 });
    }

    if (!pendingContacts || pendingContacts.length === 0) {
      return NextResponse.json({ error: "No pending contacts to call." }, { status: 400 });
    }

    // Mark mission as running
    await admin
      .from("missions")
      .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);

    // Initiate outbound calls via Telnyx
    let queued = 0;
    const errors: string[] = [];

    for (const mc of pendingContacts) {
      // Supabase may return the join as array or single object
      const rawContact = mc.contacts;
      const contactObj = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as { id: string; name: string; phone: string } | null | undefined;
      if (!contactObj?.phone) continue;

      try {
        const res = await fetch(`${TELNYX_API}/calls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connection_id: process.env.TELNYX_CONNECTION_ID,
            to: contactObj.phone,
            from: fromNumber,
            webhook_url: `${BACKEND_URL}/telnyx/webhook`,
            client_state: Buffer.from(
              JSON.stringify({ missionId: id, missionContactId: mc.id, agentId: mission.agent_id })
            ).toString("base64"),
          }),
        });

        if (res.ok) {
          const callData = (await res.json()) as { data?: { call_control_id?: string } };
          const callControlId = callData?.data?.call_control_id;

          // Mark as calling
          await admin
            .from("mission_contacts")
            .update({ call_status: "calling", call_control_id: callControlId ?? null, called_at: new Date().toISOString() })
            .eq("id", mc.id);

          queued++;
        } else {
          errors.push(`Failed to call ${contactObj.phone}`);
          await admin
            .from("mission_contacts")
            .update({ call_status: "failed" })
            .eq("id", mc.id);
        }
      } catch {
        errors.push(`Error calling ${contactObj?.phone ?? "unknown"}`);
      }
    }

    return NextResponse.json({ queued, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to launch mission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Suppress unused warning — used indirectly
void telnyxAction;
