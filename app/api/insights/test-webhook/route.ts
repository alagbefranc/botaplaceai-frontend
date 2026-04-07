import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// POST - Test a webhook URL
export async function POST(request: Request) {
  try {
    await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json();

    const { webhookUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Send test payload
    const testPayload = {
      event_type: "insight.test",
      test: true,
      timestamp: new Date().toISOString(),
      message: "This is a test webhook from AI Insights",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AI-Insights-Webhook/1.0",
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: `Webhook responded with status ${response.status}`,
          statusCode: response.status,
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `Webhook returned error status ${response.status}`,
          statusCode: response.status,
        });
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json({
          success: false,
          message: "Webhook request timed out after 5 seconds",
        });
      }

      return NextResponse.json({
        success: false,
        message: fetchError instanceof Error ? fetchError.message : "Failed to reach webhook URL",
      });
    }
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/insights/test-webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
