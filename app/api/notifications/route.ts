import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's org
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return NextResponse.json({ notifications: [] });

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get unread count
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .eq("read", false)
    .eq("dismissed", false);

  return NextResponse.json({ notifications: data || [], unreadCount: count || 0 });
}

// Mark notifications as read
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ids, markAllRead } = body as { ids?: string[]; markAllRead?: boolean };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return NextResponse.json({ error: "No org" }, { status: 400 });

  if (markAllRead) {
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("org_id", profile.org_id)
      .eq("read", false);
  } else if (ids && ids.length > 0) {
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .in("id", ids)
      .eq("org_id", profile.org_id);
  }

  return NextResponse.json({ success: true });
}

// Dismiss / clear notifications
export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ids, clearAll } = body as { ids?: string[]; clearAll?: boolean };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return NextResponse.json({ error: "No org" }, { status: 400 });

  if (clearAll) {
    await supabase
      .from("notifications")
      .update({ dismissed: true })
      .eq("org_id", profile.org_id);
  } else if (ids && ids.length > 0) {
    await supabase
      .from("notifications")
      .update({ dismissed: true })
      .in("id", ids)
      .eq("org_id", profile.org_id);
  }

  return NextResponse.json({ success: true });
}
