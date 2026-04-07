# Omnichannel AI Agent Platform

Next.js + Ant Design SaaS platform for building and operating AI agents across chat, voice, phone, and connected apps.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TypeScript + Ant Design 6 + @ant-design/charts
- **Database**: Supabase (Auth + Postgres + RLS)
- **State**: Zustand
- **AI**: Google Gemini API
- **Deployment**: Docker / Fly.io / Vercel

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required - AI
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Optional - Voice Provider (server-side only)
VOICE_PROVIDER_API_KEY=your-voice-api-key

# Optional - Tool Integrations (server-side only)
TOOL_INTEGRATION_API_KEY=your-tool-api-key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard + AI chat builder |
| `/agents` | Agent management |
| `/conversations` | Transcript explorer |
| `/apps` | Connected apps |
| `/phone-numbers` | Voice line provisioning |
| `/analytics` | Usage analytics |
| `/settings` | Organization settings |

## Embeddable Widget

Add the chat widget to any website:

```html
<script src="https://your-domain.com/widget.js" data-agent-id="your-agent-id"></script>
```

The widget:
- Loads agent config automatically
- Supports text chat with streaming responses
- Includes voice input UI (placeholder)
- Uses Shadow DOM for style isolation
- Stores session in sessionStorage

## Database Setup

Migration files in `supabase/migrations/`:

1. `001_initial_schema.sql` — Core tables with RLS enabled
2. `002_rls_policies.sql` — Row-level security policies

Apply via Supabase CLI:

```bash
supabase db push
```

## Deployment

### Docker

```bash
docker build -t ai-agent-platform .
docker run -p 3000:3000 --env-file .env.local ai-agent-platform
```

### Fly.io

```bash
fly launch
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_GEMINI_API_KEY=...
fly deploy
```

### Vercel

```bash
vercel --prod
```

## Architecture Notes

- **Auth**: Modal-only, powered by Supabase (email + Google OAuth)
- **Guest Mode**: Users can build one agent before signing up
- **Protected Actions**: Save/deploy/connect trigger auth modal
- **Bootstrap**: `POST /api/auth/bootstrap` creates org + user for new accounts
- **RLS**: All tables have row-level security scoped to `org_id`
- **Widget API**: Public endpoints at `/api/widget/config` and `/api/widget/chat`

## API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/agents` | GET/POST/DELETE | Required | Agent CRUD |
| `/api/conversations` | GET | Required | Conversation list/detail |
| `/api/dashboard` | GET | Required | Dashboard stats |
| `/api/apps` | GET | Required | Connected apps |
| `/api/apps/connect` | POST | Required | Initiate app connection |
| `/api/voice-lines` | GET | Required | Voice line list |
| `/api/voice-lines/provision` | POST | Required | Provision voice line |
| `/api/builder/chat` | POST | None | AI builder chat (streaming) |
| `/api/widget/config` | GET | None | Public agent config |
| `/api/widget/chat` | POST | None | Public chat (streaming) |
| `/api/auth/bootstrap` | POST | Required | Create org for new user |
