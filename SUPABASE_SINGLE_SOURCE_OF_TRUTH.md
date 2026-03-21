# Supabase Single Source of Truth

## Project Setup

| Field | Value |
|---|---|
| Project ID | Set in `VITE_SUPABASE_PROJECT_ID` |
| Project URL | Set in `VITE_SUPABASE_URL` |
| Dashboard | `https://supabase.com/dashboard/project/<YOUR_PROJECT_ID>` |

All frontend code, Edge Functions, and deployment docs **must** reference this project exclusively.

## Required Environment Variables

### Frontend (`.env`)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
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

## Setup Instructions

1. Copy `.env.example` to `.env`
2. Fill in your project-specific values
3. Never commit `.env` to the repository
