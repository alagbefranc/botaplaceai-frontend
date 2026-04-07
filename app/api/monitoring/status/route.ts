import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _sb: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_sb) _sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  return _sb;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

interface HealthStatus {
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

async function checkBackendHealth(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    
    if (res.ok) {
      return { status: "healthy", latencyMs };
    }
    return { status: "degraded", latencyMs, error: `Status ${res.status}` };
  } catch (e) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

async function checkSupabaseHealth(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { error } = await getDb().from("agents").select("id").limit(1);
    const latencyMs = Date.now() - start;
    
    if (!error) {
      return { status: "healthy", latencyMs };
    }
    return { status: "degraded", latencyMs, error: error.message };
  } catch (e) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

async function checkGeminiHealth(): Promise<HealthStatus> {
  // We can't easily check Gemini without making an API call
  // For now, assume healthy if we have the API key
  const hasKey = !!(process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return {
    status: hasKey ? "healthy" : "degraded",
    error: hasKey ? undefined : "API key not configured",
  };
}

async function checkTelnyxHealth(): Promise<HealthStatus> {
  const hasKey = !!process.env.TELNYX_API_KEY;
  return {
    status: hasKey ? "healthy" : "degraded",
    error: hasKey ? undefined : "API key not configured",
  };
}

// GET /api/monitoring/status - System health check
export async function GET(request: NextRequest) {
  try {
    const [backend, supabaseHealth, gemini, telnyx] = await Promise.all([
      checkBackendHealth(),
      checkSupabaseHealth(),
      checkGeminiHealth(),
      checkTelnyxHealth(),
    ]);

    // Calculate overall status
    const statuses = [backend, supabaseHealth, gemini, telnyx];
    const downCount = statuses.filter((s) => s.status === "down").length;
    const degradedCount = statuses.filter((s) => s.status === "degraded").length;

    let overall: "healthy" | "degraded" | "down" = "healthy";
    if (downCount > 0) overall = "down";
    else if (degradedCount > 0) overall = "degraded";

    return NextResponse.json({
      overall,
      services: {
        backend,
        supabase: supabaseHealth,
        gemini,
        telnyx,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error checking health:", err);
    return NextResponse.json(
      {
        overall: "down",
        error: err instanceof Error ? err.message : "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
