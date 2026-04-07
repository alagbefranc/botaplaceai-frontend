import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

// GET /api/admin/stats - Get admin dashboard stats
export async function GET(request: NextRequest) {
  try {
    // Get total users
    const sb = getSupabase();

    const { count: totalUsers } = await sb
      .from("users")
      .select("*", { count: "exact", head: true });

    // Get total organizations
    const { count: totalOrgs } = await sb
      .from("organizations")
      .select("*", { count: "exact", head: true });

    // Get total agents
    const { count: totalAgents } = await sb
      .from("agents")
      .select("*", { count: "exact", head: true });

    // Get total conversations
    const { count: totalConversations } = await sb
      .from("conversations")
      .select("*", { count: "exact", head: true });

    // Get active conversations
    const { count: activeConversations } = await sb
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Get conversations today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: conversationsToday } = await sb
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalOrgs: totalOrgs || 0,
      totalAgents: totalAgents || 0,
      totalConversations: totalConversations || 0,
      activeConversations: activeConversations || 0,
      conversationsToday: conversationsToday || 0,
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
