import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

/**
 * GET /api/settings/members
 * List all members of the current organization with their auth data
 */
export async function GET() {
  try {
    const { admin, member } = await getOrgMemberContext();

    // Get all users in the org
    const { data: orgUsers, error } = await admin
      .from("users")
      .select("id, role, created_at")
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch auth data for each user
    const members = await Promise.all(
      (orgUsers ?? []).map(async (u) => {
        const { data: authData } = await admin.auth.admin.getUserById(u.id);
        const meta = authData?.user?.user_metadata as Record<string, unknown> | undefined;
        const displayName =
          typeof meta?.full_name === "string" && meta.full_name.trim()
            ? meta.full_name.trim()
            : typeof meta?.name === "string" && meta.name.trim()
              ? meta.name.trim()
              : authData?.user?.email?.split("@")[0] ?? "Unknown";

        return {
          id: u.id,
          email: authData?.user?.email ?? "",
          displayName,
          avatarUrl: typeof meta?.avatar_url === "string" ? meta.avatar_url : null,
          role: (u.role ?? "viewer") as "admin" | "editor" | "viewer",
          joinedAt: u.created_at,
          lastSignIn: authData?.user?.last_sign_in_at ?? null,
        };
      })
    );

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load members." }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/members
 * Update a member's role (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin"] });

    const body = await request.json().catch(() => null) as {
      userId?: string;
      role?: "admin" | "editor" | "viewer";
    } | null;

    if (!body?.userId || !body.role) {
      return NextResponse.json({ error: "userId and role are required." }, { status: 400 });
    }

    if (!["admin", "editor", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // Ensure target user is in same org
    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id")
      .eq("id", body.userId)
      .eq("org_id", member.orgId)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "User not found in organization." }, { status: 404 });
    }

    const { error } = await admin
      .from("users")
      .update({ role: body.role })
      .eq("id", body.userId)
      .eq("org_id", member.orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update member role." }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/members
 * Remove a member from the organization (admin only)
 */
export async function DELETE(request: Request) {
  try {
    const { admin, user, member } = await getOrgMemberContext({ allowedRoles: ["admin"] });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
    }

    // Verify target is in same org
    const { data: target } = await admin
      .from("users")
      .select("id")
      .eq("id", userId)
      .eq("org_id", member.orgId)
      .single();

    if (!target) {
      return NextResponse.json({ error: "User not found in organization." }, { status: 404 });
    }

    const { error } = await admin.from("users").delete().eq("id", userId).eq("org_id", member.orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
