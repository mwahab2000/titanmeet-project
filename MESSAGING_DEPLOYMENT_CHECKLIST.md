# TitanMeet — Messaging Deployment Checklist

> Concise, production-oriented verification for email and WhatsApp delivery.

---

## 1. Supabase Project

| Check | Expected |
|-------|----------|
| Project URL | `https://qclaciklevavttipztrv.supabase.co` |
| Dashboard | [supabase.com/dashboard/project/qclaciklevavttipztrv](https://supabase.com/dashboard/project/qclaciklevavttipztrv) |

---

## 2. Required Edge Function Secrets

### Email (Gmail SMTP)

| Secret | Format / Notes |
|--------|---------------|
| `GMAIL_USER` | Full Google Workspace address, e.g. `events@titanmeet.com` |
| `GMAIL_APP_PASSWORD` | 16-char App Password (not the account password). Requires 2-Step Verification enabled on the Google account. Generate at *Google Account → Security → App Passwords*. |

### WhatsApp (Twilio)

| Secret | Format / Notes |
|--------|---------------|
| `TWILIO_ACCOUNT_SID` | Starts with `AC…` — found on the Twilio Console dashboard. |
| `TWILIO_AUTH_TOKEN` | Paired with the SID above. |
| `TWILIO_WHATSAPP_FROM` | Must include prefix: `whatsapp:+14155238886` (sandbox) or your approved production number. |

### Verify secrets are set

```
Supabase Dashboard → Settings → Edge Functions → Secrets
```

Or visit: <https://supabase.com/dashboard/project/qclaciklevavttipztrv/settings/functions>

---

## 3. Edge Function Deployment

### Required functions

- `send-event-invitations`
- `send-communication`
- `send-survey-links`
- `confirm-rsvp`
- `invite-get`

### Verify deployment

```
Supabase Dashboard → Edge Functions
```

Or visit: <https://supabase.com/dashboard/project/qclaciklevavttipztrv/functions>

Each function should show **Active** status with a recent deployment timestamp.

---

## 4. Frontend Environment

Verify these are set in the `.env` file (auto-populated by Lovable):

| Variable | Expected |
|----------|----------|
| `VITE_SUPABASE_URL` | `https://qclaciklevavttipztrv.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Starts with `eyJ…` (anon key) |
| `VITE_SUPABASE_PROJECT_ID` | `qclaciklevavttipztrv` |

Quick browser console check (on the running app):

```js
console.log(import.meta.env.VITE_SUPABASE_URL);
```

---

## 5. Test: Single Attendee by Email

1. Open an event workspace → **Invitations** tab.
2. Click **Generate Invites** (if no invites exist yet).
3. **Admin Debug tab** (visible to admins only):
   - Select the target attendee from the dropdown.
   - Check **Email** channel only.
   - Click **Dry Run (Validate)** — confirm all flags show ✓.
   - Click **Test Send** — verify toast shows `1 email`.
4. Check the attendee's inbox for the invitation email.

---

## 6. Test: Single Attendee by WhatsApp

> **Sandbox prerequisite:** The recipient must first send `join <sandbox-keyword>` to the Twilio sandbox number.

1. Same **Admin Debug tab** as above.
2. Select an attendee **with a valid phone number** (E.164 format, e.g. `+971501234567`).
3. Check **WhatsApp** channel only.
4. Click **Dry Run** — confirm WhatsApp status shows "Ready".
5. Click **Test Send** — verify toast shows `1 WhatsApp`.
6. Check the recipient's WhatsApp for the message.

---

## 7. Inspect Edge Function Logs

### Via Dashboard

```
Edge Functions → send-event-invitations → Logs
```

Direct link: <https://supabase.com/dashboard/project/qclaciklevavttipztrv/functions/send-event-invitations/logs>

### What to look for

- `correlationId` — matches the value shown in the Debug results panel.
- `SMTP verify succeeded` — email transport is healthy.
- `email sent to …` / `whatsapp sent to …` — delivery confirmed.
- `SMTP auth failed` — wrong `GMAIL_APP_PASSWORD`.
- `invalid phone` — attendee phone couldn't be normalised to E.164.

---

## 8. Inspect `event_invites` Table

```sql
-- All invites for an event
SELECT id, attendee_id, status, token,
       sent_via_email, email_sent_at,
       sent_via_whatsapp, whatsapp_sent_at,
       opened_at, rsvp_at
FROM event_invites
WHERE event_id = '<EVENT_UUID>'
ORDER BY created_at DESC;
```

Run in: <https://supabase.com/dashboard/project/qclaciklevavttipztrv/sql/new>

| Column | What it tells you |
|--------|-------------------|
| `status` | `created` → not sent, `sent` → delivered, `opened` → link visited |
| `sent_via_email` / `sent_via_whatsapp` | Which channels were used |
| `email_sent_at` / `whatsapp_sent_at` | Exact delivery timestamps |
| `opened_at` | When the attendee opened the invite link |
| `rsvp_at` | When they confirmed |

---

## 9. Inspect `message_logs` Table

```sql
-- Recent messages for an event
SELECT id, attendee_id, channel, to_address,
       provider, status, error,
       provider_message_id, created_at
FROM message_logs
WHERE event_id = '<EVENT_UUID>'
ORDER BY created_at DESC
LIMIT 50;
```

| Column | What it tells you |
|--------|-------------------|
| `channel` | `email` or `whatsapp` |
| `status` | `sent`, `failed`, `queued` |
| `error` | Failure reason (Twilio error code, SMTP rejection, etc.) |
| `provider_message_id` | Twilio SID — use to look up delivery status in Twilio Console |

---

## Quick Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| All emails skip as "not configured" | `GMAIL_USER` or `GMAIL_APP_PASSWORD` missing | Add secrets in Supabase dashboard |
| SMTP auth failed | Wrong App Password or 2FA not enabled | Re-generate App Password with 2FA on |
| WhatsApp "not configured" | Twilio secrets missing | Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| WhatsApp `21608` error | Recipient not opted in (sandbox) | Recipient must send `join <keyword>` first |
| WhatsApp `63016` error | Template not approved (production) | Use approved message templates |
| "Invalid phone" | Phone missing country code | Store as `+<country><number>`, e.g. `+971501234567` |
| Dry run shows "Ready" but test send fails | Network/transient error | Check Edge Function logs for `correlationId` |
