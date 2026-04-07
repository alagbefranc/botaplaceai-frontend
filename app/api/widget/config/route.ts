import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

// GET — public endpoint for embeddable widget to fetch config
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const supabase = getDb();

  try {
    // First check for saved widget config
    const { data: widgetConfig } = await supabase
      .from("widget_configs")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    // Also fetch agent basics
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

    // Merge saved config with agent defaults
    return NextResponse.json({
      id: agent.id,
      name: widgetConfig?.widget_title || agent.name,
      greeting: widgetConfig?.greeting || agent.greeting_message || "Hi! How can I help you today?",
      color: widgetConfig?.accent_color || "#7C3AED",
      position: widgetConfig?.position || "bottom-right",
      avatar_url: widgetConfig?.avatar_url || null,
      mode: widgetConfig?.mode || "hybrid",
      theme: widgetConfig?.theme || "light",
      widget_size: widgetConfig?.widget_size || "full",
      border_radius: widgetConfig?.border_radius || "medium",
      cta_button_color: widgetConfig?.cta_button_color || "#1F2937",
      cta_button_text_color: widgetConfig?.cta_button_text_color || "#FFFFFF",
      cta_title: widgetConfig?.cta_title || "Need help?",
      cta_subtitle: widgetConfig?.cta_subtitle || "Chat with our AI assistant",
      chat_placeholder: widgetConfig?.chat_placeholder || "Type your message...",
      voice_show_transcript: widgetConfig?.voice_show_transcript || false,
      auto_open: widgetConfig?.auto_open || false,
      auto_open_delay: widgetConfig?.auto_open_delay || 3,
    });
  } catch (error) {
    console.error("Widget config error:", error);
    return NextResponse.json(
      { error: "Failed to load agent config" },
      { status: 500 }
    );
  }
}

// POST — authenticated endpoint for saving widget config from builder
export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const body = await request.json();
    const { agent_id, ...config } = body;

    if (!agent_id) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    // Verify agent belongs to org
    const { data: agent, error: agentErr } = await admin
      .from("agents")
      .select("id")
      .eq("id", agent_id)
      .eq("org_id", member.orgId)
      .single();

    if (agentErr || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const row = {
      agent_id,
      org_id: member.orgId,
      mode: config.mode || "hybrid",
      theme: config.theme || "light",
      widget_size: config.widget_size || "full",
      border_radius: config.border_radius || "medium",
      position: config.position || "bottom-right",
      accent_color: config.accent_color || "#7C3AED",
      cta_button_color: config.cta_button_color || "#1F2937",
      cta_button_text_color: config.cta_button_text_color || "#FFFFFF",
      widget_title: config.widget_title || "Talk with AI",
      cta_title: config.cta_title || "Need help?",
      cta_subtitle: config.cta_subtitle,
      greeting: config.greeting,
      chat_placeholder: config.chat_placeholder || "Type your message...",
      avatar_url: config.avatar_url || null,
      voice_show_transcript: config.voice_show_transcript || false,
      auto_open: config.auto_open || false,
      auto_open_delay: config.auto_open_delay || 3,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("widget_configs")
      .upsert(row, { onConflict: "agent_id" })
      .select()
      .single();

    if (error) {
      console.error("Widget config save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Widget config save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
