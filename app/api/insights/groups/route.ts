import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import type { InsightGroup } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// GET - List all insight groups for the org
export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("insight_groups")
      .select("*")
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groups: InsightGroup[] = (data || []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      webhookUrl: row.webhook_url,
      webhookEnabled: row.webhook_enabled,
      insightIds: row.insight_ids || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/insights/groups error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new insight group
export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json();

    const { name, description, webhookUrl, webhookEnabled, insightIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("insight_groups")
      .insert({
        org_id: member.orgId,
        name,
        description,
        webhook_url: webhookUrl,
        webhook_enabled: webhookEnabled || false,
        insight_ids: insightIds || [],
      })
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

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/insights/groups error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
