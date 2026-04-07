import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getWorkspaceName(email: string | null | undefined, fullName: string | null | undefined) {
  if (fullName?.trim()) {
    return `${fullName.trim()} Workspace`;
  }

  if (email?.includes("@")) {
    const [localPart] = email.split("@");
    if (localPart) {
      return `${localPart} Workspace`;
    }
  }

  return "Workspace";
}

interface OnboardingInput {
  companyName?: string;
  website?: string | null;
  goal?: string | null;
}

export async function POST(request: Request) {
  try {
    // Parse optional onboarding payload
    let onboarding: OnboardingInput | null = null;
    try {
      const body = await request.json();
      if (body?.onboarding) onboarding = body.onboarding as OnboardingInput;
    } catch {
      // No body or invalid JSON — that's fine, bootstrap without onboarding
    }

    const supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();

    const { data: existingUser, error: existingUserError } = await admin
      .from("users")
      .select("id, org_id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json({ error: existingUserError.message }, { status: 500 });
    }

    if (existingUser) {
      const { data: existingOrg } = await admin
        .from("organizations")
        .select("id, name, plan, onboarding_completed")
        .eq("id", existingUser.org_id)
        .maybeSingle();

      // If onboarding data provided, update org
      if (onboarding?.companyName && existingOrg) {
        const updates: Record<string, unknown> = {
          name: onboarding.companyName,
          onboarding_completed: true,
        };
        if (onboarding.website) updates.website = onboarding.website;
        if (onboarding.goal) updates.goal = onboarding.goal;

        await admin.from("organizations").update(updates).eq("id", existingOrg.id);

        return NextResponse.json({
          created: false,
          user: {
            id: existingUser.id,
            orgId: existingUser.org_id,
            email: existingUser.email,
            role: existingUser.role,
          },
          org: {
            id: existingOrg.id,
            name: onboarding.companyName,
            plan: existingOrg.plan,
            onboarding_completed: true,
          },
        });
      }

      return NextResponse.json({
        created: false,
        user: {
          id: existingUser.id,
          orgId: existingUser.org_id,
          email: existingUser.email,
          role: existingUser.role,
        },
        org: existingOrg
          ? {
              id: existingOrg.id,
              name: existingOrg.name,
              plan: existingOrg.plan,
              onboarding_completed: existingOrg.onboarding_completed ?? false,
            }
          : null,
      });
    }

    const metadata = user.user_metadata as { full_name?: string; name?: string } | null;
    const fullName = metadata?.full_name ?? metadata?.name ?? null;
    const workspaceName = getWorkspaceName(user.email, fullName);

    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: workspaceName,
        plan: "free",
        billing_email: user.email ?? null,
      })
      .select("id, name")
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: orgError?.message ?? "Failed to create workspace." }, { status: 500 });
    }

    const { data: insertedUser, error: insertUserError } = await admin
      .from("users")
      .insert({
        id: user.id,
        org_id: organization.id,
        email: user.email ?? "",
        full_name: fullName,
        role: "admin",
      })
      .select("id, org_id, email, role")
      .single();

    if (insertUserError || !insertedUser) {
      return NextResponse.json(
        { error: insertUserError?.message ?? "Failed to create user profile." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        created: true,
        user: {
          id: insertedUser.id,
          orgId: insertedUser.org_id,
          email: insertedUser.email,
          role: insertedUser.role,
        },
        org: {
          id: organization.id,
          name: organization.name,
          plan: "free",
          onboarding_completed: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
