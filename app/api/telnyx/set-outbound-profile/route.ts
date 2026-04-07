import { NextResponse } from "next/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

/**
 * Configure outbound voice profile for a credential connection
 * This is REQUIRED for outbound WebRTC calls to work
 */
export async function POST(request: Request) {
  try {
    const { connectionId, outboundVoiceProfileId } = await request.json();

    if (!TELNYX_API_KEY) {
      return NextResponse.json({ error: "Telnyx API key not configured" }, { status: 500 });
    }

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    console.log(`[Telnyx Config] Setting outbound profile for connection ${connectionId}`);

    // If no profile ID provided, get the default one
    let profileId = outboundVoiceProfileId;
    if (!profileId) {
      const profilesResp = await fetch(`${TELNYX_API_URL}/outbound_voice_profiles?page[size]=1`, {
        headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
      });
      const profilesData = await profilesResp.json();
      profileId = profilesData.data?.[0]?.id;
      console.log(`[Telnyx Config] Using default profile: ${profileId}`);
    }

    if (!profileId) {
      return NextResponse.json({ error: "No outbound voice profile found" }, { status: 400 });
    }

    // Update the credential connection with outbound voice profile
    // The outbound_voice_profile_id is nested inside the "outbound" object
    const response = await fetch(`${TELNYX_API_URL}/credential_connections/${connectionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        outbound: {
          outbound_voice_profile_id: profileId,
        },
      }),
    });

    console.log(`[Telnyx Config] PATCH body:`, JSON.stringify({ outbound: { outbound_voice_profile_id: profileId } }));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Telnyx Config] Failed to update connection:", errorText);
      return NextResponse.json({ error: "Failed to configure", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log("[Telnyx Config] Connection updated:", JSON.stringify(data.data?.outbound, null, 2));

    return NextResponse.json({
      success: true,
      connectionId: data.data?.id,
      outboundVoiceProfileId: data.data?.outbound?.outbound_voice_profile_id,
    });
  } catch (error) {
    console.error("[Telnyx Config] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
