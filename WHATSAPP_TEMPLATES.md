# TitanMeet — WhatsApp Template Messages

## Why Templates Are Required

WhatsApp **does not allow** businesses to send free-form (freeform) messages to users outside a 24-hour conversation window. Business-initiated outbound messages must use **pre-approved message templates**.

If you send a free-form message, Twilio returns error **63016**:
> "Failed to send freeform message because you are outside the allowed window."

## Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `TWILIO_WHATSAPP_INVITE_TEMPLATE_SID` | Content SID for the invitation template | `HXabc123def456...` |
| `TWILIO_WHATSAPP_REMINDER_TEMPLATE_SID` | Content SID for the reminder template (optional — falls back to invite template) | `HXdef789abc012...` |

Set these in **Supabase → Settings → Edge Functions → Secrets**.

## Template Variables

The approved invitation template (`copy_event_invitation_1`) uses named variables:

| Variable | Content | Example |
|----------|---------|---------|
| `name` | Attendee name | `Ahmed` |
| `event` | Event title | `Annual Gala 2026` |

## How to Create Templates

### Option A: Twilio Content Template Builder (Recommended)

1. Go to **Twilio Console → Messaging → Content Template Builder**
2. Click **Create new** → choose **WhatsApp**
3. Template body example for invitation:
   ```
   Hi {{1}}! 🎉

   You're invited to *{{2}}*.

   👉 {{3}}

   This link is personal to you. We look forward to seeing you!
   ```
4. Template body example for reminder:
   ```
   Hi {{1}}! ⏰

   Friendly reminder: You're invited to *{{2}}*. We haven't received your confirmation yet.

   👉 {{3}}

   Please confirm your attendance!
   ```
5. Submit for approval. Once approved, copy the **Content SID** (starts with `HX`).
6. Set as `TWILIO_WA_TEMPLATE_INVITE` / `TWILIO_WA_TEMPLATE_REMINDER`.

### Option B: Twilio Sandbox (Testing Only)

The Twilio WhatsApp Sandbox comes with a pre-approved template:
- Content SID: Check your sandbox settings in Twilio Console
- Recipients must first send `join <sandbox-keyword>` to the sandbox number
- Sandbox join can expire; re-join may be required

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Error 63016 | Free-form message outside 24h window | Use template (this is now the default) |
| Error 63032 | Template not found or not approved | Verify Content SID is correct and approved |
| "No WhatsApp template configured" | `TWILIO_WA_TEMPLATE_INVITE` secret missing | Add the secret in Supabase |
| Template variables wrong | Mismatch between template and code | Ensure template has `{{1}}`, `{{2}}`, `{{3}}` |
