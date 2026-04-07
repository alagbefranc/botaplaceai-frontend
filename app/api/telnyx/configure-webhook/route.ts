import { NextResponse } from "next/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

/**
 * Configure webhook URL for a Telnyx credential connection
 * This is required for WebRTC outbound calls to work
 */
export async function POST(request: Request) {
  try {
    const { connectionId, webhookUrl } = await request.json();

    if (!TELNYX_API_KEY) {
      return NextResponse.json({ error: "Telnyx API key not configured" }, { status: 500 });
    }

    if (!connectionId || !webhookUrl) {
      return NextResponse.json({ error: "connectionId and webhookUrl required" }, { status: 400 });
    }

    console.log(`[Telnyx Config] Setting webhook URL for connection ${connectionId}: ${webhookUrl}`);

    // Update the credential connection with webhook URL
    const response = await fetch(`${TELNYX_API_URL}/credential_connections/${connectionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        webhook_api_version: "2",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Telnyx Config] Failed to update connection:", errorText);
      return NextResponse.json({ error: "Failed to configure webhook", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log("[Telnyx Config] Connection updated successfully");

    return NextResponse.json({
      success: true,
      connectionId: data.data?.id,
      webhookUrl: data.data?.webhook_url,
    });
  } catch (error) {
    console.error("[Telnyx Config] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Get current credential connection configuration
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    const response = await fetch(`${TELNYX_API_URL}/credential_connections/${connectionId}`, {
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to get connection" }, { status: 500 });
    }

    const data = await response.json();
    console.log("[Telnyx] Connection data:", JSON.stringify(data.data, null, 2));

    return NextResponse.json({
      id: data.data?.id,
      name: data.data?.connection_name,
      userName: data.data?.user_name,
      webhookUrl: data.data?.webhook_url,
      outboundVoiceProfileId: data.data?.outbound_voice_profile_id,
      sipUri: data.data?.sip_uri,
      active: data.data?.active,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
