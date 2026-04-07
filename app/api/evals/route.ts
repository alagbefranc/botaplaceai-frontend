import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Ensure tables exist
async function ensureTablesExist() {
  // Check if evals table exists by trying to select from it
  const { error } = await supabase.from("evals").select("id").limit(1);
  if (error?.code === "42P01") {
    // Table doesn't exist, create it
    // Note: In production, use proper migrations
    console.log("Evals table not found - please run migration");
  }
}

// GET /api/evals - List all evals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    let query = supabase
      .from("evals")
      .select("*")
      .order("created_at", { ascending: false });

    if (orgId) {
      query = query.eq("org_id", orgId);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ evals: [], needsMigration: true });
      }
      throw error;
    }

    return NextResponse.json({ evals: data || [] });
  } catch (err) {
    console.error("Error fetching evals:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch evals" },
      { status: 500 }
    );
  }
}

// POST /api/evals - Create new eval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, messages, orgId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("evals")
      .insert({
        org_id: orgId || null,
        name,
        description: description || null,
        type: "chat.mockConversation",
        messages,
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, return helpful error
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Evals table not found. Please run database migration.", needsMigration: true },
          { status: 500 }
        );
      }
      throw error;
    }

    return NextResponse.json({ eval: data }, { status: 201 });
  } catch (err) {
    console.error("Error creating eval:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create eval" },
      { status: 500 }
    );
  }
}
