# TitanMeet — Deployment & Launch Checklist

## Prerequisites

- Lovable account with project connected to Supabase
- Google Workspace account with App Password for email sending
- PayPal Business account with API credentials
- Custom domain (optional, for `/{clientSlug}/{eventSlug}` routing)

---

## 1. Environment & Secrets

### Frontend (auto-populated by Lovable)
| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Auto-set |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Auto-set |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Auto-set |
| `VITE_PUBLIC_ROOT_DOMAIN` | ✅ | Root domain for subdomain routing (e.g. `titanmeet.com`) |

### Supabase Edge Function Secrets
| Secret | Required | Where to set |
|---|---|---|
| `GMAIL_USER` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `GMAIL_APP_PASSWORD` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `SEND_EMAIL_HOOK_SECRET` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `TWILIO_ACCOUNT_SID` | ❌ MVP | Twilio Account SID (starts with `AC…`) |
| `TWILIO_AUTH_TOKEN` | ❌ MVP | Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | ❌ MVP | WhatsApp sender, e.g. `whatsapp:+14155238886` |
| `PAYPAL_CLIENT_ID` | ✅ | PayPal Developer → API credentials |
| `PAYPAL_CLIENT_SECRET` | ✅ | PayPal Developer → API credentials |
| `PAYPAL_WEBHOOK_ID` | ✅ | PayPal Developer → Webhooks |
| `PAYPAL_API_BASE` | ✅ | `https://api-m.sandbox.paypal.com` (sandbox) or `https://api-m.paypal.com` (live) |
| `PAYPAL_SUCCESS_URL` | ❌ | Defaults to `/dashboard/billing?payment=success` |
| `PAYPAL_CANCEL_URL` | ❌ | Defaults to `/dashboard/billing?payment=cancelled` |
| `PAYPAL_PLAN_ID_STARTER` | ✅ Sub | PayPal subscription plan ID for Starter tier |
| `PAYPAL_PLAN_ID_PROFESSIONAL` | ✅ Sub | PayPal subscription plan ID for Professional tier |
| `PAYPAL_PLAN_ID_ENTERPRISE` | ✅ Sub | PayPal subscription plan ID for Enterprise tier |

---

## 2. Database

All migrations are managed via Lovable's migration tool. They auto-apply when approved.

Key tables: `events`, `attendees`, `clients`, `rsvp_tokens`, `communications_log`, `speakers`, `organizers`, `agenda_items`, `announcements`, `dress_codes`, `surveys`, `transport_*`, `user_roles`, `profiles`, `payment_intents`, `payment_events`, `account_subscriptions`, `account_entitlements`.

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
| `send-email` | Yes | Send invitation/reminder emails |
| `send-communication` | Yes | Multi-channel comms (email/SMS/WhatsApp) |
| `paypal-create-order` | No* | Create PayPal one-time order (*validates JWT in code) |
| `paypal-capture-order` | No* | Capture PayPal order after approval (*validates JWT in code) |
| `paypal-create-subscription` | No* | Create PayPal monthly subscription (*validates JWT in code) |
| `paypal-webhook` | No | Receive PayPal payment webhooks (signature verified) |

Edge functions deploy automatically via Lovable.

---

## 5. PayPal Setup

### One-time payments
No extra setup needed — uses PayPal Orders API.

### Monthly subscriptions
1. Create a Product in PayPal Developer dashboard
2. Create Billing Plans for each tier (Starter, Professional, Enterprise)
3. Set the plan IDs as secrets: `PAYPAL_PLAN_ID_STARTER`, etc.

### Webhooks
1. In PayPal Developer → Webhooks, create a webhook pointing to:
   `https://qclaciklevavttipztrv.supabase.co/functions/v1/paypal-webhook`
2. Subscribe to events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.PAYMENT.COMPLETED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
3. Copy the Webhook ID and set as `PAYPAL_WEBHOOK_ID` secret

---

## 6. Deploy Steps

### Option A: Lovable Publish (staging)
1. Click **Publish** in Lovable editor (top-right)
2. Click **Update** in the publish dialog

### Option B: Google Cloud Run (production)
See **[deploy/CLOUD_RUN_DEPLOYMENT.md](deploy/CLOUD_RUN_DEPLOYMENT.md)** for full instructions:
- Multi-stage Dockerfile with Nginx SPA fallback
- HTTPS Load Balancer with wildcard SSL (`*.titanmeet.com`)
- GoDaddy DNS A records (`@`, `www`, `*`) → static IP

### Backend (auto-deployed)
- Edge functions deploy automatically on save
- Database migrations apply when approved in chat

### Post-deploy manual steps
1. Verify all secrets are set in Supabase dashboard
2. Verify storage buckets exist (they should from migrations)
3. If using custom domain: configure DNS in Lovable Settings → Domains
4. **Wildcard subdomain**: configure DNS with `*.titanmeet.com` → A record pointing to your LB static IP
5. Set `VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com` in your build environment

---

## 7. Wildcard Subdomain Hosting

Public event pages are served at `{clientSlug}.titanmeet.com/{eventSlug}`.

### DNS

- Add a **wildcard A record**: `*.titanmeet.com` → your hosting IP (e.g. `185.158.133.1`)
- Add root A records for `titanmeet.com` and `www.titanmeet.com` as usual
- A **wildcard SSL certificate** (e.g. via Let's Encrypt) is required

### SPA Rewrite

All paths must rewrite to `index.html` so client-side routing works on direct page loads / refresh. Configure your hosting provider accordingly (e.g. Lovable handles this automatically; for Nginx add `try_files $uri /index.html`).

### How It Works

1. `getClientSlugFromHostname()` in `src/lib/subdomain.ts` extracts the client slug from the hostname
2. If a client slug is detected, the app renders subdomain-mode routes (`/:eventSlug`)
3. If no client slug (main domain, localhost, `*.lovable.app`), the full dashboard + path-based public routes are rendered
4. Reserved subdomains (`www`, `app`, `api`, `admin`) are excluded from client resolution

### Test Checklist

1. Open `titanmeet.com` → main site / landing page
2. Open `acme.titanmeet.com/board-meeting` → loads correct event
3. Wrong clientSlug (e.g. `nonexistent.titanmeet.com/x`) → "Client not found" / 404
4. Wrong eventSlug (e.g. `acme.titanmeet.com/no-such-event`) → "Event not found" / 404
5. Refresh on `/{eventSlug}` works (SPA rewrite enabled)
6. `www.titanmeet.com` → main site (not treated as client slug)

---

## 8. Smoke Test Checklist

- [ ] Sign in with email/password
- [ ] Create a client
- [ ] Create an event under that client
- [ ] Fill hero image, title, slug, date, description, venue
- [ ] Preview draft event (Website → Preview Public Page)
- [ ] Publish event (all checklist items green)
- [ ] Open public page `/{clientSlug}/{eventSlug}`
- [ ] Add attendees (manual + CSV import)
- [ ] Send invitation email
- [ ] Click RSVP link → confirm attendance
- [ ] Verify attendee status updates to "Confirmed"
- [ ] Export attendees CSV
- [ ] Verify anonymous user cannot access draft event
- [ ] **PayPal one-time**: purchase → access active for 30 days
- [ ] **PayPal subscription**: subscribe → access active, cancel → access until period end
- [ ] **Billing UI**: shows correct access status, payment history, renewal prompts

---

## 8. Google Workspace Email Setup

To send invitation and reminder emails via Google Workspace SMTP:

### Prerequisites
- A Google Workspace account (or personal Gmail with App Passwords enabled)
- 2-Step Verification must be **enabled** on the sending account

### Steps

1. **Enable 2-Step Verification**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Under "Signing in to Google", enable **2-Step Verification**
   - If using Google Workspace, the admin must allow 2-Step Verification in Admin Console → Security → Authentication settings

2. **Generate an App Password**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select app: "Mail", device: "Other (TitanMeet)"
   - Copy the generated 16-character password

3. **Set Supabase Edge Function Secrets**
   - Go to Supabase → Settings → Edge Functions → Secrets
   - Add:
     - `GMAIL_USER` = your Google Workspace email (e.g., `events@yourdomain.com`)
     - `GMAIL_APP_PASSWORD` = the 16-character App Password from step 2

### Common Issues

| Symptom | Fix |
|---|---|
| "Email not configured" toast | `GMAIL_USER` or `GMAIL_APP_PASSWORD` secret is missing |
| "SMTP authentication failed" | Wrong password (use App Password, not account password), or 2FA not enabled |
| "Username and Password not accepted" | Admin may have disabled "Less secure apps" / App Passwords in Workspace admin |
| Emails go to spam | Set up SPF/DKIM for your domain in Google Workspace Admin |

### Verification

After setting secrets, send a test invitation from the Attendees screen. Check the Edge Function logs if issues persist:
`Supabase → Edge Functions → send-event-invitations → Logs`

---

## 9. Twilio WhatsApp Setup

### Secrets Required

| Secret | Format | Example |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Starts with `AC` | `AC1234567890abcdef1234567890abcdef` |
| `TWILIO_AUTH_TOKEN` | 32-char hex | `abcdef1234567890abcdef1234567890` |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+E.164` | `whatsapp:+14155238886` |

Set all three in **Supabase → Settings → Edge Functions → Secrets**.

### Sandbox Mode (Testing)

1. In Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Recipients must **opt in** by sending "join <sandbox-keyword>" to the Twilio sandbox number
3. Sandbox sender is typically `whatsapp:+14155238886`
4. Only opted-in numbers can receive messages — others get a silent failure

### Production Sender

1. Register a WhatsApp Business Profile in Twilio Console → Senders → WhatsApp Senders
2. Submit message templates for approval (Twilio requires pre-approved templates for business-initiated messages)
3. Update `TWILIO_WHATSAPP_FROM` to your approved sender number (e.g. `whatsapp:+1XXXXXXXXXX`)
4. No recipient opt-in needed for template messages; freeform messages require a 24h conversation window

### Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| "Messaging service unavailable" | One or more Twilio secrets missing — check all three are set |
| `21608` error (sandbox) | Recipient hasn't opted in — send "join <keyword>" first |
| `63016` error | Template not approved or wrong format for production |
| Messages sent but not received | Check Twilio Console → Monitor → Logs for delivery status |
| `21211` invalid To number | Mobile must be E.164 format with country code (e.g. `+971501234567`) |

---

## 10. Known Limitations (MVP)

- Email via Gmail SMTP — subject to Google rate limits (~500/day)
- No QR check-in or ticketing
- PayPal payments only (no card processing directly, no auto-renewal for one-time)
- No public self-registration
- OG images in `index.html` still reference Lovable defaults
- No automated test suite beyond basic example test
