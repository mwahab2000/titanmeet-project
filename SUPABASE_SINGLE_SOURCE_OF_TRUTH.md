# Supabase Single Source of Truth

## Correct Project

| Field | Value |
|---|---|
| Project ID | `qclaciklevavttipztrv` |
| Project URL | `https://qclaciklevavttipztrv.supabase.co` |
| Dashboard | `https://supabase.com/dashboard/project/qclaciklevavttipztrv` |

All frontend code, Edge Functions, and deployment docs **must** reference this project exclusively.

## What Was Cleaned Up

| Item | Action |
|---|---|
| `project/` directory (stale copy with `agfsnvywlltiiigkatar`) | **Deleted** — contained a `config.toml` pointing to a different Supabase project and duplicate Edge Function source files |
| `DEPLOYMENT.md` line 95 | **Updated** — replaced `<your-supabase-project>` placeholder with `qclaciklevavttipztrv` |

## Files Already Correct (no changes needed)

- `.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` all reference `qclaciklevavttipztrv`
- `supabase/config.toml` — `project_id = "qclaciklevavttipztrv"`
- `src/integrations/supabase/client.ts` — reads from `VITE_SUPABASE_URL` env var
- All Edge Functions (`supabase/functions/*/index.ts`) — use `Deno.env.get("SUPABASE_URL")` (runtime secret, already set to the correct URL)
- Email templates — hardcoded logo URL uses `qclaciklevavttipztrv.supabase.co` storage bucket ✓
- `src/pages/public/PublicSurveyPage.tsx` — constructs URL from `VITE_SUPABASE_PROJECT_ID` ✓

## Required Environment Variables

### Frontend (`.env` / build env)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | `https://qclaciklevavttipztrv.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `qclaciklevavttipztrv` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key for the project |

### Edge Function Secrets (Supabase Dashboard → Settings → Edge Functions)

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Same project URL (auto-provided by Supabase) |
| `SUPABASE_ANON_KEY` | Anon key (auto-provided) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-provided) |
| `GMAIL_USER` | Google Workspace email for SMTP |
| `GMAIL_APP_PASSWORD` | App password for SMTP |
| `OPENAI_API_KEY` | AI assistant |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Billing |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | WhatsApp |
