import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

/**
 * GET /api/organization
 * Get current organization details including billing settings
 */
export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    const { data: org, error } = await admin
      .from("organizations")
      .select("id, name, metadata, billing_email")
      .eq("id", member.orgId)
      .single();

    if (error || !org) {
      return NextResponse.json(
        { error: error?.message || "Organization not found" },
        { status: 404 }
      );
    }

    const metadata = org.metadata as Record<string, unknown> | null;
    
    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        billingEmail: org.billing_email,
        billingMarkupPercentage: typeof metadata?.billing_markup_percentage === "number"
          ? metadata.billing_markup_percentage
          : 0,
      },
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch organization.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/organization
 * Update organization settings (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();

    // Check if user is admin
    if (member.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update organization settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { billingMarkupPercentage, billingEmail, name } = body;

    // Validate markup percentage
    if (
      billingMarkupPercentage !== undefined &&
      (typeof billingMarkupPercentage !== "number" ||
        billingMarkupPercentage < 0 ||
        billingMarkupPercentage > 500)
    ) {
      return NextResponse.json(
        { error: "Markup percentage must be a number between 0 and 500" },
        { status: 400 }
      );
    }

    // Fetch current org to merge metadata
    const { data: currentOrg } = await admin
      .from("organizations")
      .select("metadata")
      .eq("id", member.orgId)
      .single();

    const currentMetadata = (currentOrg?.metadata as Record<string, unknown>) || {};

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (billingMarkupPercentage !== undefined) {
      updateData.metadata = {
        ...currentMetadata,
        billing_markup_percentage: billingMarkupPercentage,
      };
    }

    if (billingEmail !== undefined && typeof billingEmail === "string") {
      updateData.billing_email = billingEmail;
    }

    if (name !== undefined && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await admin
      .from("organizations")
      .update(updateData)
      .eq("id", member.orgId)
      .select("id, name, metadata, billing_email")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const metadata = updated.metadata as Record<string, unknown> | null;

    return NextResponse.json({
      organization: {
        id: updated.id,
        name: updated.name,
        billingEmail: updated.billing_email,
        billingMarkupPercentage: typeof metadata?.billing_markup_percentage === "number"
          ? metadata.billing_markup_percentage
          : 0,
      },
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to update organization.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
