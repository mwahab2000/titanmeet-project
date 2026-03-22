

# Final Integration Pass: Unified WhatsApp+Email Communication System

## Current State Assessment

The system is ~90% complete. All core pieces exist:
- **Database**: `communication_campaigns` and `campaign_recipients` tables with RLS
- **Frontend API**: `src/lib/campaign-api.ts` with full CRUD + stats helpers
- **Communication Center UI**: `CampaignsView.tsx` integrated into CommsSidebar
- **AI Builder tools**: 6 communication tools implemented and wired in the edge function
- **Edge function**: Tools are implemented but need deployment + helper alignment

## Gaps Found

1. **`formatToolDisplayName` missing entries** for 6 communication tools
2. **`formatToolLabel` missing entries** for 6 communication tools  
3. **Tool category classification** does not include communication tools (line 3991-3993)
4. **`resolveToolTarget` missing entries** for communication tools
5. **`filterSafeMetadata` allowed keys** missing campaign-related keys
6. **Analytics section** computes confirmed/pending/message stats independently from `campaign-api.ts` — logic is duplicated but consistent (both query same tables)
7. **Idempotency**: `sendCampaign` in campaign-api and `toolSendCommunicationCampaign` both check `status !== "draft"` before sending — good. But no guard against rapid double-clicks on the UI Send button beyond `setSendingId` state.
8. **Edge function not yet deployed** with communication tools

## Implementation Plan

### Step 1: Complete helper functions in edge function

In `supabase/functions/ai-event-builder/index.ts`:

**A. Add communication tools to `formatToolDisplayName`** (line ~4244):
```
prepare_communication_campaign: "Prepare Campaign",
send_communication_campaign: "Send Campaign",
get_event_confirmation_stats: "Confirmation Stats",
list_confirmation_segments: "Confirmation Segments",
get_communication_performance: "Communication Performance",
list_event_campaigns: "List Campaigns",
```

**B. Add communication tools to `formatToolLabel`** (line ~4341):
- Map each tool result to a human-readable label string

**C. Add communication tools to category classification** (line ~3991):
- Add `isCommunicationTool` check for the 6 tools, categorize as `"communication"`

**D. Add communication tools to `resolveToolTarget`** (line ~4282):
- Map tool args to meaningful target strings

**E. Add campaign-related keys to `filterSafeMetadata`** (line ~4304):
- Add: `campaign_id`, `campaign_type`, `channels`, `audience_count`, `audience_segment`, `sent_email`, `sent_whatsapp`, `failed_email`, `failed_whatsapp`, `confirmation_rate`, `invited`, `confirmed`, `pending`, `segments`, `campaigns`

### Step 2: Add idempotency guard to frontend campaign send

In `src/components/comms/CampaignsView.tsx`:
- Disable Send button for campaigns that are not `draft` status (already partially done via conditional render, but add explicit disabled check)
- After send completes, reload to get updated status — already done

In `src/lib/campaign-api.ts`:
- Add a pre-send check: re-fetch campaign status before sending to prevent race conditions from stale UI state

### Step 3: Deploy edge function

Deploy the updated `ai-event-builder` edge function with all communication tool helpers completed.

### Step 4: Validate consistency

Verify that these three surfaces compute the same numbers from the same tables:
- **AnalyticsSection**: queries `attendees`, `event_invites`, `message_logs` directly
- **campaign-api.ts `getConfirmationStats`**: queries `attendees`, `event_invites`, `message_logs` directly
- **AI Builder `toolGetEventConfirmationStats`**: queries `attendees`, `message_logs` directly

All three use the same source tables and same field logic (`confirmed` boolean on attendees, `status` on message_logs). The logic is consistent — no normalization needed, just confirming alignment.

### Files Changed

1. `supabase/functions/ai-event-builder/index.ts` — helper function updates + deploy
2. `src/lib/campaign-api.ts` — idempotency pre-check on sendCampaign
3. `src/components/comms/CampaignsView.tsx` — minor guard improvements

### Env Vars / Secrets Required

All already configured:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — WhatsApp delivery
- `TWILIO_WHATSAPP_INVITE_TEMPLATE_SID` — WhatsApp templates
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — Email delivery
- `OPENAI_API_KEY` — AI Builder
- `VITE_APP_URL` — Base URL for invitation links

### Risks

- **WhatsApp template compliance**: Sending via `send-event-invitations` uses Twilio Content Templates. New campaign types (confirmation, reminder) must have matching approved templates or will fall back to freeform (which may fail outside 24h window).
- **No scheduled campaign executor yet**: `scheduled` status campaigns are stored but there's no cron/background job to trigger them at `scheduled_at`. This is a known future extension.

