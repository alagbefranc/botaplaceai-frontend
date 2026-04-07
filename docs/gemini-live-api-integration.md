# Gemini Live API Integration Guide

This document outlines how to integrate the Gemini Live API into the omnichannel AI agent platform for real-time voice and video interactions.

## Overview

The Gemini Live API enables low-latency, real-time voice and video interactions with Gemini models. It processes continuous streams of audio, video, or text to deliver immediate, human-like spoken responses.

**Reference repo:** `gemini-live-api-examples` (cloned to `../gemini-live-api-examples`)

## Key Features Relevant to Our Platform

| Feature | Description | Platform Use Case |
|---------|-------------|-------------------|
| **Multilingual support** | 70 supported languages | Global customer support agents |
| **Barge-in** | Users can interrupt the model | Natural phone/voice conversations |
| **Tool use** | Function calling + Google Search | Connect to Gmail, Calendar, Stripe, HubSpot, etc. |
| **Audio transcriptions** | Text transcripts of input/output | Conversation logging in `/conversations` |
| **Affective dialog** | Adapts tone to user expression | Empathetic support agents |

## Technical Specifications

| Category | Details |
|----------|---------|
| Input modalities | Audio (16-bit PCM, 16kHz), images/video (JPEG ≤1FPS), text |
| Output modalities | Audio (16-bit PCM, 24kHz), text |
| Protocol | Stateful WebSocket (WSS) |

## Integration Architecture

### Option A: Python Backend (Recommended)

Based on `gemini-live-genai-python-sdk/`:

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     SDK      ┌─────────────────┐
│  Next.js App    │ ◄──────────────────► │  FastAPI/Python │ ◄───────────► │  Gemini Live    │
│  (Frontend)     │    audio/video      │  Backend        │              │  API            │
└─────────────────┘                     └─────────────────┘              └─────────────────┘
```

**Pros:**
- Gen AI SDK handles connection management
- Easier tool integration via Python
- Robust async handling with asyncio

**Files to reference:**
- `gemini_live.py` — `GeminiLive` class wrapping `genai.Client`
- `main.py` — FastAPI WebSocket endpoint
- `frontend/media-handler.js` — PCM audio capture/playback

### Option B: Ephemeral Tokens + Direct WebSocket

Based on `gemini-live-ephemeral-tokens-websocket/`:

```
┌─────────────────┐   POST /api/token   ┌─────────────────┐
│  Next.js App    │ ───────────────────► │  Python Server  │
│  (Frontend)     │ ◄─────────────────── │  (token issuer) │
└────────┬────────┘   { token, expires } └─────────────────┘
         │
         │ Direct WebSocket (WSS)
         ▼
┌─────────────────┐
│  Gemini Live    │
│  API            │
└─────────────────┘
```

**Pros:**
- Frontend connects directly to Gemini (lower latency)
- Backend only issues tokens (simpler)
- Better for browser-only voice widget

**Files to reference:**
- `server.py` — Token generation endpoint
- `frontend/` — Direct WebSocket client

### Option C: Node.js Backend

Based on `command-line/node/`:

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({});
const session = await ai.live.connect({
  model: 'gemini-3.1-flash-live-preview',
  config: { responseModalities: [Modality.AUDIO] },
  callbacks: { onmessage: (msg) => handleResponse(msg) }
});

session.sendRealtimeInput({
  audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" }
});
```

**Pros:**
- Same language as Next.js
- Can run in API routes or Edge Functions

## Recommended Integration for Omnichannel Platform

### Phase 1: Web Voice Channel (`web_voice`)

1. **Add Python microservice** for Gemini Live sessions
   - FastAPI server with WebSocket endpoint
   - Use `GeminiLive` class pattern from examples
   - Configure voice from agent's `voice` field (e.g., "Puck", "Charon")

2. **Frontend integration**
   - Port `MediaHandler` class to React component
   - Connect via WebSocket to Python backend
   - Handle PCM audio capture (16kHz) and playback (24kHz)

3. **Tool integration**
   - Map agent's `tools` array to Gemini function declarations
   - Execute tool calls via existing Composio connections

### Phase 2: Phone Channel (`phone`)

1. **Telnyx + Gemini bridge**
   - Receive inbound calls via Telnyx WebSocket
   - Forward audio stream to Gemini Live session
   - Return Gemini audio to caller

2. **Session management**
   - Track active calls in database
   - Log transcriptions to `messages` table

### Voice Configuration Mapping

Current `VOICE_OPTIONS` in `lib/domain/agent-builder.ts` already use Gemini voice names:

```typescript
// These map directly to Gemini Live API voice names
{ name: "Puck", tone: "Friendly", ... }
{ name: "Charon", tone: "Deep", ... }
{ name: "Kore", tone: "Neutral", ... }
// ... 30 total voices
```

Configure in session:

```python
config = types.LiveConnectConfig(
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name=agent.voice  # "Puck", "Charon", etc.
            )
        )
    ),
    system_instruction=types.Content(
        parts=[types.Part(text=agent.system_prompt)]
    ),
    tools=agent_tools,  # Function declarations
)
```

## Environment Variables

Add to `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
```

## Next Steps

1. [ ] Create `services/gemini-live/` Python microservice
2. [ ] Add WebSocket proxy route in Next.js (`/api/voice/ws`)
3. [ ] Build `VoiceChat` React component with `MediaHandler`
4. [ ] Wire tool calls to existing Composio integrations
5. [ ] Add conversation transcription logging
6. [ ] Integrate with Telnyx for phone channel

## References

- [Gemini Live API Guide](https://ai.google.dev/gemini-api/docs/live-guide)
- [Live API Tools](https://ai.google.dev/gemini-api/docs/live-tools)
- [Supported Languages](https://ai.google.dev/gemini-api/docs/live-guide#supported-languages)
- [Partner Integrations](https://github.com/google-gemini/gemini-live-api-examples#partner-integrations) (LiveKit, Pipecat, Voximplant)
