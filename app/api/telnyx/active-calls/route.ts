import { NextResponse } from "next/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

/**
 * List active calls for a connection
 * This only works if the connection has a webhook_url configured
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId") || "2923887190440150147";

  try {
    // First, check the connection configuration
    const connResp = await fetch(`${TELNYX_API_URL}/credential_connections/${connectionId}`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    const connData = await connResp.json();
    
    // credential_connections use webhook_event_url, not webhook_url
    const webhookUrl = connData.data?.webhook_event_url || connData.data?.webhook_url;
    const hasWebhook = Boolean(webhookUrl);

    // Try to list active calls
    const callsResp = await fetch(`${TELNYX_API_URL}/connections/${connectionId}/active_calls`, {
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}` },
    });
    
    let activeCalls = [];
    let callsError = null;
    
    if (callsResp.ok) {
      const callsData = await callsResp.json();
      activeCalls = callsData.data || [];
    } else {
      const errorData = await callsResp.json();
      callsError = errorData.errors?.[0]?.detail || "Failed to fetch active calls";
    }

    return NextResponse.json({
      connectionId,
      connectionName: connData.data?.connection_name,
      webhookUrl: webhookUrl || null,
      hasWebhook,
      activeCalls,
      activeCallCount: activeCalls.length,
      error: callsError,
      message: hasWebhook 
        ? "Connection has webhook configured" 
        : "⚠️ No webhook URL configured! WebRTC outbound calls won't work without it.",
      fix: hasWebhook ? null : "Use POST /api/telnyx/configure-webhook to set the webhook URL",
    });
  } catch (error) {
    console.error("[Active Calls] Error:", error);
    return NextResponse.json({ error: "Failed to check active calls" }, { status: 500 });
  }
}
