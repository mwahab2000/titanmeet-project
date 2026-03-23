# TitanMeet — Replit Migration Notes

## Project Overview
TitanMeet is a full-featured corporate event management SaaS platform. It's a Vite/React/TypeScript frontend with Supabase for auth, database (PostgreSQL with RLS), and storage. Edge functions have been replaced by an Express.js server.

## Architecture

### Frontend (Vite + React)
- Built with Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- Supabase client SDK for auth and direct DB queries (RLS enforced)
- Runs on port **5000** in dev mode
- Proxy: `/api/*` → Express server on port 3000

### Backend (Express.js)
- `server/index.ts` — Express server that replaces Supabase Edge Functions
- Runs on port **3000**
- Routes:
  - `POST /api/webhooks/paddle` — Paddle billing webhook handler
  - `POST /api/functions/check-plan-limits` — Plan usage/limit checks
  - `POST /api/functions/send-event-invitations` — Email/WhatsApp invitations
  - `POST /api/functions/validate-discount` — Discount code validation
  - `POST /api/functions/ai-assistant` — AI features (OpenAI)
  - `POST /api/functions/event-concierge` — Attendee AI chatbot
  - `GET /api/health` — Health check

### Development
```bash
npm run dev   # Runs both Vite (port 5000) + Express (port 3000) concurrently
```

### Production Build (for deployment)
```bash
npm run build   # Builds Vite frontend to dist/
npm run start   # Express serves both API and static frontend
```

## Key Files
- `server/index.ts` — Express server with all API routes
- `src/integrations/supabase/client.ts` — Supabase client + `invokeEdgeFunction` helper that routes ported functions to local API
- `vite.config.ts` — Vite config with `/api` proxy to Express

## Environment Variables Needed
Set these as Replit secrets:
- `SUPABASE_SERVICE_ROLE_KEY` — For server-side Supabase admin access
- `OPENAI_API_KEY` — For AI features
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — For email invitations
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — For WhatsApp (optional)
- `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_KEY` — For billing

Already set as env vars:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

## Supabase
Supabase is kept for auth and DB — it's deeply embedded. The service uses Supabase's hosted Postgres with Row Level Security. The Neon Postgres DB provisioned in Replit is not actively used (Supabase handles all data).

## Migration Notes
- Removed: Lovable-tagger, Supabase edge function direct invocations
- Added: Express server replacing all key edge functions
- Kept: Supabase auth, Supabase DB (RLS), Supabase storage, Supabase realtime
