# TitanMeet — Deployment & Launch Checklist

## Prerequisites

- Lovable account with project connected to Supabase
- Google Workspace account with App Password for email sending
- Custom domain (optional, for `/{clientSlug}/{eventSlug}` routing)

---

## 1. Environment & Secrets

### Frontend (auto-populated by Lovable)
| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Auto-set |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Auto-set |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Auto-set |

### Supabase Edge Function Secrets
| Secret | Required | Where to set |
|---|---|---|
| `GMAIL_USER` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `GMAIL_APP_PASSWORD` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `SEND_EMAIL_HOOK_SECRET` | ✅ | Supabase → Settings → Edge Functions → Secrets |
| `TWILIO_ACCOUNT_SID` | ❌ MVP | Only for SMS/WhatsApp |
| `TWILIO_AUTH_TOKEN` | ❌ MVP | Only for SMS/WhatsApp |
| `TWILIO_PHONE_NUMBER` | ❌ MVP | Only for SMS/WhatsApp |
| `TRIPLEA_CLIENT_ID` | ✅ Crypto | Triple-A dashboard → API credentials |
| `TRIPLEA_CLIENT_SECRET` | ✅ Crypto | Triple-A dashboard → API credentials |
| `TRIPLEA_MERCHANT_ID` | ✅ Crypto | Triple-A dashboard → Merchant key |
| `TRIPLEA_WEBHOOK_SECRET` | ✅ Crypto | Triple-A dashboard → Webhook config |
| `TRIPLEA_SUCCESS_URL` | ❌ | Defaults to `/dashboard/billing?payment=success` |
| `TRIPLEA_CANCEL_URL` | ❌ | Defaults to `/dashboard/billing?payment=cancelled` |

---

## 2. Database

All migrations are managed via Lovable's migration tool. They auto-apply when approved.

Key tables: `events`, `attendees`, `clients`, `rsvp_tokens`, `communications_log`, `speakers`, `organizers`, `agenda_items`, `announcements`, `dress_codes`, `surveys`, `transport_*`, `user_roles`, `profiles`.

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
| `create-triplea-payment` | No* | Create crypto payment intent (*validates JWT in code) |
| `triplea-webhook` | No | Receive Triple-A payment status webhooks |

Edge functions deploy automatically via Lovable.

---

## 5. Deploy Steps

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

---

## 6. Smoke Test Checklist

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
- [ ] Verify anonymous user cannot access private assets

---

## 7. Known Limitations (MVP)

- Email via Gmail SMTP — subject to Google rate limits (~500/day)
- No QR check-in or ticketing
- Crypto payments via Triple-A (no card processing, no auto-renewal, no refunds yet)
- No public self-registration
- SMS/WhatsApp requires Twilio setup (not configured for MVP)
- OG images in `index.html` still reference Lovable defaults
- No automated test suite beyond basic example test
