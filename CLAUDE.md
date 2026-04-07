# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js Version Warning

This is **Next.js 16** — breaking changes exist from earlier versions. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices. Do not rely on training data for Next.js APIs.

---

## Commands

### Frontend (root)
```bash
npm run dev        # Start Next.js dev server (Turbopack) on :3000
npm run build      # Production build
npm run lint       # ESLint
```

### Backend server (`/server`)
```bash
cd server
npm run dev        # tsx watch — runs on :4000
npm run build      # tsc compile to dist/
npm run typecheck  # tsc --noEmit
```

### Chat widget package (`/packages/chat-widget`)
```bash
cd packages/chat-widget
npm run dev        # rollup watch
npm run build      # rollup production bundle
```

### Database migrations (`/supabase`)
```bash
supabase db push   # Apply migrations to remote
supabase db reset  # Reset local DB and re-run all migrations
```

---

## Architecture Overview

This is a **two-process** application: the Next.js frontend (`:3000`) and a standalone Express/WebSocket backend server (`:4000`). They are separate Node processes and must both be running for full functionality.

### How a Conversation Works

1. **Browser** opens a WebSocket to `ws://localhost:4000/ws?type=text_chat&agentId=...`
2. **`server/src/websocket/hub.ts`** routes the connection to the correct handler:
   - `type=text_chat` → `handlers/textChat.ts` → Gemini Chat API (REST)
   - `type=voice_chat` → `handlers/voiceChat.ts` → Gemini Live API (streaming audio)
   - `type=telnyx` → `handlers/telnyxBridge.ts` → PSTN call bridge
3. The handler loads agent config from Supabase, builds a Gemini request with tools/knowledge/memory, streams the response back, and persists the conversation to Supabase.

### Agent Configuration System

All agent config types and defaults live in **`lib/domain/agent-builder.ts`** (the single source of truth). This file defines:
- All config interfaces (`LiveApiConfig`, `BehaviorConfig`, `SpeechConfig`, `ToolsConfig`, `GuardrailsConfig`, etc.)
- `VOICE_OPTIONS` — 30 Gemini voices with official tone/description metadata
- `TOOL_OPTIONS`, `CHANNEL_OPTIONS`, language lists
- Default values for every config field

The frontend agent editor (`app/agents/[id]/`) reads/writes this config. The backend server (`server/`) reads the same config from Supabase when handling conversations.

### Auth & Multi-tenancy

- Auth is handled by **Supabase Auth** (email + Google OAuth).
- On first login, the frontend calls `POST /api/auth/bootstrap` which creates an `organizations` row and a `users` row scoped to that org.
- All Supabase tables have **Row-Level Security (RLS)** enforced via `org_id`. Server-side API routes use `lib/server/org-member.ts` to extract `orgId` from the session and pass it to every query.
- Never bypass RLS — always work through `org-member.ts` helpers in API routes.

### Next.js API Routes vs Backend Server

There are **two separate API surfaces**:

| Surface | Location | Auth | Purpose |
|---|---|---|---|
| Next.js API routes | `app/api/` | Supabase session (RLS) | Dashboard CRUD: agents, conversations, missions, contacts, analytics |
| Express backend | `server/src/routes/` | None / service role | Real-time: WebSocket hub, Telnyx webhooks, widget config (public) |

Do not confuse them. Widget and voice calls hit the Express server directly. Dashboard UI hits Next.js API routes.

### Knowledge Base (RAG)

- Documents are uploaded via `POST /api/knowledge-base/upload` → stored in **Vertex AI RAG corpus**.
- At conversation time, the backend server calls `lib/vertex-search.ts` to retrieve relevant chunks and injects them into the Gemini system prompt.
- Corpus management (create/delete) is in `lib/vertex-rag.ts` and `server/src/services/vertexRag.ts`.

### Missions (Outbound Campaigns)

Missions are outbound call campaigns. The flow: create a mission with contacts → `POST /api/missions/[id]/launch` → iterates contacts → triggers Telnyx outbound calls → each call bridges to the Gemini Live API via `telnyxBridge.ts` → results stored in `mission_calls` table.

### Multi-Agent Teams & Handoffs

- Teams and handoff rules are configured in `app/teams/` and stored in `agent_teams` / `handoff_rules` tables.
- At runtime, `server/src/gemini/handoff.ts` evaluates handoff conditions (keywords, intents) using `server/src/utils/expressionEvaluator.ts`.
- When a handoff triggers, the session switches to a different agent config mid-conversation, passing context variables.

### Embeddable Widget

`packages/chat-widget` compiles to `public/widget.js` (UMD bundle). It loads agent config from `GET /widget/config` on the Express server (no auth required — public endpoint keyed by `agentId`).

---

## Environment Variables

The frontend reads from `.env.local`. The backend server reads from `.env` in the repo root (loaded via `server/src/config/env.ts`).

**Required for frontend:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GEMINI_API_KEY
```

**Required for backend server (`:4000`):**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GEMINI_API_KEY
FRONTEND_URL          # defaults to http://localhost:3000
BACKEND_WS_URL        # defaults to ws://localhost:4000
```

**Optional integrations:**
```
COMPOSIO_API_KEY      # Tool integrations (Gmail, Slack, etc.)
TELNYX_API_KEY        # Phone/PSTN calls
TELNYX_API_SECRET
TELNYX_VOICE_APP_ID
GOOGLE_CLOUD_PROJECT  # Vertex AI RAG
```

---

## Key Conventions

- **Gemini models**: Use `gemini-3-flash-preview` (chat), `gemini-3.1-flash-live-preview` (Live/voice). Legacy `gemini-2.x` / `gemini-1.5-x` models are deprecated.
- **Tailwind CSS** is only used in `app/landing/` — the rest of the app uses Ant Design's CSS-in-JS theme system. Do not add Tailwind classes outside the `landing/` route.
- **`AntdStyleRegistry`** in `app/layout.tsx` extracts Ant Design CSS-in-JS at SSR time to prevent FOUC — do not remove it.
- **`lib/server/org-member.ts`** must be used in every Next.js API route to enforce org-scoped data access.
- The `server/` package has its own `tsconfig.json`, `package.json`, and `node_modules` — run its commands from inside `server/`, not the root.
