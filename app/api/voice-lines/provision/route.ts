import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { provisionVoiceLine } from "@/lib/server/voice-line-service";

export const runtime = "nodejs";

interface ProvisionVoiceLineBody {
  countryCode?: string;
  city?: string;
  displayLabel?: string;
  agentId?: string | null;
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const body = (await request.json().catch(() => null)) as ProvisionVoiceLineBody | null;

    const result = await provisionVoiceLine({
      admin,
      orgId: member.orgId,
      agentId: body?.agentId ?? null,
      countryCode: body?.countryCode,
      city: body?.city,
      displayLabel: body?.displayLabel,
    });

    return NextResponse.json(
      {
        orderId: result.orderId,
        phoneNumber: result.phoneNumber,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unexpected error while provisioning phone number.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
