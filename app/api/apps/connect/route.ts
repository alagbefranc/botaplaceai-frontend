import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

interface ConnectAppBody {
  integrationId?: string;
  appName?: string;
  inputFields?: Record<string, string>;
}

function composioHeaders(apiKey: string) {
  return { "x-api-key": apiKey, "Content-Type": "application/json" } as const;
}

/**
 * When an app has no pre-configured auth config, the apps list returns a fake
 * integrationId of "app_<slug>". We need to create a real auth config first
 * using Composio's managed auth (useComposioAuth: true), then use the returned
 * ID to initiate the connection.
 */
async function ensureRealIntegrationId(
  apiKey: string,
  integrationId: string,
  appName: string,
): Promise<string> {
  // Real integration IDs are UUIDs, not "app_*"
  if (!integrationId.startsWith("app_")) {
    return integrationId;
  }

  const slug = appName || integrationId.replace("app_", "");

  // Create a managed auth config for this app
  const res = await fetch(`${COMPOSIO_BASE}/auth_configs`, {
    method: "POST",
    headers: composioHeaders(apiKey),
    body: JSON.stringify({
      toolkitSlug: slug,
      useComposioAuth: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create auth config for ${slug}: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error(`Composio did not return an integration ID for ${slug}`);
  }

  return data.id;
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

    // Resolve fake "app_*" IDs to real Composio integration IDs
    const realIntegrationId = await ensureRealIntegrationId(
      composioApiKey,
      integrationId,
      appName,
    );

    const entityId = member.orgId;
    const callbackUrl = `${new URL(request.url).origin}/apps`;

    // Initiate connection via Composio v3 REST API
    const initiateRes = await fetch(`${COMPOSIO_BASE}/connected_accounts`, {
      method: "POST",
      headers: composioHeaders(composioApiKey),
      body: JSON.stringify({
        auth_config: { id: realIntegrationId },
        connection: {
          userId: entityId,
          redirectUri: callbackUrl,
          ...(Object.keys(inputFields).length > 0 ? { data: inputFields } : {}),
        },
      }),
    });

    if (!initiateRes.ok) {
      const errBody = await initiateRes.text();
      console.error("[Composio Connect] initiate failed:", initiateRes.status, errBody);
      return NextResponse.json(
        { error: `Composio returned ${initiateRes.status}: ${errBody}` },
        { status: initiateRes.status },
      );
    }

    const result = (await initiateRes.json()) as {
      redirect_url?: string;
      redirectUrl?: string;
      id?: string;
      connectedAccountId?: string;
    };

    return NextResponse.json(
      {
        redirectUrl: result.redirect_url ?? result.redirectUrl,
        connectedAccountId: result.id ?? result.connectedAccountId,
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
