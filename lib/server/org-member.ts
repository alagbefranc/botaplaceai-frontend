import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type OrgMemberRole = "admin" | "editor" | "viewer";

export interface OrgMemberContext {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  user: User;
  member: {
    orgId: string;
    role: OrgMemberRole;
  };
}

export class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ContextOptions {
  allowedRoles?: OrgMemberRole[];
}

export async function getOrgMemberContext(options: ContextOptions = {}): Promise<OrgMemberContext> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new ApiRouteError(401, "Unauthorized.");
  }

  const admin = getSupabaseAdminClient();

  const { data: member, error: memberError } = await admin
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (memberError || !member?.org_id) {
    throw new ApiRouteError(403, "User is not provisioned in an organization.");
  }

  const role = (member.role ?? "viewer") as OrgMemberRole;

  if (options.allowedRoles && !options.allowedRoles.includes(role)) {
    throw new ApiRouteError(403, "You do not have permission for this action.");
  }

  return {
    admin,
    user,
    member: {
      orgId: member.org_id,
      role,
    },
  };
}
