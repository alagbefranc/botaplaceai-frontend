import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: agent, error } = await supabase
      .from("agents")
      .select("id, name, greeting_message, voice, status")
      .eq("id", agentId)
      .eq("status", "active")
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: "Agent not found or inactive" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      greeting: agent.greeting_message || "Hi! How can I help you today?",
      color: "#6C5CE7",
      position: "bottom-right",
      avatar_url: null,
    });
  } catch (error) {
    console.error("Widget config error:", error);
    return NextResponse.json(
      { error: "Failed to load agent config" },
      { status: 500 }
    );
  }
}
