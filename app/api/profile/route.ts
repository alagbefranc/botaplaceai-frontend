import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

/**
 * GET /api/profile
 * Returns current user's profile info: email, display name, role, org
 */
export async function GET() {
  try {
    const { admin, user, member } = await getOrgMemberContext();

    // Fetch org name
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", member.orgId)
      .single();

    const meta = user.user_metadata as Record<string, unknown> | undefined;

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email ?? "",
        displayName:
          typeof meta?.full_name === "string" && meta.full_name.trim()
            ? meta.full_name.trim()
            : typeof meta?.name === "string" && meta.name.trim()
              ? meta.name.trim()
              : "",
        avatarUrl: typeof meta?.avatar_url === "string" ? meta.avatar_url : null,
        role: member.role,
        orgId: member.orgId,
        orgName: org?.name ?? "",
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at ?? null,
      },
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Update display name (stored in Supabase auth user_metadata)
 */
export async function PATCH(request: Request) {
  try {
    const { admin, user } = await getOrgMemberContext();
    const body = await request.json().catch(() => null) as {
      displayName?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    if (body.displayName !== undefined) {
      const name = body.displayName.trim();
      if (name.length === 0) {
        return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
      }
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...((user.user_metadata as Record<string, unknown>) ?? {}),
          full_name: name,
        },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
