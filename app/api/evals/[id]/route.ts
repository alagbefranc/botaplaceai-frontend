import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getDb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

// GET /api/evals/[id] - Get single eval
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await getDb()
      .from("evals")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Eval not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ eval: data });
  } catch (err) {
    console.error("Error fetching eval:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch eval" },
      { status: 500 }
    );
  }
}

// PATCH /api/evals/[id] - Update eval
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, messages } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (messages !== undefined) updates.messages = messages;

    const { data, error } = await getDb()
      .from("evals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Eval not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ eval: data });
  } catch (err) {
    console.error("Error updating eval:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update eval" },
      { status: 500 }
    );
  }
}

// DELETE /api/evals/[id] - Delete eval
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await getDb().from("evals").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting eval:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete eval" },
      { status: 500 }
    );
  }
}
