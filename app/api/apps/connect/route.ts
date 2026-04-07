import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { Composio } from "composio-core";

export const runtime = "nodejs";

interface ConnectAppBody {
  integrationId?: string;
  appName?: string;
  inputFields?: Record<string, string>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as ConnectAppBody | null;
    const integrationId =
      typeof body?.integrationId === "string" ? body.integrationId.trim() : "";
    const appName =
      typeof body?.appName === "string" ? body.appName.trim() : "";
    const inputFields = body?.inputFields ?? {};

    if (!integrationId) {
      return NextResponse.json({ error: "integrationId is required." }, { status: 400 });
    }

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json({ error: "COMPOSIO_API_KEY is not configured." }, { status: 503 });
    }

    const { member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    // Use orgId as Composio entityId — connections belong to the org, not a single user
    const entityId = member.orgId;
    const callbackUrl = `${new URL(request.url).origin}/apps`;

    // Use Composio SDK to initiate connection - handles input fields properly
    const composio = new Composio({ apiKey: composioApiKey });

    const connectionRequest = await composio.connectedAccounts.initiate({
      entityId,
      integrationId,
      redirectUri: callbackUrl,
      ...(Object.keys(inputFields).length > 0 ? { connectionParams: inputFields } : {}),
    });

    return NextResponse.json(
      {
        redirectUrl: connectionRequest.redirectUrl,
        connectedAccountId: connectionRequest.connectedAccountId,
        appName,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unexpected error while connecting app.";
    console.error("[Composio Connect] Unexpected:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
