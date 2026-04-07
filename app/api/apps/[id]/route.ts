import { NextResponse } from "next/server";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";

export const runtime = "nodejs";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

function headers(apiKey: string) {
  return { "x-api-key": apiKey, "Content-Type": "application/json" };
}

// GET /api/apps/[id] — fetch a single connected account by ID
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json({ error: "COMPOSIO_API_KEY is not configured." }, { status: 503 });
    }

    // Verify the caller is an org member (any role can view)
    await getOrgMemberContext({ allowedRoles: ["admin", "editor", "viewer"] });

    const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/${id}`, {
      headers: headers(composioApiKey),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return NextResponse.json(
        { error: err?.message ?? `Composio returned ${res.status}` },
        { status: res.status >= 500 ? 502 : 404 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("[Apps/[id] GET] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/apps/[id] — disconnect a connected account
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json({ error: "COMPOSIO_API_KEY is not configured." }, { status: 503 });
    }

    // Only admins can disconnect apps
    await getOrgMemberContext({ allowedRoles: ["admin"] });

    const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/${id}`, {
      method: "DELETE",
      headers: headers(composioApiKey),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return NextResponse.json(
        { error: err?.message ?? `Composio returned ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("[Apps/[id] DELETE] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
