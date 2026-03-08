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
| `TWILIO_ACCOUNT_SID` | ❌ MVP | Only for SMS/WhatsApp |
| `TWILIO_AUTH_TOKEN` | ❌ MVP | Only for SMS/WhatsApp |
| `TWILIO_PHONE_NUMBER` | ❌ MVP | Only for SMS/WhatsApp |
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
   `https://<your-supabase-project>.supabase.co/functions/v1/paypal-webhook`
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

### Frontend
1. Click **Publish** in Lovable editor (top-right)
2. Click **Update** in the publish dialog

### Backend (auto-deployed)
- Edge functions deploy automatically on save
- Database migrations apply when approved in chat

### Post-deploy manual steps
1. Verify all secrets are set in Supabase dashboard
2. Verify storage buckets exist (they should from migrations)
3. If using custom domain: configure DNS in Lovable Settings → Domains
4. **Wildcard subdomain**: configure DNS with `*.titanmeet.com` → A record pointing to your hosting IP
5. Set `VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com` in your build environment

---

## 7. Smoke Test Checklist

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

## 8. Known Limitations (MVP)

- Email via Gmail SMTP — subject to Google rate limits (~500/day)
- No QR check-in or ticketing
- PayPal payments only (no card processing directly, no auto-renewal for one-time)
- No public self-registration
- SMS/WhatsApp requires Twilio setup (not configured for MVP)
- OG images in `index.html` still reference Lovable defaults
- No automated test suite beyond basic example test
