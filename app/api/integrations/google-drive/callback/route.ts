import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeCodeForTokens, getAppUrl } from "@/lib/google-drive-oauth";

export const runtime = "nodejs";

/**
 * GET /api/integrations/google-drive/callback
 * Google redirects here after user grants consent.
 * Exchanges code for tokens and stores refresh_token per org.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = getAppUrl();

  // User denied access
  if (error) {
    console.warn("[Drive OAuth] User denied:", error);
    return NextResponse.redirect(
      `${appUrl}/knowledge-base?drive=denied&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/knowledge-base?drive=error&reason=missing_params`
    );
  }

  // Decode state to get orgId
  let orgId: string | null = null;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    orgId = decoded.orgId ?? null;
  } catch {
    return NextResponse.redirect(
      `${appUrl}/knowledge-base?drive=error&reason=invalid_state`
    );
  }

  if (!orgId) {
    return NextResponse.redirect(
      `${appUrl}/knowledge-base?drive=error&reason=missing_org`
    );
  }

  try {
    // Exchange code for tokens
    const { refreshToken, email } = await exchangeCodeForTokens(code);

    if (!refreshToken) {
      console.error("[Drive OAuth] No refresh token received. Make sure prompt=consent is set.");
      return NextResponse.redirect(
        `${appUrl}/knowledge-base?drive=error&reason=no_refresh_token`
      );
    }

    // Store refresh token in org settings
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const { error: updateError } = await admin
      .from("organizations")
      .update({
        settings: {
          ...(org?.settings || {}),
          google_drive_refresh_token: refreshToken,
          google_drive_email: email,
          google_drive_connected_at: new Date().toISOString(),
        },
      })
      .eq("id", orgId);

    if (updateError) {
      console.error("[Drive OAuth] Failed to store token:", updateError);
      return NextResponse.redirect(
        `${appUrl}/knowledge-base?drive=error&reason=storage_failed`
      );
    }

    console.log(`[Drive OAuth] Connected Google Drive for org ${orgId} (${email})`);
    return NextResponse.redirect(`${appUrl}/knowledge-base?drive=connected`);
  } catch (err) {
    console.error("[Drive OAuth] Callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/knowledge-base?drive=error&reason=token_exchange_failed`
    );
  }
}
