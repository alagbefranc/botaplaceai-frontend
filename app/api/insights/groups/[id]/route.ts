import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { InsightGroup } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// GET - Get a single insight group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("insight_groups")
      .select("*")
      .eq("id", id)
      .eq("org_id", member.orgId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const group: InsightGroup = {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description,
      webhookUrl: data.webhook_url,
      webhookEnabled: data.webhook_enabled,
      insightIds: data.insight_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ group });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/groups/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update an insight group
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json();

    // Verify the group belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("insight_groups")
      .select("id, org_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing || existing.org_id !== member.orgId) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { name, description, webhookUrl, webhookEnabled, insightIds } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;
    if (webhookEnabled !== undefined) updateData.webhook_enabled = webhookEnabled;
    if (insightIds !== undefined) updateData.insight_ids = insightIds;

    const { data, error } = await admin
      .from("insight_groups")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const group: InsightGroup = {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description,
      webhookUrl: data.webhook_url,
      webhookEnabled: data.webhook_enabled,
      insightIds: data.insight_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ group });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PUT /api/insights/groups/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete an insight group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });

    // Verify the group belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("insight_groups")
      .select("id, org_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing || existing.org_id !== member.orgId) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("insight_groups")
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
    console.error("DELETE /api/insights/groups/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
