import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function resolveOrgId(request: NextRequest): Promise<string | null> {
  const orgIdParam = new URL(request.url).searchParams.get("orgId");
  if (orgIdParam && orgIdParam !== "_current") return orgIdParam;

  // Try to get from Supabase session
  try {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const admin = getAdmin();
      const { data } = await admin
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();
      return data?.org_id ?? null;
    }
  } catch { /* no session */ }

  // Fallback: first org
  const admin = getAdmin();
  const { data } = await admin.from("organizations").select("id").limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * GET /api/integrations/google-drive/status
 * Returns Drive connection status for this org.
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await resolveOrgId(request);
    if (!orgId) {
      return NextResponse.json({ connected: false, email: null }, { status: 200 });
    }

    const admin = getAdmin();
    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settings = org?.settings as Record<string, string> | null;
    const refreshToken = settings?.google_drive_refresh_token;
    const email = settings?.google_drive_email ?? null;
    const connectedAt = settings?.google_drive_connected_at ?? null;

    return NextResponse.json({
      connected: !!refreshToken,
      email,
      connectedAt,
      configured: !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET),
    });
  } catch (error) {
    console.error("[Drive OAuth] Status error:", error);
    return NextResponse.json({ connected: false, email: null }, { status: 200 });
  }
}

/**
 * DELETE /api/integrations/google-drive/status
 * Disconnects Google Drive for this org (removes stored token).
 */
export async function DELETE(request: NextRequest) {
  try {
    const orgId = await resolveOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Could not determine org" }, { status: 400 });
    }

    const admin = getAdmin();
    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settings = { ...(org?.settings || {}) } as Record<string, unknown>;
    delete settings.google_drive_refresh_token;
    delete settings.google_drive_email;
    delete settings.google_drive_connected_at;

    const { error } = await admin
      .from("organizations")
      .update({ settings })
      .eq("id", orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error("[Drive OAuth] Disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
