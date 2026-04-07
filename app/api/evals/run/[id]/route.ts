import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getDb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

// GET /api/evals/run/[id] - Get single eval run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await getDb()
      .from("eval_runs")
      .select("*, evals(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Eval run not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ evalRun: data });
  } catch (err) {
    console.error("Error fetching eval run:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch eval run" },
      { status: 500 }
    );
  }
}
