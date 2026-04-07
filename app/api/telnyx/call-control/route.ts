import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

// Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Telnyx Call Control API
 * Multi-tenant: Looks up org credentials from Supabase
 * 
 * Use this to control calls and integrate with YOUR OWN AI agent:
 * - streaming_start: Stream audio to your AI backend
 * - transcription_start: Get live transcription for your AI
 * - speak: Your AI responds via TTS
 * - playback_start: Play your AI's audio responses
 */

interface CallControlRequest {
  call_control_id: string;
  action: string;
  org_id?: string; // Organization ID for multi-tenant lookup
  // Action-specific parameters
  [key: string]: unknown;
}

// Helper to get org's Telnyx credentials from Supabase
async function getOrgCredentials(orgId?: string) {
  if (!orgId) {
    // Fallback to env var for backwards compatibility
    return {
      connectionId: process.env.TELNYX_CONNECTION_ID,
      apiKey: TELNYX_API_KEY,
    };
  }
  
  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("telnyx_connections")
    .select("connection_id, connection_name, settings")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("is_default", true)
    .single();
  
  if (connection) {
    return {
      connectionId: connection.connection_id,
      connectionName: connection.connection_name,
      settings: connection.settings,
      apiKey: TELNYX_API_KEY, // Still use master API key for control
    };
  }
  
  return null;
}

// Helper to log call action to database
async function logCallAction(
  orgId: string | undefined,
  callControlId: string,
  action: string,
  params: Record<string, unknown>,
  result: unknown
) {
  if (!orgId) return;
  
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("call_logs").insert({
      org_id: orgId,
      call_control_id: callControlId,
      action,
      params,
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Log error but don't fail the request
    console.error("[Call Control] Failed to log action:", e);
  }
}

// Helper to make Telnyx API calls
async function telnyxAction(callControlId: string, action: string, params: Record<string, unknown> = {}) {
  const url = `${TELNYX_API_URL}/calls/${callControlId}/actions/${action}`;
  
  console.log(`[Call Control] ${action.toUpperCase()} for call ${callControlId}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
    },
    body: JSON.stringify(params),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error(`[Call Control] ${action} failed:`, data);
    throw new Error(data.errors?.[0]?.detail || `${action} failed`);
  }
  
  return data;
}

export async function POST(request: Request) {
  try {
    const body: CallControlRequest = await request.json();
    const { call_control_id, action, org_id, ...params } = body;
    
    if (!call_control_id) {
      return NextResponse.json({ error: "call_control_id is required" }, { status: 400 });
    }
    
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }
    
    // Get org credentials from Supabase (multi-tenant)
    const credentials = await getOrgCredentials(org_id);
    if (org_id && !credentials) {
      return NextResponse.json({ 
        error: "No Telnyx connection found for this organization" 
      }, { status: 404 });
    }
    
    console.log(`[Call Control] Org: ${org_id || "default"}, Connection: ${credentials?.connectionId}`);
    
    let result;
    
    switch (action) {
      // ===== BASIC CALL CONTROL =====
      
      case "answer":
        // Answer an incoming call
        result = await telnyxAction(call_control_id, "answer", {
          client_state: params.client_state,
          webhook_url: params.webhook_url,
        });
        break;
        
      case "hangup":
        // End a call
        result = await telnyxAction(call_control_id, "hangup", {
          cause: params.cause || "NORMAL_CLEARING",
        });
        break;
        
      case "reject":
        // Reject an incoming call
        result = await telnyxAction(call_control_id, "reject", {
          cause: params.cause || "CALL_REJECTED",
        });
        break;
        
      case "transfer":
        // Transfer call to another number
        result = await telnyxAction(call_control_id, "transfer", {
          to: params.to, // Required: destination number in E.164 format
          from: params.from,
          from_display_name: params.from_display_name,
          audio_url: params.audio_url, // Hold music during transfer
          timeout_secs: params.timeout_secs || 30,
          answering_machine_detection: params.answering_machine_detection,
          webhook_url: params.webhook_url,
        });
        break;
        
      case "bridge":
        // Bridge two calls together
        result = await telnyxAction(call_control_id, "bridge", {
          call_control_id: params.target_call_control_id,
          client_state: params.client_state,
          park_after_unbridge: params.park_after_unbridge,
        });
        break;
        
      // ===== AUDIO PLAYBACK (for AI responses) =====
      
      case "playback_start":
        // Play audio file (use for pre-recorded AI responses)
        result = await telnyxAction(call_control_id, "playback_start", {
          audio_url: params.audio_url, // Required: URL to audio file
          loop: params.loop || 1,
          overlay: params.overlay || false,
          target_legs: params.target_legs || "both",
          client_state: params.client_state,
        });
        break;
        
      case "playback_stop":
        // Stop audio playback
        result = await telnyxAction(call_control_id, "playback_stop", {
          stop: params.stop || "all",
        });
        break;
        
      // ===== TEXT-TO-SPEECH (for AI responses) =====
      
      case "speak":
        // Speak text using TTS (perfect for AI responses!)
        result = await telnyxAction(call_control_id, "speak", {
          payload: params.text || params.payload, // Required: text to speak
          voice: params.voice || "female", // male, female
          language: params.language || "en-US",
          payload_type: params.payload_type || "text", // text or ssml
          service_level: params.service_level || "basic", // basic or premium
        });
        break;
        
      // ===== DTMF (touch tones) =====
      
      case "send_dtmf":
        // Send DTMF tones
        result = await telnyxAction(call_control_id, "send_dtmf", {
          digits: params.digits, // Required: e.g., "1234#"
          duration_millis: params.duration_millis || 250,
        });
        break;
        
      // ===== GATHER INPUT (IVR) =====
      
      case "gather":
        // Collect DTMF digits
        result = await telnyxAction(call_control_id, "gather", {
          minimum_digits: params.minimum_digits || 1,
          maximum_digits: params.maximum_digits || 128,
          timeout_millis: params.timeout_millis || 60000,
          terminating_digit: params.terminating_digit || "#",
          inter_digit_timeout_millis: params.inter_digit_timeout_millis || 5000,
          initial_timeout_millis: params.initial_timeout_millis || 5000,
          valid_digits: params.valid_digits || "0123456789*#",
          client_state: params.client_state,
        });
        break;
        
      case "gather_using_speak":
        // Speak prompt and gather input
        result = await telnyxAction(call_control_id, "gather_using_speak", {
          payload: params.text || params.payload, // Required: prompt text
          voice: params.voice || "female",
          language: params.language || "en-US",
          minimum_digits: params.minimum_digits || 1,
          maximum_digits: params.maximum_digits || 128,
          terminating_digit: params.terminating_digit || "#",
          timeout_millis: params.timeout_millis || 60000,
        });
        break;
        
      case "gather_using_audio":
        // Play audio prompt and gather input
        result = await telnyxAction(call_control_id, "gather_using_audio", {
          audio_url: params.audio_url, // Required: prompt audio URL
          minimum_digits: params.minimum_digits || 1,
          maximum_digits: params.maximum_digits || 128,
          terminating_digit: params.terminating_digit || "#",
          timeout_millis: params.timeout_millis || 60000,
        });
        break;
        
      case "gather_stop":
        // Stop gathering
        result = await telnyxAction(call_control_id, "gather_stop", {});
        break;
        
      // ===== RECORDING =====
      
      case "record_start":
        // Start call recording
        result = await telnyxAction(call_control_id, "record_start", {
          format: params.format || "mp3", // mp3 or wav
          channels: params.channels || "single", // single or dual
          play_beep: params.play_beep !== false,
          max_length: params.max_length || 0, // 0 = no limit
          timeout_secs: params.timeout_secs || 0, // 0 = no silence timeout
        });
        break;
        
      case "record_stop":
        // Stop recording
        result = await telnyxAction(call_control_id, "record_stop", {});
        break;
        
      case "record_pause":
        // Pause recording
        result = await telnyxAction(call_control_id, "record_pause", {});
        break;
        
      case "record_resume":
        // Resume recording
        result = await telnyxAction(call_control_id, "record_resume", {});
        break;
        
      // ===== LIVE TRANSCRIPTION (for YOUR AI) =====
      
      case "transcription_start":
        // Start live transcription - feed to YOUR AI!
        result = await telnyxAction(call_control_id, "transcription_start", {
          language: params.language || "en", // Language code
          transcription_engine: params.transcription_engine || "A", // A or B
          interim_results: params.interim_results !== false, // Get partial results
          client_state: params.client_state,
        });
        break;
        
      case "transcription_stop":
        // Stop transcription
        result = await telnyxAction(call_control_id, "transcription_stop", {});
        break;
        
      // ===== AUDIO STREAMING (for YOUR AI) =====
      
      case "streaming_start":
        // Stream raw audio to YOUR AI backend via WebSocket!
        result = await telnyxAction(call_control_id, "streaming_start", {
          stream_url: params.stream_url, // Required: YOUR WebSocket endpoint
          stream_track: params.stream_track || "inbound", // inbound, outbound, both
          stream_bidirectional_mode: params.bidirectional ? "mp3" : undefined,
          enable_dialogflow: false, // We use OUR AI, not Dialogflow
          client_state: params.client_state,
        });
        break;
        
      case "streaming_stop":
        // Stop streaming
        result = await telnyxAction(call_control_id, "streaming_stop", {});
        break;
        
      // ===== AUDIO FORKING (alternative to streaming) =====
      
      case "fork_start":
        // Fork audio to external endpoint
        result = await telnyxAction(call_control_id, "fork_start", {
          target: params.target, // Required: RTP or UDP endpoint
          rx: params.rx, // Receive endpoint
          tx: params.tx, // Transmit endpoint
          stream_type: params.stream_type || "raw", // raw or decrypted
        });
        break;
        
      case "fork_stop":
        // Stop forking
        result = await telnyxAction(call_control_id, "fork_stop", {});
        break;
        
      // ===== NOISE SUPPRESSION =====
      
      case "suppression_start":
        // Start noise suppression
        result = await telnyxAction(call_control_id, "suppression_start", {
          direction: params.direction || "inbound", // inbound or both
        });
        break;
        
      case "suppression_stop":
        // Stop noise suppression
        result = await telnyxAction(call_control_id, "suppression_stop", {
          direction: params.direction || "inbound",
        });
        break;
        
      // ===== QUEUE MANAGEMENT =====
      
      case "enqueue":
        // Add call to queue
        result = await telnyxAction(call_control_id, "enqueue", {
          queue_name: params.queue_name, // Required
          max_wait_time_secs: params.max_wait_time_secs,
          audio_url: params.audio_url, // Hold music
        });
        break;
        
      case "leave_queue":
        // Remove from queue
        result = await telnyxAction(call_control_id, "leave_queue", {});
        break;
        
      // ===== CLIENT STATE =====
      
      case "client_state_update":
        // Update client state
        result = await telnyxAction(call_control_id, "client_state_update", {
          client_state: params.client_state, // Base64 encoded
        });
        break;
        
      // ===== SIP =====
      
      case "refer":
        // SIP REFER (blind transfer)
        result = await telnyxAction(call_control_id, "refer", {
          sip_address: params.sip_address, // Required
        });
        break;
        
      default:
        return NextResponse.json({ 
          error: `Unknown action: ${action}`,
          available_actions: [
            "answer", "hangup", "reject", "transfer", "bridge",
            "playback_start", "playback_stop", "speak",
            "send_dtmf", "gather", "gather_using_speak", "gather_using_audio", "gather_stop",
            "record_start", "record_stop", "record_pause", "record_resume",
            "transcription_start", "transcription_stop",
            "streaming_start", "streaming_stop",
            "fork_start", "fork_stop",
            "suppression_start", "suppression_stop",
            "enqueue", "leave_queue",
            "client_state_update", "refer"
          ]
        }, { status: 400 });
    }
    
    // Log action to database (multi-tenant)
    await logCallAction(org_id, call_control_id, action, params, result);
    
    return NextResponse.json({
      success: true,
      action,
      call_control_id,
      org_id: org_id || "default",
      result: result.data,
    });
    
  } catch (error) {
    console.error("[Call Control] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Call control action failed" 
    }, { status: 500 });
  }
}

/**
 * GET endpoint to list available actions
 */
export async function GET() {
  return NextResponse.json({
    message: "Telnyx Call Control API",
    usage: "POST with { call_control_id, action, ...params }",
    actions: {
      basic: {
        answer: "Answer incoming call",
        hangup: "End a call (cause: NORMAL_CLEARING, USER_BUSY, etc.)",
        reject: "Reject incoming call",
        transfer: "Transfer call to another number (to: +E.164)",
        bridge: "Bridge two calls (target_call_control_id)",
      },
      audio: {
        playback_start: "Play audio file (audio_url)",
        playback_stop: "Stop audio playback",
        speak: "Text-to-speech (text, voice, language)",
      },
      dtmf: {
        send_dtmf: "Send DTMF tones (digits)",
        gather: "Collect DTMF input",
        gather_using_speak: "TTS prompt + gather (text)",
        gather_using_audio: "Audio prompt + gather (audio_url)",
        gather_stop: "Stop gathering",
      },
      recording: {
        record_start: "Start recording (format: mp3/wav)",
        record_stop: "Stop recording",
        record_pause: "Pause recording",
        record_resume: "Resume recording",
      },
      ai_integration: {
        transcription_start: "Live transcription → feed to YOUR AI (language)",
        transcription_stop: "Stop transcription",
        streaming_start: "Stream audio to YOUR AI WebSocket (stream_url)",
        streaming_stop: "Stop streaming",
        fork_start: "Fork audio to RTP/UDP endpoint (target)",
        fork_stop: "Stop forking",
      },
      other: {
        suppression_start: "Noise suppression on",
        suppression_stop: "Noise suppression off",
        enqueue: "Add to queue (queue_name)",
        leave_queue: "Remove from queue",
        client_state_update: "Update call metadata",
        refer: "SIP REFER (sip_address)",
      },
    },
    example: {
      speak_ai_response: {
        call_control_id: "abc123",
        action: "speak",
        text: "Hello! How can I help you today?",
        voice: "female",
        language: "en-US",
      },
      stream_to_ai: {
        call_control_id: "abc123",
        action: "streaming_start",
        stream_url: "wss://your-ai-backend.com/audio-stream",
        stream_track: "inbound",
      },
    },
  });
}
