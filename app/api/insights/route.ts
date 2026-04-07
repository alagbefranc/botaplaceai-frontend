import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { InsightDefinition } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// GET - List all insight definitions for the org
export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("insight_definitions")
      .select("*")
      .or(`org_id.eq.${member.orgId},is_template.eq.true`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to camelCase
    const insights: InsightDefinition[] = (data || []).map((row) => ({
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

    return NextResponse.json({ insights });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new insight definition
export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json();

    const { name, description, insightType, schema, prompt } = body;

    if (!name || !insightType) {
      return NextResponse.json(
        { error: "Name and insightType are required" },
        { status: 400 }
      );
    }

    if (insightType === "structured" && !schema?.parameters?.length) {
      return NextResponse.json(
        { error: "Structured insights require at least one parameter" },
        { status: 400 }
      );
    }

    if (insightType === "unstructured" && !prompt) {
      return NextResponse.json(
        { error: "Unstructured insights require a prompt" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("insight_definitions")
      .insert({
        org_id: member.orgId,
        name,
        description,
        insight_type: insightType,
        schema: insightType === "structured" ? schema : null,
        prompt: insightType === "unstructured" ? prompt : null,
        is_template: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const insight: InsightDefinition = {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description,
      insightType: data.insight_type,
      schema: data.schema,
      prompt: data.prompt,
      isTemplate: data.is_template,
      templateCategory: data.template_category,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ insight }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
