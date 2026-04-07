import { NextResponse } from "next/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

/**
 * Assign a phone number to a credential connection for outbound calling
 */
export async function POST(request: Request) {
  try {
    const { phoneNumberId, connectionId } = await request.json();

    if (!TELNYX_API_KEY) {
      return NextResponse.json({ error: "Telnyx API key not configured" }, { status: 500 });
    }

    if (!phoneNumberId || !connectionId) {
      return NextResponse.json({ error: "phoneNumberId and connectionId required" }, { status: 400 });
    }

    console.log(`[Telnyx] Assigning phone ${phoneNumberId} to connection ${connectionId}`);

    const response = await fetch(`${TELNYX_API_URL}/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        connection_id: connectionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Telnyx] Assignment failed:", errorText);
      return NextResponse.json({ error: "Failed to assign connection", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log("[Telnyx] Assignment successful");

    return NextResponse.json({
      success: true,
      phoneNumber: data.data?.phone_number,
      connectionId: data.data?.connection_id,
    });
  } catch (error) {
    console.error("[Telnyx] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
