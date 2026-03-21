# TitanMeet — Deployment & Launch Checklist

## Prerequisites

- Lovable account with project connected to Supabase
- Google Workspace account with App Password for email sending
- Paddle account with API credentials (sole billing provider)
- Custom domain (for `clientslug.titanmeet.com/eventSlug` routing)

## Setup

1. Copy `.env.example` to `.env` and fill in your values
2. **Never** commit `.env` to the repository

---

## 1. Environment & Secrets

### Frontend (set in `.env` or as Docker build args)

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Your Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Your Supabase project ID |
| `VITE_PUBLIC_ROOT_DOMAIN` | ✅ | Root domain for subdomain routing (e.g. `titanmeet.com`) |
| `VITE_PADDLE_CLIENT_TOKEN` | ✅ | Paddle client-side token |
| `VITE_PADDLE_ENV` | ✅ | `sandbox` or `production` |
| `VITE_PADDLE_PRICE_STARTER_MONTHLY` | ✅ | Paddle Price ID |
| `VITE_PADDLE_PRICE_STARTER_ANNUAL` | ✅ | Paddle Price ID |
| `VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY` | ✅ | Paddle Price ID |
| `VITE_PADDLE_PRICE_PROFESSIONAL_ANNUAL` | ✅ | Paddle Price ID |
| `VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY` | ✅ | Paddle Price ID |
| `VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL` | ✅ | Paddle Price ID |

### Supabase Edge Function Secrets

| Secret | Required | Notes |
|---|---|---|
| `PADDLE_API_KEY` | ✅ | Server-side API key from Paddle dashboard |
| `PADDLE_WEBHOOK_SECRET` | ✅ | Webhook HMAC secret — **mandatory** (webhook rejects without it) |
| `PADDLE_PRICE_STARTER_MONTHLY` | ✅ | Server-side price ID for webhook plan resolution |
| `PADDLE_PRICE_STARTER_ANNUAL` | ✅ | Server-side price ID |
| `PADDLE_PRICE_PROFESSIONAL_MONTHLY` | ✅ | Server-side price ID |
| `PADDLE_PRICE_PROFESSIONAL_ANNUAL` | ✅ | Server-side price ID |
| `PADDLE_PRICE_ENTERPRISE_MONTHLY` | ✅ | Server-side price ID |
| `PADDLE_PRICE_ENTERPRISE_ANNUAL` | ✅ | Server-side price ID |
| `GMAIL_USER` | ✅ | SMTP sender address |
| `GMAIL_APP_PASSWORD` | ✅ | Google App Password |
| `SEND_EMAIL_HOOK_SECRET` | ✅ | Auth email hook verification |
| `OPENAI_API_KEY` | ✅ | For AI assistant |
| `AI_MODEL` | ✅ | OpenAI model (e.g. `gpt-4o-mini`) |
| `VITE_APP_URL` | ✅ | Public app URL for email links |
| `TWILIO_ACCOUNT_SID` | ❌ MVP | Twilio SID |
| `TWILIO_AUTH_TOKEN` | ❌ MVP | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | ❌ MVP | WhatsApp sender |
| `TWILIO_WHATSAPP_INVITE_TEMPLATE_SID` | ❌ MVP | Content Template SID |
| `TWILIO_WHATSAPP_REMINDER_TEMPLATE_SID` | ❌ MVP | Content Template SID |

---

## 2. Database

All migrations are managed via Lovable's migration tool. They auto-apply when approved.

Key tables: `events`, `attendees`, `clients`, `rsvp_tokens`, `communications_log`, `speakers`, `organizers`, `agenda_items`, `announcements`, `dress_codes`, `surveys`, `transport_*`, `user_roles`, `profiles`, `payment_intents`, `payment_events`, `account_subscriptions`, `account_entitlements`, `inbound_messages`, `message_logs`.

---

## 3. Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `event-assets` | No | Hero images, gallery, speaker photos |
| `dress-code-images` | No | Dress code reference images |
| `client-assets` | Yes (read) | Client logos |
| `email-assets` | Yes | Logo for auth emails |
| `TitanMeet` | No | General storage |

Private buckets are served via the `serve-event-asset` Edge Function proxy.

---

## 4. Edge Functions

| Function | JWT | Purpose |
|---|---|---|
| `auth-email-hook` | No | Branded signup/recovery emails |
| `serve-event-asset` | No | Proxy private storage for public events |
| `confirm-rsvp` | No | RSVP confirmation via token |
| `send-event-invitations` | No | Send invitation emails/WhatsApp |
| `invite-get` | No | Fetch invite details by token |
| `paddle-webhook` | No | Receive Paddle payment webhooks |
| `paddle-cancel-subscription` | No | Cancel Paddle subscription |
| `schedule-plan-change` | No | Schedule plan downgrade |
| `cancel-downgrade` | No | Cancel scheduled downgrade |
| `check-plan-limits` | No | Validate plan limits |
| `ai-assistant` | No | AI chat assistant |
| `twilio-whatsapp-inbound` | No | Receive inbound WhatsApp messages |
| `twilio-status-callback` | No | Twilio delivery status updates |
| `send-communication` | No | Send event communications |
| `send-notification-email` | No | Email notifications for support |
| `onboarding-email-trigger` | No | Onboarding drip emails |
| `process-email-queue` | No | Process queued emails |
| `send-survey-links` | No | Send survey invitation links |
| `survey-api` | No | Public survey submission |
| `send-email` | No | Generic email sending |

Edge functions deploy automatically via Lovable.

---

## 5. Paddle Setup

1. Create Products and Price IDs in Paddle dashboard for each tier (Starter, Professional, Enterprise) × (Monthly, Annual)
2. Set frontend price IDs as env vars: `VITE_PADDLE_PRICE_STARTER_MONTHLY`, etc.
3. Set **matching server-side** price IDs as Supabase secrets: `PADDLE_PRICE_STARTER_MONTHLY`, etc.
4. Set `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` as Supabase secrets
5. Configure webhook URL: `https://<PROJECT_ID>.supabase.co/functions/v1/paddle-webhook`
6. Subscribe to events: `transaction.completed`, `subscription.activated`, `subscription.renewed`, `subscription.updated`, `subscription.canceled`, `transaction.payment_failed`

---

## 6. Deploy

### Option A: Lovable Publish (staging)
1. Click **Publish** in Lovable editor
2. Click **Update** in the publish dialog

### Option B: Google Cloud Run (production)
See **[deploy/CLOUD_RUN_DEPLOYMENT.md](deploy/CLOUD_RUN_DEPLOYMENT.md)** for full instructions.

### Post-deploy steps
1. Verify all secrets are set in Supabase dashboard
2. Verify storage buckets exist
3. Configure DNS with `*.titanmeet.com` → A record pointing to your LB static IP
4. Set `VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com` in your build environment

---

## 7. Wildcard Subdomain Hosting

Public event pages are served at `{clientSlug}.titanmeet.com/{eventSlug}`.

### DNS
- Add a **wildcard A record**: `*.titanmeet.com` → your hosting IP
- Add root A records for `titanmeet.com` and `www.titanmeet.com`
- A **wildcard SSL certificate** is required

### How It Works
1. `getClientSlugFromHostname()` extracts the client slug from the hostname
2. If a client slug is detected, the app renders subdomain-mode routes
3. Reserved subdomains (`www`, `app`, `api`, `admin`) are excluded

---

## 8. Smoke Test Checklist

- [ ] Sign in with email/password
- [ ] Create a client
- [ ] Create an event under that client
- [ ] Fill hero image, title, slug, date, description, venue
- [ ] Preview draft event
- [ ] Publish event
- [ ] Open public page `clientslug.titanmeet.com/eventSlug`
- [ ] Add attendees (manual + CSV import)
- [ ] Send invitation email
- [ ] Click RSVP link → confirm attendance
- [ ] Verify attendee status updates to "Confirmed"
- [ ] Export attendees CSV
- [ ] Verify anonymous user cannot access draft event
- [ ] **Paddle subscription**: subscribe → verify entitlement active
- [ ] **Paddle cancellation**: cancel → access until period end
- [ ] **Billing UI**: shows correct plan, payment history

---

## 9. Known Limitations (MVP)

- Email via Gmail SMTP — subject to Google rate limits (~500/day)
- No QR check-in or ticketing
- No public self-registration
- No automated test suite beyond basic example test
