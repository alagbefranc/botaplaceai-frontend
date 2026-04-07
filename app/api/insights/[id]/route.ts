import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { InsightDefinition } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// GET - Get a single insight definition
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("insight_definitions")
      .select("*")
      .eq("id", id)
      .or(`org_id.eq.${member.orgId},is_template.eq.true`)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
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

    return NextResponse.json({ insight });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update an insight definition
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json();

    // Verify the insight belongs to this org (not a template)
    const { data: existing, error: fetchError } = await admin
      .from("insight_definitions")
      .select("id, org_id, is_template")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (existing.is_template) {
      return NextResponse.json({ error: "Cannot edit template insights" }, { status: 403 });
    }

    if (existing.org_id !== member.orgId) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    const { name, description, insightType, schema, prompt } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (insightType !== undefined) {
      updateData.insight_type = insightType;
      updateData.schema = insightType === "structured" ? schema : null;
      updateData.prompt = insightType === "unstructured" ? prompt : null;
    } else {
      if (schema !== undefined) updateData.schema = schema;
      if (prompt !== undefined) updateData.prompt = prompt;
    }

    const { data, error } = await admin
      .from("insight_definitions")
      .update(updateData)
      .eq("id", id)
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

    return NextResponse.json({ insight });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PUT /api/insights/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete an insight definition
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });

    // Verify the insight belongs to this org (not a template)
    const { data: existing, error: fetchError } = await admin
      .from("insight_definitions")
      .select("id, org_id, is_template")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (existing.is_template) {
      return NextResponse.json({ error: "Cannot delete template insights" }, { status: 403 });
    }

    if (existing.org_id !== member.orgId) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("insight_definitions")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/insights/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
