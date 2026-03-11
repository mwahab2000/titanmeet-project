# TitanMeet Invitation System — Final Audit Report

**Date:** 2026-03-11  
**Scope:** Full audit of the invitation sending, reminder, RSVP, and tracking system.

---

## Issues Fixed

### 1. SMTP Configuration Inconsistency (send-survey-links)
- **Problem:** `send-survey-links` used port 465 with `secure: true`, while all other functions (`send-event-invitations`, `send-communication`) use port 587 with STARTTLS.
- **Risk:** Port 465 connections can fail silently in some environments. Inconsistent config makes debugging harder.
- **Fix:** Aligned `send-survey-links` to port 587 + `requireTLS: true` + `rejectUnauthorized: false` + connection/greeting timeouts. All three messaging functions now use identical SMTP config.

### 2. Dead Code — `handleResend` in InvitationsSection
- **Problem:** `handleResend()` was defined but never called in the JSX. Per-row resending uses `handleSendSingle()` instead.
- **Fix:** Removed the dead function, replaced with a comment clarifying the actual handler.

### 3. Dead Code — `attendee_results` Fallback in AttendeesSection
- **Problem:** `SendResponse` interface included `attendee_results` and `reason` fields that the Edge Function never returns. Helper functions (`getSuccessfullySentIds`, `getFailedIds`, `buildResultMap`) had unnecessary `|| res.attendee_results` fallbacks.
- **Fix:** Removed the phantom fields and simplified all helpers to use `res.results` directly.

### 4. SMTP Config in send-survey-links Missing Timeouts
- **Problem:** No `connectionTimeout` or `greetingTimeout` — could hang indefinitely on SMTP connect.
- **Fix:** Added 10s timeouts matching `send-event-invitations`.

---

## Verified Correct (No Action Needed)

| Area | Status | Notes |
|------|--------|-------|
| **Twilio secret naming** | ✅ Consistent | All functions use `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| **Phone normalization** | ✅ Shared utility | `_shared/phone.ts` used by all three messaging functions |
| **Edge Function auth** | ✅ JWT + ownership | All functions validate Bearer token + `owns_event()` RPC |
| **DB writes — event_invites** | ✅ Correct | Status transitions: `created` → `sent` → `opened` → `rsvp_yes`. Timestamps updated per-channel. |
| **DB writes — message_logs** | ✅ Correct | Both success and failure paths insert into `message_logs` with provider/channel/error |
| **DB writes — attendees** | ✅ Correct | `confirmed` + `confirmed_at` set by `confirm-rsvp` function |
| **Dry-run mode** | ✅ Working | Validates ownership, tokens, email/WA config, phone normalization without sending |
| **Reminder 24h cooldown** | ✅ Client-enforced | `getLastSentTime()` checks `last_sent_at` from `event_invites` |
| **RSVP flow** | ✅ End-to-end | `invite-get` → marks opened, `confirm-rsvp` → marks confirmed |
| **InviteLandingPage** | ✅ Functional | Token validation, RSVP confirmation, event link navigation all correct |
| **correlationId logging** | ✅ Present | Returned in response + logged in Edge Function for trace matching |
| **Error sanitization** | ✅ Present | `sanitizeError()` strips credentials from error strings |
| **Schema alignment** | ✅ Correct | Code matches `event_invites` table schema (all columns used correctly) |
| **Legacy rsvp_tokens** | ✅ Not referenced | Table exists in DB/types but zero app code references it |
| **TWILIO_PHONE_NUMBER** | ✅ Fully removed | Zero references remaining in codebase |

---

## Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Bulk reminders send sequentially** | Low | `sendAllReminders` loops one-by-one. For >100 attendees this could be slow. Consider batching in a future iteration. |
| **No server-side 24h cooldown** | Medium | Cooldown is only enforced client-side in `AttendeesSection`. A determined user could bypass via API. Consider adding server-side check in `send-event-invitations`. |
| **InviteLandingPage uses hardcoded colors** | Low | Uses `bg-gray-50`, `text-emerald-600` etc. instead of design tokens. Functional but won't auto-adapt to theme changes. |
| **rsvp_tokens table still in DB** | Low | Legacy table, not referenced. Can be dropped in a future migration if desired. |
| **No rate limit on send-event-invitations** | Medium | `send-communication` has rate limiting (200/hr/event) but `send-event-invitations` does not. Large events could trigger SMTP throttling. |
| **Twilio sandbox limitations** | Info | Sandbox requires recipient opt-in (`join <keyword>`). Production requires approved sender and WhatsApp Business verification. |

---

## Recommended Manual Tests

### Email Flow
1. **Single attendee test send** — Use Admin Debug tab → select attendee → Dry Run → Test Send
2. **Bulk send** — Add 3+ attendees → Send All Invitations → verify `event_invites` rows + email delivery
3. **Reminder** — Wait 24h (or adjust `last_sent_at` in DB) → Send Reminder → verify different email template

### WhatsApp Flow
4. **Dry run validation** — Select attendee with phone → Dry Run → confirm "Ready" status
5. **Sandbox test** — Ensure recipient has joined sandbox → Test Send via WhatsApp
6. **Invalid phone** — Add attendee with local number (e.g. `0501234567`) → attempt send → verify "invalid_phone" status

### RSVP Flow
7. **Confirm via link** — Copy invite link from Invitations tab → open in incognito → click Confirm → verify `attendees.confirmed = true`
8. **Double-confirm** — Click confirm link again → verify "already confirmed" response
9. **Invalid token** — Navigate to `/i/invalidtoken123` → verify error page

### Edge Cases
10. **Missing email config** — Temporarily unset `GMAIL_USER` → Dry Run → verify "Email secrets not configured" message
11. **Missing WhatsApp config** — Dry Run with WhatsApp channel → verify proper skip message
12. **CSV import + send** — Import CSV → Send All → verify correct count in summary banner

### Log Verification
13. Check Edge Function logs at: https://supabase.com/dashboard/project/qclaciklevavttipztrv/functions/send-event-invitations/logs
14. Verify `correlationId` from UI debug panel matches log entries
15. Query `message_logs` table to confirm delivery records exist
