import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { InsightDefinition } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// GET - List all template insight definitions
export async function GET() {
  try {
    await getOrgMemberContext(); // Just verify auth

    // We use admin client to bypass RLS and get all templates
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("insight_definitions")
      .select("*")
      .eq("is_template", true)
      .order("template_category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const templates: InsightDefinition[] = (data || []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      insightType: row.insight_type,
      schema: row.schema,
      prompt: row.prompt,
      isTemplate: row.is_template,
      templateCategory: row.template_category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ templates });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/templates error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
