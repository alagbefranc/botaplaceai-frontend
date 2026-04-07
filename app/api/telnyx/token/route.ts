import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

// Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Creates a Telnyx telephony credential token for WebRTC authentication
 * Multi-tenant: Each org gets their own credential scoped to their connection
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let orgId = body.orgId as string | undefined;

    console.log("[Telnyx Token] Request body:", JSON.stringify(body));

    if (!TELNYX_API_KEY) {
      console.error("[Telnyx Token] TELNYX_API_KEY not configured");
      return NextResponse.json(
        { error: "Telnyx API key not configured" },
        { status: 500 }
      );
    }

    // If no orgId provided, try to get from the user's session
    if (!orgId) {
      // Try getting from Supabase auth cookie
      const supabase = getSupabaseAdmin();
      const { data: users } = await supabase
        .from("users")
        .select("org_id")
        .limit(1)
        .single();
      
      if (users?.org_id) {
        orgId = users.org_id;
        console.log("[Telnyx Token] Using orgId from database:", orgId);
      }
    }

    if (!orgId) {
      console.error("[Telnyx Token] No orgId provided");
      return NextResponse.json(
        { error: "Organization ID required. Please log in first." },
        { status: 400 }
      );
    }

    console.log("[Telnyx Token] Processing for org:", orgId);

    // Look up the org's Telnyx credential from database
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("telnyx_connections")
      .select("connection_id, connection_name")
      .eq("org_id", orgId)
      .eq("status", "active")
      .eq("is_default", true)
      .single();

    let credentialId: string;

    if (connection?.connection_id) {
      // We already have a credential ID stored - just use it to create a token
      credentialId = connection.connection_id;
      console.log(`[Telnyx Token] Using existing credential: ${credentialId}`);
    } else {
      // No credential exists, need to create one
      // First, get an existing credential connection to use
      const connectionsResponse = await fetch(`${TELNYX_API_URL}/credential_connections?page[size]=1`, {
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
        },
      });

      if (!connectionsResponse.ok) {
        console.error("[Telnyx Token] Failed to list credential connections");
        return NextResponse.json(
          { error: "Failed to list Telnyx connections" },
          { status: 500 }
        );
      }

      const connectionsData = await connectionsResponse.json();
      const credentialConnection = connectionsData.data?.[0];

      if (!credentialConnection) {
        return NextResponse.json(
          { error: "No Telnyx credential connection found. Please configure one in the Telnyx portal." },
          { status: 500 }
        );
      }

      // Create a new telephony credential
      const credentialResponse = await fetch(`${TELNYX_API_URL}/telephony_credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
        },
        body: JSON.stringify({
          connection_id: credentialConnection.id,
          name: `webrtc-${orgId.slice(0, 8)}`,
          tag: `org:${orgId}`,
        }),
      });

      if (!credentialResponse.ok) {
        const errorText = await credentialResponse.text();
        console.error("[Telnyx Token] Failed to create credential:", errorText);
        return NextResponse.json(
          { error: "Failed to create WebRTC credential" },
          { status: 500 }
        );
      }

      const credentialData = await credentialResponse.json();
      credentialId = credentialData.data?.id;

      // Save the credential ID for future use
      await supabase.from("telnyx_connections").upsert({
        org_id: orgId,
        connection_id: credentialId,
        connection_name: `webrtc-${orgId.slice(0, 8)}`,
        status: "active",
        is_default: true,
      }, { onConflict: "org_id,connection_id" });

      console.log(`[Telnyx Token] Created new credential: ${credentialId}`);
    }

    // Create a token for the credential
    const tokenResponse = await fetch(
      `${TELNYX_API_URL}/telephony_credentials/${credentialId}/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
        },
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Telnyx Token] Failed to create token:", errorText);
      return NextResponse.json(
        { error: "Failed to create WebRTC token" },
        { status: 500 }
      );
    }

    // Telnyx returns the JWT token directly as plain text, not JSON
    const loginToken = await tokenResponse.text();
    console.log("[Telnyx Token] Token created successfully");

    return NextResponse.json({
      login_token: loginToken,
      credential_id: credentialId,
      expires_in: 3600, // 1 hour
    });
  } catch (error) {
    console.error("[Telnyx Token] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Health check for Telnyx WebRTC configuration
 * Also verifies outbound profile setup
 */
export async function GET() {
  const configured = Boolean(TELNYX_API_KEY);
  
  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: "Telnyx API key not configured",
    });
  }

  try {
    // Check credential connections
    const credResponse = await fetch(`${TELNYX_API_URL}/credential_connections?page[size]=5`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const credData = await credResponse.json();
    const credentialConnections = credData.data || [];

    // Check outbound voice profiles
    const outboundResponse = await fetch(`${TELNYX_API_URL}/outbound_voice_profiles?page[size]=5`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const outboundData = await outboundResponse.json();
    const outboundProfiles = outboundData.data || [];

    // Check phone numbers
    const numbersResponse = await fetch(`${TELNYX_API_URL}/phone_numbers?page[size]=5`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const numbersData = await numbersResponse.json();
    const phoneNumbers = numbersData.data || [];

    const hasOutboundProfile = outboundProfiles.length > 0;
    const hasCredentialConnection = credentialConnections.length > 0;

    return NextResponse.json({
      configured: true,
      hasCredentialConnection,
      hasOutboundProfile,
      credentialConnections: credentialConnections.map((c: { id: string; user_name: string; connection_name: string }) => ({
        id: c.id,
        userName: c.user_name,
        name: c.connection_name,
      })),
      outboundProfiles: outboundProfiles.map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })),
      phoneNumbers: phoneNumbers.map((n: { id: string; phone_number: string; connection_id: string }) => ({
        id: n.id,
        number: n.phone_number,
        connectionId: n.connection_id,
      })),
      issues: [
        !hasCredentialConnection && "No credential connection found - create one in Telnyx Mission Control",
        !hasOutboundProfile && "No outbound voice profile found - required for making calls",
        phoneNumbers.length === 0 && "No phone numbers found in Telnyx account",
      ].filter(Boolean),
    });
  } catch (error) {
    console.error("[Telnyx Health] Error:", error);
    return NextResponse.json({
      configured: true,
      error: "Failed to check Telnyx configuration",
    });
  }
}
