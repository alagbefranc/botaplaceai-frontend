import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const DEMO_AGENT_ID =
  process.env.LANDING_DEMO_AGENT_ID ?? "00000000-b07a-0000-0000-000000000001";
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Normalize a user-entered phone number to E.164 format.
 * Handles: +1XXXXXXXXXX, 1XXXXXXXXXX, XXXXXXXXXX (assumed US/CA).
 */
function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/\D/g, "");
  if (stripped.length === 10) return `+1${stripped}`;
  if (stripped.length === 11 && stripped.startsWith("1")) return `+${stripped}`;
  if (raw.startsWith("+") && stripped.length >= 10 && stripped.length <= 15) {
    return `+${stripped}`;
  }
  return null;
}

/**
 * POST /api/landing/demo-call
 *
 * Public endpoint (no auth). Initiates a Telnyx outbound call to the visitor's
 * phone number, answered by the Botaplace demo AI agent.
 *
 * Rate limit: 3 calls per IP per hour (logged in landing_demo_calls table).
 */
export async function POST(request: Request) {
  try {
    let body: { phone?: string };
    try {
      body = (await request.json()) as { phone?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { phone } = body;
    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone.trim());
    if (!normalized) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid phone number, e.g. +1 555 123 4567.",
        },
        { status: 400 }
      );
    }

    // ── Rate limiting ──────────────────────────────────────────────────────────
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("landing_demo_calls")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        {
          error:
            "You've requested too many demo calls. Please try again in an hour.",
        },
        { status: 429 }
      );
    }

    // ── Resolve demo agent org ─────────────────────────────────────────────────
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("org_id")
      .eq("id", DEMO_AGENT_ID)
      .single();

    if (agentError || !agent) {
      console.error("[DemoCall] Demo agent not found:", agentError?.message);
      return NextResponse.json(
        { error: "Demo agent not configured. Please contact support." },
        { status: 503 }
      );
    }

    // ── Resolve caller-ID ──────────────────────────────────────────────────────
    let fromNumber: string | null =
      process.env.LANDING_DEMO_FROM_NUMBER ?? null;

    if (!fromNumber) {
      const { data: pn } = await supabase
        .from("phone_numbers")
        .select("telnyx_number")
        .not("telnyx_number", "is", null)
        .limit(1)
        .single();
      fromNumber = (pn as { telnyx_number?: string } | null)?.telnyx_number ?? null;
    }

    if (!fromNumber) {
      return NextResponse.json(
        {
          error:
            "No Telnyx phone number is configured. Please contact support.",
        },
        { status: 503 }
      );
    }

    const connectionId = process.env.TELNYX_CONNECTION_ID;
    if (!connectionId) {
      return NextResponse.json(
        { error: "Telnyx connection not configured. Please contact support." },
        { status: 503 }
      );
    }

    // ── Initiate outbound call ─────────────────────────────────────────────────
    const clientState = Buffer.from(
      JSON.stringify({
        agentId: DEMO_AGENT_ID,
        orgId: agent.org_id as string,
        isDemoCall: true,
      })
    ).toString("base64");

    const telnyxRes = await fetch(`${TELNYX_API_URL}/calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        connection_id: connectionId,
        to: normalized,
        from: fromNumber,
        from_display_name: "Botaplace AI",
        client_state: clientState,
        timeout_secs: 30,
        answering_machine_detection: "disabled",
      }),
    });

    if (!telnyxRes.ok) {
      const err = (await telnyxRes.json().catch(() => ({}))) as {
        errors?: { detail: string }[];
      };
      const detail =
        err.errors?.[0]?.detail ?? "Failed to initiate call. Please try again.";
      console.error("[DemoCall] Telnyx error:", err);
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    // ── Log for rate limiting ──────────────────────────────────────────────────
    await supabase.from("landing_demo_calls").insert({ ip });

    return NextResponse.json({
      success: true,
      message: "Call on its way! Your phone should ring within 15 seconds.",
    });
  } catch (err) {
    console.error("[DemoCall] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
