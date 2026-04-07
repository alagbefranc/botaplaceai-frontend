import { NextResponse } from "next/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

/**
 * Comprehensive Telnyx WebRTC configuration diagnostic
 */
export async function GET() {
  if (!TELNYX_API_KEY) {
    return NextResponse.json({ error: "Telnyx API key not configured" }, { status: 500 });
  }

  try {
    // Get the credential connection used for WebRTC (Bo WebRTC - purpgo)
    const connectionId = "2923887190440150147";
    
    // 1. Check credential connection details
    const connResp = await fetch(`${TELNYX_API_URL}/credential_connections/${connectionId}`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const connData = await connResp.json();
    console.log("[Telnyx Diag] Credential Connection:", JSON.stringify(connData.data, null, 2));

    // 2. Check outbound voice profiles
    const profilesResp = await fetch(`${TELNYX_API_URL}/outbound_voice_profiles`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const profilesData = await profilesResp.json();
    console.log("[Telnyx Diag] Outbound Profiles:", JSON.stringify(profilesData.data, null, 2));

    // 3. Check phone number +13439470641
    const phoneId = "2917985602899019599";
    const phoneResp = await fetch(`${TELNYX_API_URL}/phone_numbers/${phoneId}`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const phoneData = await phoneResp.json();
    console.log("[Telnyx Diag] Phone Number:", JSON.stringify(phoneData.data, null, 2));

    // 4. Check telephony credentials for this connection
    const credsResp = await fetch(`${TELNYX_API_URL}/telephony_credentials?filter[connection_id]=${connectionId}`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const credsData = await credsResp.json();
    console.log("[Telnyx Diag] Telephony Credentials:", JSON.stringify(credsData.data, null, 2));

    // Identify issues
    const issues: string[] = [];
    
    // Check connection
    if (!connData.data?.outbound_voice_profile_id && !connData.data?.outbound) {
      issues.push("Credential connection has no outbound voice profile configured");
    }
    
    // Check phone number
    if (!phoneData.data?.connection_id) {
      issues.push("Phone number is not assigned to any connection");
    }
    
    if (phoneData.data?.connection_id !== connectionId) {
      issues.push(`Phone number is assigned to different connection (${phoneData.data?.connection_id})`);
    }

    return NextResponse.json({
      connection: {
        id: connData.data?.id,
        name: connData.data?.connection_name,
        active: connData.data?.active,
        outboundVoiceProfileId: connData.data?.outbound_voice_profile_id,
        outbound: connData.data?.outbound,
        inbound: connData.data?.inbound,
        sipUri: connData.data?.sip_uri,
      },
      phoneNumber: {
        id: phoneData.data?.id,
        number: phoneData.data?.phone_number,
        connectionId: phoneData.data?.connection_id,
        connectionName: phoneData.data?.connection_name,
        status: phoneData.data?.status,
      },
      outboundProfiles: profilesData.data?.map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })),
      telephonyCredentials: credsData.data?.map((c: { id: string; name: string; sip_username: string }) => ({
        id: c.id,
        name: c.name,
        sipUsername: c.sip_username,
      })),
      issues,
    });
  } catch (error) {
    console.error("[Telnyx Diag] Error:", error);
    return NextResponse.json({ error: "Diagnostic failed" }, { status: 500 });
  }
}
