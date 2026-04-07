import { NextResponse } from "next/server";

/**
 * Telnyx API Overview
 * Lists all available Telnyx API endpoints in this project
 */
export async function GET() {
  return NextResponse.json({
    title: "Telnyx API Suite for AI-Powered Calling",
    description: "Complete API integration for connecting Telnyx calls to YOUR AI agent",
    
    endpoints: {
      // Authentication
      "/api/telnyx/token": {
        method: "POST",
        description: "Get JWT token for WebRTC client authentication",
        params: { connection_id: "Optional - defaults to env var" },
      },
      
      // Configuration
      "/api/telnyx/configure-webhook": {
        method: "POST",
        description: "Set webhook URL on credential connection",
        params: { connectionId: "string", webhookUrl: "string" },
      },
      
      "/api/telnyx/set-outbound-profile": {
        method: "POST",
        description: "Set outbound voice profile for calls",
        params: { connectionId: "string", profileId: "string" },
      },
      
      "/api/telnyx/assign-connection": {
        method: "POST",
        description: "Assign phone number to credential connection",
        params: { phoneNumberId: "string", connectionId: "string" },
      },
      
      // Diagnostics
      "/api/telnyx/diagnose": {
        method: "GET",
        description: "Check Telnyx account configuration (connections, profiles, numbers)",
      },
      
      "/api/telnyx/active-calls": {
        method: "GET",
        description: "List active calls and check webhook configuration",
        params: { connectionId: "Optional query param" },
      },
      
      // Call Control (MAIN API)
      "/api/telnyx/call-control": {
        method: "POST",
        description: "Execute call control actions",
        params: {
          call_control_id: "string (required)",
          action: "string (required)",
          "...params": "Action-specific parameters",
        },
        actions: {
          basic: ["answer", "hangup", "reject", "transfer", "bridge"],
          audio: ["playback_start", "playback_stop", "speak"],
          dtmf: ["send_dtmf", "gather", "gather_using_speak", "gather_using_audio", "gather_stop"],
          recording: ["record_start", "record_stop", "record_pause", "record_resume"],
          ai_integration: ["transcription_start", "transcription_stop", "streaming_start", "streaming_stop", "fork_start", "fork_stop"],
          other: ["suppression_start", "suppression_stop", "enqueue", "leave_queue"],
        },
      },
      
      // Webhook (receives events)
      "/api/telnyx/webhook": {
        method: "POST",
        description: "Receives call events from Telnyx",
        events: [
          "call.initiated",
          "call.answered", 
          "call.hangup",
          "call.bridged",
          "call.transcription",
          "call.streaming.started",
          "call.streaming.stopped",
          "call.recording.saved",
          "call.gather.ended",
          "call.speak.ended",
          "call.playback.ended",
        ],
      },
    },
    
    ai_integration_flow: {
      description: "How to connect Telnyx calls to YOUR AI agent",
      steps: [
        {
          step: 1,
          title: "Receive Inbound Call",
          action: "Webhook receives call.initiated (direction: incoming)",
        },
        {
          step: 2,
          title: "Answer Call",
          action: "POST /api/telnyx/call-control { action: 'answer', call_control_id }",
        },
        {
          step: 3,
          title: "Start Transcription OR Streaming",
          options: [
            "transcription_start → Get text via webhook → Process with your AI",
            "streaming_start → Stream audio to your WebSocket → Process with your AI",
          ],
        },
        {
          step: 4,
          title: "AI Responds",
          action: "POST /api/telnyx/call-control { action: 'speak', text: 'AI response' }",
        },
        {
          step: 5,
          title: "Loop",
          action: "Repeat steps 3-4 until conversation ends",
        },
      ],
    },
    
    example_ai_integration: {
      description: "Example: AI Agent answers and responds",
      code: `
// In your webhook handler when transcription arrives:
if (eventType === "call.transcription") {
  const transcript = payload.transcription_data.transcript;
  
  // Send to YOUR AI (Gemini, GPT, etc.)
  const aiResponse = await yourAI.chat(transcript);
  
  // Speak the AI response
  await fetch("/api/telnyx/call-control", {
    method: "POST",
    body: JSON.stringify({
      call_control_id: callControlId,
      action: "speak",
      text: aiResponse,
      voice: "female",
      language: "en-US",
    }),
  });
}
      `,
    },
    
    setup_checklist: {
      "1_env_vars": {
        TELNYX_API_KEY: "Your Telnyx API key",
        TELNYX_CONNECTION_ID: "Your credential connection ID",
        TELNYX_OUTBOUND_PROFILE_ID: "Your outbound voice profile ID",
      },
      "2_webhook_setup": {
        step: "Run ngrok and configure webhook URL",
        command: "ngrok http 3000",
        configure: "POST /api/telnyx/configure-webhook with your ngrok URL",
      },
      "3_test": {
        diagnose: "GET /api/telnyx/diagnose",
        active_calls: "GET /api/telnyx/active-calls",
      },
    },
  });
}
