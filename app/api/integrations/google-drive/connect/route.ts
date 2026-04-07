import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildAuthUrl, isGoogleDriveConfigured } from "@/lib/google-drive-oauth";

export const runtime = "nodejs";

/**
 * GET /api/integrations/google-drive/connect
 * Redirects the user to Google's OAuth consent screen.
 * orgId is read from the authenticated session.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Drive OAuth is not configured. Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to your environment.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Resolve orgId from session user
    let orgId: string | null = null;

    if (user) {
      // Look up user's org from DB
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: dbUser } = await admin
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();
      orgId = dbUser?.org_id ?? null;
    }

    // Fallback: check query param (for non-session flows)
    if (!orgId) {
      orgId = new URL(request.url).searchParams.get("orgId");
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in first." },
        { status: 401 }
      );
    }

    const authUrl = buildAuthUrl(orgId);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[Drive OAuth] Connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google Drive connection" },
      { status: 500 }
    );
  }
}
