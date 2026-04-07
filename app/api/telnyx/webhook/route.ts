import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ConversationMessage } from "../ai-handler/route";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// ⚠️ DEPRECATED: This webhook uses Telnyx basic TTS (male/female only) which
// sounds robotic. All AI agent calls should route through the backend server
// webhook at /telnyx/webhook (server/src/routes/telnyx.ts) which uses Gemini
// Live audio streaming with the agent's real configured voice.
// The credential connection webhook URL has been updated to point to the
// backend server. This file is kept for backwards compatibility only.

// ── In-memory call state ──────────────────────────────────────────────────────
interface ActiveCallState {
  callControlId: string;
  from: string;
  to: string;
  direction: string;
  startTime: Date;
  orgId?: string;
  agentId?: string;
  agentName?: string;
  missionId?: string;
  missionContactId?: string;
  missionObjective?: string;
  contactName?: string;
  conversationHistory: ConversationMessage[];
  greeted: boolean;
}

const activeCalls = new Map<string, ActiveCallState>();

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getOrgFromConnection(connectionId: string): Promise<string | undefined> {
  if (!connectionId) return undefined;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("telnyx_connections")
      .select("org_id")
      .eq("connection_id", connectionId)
      .single();
    return data?.org_id;
  } catch {
    return undefined;
  }
}

/**
 * Looks up which agent is assigned to the given Telnyx number.
 * Returns { agentId, orgId } or null if none found.
 */
async function getAgentForNumber(
  toNumber: string
): Promise<{ agentId: string; orgId: string } | null> {
  if (!toNumber) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("phone_numbers")
      .select("agent_id, org_id")
      .eq("telnyx_number", toNumber)
      .not("agent_id", "is", null)
      .maybeSingle();

    if (!data?.agent_id || !data?.org_id) return null;
    return { agentId: data.agent_id, orgId: data.org_id };
  } catch {
    return null;
  }
}

async function telnyxAction(
  callControlId: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const url = `${TELNYX_API_URL}/calls/${callControlId}/actions/${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Webhook] ${action} failed:`, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[Webhook] ${action} error:`, e);
    return false;
  }
}

async function saveCallLog(
  orgId: string | undefined,
  callControlId: string,
  callLegId: string | undefined,
  data: {
    direction?: string;
    caller_number?: string;
    callee_number?: string;
    call_state?: string;
    duration_seconds?: number;
    recording_url?: string;
    ended_at?: string;
    metadata?: Record<string, unknown>;
  }
) {
  if (!orgId) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("call_logs")
      .select("id")
      .eq("telnyx_call_control_id", callControlId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("call_logs")
        .update(data)
        .eq("id", existing.id);
    } else {
      await supabase.from("call_logs").insert({
        org_id: orgId,
        telnyx_call_control_id: callControlId,
        telnyx_call_leg_id: callLegId,
        direction: data.direction ?? "outbound",
        caller_number: data.caller_number,
        callee_number: data.callee_number,
        call_state: data.call_state ?? "initiated",
        started_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("[Webhook] Failed to save call log:", e);
  }
}

/**
 * Fetches agent config from Supabase.
 */
async function getAgentConfig(
  agentId: string
): Promise<{ greeting: string | null; voice: string; name: string; systemPrompt: string | null } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("agents")
      .select("greeting_message, voice, name, system_prompt")
      .eq("id", agentId)
      .maybeSingle();
    if (!data) return null;
    return {
      greeting: data.greeting_message,
      voice: data.voice ?? "Joanna",
      name: data.name ?? "Assistant",
      systemPrompt: data.system_prompt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Maps Gemini voice names → Telnyx basic TTS gender.
 * Telnyx basic only supports "male" | "female" for en-US calls.
 */
function mapVoiceToTelnyx(voice: string): string {
  const v = voice.toLowerCase();
  // Known male Gemini voices
  const maleVoices = ["orus", "charon", "fenrir", "puck", "achird", "algenib", "rasalgethi", "zubenelgenubi", "sadachbia"];
  if (maleVoices.includes(v) || v.includes("male")) return "male";
  // Everything else (female Gemini voices + unknown) → female
  return "female";
}

/**
 * Calls the AI handler to process a transcript and speak the response.
 * Runs fire-and-forget from the webhook (returns 200 immediately to Telnyx).
 */
async function processTranscriptWithAI(
  callControlId: string,
  agentId: string,
  transcript: string,
  history: ConversationMessage[],
  missionContext?: string
): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/telnyx/ai-handler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, callControlId, transcript, history, missionContext }),
    });

    if (!res.ok) {
      console.error("[Webhook] AI handler error:", await res.text());
      return null;
    }
    const data = (await res.json()) as { response?: string };
    return data.response ?? null;
  } catch (e) {
    console.error("[Webhook] Failed to call AI handler:", e);
    return null;
  }
}

// ── Main webhook handler ────────────────────────────────────────────────────────

/**
 * POST /api/telnyx/webhook
 *
 * Handles all Telnyx call events.
 * Full AI loop for inbound calls assigned to an agent:
 *   call.initiated (incoming) → auto-answer
 *   call.answered             → speak greeting + start transcription
 *   call.transcription        → Gemini AI → speak response → restart transcription
 *   call.speak.ended          → restart transcription (listen again)
 *   call.hangup               → clean up
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventType = body.data?.event_type as string;
    const payload = body.data?.payload;
    const callControlId = payload?.call_control_id as string;
    const callLegId = payload?.call_leg_id as string | undefined;
    const connectionId = payload?.connection_id as string | undefined;
    const direction = payload?.direction as string | undefined;
    const to = payload?.to as string | undefined;
    const from = payload?.from as string | undefined;
    const state = payload?.state as string | undefined;

    console.log(`[Webhook] ${eventType} | direction=${direction} | state=${state} | from=${from} → to=${to}`);

    // ── INBOUND: call.initiated ──────────────────────────────────────────────
    if (eventType === "call.initiated" && direction === "incoming") {
      console.log("[Webhook] Incoming call from:", from, "to:", to);

      // Identify which agent owns this number
      const assignment = to ? await getAgentForNumber(to) : null;
      const orgId = assignment?.orgId ?? (await getOrgFromConnection(connectionId ?? ""));

      // Save initial call log
      await saveCallLog(orgId, callControlId, callLegId, {
        direction: "inbound",
        caller_number: from,
        callee_number: to,
        call_state: "ringing",
      });

      if (assignment) {
        console.log(`[Webhook] Agent ${assignment.agentId} assigned to ${to ?? ""} — auto-answering`);

        // Store call state
        activeCalls.set(callControlId, {
          callControlId,
          from: from ?? "",
          to: to ?? "",
          direction: "incoming",
          startTime: new Date(),
          orgId: assignment.orgId,
          agentId: assignment.agentId,
          conversationHistory: [],
          greeted: false,
        });

        // Auto-answer
        await telnyxAction(callControlId, "answer", {});
      } else {
        console.log("[Webhook] No agent assigned to", to, "— not auto-answering");
      }
    }

    // ── OUTBOUND: call.initiated ─────────────────────────────────────────────
    if (eventType === "call.initiated" && direction === "outgoing") {
      const orgId = await getOrgFromConnection(connectionId ?? "");
      await saveCallLog(orgId, callControlId, callLegId, {
        direction: "outbound",
        caller_number: from,
        callee_number: to,
        call_state: "initiated",
      });

      // Decode client_state and register the AI session so call.answered can
      // greet + transcribe. Handles both demo calls and mission outbound calls.
      const rawState = payload?.client_state as string | undefined;
      if (rawState) {
        try {
          const decoded = JSON.parse(
            Buffer.from(rawState, "base64").toString("utf8")
          ) as { agentId?: string; orgId?: string; isDemoCall?: boolean; missionId?: string; missionContactId?: string };

          if (decoded?.agentId) {
            // Pre-fetch mission objective + contact name so call.answered has them instantly
            let missionObjective: string | undefined;
            let contactName: string | undefined;
            if (decoded.missionId) {
              try {
                const supabase = getSupabaseAdmin();
                const { data: mission } = await supabase
                  .from("missions")
                  .select("objective")
                  .eq("id", decoded.missionId)
                  .maybeSingle();
                missionObjective = mission?.objective ?? undefined;

                if (decoded.missionContactId) {
                  const { data: mc } = await supabase
                    .from("mission_contacts")
                    .select("contacts(name)")
                    .eq("id", decoded.missionContactId)
                    .maybeSingle();
                  const raw = mc?.contacts as { name?: string } | null;
                  contactName = raw?.name ?? undefined;
                }
              } catch { /* non-fatal */ }
            }

            activeCalls.set(callControlId, {
              callControlId,
              from: from ?? "",
              to: to ?? "",
              direction: "outgoing",
              startTime: new Date(),
              orgId: decoded.orgId ?? orgId ?? "",
              agentId: decoded.agentId,
              missionId: decoded.missionId,
              missionContactId: decoded.missionContactId,
              missionObjective,
              contactName,
              conversationHistory: [],
              greeted: false,
            });
            console.log(
              `[Webhook] Outbound call registered — agent ${decoded.agentId}${decoded.missionId ? ` (mission ${decoded.missionId}, objective: "${missionObjective}")` : " (demo)"}`
            );
          }
        } catch {
          // client_state may not be JSON — ignore
        }
      }
    }

    // ── call.answered ────────────────────────────────────────────────────────
    if (eventType === "call.answered") {
      await saveCallLog(undefined, callControlId, callLegId, {
        call_state: "answered",
      });

      const callState = activeCalls.get(callControlId);

      if (callState?.agentId && !callState.greeted) {
        const isOutbound = callState.direction === "outgoing";
        console.log(`[Webhook] Call answered (${isOutbound ? "outbound" : "inbound"}) — fetching agent config`);

        const agentConfig = await getAgentConfig(callState.agentId);
        callState.greeted = true;
        if (agentConfig) callState.agentName = agentConfig.name;

        // Build greeting — mission outbound gets a personalised opener
        let greeting: string | null = null;
        if (isOutbound && callState.missionObjective) {
          const name = callState.contactName ? `, ${callState.contactName.split(" ")[0]}` : "";
          const agentFirst = agentConfig?.name?.split(" ")[0] ?? "your assistant";
          greeting = `Hi${name}! This is ${agentFirst} calling. I'm reaching out to help you with: ${callState.missionObjective}. Is now a good time to talk?`;
        } else {
          greeting = agentConfig?.greeting ?? null;
        }

        if (greeting) {
          const telnyxVoice = mapVoiceToTelnyx(agentConfig?.voice ?? "Joanna");
          const spoke = await telnyxAction(callControlId, "speak", {
            payload: greeting,
            voice: telnyxVoice,
            language: "en-US",
            payload_type: "text",
            service_level: "basic",
            client_state: Buffer.from("greeting").toString("base64"),
          });
          if (spoke) {
            console.log(`[Webhook] Greeting (${telnyxVoice}): "${greeting}"`);
            return NextResponse.json({ received: true });
          }
        }

        // No greeting — start transcription immediately
        await telnyxAction(callControlId, "transcription_start", {
          language: "en",
          interim_results: false,
        });
      }
    }

    // ── call.speak.ended ─────────────────────────────────────────────────────
    if (eventType === "call.speak.ended") {
      const callState = activeCalls.get(callControlId);
      if (callState?.agentId) {
        console.log("[Webhook] Speak ended — starting transcription to listen");
        await telnyxAction(callControlId, "transcription_start", {
          language: "en",
          interim_results: false,
        });
      }
    }

    // ── call.transcription ───────────────────────────────────────────────────
    if (eventType === "call.transcription") {
      const transcriptionData = payload?.transcription_data;
      const transcript = transcriptionData?.transcript as string | undefined;
      const isFinal = transcriptionData?.is_final as boolean | undefined;

      const callState = activeCalls.get(callControlId);

      if (!isFinal || !transcript?.trim()) {
        return NextResponse.json({ received: true });
      }

      console.log(`[Webhook] Final transcript: "${transcript}"`);

      if (!callState?.agentId) {
        console.log("[Webhook] No agent ID for this call — skipping AI processing");
        return NextResponse.json({ received: true });
      }

      // Stop transcription while AI is processing
      await telnyxAction(callControlId, "transcription_stop", {});

      // Add user message to history
      callState.conversationHistory.push({ role: "user", content: transcript });

      // Call AI handler (which also speaks the response)
      const missionContext = callState.missionObjective
        ? `MISSION OBJECTIVE: ${callState.missionObjective}. Stay focused on this goal throughout the call.`
        : undefined;
      const aiResponse = await processTranscriptWithAI(
        callControlId,
        callState.agentId,
        transcript,
        callState.conversationHistory,
        missionContext
      );

      if (aiResponse) {
        // Add AI response to history for context
        callState.conversationHistory.push({ role: "assistant", content: aiResponse });
        // Keep history bounded to last 20 turns
        if (callState.conversationHistory.length > 40) {
          callState.conversationHistory = callState.conversationHistory.slice(-40);
        }
      }
      // Note: transcription will restart when call.speak.ended fires
    }

    // ── call.bridged ─────────────────────────────────────────────────────────
    if (eventType === "call.bridged") {
      await saveCallLog(undefined, callControlId, callLegId, {
        call_state: "connected",
      });
    }

    // ── call.hangup ──────────────────────────────────────────────────────────
    if (eventType === "call.hangup") {
      console.log("[Webhook] Call ended, cause:", payload?.hangup_cause);

      const callState = activeCalls.get(callControlId);
      const duration = callState
        ? Math.floor((Date.now() - callState.startTime.getTime()) / 1000)
        : 0;

      await saveCallLog(callState?.orgId, callControlId, callLegId, {
        call_state: "completed",
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
        metadata: {
          hangup_cause: payload?.hangup_cause,
          turns: callState?.conversationHistory.length ?? 0,
        },
      });

      // Update mission_contacts if this was a mission call
      if (callState?.missionContactId && callState?.missionId) {
        const supabase = getSupabaseAdmin();
        const callAnswered = callState.greeted; // greeted=true means call was answered
        const finalStatus = callAnswered ? "completed" : "no_answer";

        await supabase
          .from("mission_contacts")
          .update({
            call_status: finalStatus,
            call_duration: duration,
            completed_at: new Date().toISOString(),
          })
          .eq("id", callState.missionContactId);

        console.log(`[Webhook] Mission contact ${callState.missionContactId} → ${finalStatus}`);

        // Check if all contacts in this mission are done — if so, complete the mission
        const { data: remaining } = await supabase
          .from("mission_contacts")
          .select("id")
          .eq("mission_id", callState.missionId)
          .in("call_status", ["pending", "calling"]);

        if (!remaining || remaining.length === 0) {
          // Count outcomes for summary
          const { data: outcomes } = await supabase
            .from("mission_contacts")
            .select("call_status")
            .eq("mission_id", callState.missionId);

          const completed = outcomes?.filter(c => c.call_status === "completed").length ?? 0;
          const noAnswer  = outcomes?.filter(c => c.call_status === "no_answer").length ?? 0;
          const failed    = outcomes?.filter(c => c.call_status === "failed").length ?? 0;

          await supabase
            .from("missions")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              completed_calls: completed,
              failed_calls: noAnswer + failed,
              result_summary: `Mission completed. ${completed} answered, ${noAnswer} no answer, ${failed} failed.`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", callState.missionId);

          console.log(`[Webhook] Mission ${callState.missionId} completed — ${completed} answered, ${noAnswer + failed} not reached`);
        }
      }

      activeCalls.delete(callControlId);
    }

    // ── call.recording.saved ─────────────────────────────────────────────────
    if (eventType === "call.recording.saved") {
      const recordingUrl = payload?.recording_urls?.mp3 as string | undefined;
      if (recordingUrl) {
        const callState = activeCalls.get(callControlId);
        await saveCallLog(callState?.orgId, callControlId, callLegId, {
          recording_url: recordingUrl,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/**
 * GET — Telnyx webhook validation
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Telnyx webhook ready — AI voice loop active",
    timestamp: new Date().toISOString(),
  });
}
