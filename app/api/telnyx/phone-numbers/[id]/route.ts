import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";

export const runtime = "nodejs";

/**
 * PATCH /api/telnyx/phone-numbers/[id]
 * Assign or unassign an agent to a phone number.
 * Body: { agentId: string | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { member } = await getOrgMemberContext();
    const { id } = await params;

    const body = (await request.json()) as { agentId?: string | null };
    const agentId = body.agentId ?? null;

    const supabase = getSupabaseAdminClient();

    // If assigning a specific agent, verify it belongs to this org
    if (agentId) {
      const { data: agentCheck } = await supabase
        .from("agents")
        .select("id")
        .eq("id", agentId)
        .eq("org_id", member.orgId)
        .maybeSingle();

      if (!agentCheck) {
        return NextResponse.json(
          { error: "Agent not found in your organization." },
          { status: 404 }
        );
      }

      // Unassign any OTHER number currently assigned to this agent (1 agent = 1 primary number)
      await supabase
        .from("phone_numbers")
        .update({ agent_id: null })
        .eq("org_id", member.orgId)
        .eq("agent_id", agentId)
        .neq("id", id);
    }

    // Update the phone number's agent assignment
    const { data, error } = await supabase
      .from("phone_numbers")
      .update({ agent_id: agentId })
      .eq("id", id)
      .eq("org_id", member.orgId)
      .select("id, telnyx_number, display_label, status, agent_id, agents(id, name)")
      .maybeSingle();

    if (error) {
      console.error("[phone-numbers/assign] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Phone number not found in your organization." },
        { status: 404 }
      );
    }

    const agentsData = data.agents as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
    const agentObj = Array.isArray(agentsData) ? (agentsData[0] ?? null) : agentsData;
    const phoneNumber = {
      id: data.id,
      number: data.telnyx_number,
      displayLabel: data.display_label,
      status: data.status,
      agentId: data.agent_id ?? null,
      agentName: agentObj?.name ?? null,
    };

    console.log(
      `[phone-numbers/assign] Number ${data.telnyx_number} → agent ${agentId ?? "unassigned"}`
    );

    return NextResponse.json({ phoneNumber });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[phone-numbers/assign] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update phone number." },
      { status: 500 }
    );
  }
}
