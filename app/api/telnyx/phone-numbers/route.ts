import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id, telnyx_number, display_label, status, agent_id, agents(id, name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[phone-numbers] Error fetching phone numbers:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to format expected by PhoneDialpad and CoreSettingsTab
    const phoneNumbers = (data ?? []).map((pn) => {
      const agentsData = pn.agents as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
      const agentObj = Array.isArray(agentsData) ? (agentsData[0] ?? null) : agentsData;
      return {
        id: pn.id,
        number: pn.telnyx_number,
        displayLabel: pn.display_label,
        status: pn.status,
        agentId: pn.agent_id ?? null,
        agentName: agentObj?.name ?? null,
      };
    });

    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error("[phone-numbers] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch phone numbers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
