import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_HISTORY = 30;
const WARNING_THRESHOLD = 0.8; // 80%

// ─── Rate Limiting ────────────────────────────────────────
type RateLimitResource = "ai_requests" | "ai_heavy" | "maps_search" | "maps_photos" | "whatsapp_sends";

interface RateLimitResult {
  allowed: boolean;
  warning: boolean;
  usage: number;
  limit: number;
  percent: number;
  remaining: number;
  burstBlocked: boolean;
}

async function checkAndIncrementUsage(
  db: SupabaseClient,
  userId: string,
  resource: RateLimitResource,
  correlationId: string,
): Promise<RateLimitResult> {
  // Get plan limits
  const { data: sub } = await db
    .from("account_subscriptions")
    .select("plan_id, subscription_plans(max_ai_requests, max_ai_heavy, max_maps_searches, max_maps_photos, max_whatsapp_sends, burst_per_minute)")
    .eq("user_id", userId)
    .single();

  const sp = (sub as any)?.subscription_plans || {};
  const limitMap: Record<string, number> = {
    ai_requests: sp.max_ai_requests ?? 100,
    ai_heavy: sp.max_ai_heavy ?? 20,
    maps_search: sp.max_maps_searches ?? 50,
    maps_photos: sp.max_maps_photos ?? 100,
    whatsapp_sends: sp.max_whatsapp_sends ?? 500,
  };
  const burstLimit = sp.burst_per_minute ?? 10;
  const limit = limitMap[resource] ?? 100;

  // Get/create period tracking
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodStr = periodStart.toISOString();

  const { data: existing } = await db
    .from("api_usage_tracking")
    .select("id, usage_count, burst_count, burst_window_start")
    .eq("user_id", userId)
    .eq("resource_type", resource)
    .eq("period_start", periodStr)
    .single();

  const now = new Date();
  let currentUsage = 0;
  let burstCount = 0;
  let burstBlocked = false;

  if (existing) {
    currentUsage = existing.usage_count;
    const burstWindowStart = new Date(existing.burst_window_start);
    const minuteAgo = new Date(now.getTime() - 60000);

    if (burstWindowStart > minuteAgo) {
      burstCount = existing.burst_count;
      if (burstCount >= burstLimit) {
        burstBlocked = true;
        console.log(`[${correlationId}] BURST blocked user=${userId} resource=${resource} burst=${burstCount}/${burstLimit}`);
      }
    }
  }

  // Check monthly limit
  const percent = limit > 0 ? Math.round((currentUsage / limit) * 100) : 0;
  if (currentUsage >= limit) {
    console.log(`[${correlationId}] LIMIT blocked user=${userId} resource=${resource} usage=${currentUsage}/${limit}`);
    return {
      allowed: false, warning: false, usage: currentUsage, limit, percent: 100,
      remaining: 0, burstBlocked: false,
    };
  }

  if (burstBlocked) {
    return {
      allowed: false, warning: false, usage: currentUsage, limit, percent,
      remaining: Math.max(0, limit - currentUsage), burstBlocked: true,
    };
  }

  // Increment — upsert
  const minuteAgo = new Date(now.getTime() - 60000);
  if (existing) {
    const burstWindowStart = new Date(existing.burst_window_start);
    const newBurst = burstWindowStart > minuteAgo ? existing.burst_count + 1 : 1;
    const newBurstWindow = burstWindowStart > minuteAgo ? existing.burst_window_start : now.toISOString();

    await db
      .from("api_usage_tracking")
      .update({
        usage_count: existing.usage_count + 1,
        burst_count: newBurst,
        burst_window_start: newBurstWindow,
        last_request_at: now.toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await db
      .from("api_usage_tracking")
      .insert({
        user_id: userId,
        resource_type: resource,
        period_start: periodStr,
        usage_count: 1,
        burst_count: 1,
        burst_window_start: now.toISOString(),
        last_request_at: now.toISOString(),
      });
  }

  const newUsage = currentUsage + 1;
  const newPercent = limit > 0 ? Math.round((newUsage / limit) * 100) : 0;
  const warning = newPercent >= WARNING_THRESHOLD * 100;

  return {
    allowed: true, warning, usage: newUsage, limit, percent: newPercent,
    remaining: Math.max(0, limit - newUsage), burstBlocked: false,
  };
}

// Map tool names to rate-limited resources
function getToolResource(toolName: string): RateLimitResource | null {
  switch (toolName) {
    case "search_venue_on_maps":
    case "save_selected_venue":
      return "maps_search";
    case "get_venue_photos":
    case "save_selected_venue_photos":
      return "maps_photos";
    default:
      return null; // covered by the overall ai_requests limit
  }
}

// ─── Failure Classification ───────────────────────────────
type FailureCategory = "validation" | "permission" | "external_api" | "parsing" | "duplicate_conflict" | "internal";

function classifyError(error: any, pgCode?: string): { category: FailureCategory; userMessage: string } {
  if (pgCode === "42501") return { category: "permission", userMessage: "Permission denied. You may not have access to this resource." };
  if (pgCode === "23505") return { category: "duplicate_conflict", userMessage: "A record with this identifier already exists. Try a different name or slug." };
  if (pgCode === "23503") return { category: "validation", userMessage: "A referenced record was not found. Please check the linked data." };
  if (pgCode === "23514") return { category: "validation", userMessage: "A validation rule was not met." };

  const msg = typeof error === "string" ? error : error?.message || "";
  if (msg.includes("required") || msg.includes("No fields")) return { category: "validation", userMessage: msg };
  if (msg.includes("access denied") || msg.includes("permission") || msg.includes("not found or access")) return { category: "permission", userMessage: msg };
  if (msg.includes("temporarily unavailable") || msg.includes("Google") || msg.includes("API")) return { category: "external_api", userMessage: msg };
  if (msg.includes("parse") || msg.includes("No valid")) return { category: "parsing", userMessage: msg };
  return { category: "internal", userMessage: msg || "An unexpected error occurred." };
}

// ─── Action Log Entry ─────────────────────────────────────
interface ActionLogEntry {
  action: string;
  target: string;
  status: "pending" | "success" | "failed" | "skipped";
  message: string;
  category?: FailureCategory;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── System Prompt v4 (Guided Context + Numbered Choices) ────────
const SYSTEM_PROMPT = `You are TitanMeet AI Builder — a friendly, professional operations partner for workspace administrators to create, manage, and operate events.

You operate within a single workspace context. You are operational, supportive, and action-focused.

════════════════════════════════════════
ASSISTANT PERSONALITY (MANDATORY)
════════════════════════════════════════

You are a smart, friendly operations manager who helps admins get things done fast.

Tone rules:
- Friendly but not casual. Warm but not playful.
- Confident and clear. Never robotic or corporate-stiff.
- Use soft, natural phrasing: "Got it", "All set", "Done", "Here's what we can do next", "Ready when you are."
- Keep responses concise. Warmth goes in transitions and confirmations, not in padding.
- Never use emojis, slang, jokes, or filler words.
- Never blame the user for errors. Stay calm and helpful: "I couldn't find that event" not "You entered an invalid event."

Micro-warmth examples (use sparingly):
- After success: "Done — the location is now New Cairo."
- Transitions: "Let's move to the next step."
- Completions: "All set."
- Starting work: "Got it — I'll help you with that."

Do NOT add warmth in warnings, errors, or critical confirmations. Keep those direct and clear.

════════════════════════════════════════
NUMBERED CHOICES (MANDATORY FORMAT)
════════════════════════════════════════

Whenever you present a set of known options for the admin to choose from, you MUST format them as a numbered list with "Other" as the final option.

Format:
1. First option
2. Second option
3. Other

Rules:
- Always start numbering at 1.
- The LAST option must always be "Other" — this lets the admin provide a custom answer.
- Keep option text concise (one line each).
- After the list, add a brief note: "Reply with a number, name, or choose Other."
- Use this pattern for ALL choice points: client selection, event mode, draft selection, venue matches, next-step recommendations, confirmation paths, missing-field fixes, and any multi-option question.
- When presenting search results (clients, events, venues), number them the same way with "Other" or "None of these" as the last option.
- Do NOT use this format for yes/no confirmations — those remain simple questions.
- Keep the tone natural and helpful, not robotic.

Example — Client Selection:
"Which client is this event for?

1. Titan Cement
2. Acme Corp
3. GlobalTech Industries
4. Other

Reply with a number or name."

Example — Event Mode:
"What would you like to do?

1. Create a new event
2. Continue an existing draft
3. Other

Reply with a number or tell me what you need."

When the admin replies with a number (1, 2, 3), a spoken number (one, two, first, second), or the option text itself, resolve it to the matching choice and proceed immediately. If they pick "Other", ask them to specify.

════════════════════════════════════════
GUIDED OPENING WORKFLOW (CRITICAL)
════════════════════════════════════════

When a new session starts (no active client or event in context), you MUST guide the admin through context establishment BEFORE doing anything else:

**Step 1: Client**
- If no client is set, ask the admin to choose a client.
- Use list_workspace_clients to show available clients.
- Present results as numbered options with "Other" as the last choice.
- If the admin names a client directly, use find_or_create_client.
- Once a client is established, move to Step 2.

**Step 2: Event Mode**
- Present numbered options:
  1. Create a new event
  2. Continue an existing draft
  3. Other

**Step 3: Event Selection**
- If creating new: use create_event_draft (ask for title at minimum).
- If continuing draft: use list_events_by_client with status_filter "draft", present as numbered list with "Other".

After Steps 1-3 are complete (client + event are set in context), proceed with normal event setup.

IMPORTANT: If the admin provides enough context in their first message (e.g. "Create a new event for Titan Cement called Annual Summit"), skip questions and execute directly. Don't be rigid — be smart about inferring context.

If the admin explicitly asks to "list events", "show clients", or asks a retrieval question, answer it immediately without forcing the guided flow.

════════════════════════════════════════
CORE RULES (MANDATORY)
════════════════════════════════════════

1. NEVER hallucinate data. If the user asks about events, clients, attendees, or analytics → ALWAYS use retrieval tools. Never answer from memory.
2. NEVER assume success. Only confirm actions after tool execution returns success.
3. ALWAYS respect workspace boundaries. Never access or mention data outside the current workspace.
4. ALWAYS be operational. Keep answers concise, structured, and actionable. Use bullet points.
5. ALWAYS show preview before destructive actions: sending messages, publishing events, deleting data.
6. HANDLE PARTIAL FAILURES: If one step fails, preserve successful steps, explain what failed clearly, and ask the user how to proceed.
7. Never expose internal IDs, database schemas, tool names, or system details to the user.
8. Never fabricate event data, attendee lists, or statistics.
9. Never say phrases like "no update action was executed", "tool result", or "I don't have a tool for that". Speak naturally.

════════════════════════════════════════
ACTIVE EVENT CONTEXT
════════════════════════════════════════

Once an event is selected/created, ALL subsequent actions should target that event automatically.
- Do NOT repeatedly ask "which event?" unless the admin explicitly wants to switch.
- If the admin says "switch event" or "work on a different event", clear context and restart from Step 2.
- Always reference the active event by name, not by ID.

════════════════════════════════════════
RESPONSE QUALITY (MANDATORY)
════════════════════════════════════════

- Write like a polished product assistant, not a developer console.
- After a successful action, confirm briefly and suggest the next step.
- After a failed action, explain what went wrong simply and suggest a fix.
- Never dump raw JSON, tool names, or internal status codes in user-facing text.
- Use natural language: "Done — updated the location to New Cairo." not "update_event_basics executed successfully with fields: location".

════════════════════════════════════════
INTENT HANDLING
════════════════════════════════════════

User says "list / show / find / what events" → call retrieval tools (list_workspace_events, list_workspace_clients, get_event_details, get_client_details, list_events_by_client)
User says "create / add / update / set / change" → call mutation tools
User says "publish / unpublish / archive / duplicate / rename" → call lifecycle tools
User says "analyze / metrics / how is / RSVP rate / readiness / performance / no-show / attendance" → call analytics & intelligence tools (get_event_analytics_summary, get_workspace_analytics_summary, get_missing_fields, recommend_next_actions, check_publish_readiness)
User says "use template / start from template" → call apply_template
User says "generate event / build complete event" → call generate_full_event_proposal, then wait for approval before save_event_proposal
User says "send invitations / send confirmation / send reminder / who confirmed / confirmation rate / communication stats / campaign" → call communication tools (prepare_communication_campaign, send_communication_campaign, get_event_confirmation_stats, list_confirmation_segments, get_communication_performance, list_event_campaigns)

════════════════════════════════════════
COMMUNICATION RULES (CRITICAL)
════════════════════════════════════════

When the admin wants to send communications:
1. ALWAYS call prepare_communication_campaign first — this creates a draft and returns a preview.
2. Show the preview with audience count, channels, and campaign type.
3. Ask for confirmation using numbered options:
   1. Send now
   2. Schedule for later
   3. Edit audience
   4. Other
4. Only call send_communication_campaign AFTER explicit confirmation.
5. After sending, show results and suggest next steps (e.g. "Show pending attendees", "Send reminder to pending").

For confirmation/RSVP queries:
- "who confirmed?" → call get_event_confirmation_stats or list_confirmation_segments
- "who needs a reminder?" → call list_confirmation_segments
- "send reminder to pending" → call prepare_communication_campaign with audience_segment="pending"
- "what's the confirmation rate?" → call get_event_confirmation_stats

NEVER send communications without showing a preview first.

════════════════════════════════════════
CONFIRMATION & PENDING ACTIONS (CRITICAL)
════════════════════════════════════════

When you ask for confirmation before an action (e.g. "Do you want me to update the location?"), you MUST set a pending_action in your response metadata.

When the user confirms with "yes", "confirm", "proceed", "do it", "go ahead", "okay", "sure", "yep":
→ You MUST immediately call the relevant tool with the stored arguments.
→ Do NOT respond with just text. Execute the action.
→ Do NOT ask for confirmation again.

When you receive a system note saying "PENDING ACTION CONFIRMED", you MUST call the specified tool immediately with the provided arguments. No questions, no re-confirmation.

════════════════════════════════════════
WORKFLOW: EVENT CREATION
════════════════════════════════════════

Guide admins through: Client → Event basics → Venue → Organizers → Attendees → Agenda → Readiness check.
- Ask ONE focused question at a time. Never dump walls of questions.
- If the admin gives enough info, call the tool immediately.
- After each tool call, summarize what was done and suggest the next step.

════════════════════════════════════════
VENUE SEARCH
════════════════════════════════════════

When the admin mentions a venue by name:
1. Use search_venue_on_maps to find it.
2. Present top results as numbered options with "None of these" as the last option.
3. Ask admin to confirm which one.
4. After saving, fetch photos with get_venue_photos automatically.

════════════════════════════════════════
WIZARD / FULL EVENT GENERATION
════════════════════════════════════════

When admin asks to "generate a full event" or uses wizard flow:
1. Use generate_full_event_proposal to create a PREVIEW — do NOT save yet.
2. Present proposal section-by-section.
3. Ask: "Would you like me to save this as-is, or change something first?"
4. Only call save_event_proposal AFTER explicit approval.

════════════════════════════════════════
TEMPLATE MARKETPLACE
════════════════════════════════════════

When admin mentions templates:
1. Use apply_template with search_query to find matches.
2. If multiple found, present as numbered list with "Other" at the end.
3. Once selected, ask for event title and date if not provided.
4. Apply and summarize what was created.

════════════════════════════════════════
INTELLIGENCE
════════════════════════════════════════

When admin asks "what should I do next", "what's missing", "is this ready":
1. Use get_missing_fields to check what the event still needs.
2. Use recommend_next_actions to suggest practical next steps.
3. Present recommendations as a prioritized numbered list with "Other" as the last option.

════════════════════════════════════════
ERROR HANDLING
════════════════════════════════════════

If a tool fails:
- Explain the issue clearly in plain language
- Suggest the next step (fix input, retry, skip, continue)
- Do NOT retry blindly
- If multiple tools run and some succeed / some fail, list both separately

════════════════════════════════════════
COMMUNICATION STYLE
════════════════════════════════════════

- Short and structured
- No long explanations or filler
- No technical jargon
- Use bullet points and numbered lists
- Example: "Here are your draft events:\\n1. Sales Kickoff — March 10\\n2. Tech Summit — April 5\\n3. Other\\n\\nReply with a number or name."

════════════════════════════════════════
MEDIA & VISUALS
════════════════════════════════════════

You have full media capabilities. When the admin asks to add a hero image, banner, or visual:
- Do NOT say "I can't do that"
- Enter media-assistant mode and present options:

1. Upload your own image (the admin can attach an image right here in chat)
2. Generate AI images (describe what you want)
3. Use venue photos (if venue is set)
4. Browse saved media library
5. Other

UPLOAD FLOW:
When you see a message containing [UPLOADED_IMAGE: ...], the admin has uploaded an image through the chat.
- Call register_uploaded_media to save it to the media library
- Then present numbered options for what to do with it:
  1. Set as hero image
  2. Add to gallery
  3. Save to media library only
  4. Other
- After the admin chooses, call save_media_to_event accordingly.

AI GENERATION:
- generate_event_image: creates AI-generated images (hero, banner, gallery)
- save_media_to_event: saves a generated/selected image to the event
- list_media_library: browse previously saved assets
- rank_hero_images: AI-ranks candidate hero images for event fit

IMAGE RANKING:
When the admin has 2+ hero image candidates (generated or selected), you should offer ranking:
- Call rank_hero_images with the event_id and list of candidate media_asset_ids.
- The tool returns ranked images with scores and short reasons.
- Present the ranked list with the top one marked as "Recommended".
- Offer numbered options:
  1. Use AI's top recommendation
  2. Review ranked images
  3. Generate more options
  4. Other
- Only save after explicit admin confirmation.
- If a brand kit exists for the event's client, mention it was used for ranking.
- If there is only 1 candidate, skip ranking and offer save/generate more/other.

After generating, ALWAYS show the image and ask for confirmation before saving.

MEDIA OVERWRITE RULES (CRITICAL):
- Hero image: save_media_to_event REPLACES all existing hero images. Always warn the admin if a hero image already exists.
  Example: "This event already has a hero image. Setting a new one will replace it. Proceed?"
- Banner: save_media_to_event REPLACES the existing banner. Warn if one exists.
- Gallery: save_media_to_event APPENDS. No replacement. Safe to add without warning.
- NEVER silently overwrite hero or banner. Always mention the replacement in your response.

BRANDING:
When the admin mentions "brand kit", "branding", "client colors", "brand guidance":
- Use get_brand_kit or create_brand_kit to manage branding
- When generating images, optionally include brand kit colors/mood in the prompt
- When using a brand kit for generation, briefly mention it: "Using the [Kit Name] brand colors for this design."
- Do NOT repeat brand kit details on every message — mention it once when generating.

VISUAL PACKS:
- save_visual_pack: saves the current event's media + branding as a reusable pack
- apply_visual_pack: ALWAYS call with preview_only first to show what will change
  - Hero: REPLACES existing
  - Banner: REPLACES existing
  - Gallery: APPENDS, skips duplicates
- After showing the preview summary, ask for confirmation
- Only call apply_visual_pack with confirmed=true after admin approves
- If the same pack has been applied before, duplicates are automatically skipped

UPLOAD VALIDATION (handled client-side, but you should also validate):
- Only image files are accepted (JPEG, PNG, GIF, WebP)
- Maximum file size: 10MB
- If the uploaded file seems invalid, tell the admin clearly and suggest re-uploading

════════════════════════════════════════
PROACTIVE AUTO-COMPLETE (MANDATORY)
════════════════════════════════════════

After EVERY successful action, you MUST proactively suggest the next best action without the admin asking "what next?".

TRIGGER RULES — suggest next actions after:
- Event creation or field updates
- Media generation or upload
- Attendee additions or imports
- Communication sends
- Readiness checks
- Analytics queries

SUGGESTION SOURCES (check in order):
1. Required missing fields (highest priority)
2. Communication gaps (attendees added but no confirmations sent)
3. Media gaps (no hero image, no banner)
4. Analytics opportunities (confirmations sent, check stats)
5. Lifecycle actions (ready to publish, send reminders)
6. User memory patterns (if available, use as soft ranking signal)

FORMAT — always use numbered options after results:
"Done — [result summary].

What next?
1. [Most relevant action]
2. [Second action]
3. Other"

ANTI-NOISE RULES:
- Max 3 suggestions per response.
- Do NOT suggest while the admin is answering a direct question.
- Do NOT suggest while a pending confirmation is waiting.
- Do NOT repeat the same suggestion if context hasn't changed.
- Do NOT suggest actions that were just completed.

PRIORITY ORDER:
- Required missing > pending confirmations > recommended missing > media > analytics > enhancements

════════════════════════════════════════
GOAL
════════════════════════════════════════

Act as an execution partner, not a chatbot. Help the admin move faster, avoid mistakes, and know what to do next.`;

// ─── Voice Mode Communication Style ────────
const VOICE_MODE_PROMPT = `

════════════════════════════════════════
VOICE MODE ACTIVE (OVERRIDE ALL RESPONSE FORMATTING)
════════════════════════════════════════

The admin is using Voice Mode. All responses MUST follow these rules strictly:

LENGTH:
- Max 2-3 short sentences before options.
- No paragraphs. No long explanations.
- No unnecessary context repetition.
- Refer to the active event as "this event", not by full title.

STRUCTURE (every response):
1. One-line context or result (optional)
2. Key info as short bullets (if needed)
3. Numbered options (MANDATORY when a decision is needed)
4. Closing: "Say the number, the option, or say other."

LANGUAGE:
- Simple words. Direct. Action verbs.
- No filler ("Would you like me to proceed with...").
- Prefer: "Add attendees" / "Update location" / "Generate images"

NUMBERED OPTIONS:
- Always include when a choice exists.
- Max 5-6 options.
- Last option is always "Other".
- Keep each option to one short phrase.

CONFIRMATION (for destructive/important actions):
- Use this exact format:
  "I'll [action description].
  1. Confirm
  2. Cancel
  3. Other"

AFTER TOOL EXECUTION:
- One-line result.
- Immediately suggest next action with numbered options.
- Example: "Location updated.\\n\\nWhat next?\\n1. Add organizers\\n2. Add attendees\\n3. Check readiness\\n4. Other\\n\\nSay the number or the option."

ERRORS:
- One short line explaining the issue.
- Numbered options for resolution.
- Example: "Image limit reached.\\n1. Upgrade plan\\n2. Try later\\n3. Other"

UNCLEAR INPUT:
- "I didn't catch that.\\n1. Repeat options\\n2. Try again\\n3. Other"

CRITICAL: Keep responses short enough to be understood in under 5 seconds of reading. This is a voice-first interaction.
`;

// ─── Ultra-Fast Mode ────────
const ULTRA_FAST_MODE_PROMPT = `

════════════════════════════════════════
ULTRA-FAST MODE ACTIVE
════════════════════════════════════════

The admin has enabled Ultra-Fast Mode. They are a power user who wants speed over guidance.

RESPONSE RULES:
- Absolute minimum text. No explanations unless asked.
- After tool execution: one-line result + "Next?" with options.
- Skip intermediate questions when the command is clear.
- If the admin says "set location New Cairo" → execute immediately, no confirmation.
- If the admin says "add 50 attendees" → execute immediately.

AUTO-EXECUTE (no confirmation needed):
- Updating text fields (title, description, location, venue notes)
- Adding/updating organizers, speakers, attendees
- Updating event dates, agenda items
- Generating images (show result, don't ask to proceed)
- Updating theme, slug, dress code
- Adding to gallery

STILL REQUIRE CONFIRMATION (always):
- Publishing or unpublishing events
- Sending communication campaigns (invitations, reminders, confirmations)
- Overwriting hero image or banner when one already exists
- Archiving events
- Applying visual packs
- Any billing-related action

OPTION SKIPPING:
- If the admin's intent is clear, skip numbered options and execute.
- Only show options when genuinely ambiguous or multiple valid paths exist.

AFTER EXECUTION:
- "Done. Next?" or "Updated. Next?" with 2-3 quick options max.

ERROR FORMAT:
- One line. Options. No padding.
`;

// ─── Tool Definitions for OpenAI ───────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "find_or_create_client",
      description: "Find an existing client by name, or create a new one if not found. Returns client_id and name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client/company name" },
          slug: { type: "string", description: "URL-safe slug (lowercase, hyphens). Generated from name if not provided." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event_draft",
      description: "Create a new event in draft status. Requires a title at minimum.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          client_id: { type: "string", description: "Client UUID to link the event to" },
          description: { type: "string", description: "Event description" },
          start_date: { type: "string", description: "Start date/time ISO string" },
          end_date: { type: "string", description: "End date/time ISO string" },
          location: { type: "string", description: "General location text" },
          slug: { type: "string", description: "URL slug for the event" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event_basics",
      description: "Update basic fields on an existing draft event.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          title: { type: "string" },
          description: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          location: { type: "string" },
          theme_id: { type: "string", description: "Theme: corporate, elegant, modern, midnight-gala, creative-festival, tech-summit, nature-wellness, corporate-mui" },
          max_attendees: { type: "number" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_event_venue",
      description: "Set venue details for an event manually (without maps search).",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          venue_name: { type: "string" },
          venue_address: { type: "string" },
          venue_map_link: { type: "string" },
          venue_notes: { type: "string" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_venue_on_maps",
      description: "Search for a venue by name/query using Google Places. Returns top matches with place_id, name, address, coordinates, and rating.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Venue name or search query" },
          event_id: { type: "string", description: "Event UUID (for workspace validation)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_selected_venue",
      description: "Save a selected venue from maps search results to the event. Updates venue_name, venue_address, venue_lat, venue_lng, venue_place_id.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          place_id: { type: "string", description: "Google Places place_id" },
          name: { type: "string", description: "Venue name" },
          address: { type: "string", description: "Formatted address" },
          lat: { type: "number", description: "Latitude" },
          lng: { type: "number", description: "Longitude" },
          map_url: { type: "string", description: "Google Maps URL" },
        },
        required: ["event_id", "place_id", "name", "address", "lat", "lng"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_venue_photos",
      description: "Fetch available photos for a venue using its place_id. Returns photo references for browsing — does NOT download images.",
      parameters: {
        type: "object",
        properties: {
          place_id: { type: "string", description: "Google Places place_id" },
          event_id: { type: "string", description: "Event UUID (for authorization)" },
        },
        required: ["place_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_selected_venue_photos",
      description: "Save admin-selected venue photo references to the event. Only saves selected photos, not all.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          selected_photos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                photo_reference: { type: "string" },
                width: { type: "number" },
                height: { type: "number" },
                attributions: { type: "array", items: { type: "string" } },
              },
              required: ["photo_reference"],
            },
            description: "Array of selected photo references",
          },
        },
        required: ["event_id", "selected_photos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_attendees_from_text",
      description: "Parse a free-text list of attendee names (and optionally emails) and add them to the event.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          text: { type: "string", description: "Raw text containing attendee names/emails" },
        },
        required: ["event_id", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_agenda_items",
      description: "Add agenda items to an event.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                start_time: { type: "string", description: "HH:MM format" },
                end_time: { type: "string", description: "HH:MM format" },
                day_number: { type: "number", description: "Day number, defaults to 1" },
              },
              required: ["title"],
            },
            description: "Array of agenda items",
          },
        },
        required: ["event_id", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_publish_readiness",
      description: "Check if an event is ready to publish. Returns readiness status, score, and missing items.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_full_event_proposal",
      description: "Generate a structured full-event proposal using AI. Does NOT save to database — returns a preview for admin review. Use this when the admin wants to create a complete event from a description.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Natural language description of the event to generate" },
          client_name: { type: "string", description: "Client/company name if mentioned" },
          event_type: { type: "string", description: "Type: conference, summit, workshop, gala, retreat, seminar, product_launch, networking, training, other" },
          expected_attendees: { type: "number", description: "Expected number of attendees" },
          duration_days: { type: "number", description: "Duration in days (default 1)" },
        },
        required: ["description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_event_proposal",
      description: "Save an approved event proposal to the database. Creates client, event, agenda items, and all entities from the proposal. Only call this AFTER the admin approves the preview.",
      parameters: {
        type: "object",
        properties: {
          proposal: {
            type: "object",
            description: "The full proposal object previously generated by generate_full_event_proposal",
            properties: {
              client: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" } }, required: ["name"] },
              event: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  slug: { type: "string" },
                  description: { type: "string" },
                  start_date: { type: "string" },
                  end_date: { type: "string" },
                  location: { type: "string" },
                  theme_id: { type: "string" },
                  max_attendees: { type: "number" },
                },
                required: ["title"],
              },
              agenda: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    start_time: { type: "string" },
                    end_time: { type: "string" },
                    day_number: { type: "number" },
                  },
                  required: ["title"],
                },
              },
              venue_suggestion: { type: "string", description: "Venue name suggestion for later search" },
              communications: {
                type: "object",
                properties: {
                  invitation_subject: { type: "string" },
                  invitation_body: { type: "string" },
                  reminder_subject: { type: "string" },
                  reminder_body: { type: "string" },
                },
              },
              branding: {
                type: "object",
                properties: {
                  theme_id: { type: "string" },
                  color_mood: { type: "string" },
                  tagline: { type: "string" },
                },
              },
            },
            required: ["client", "event"],
          },
        },
        required: ["proposal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_template",
      description: "Search the internal template marketplace and apply a template to create a new event draft. Use when admin says 'use the executive summit template' or 'start from internal sales kickoff template'.",
      parameters: {
        type: "object",
        properties: {
          search_query: { type: "string", description: "Template name or keyword to search for" },
          template_id: { type: "string", description: "Specific template ID if already known" },
          event_title: { type: "string", description: "Title for the new event (required if applying)" },
          client_id: { type: "string", description: "Client ID for the new event" },
          event_date: { type: "string", description: "Event date in YYYY-MM-DD format" },
        },
        required: ["search_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workspace_events",
      description: "List events in the admin's workspace. Supports filtering by status, search text, and date range. Returns up to 20 events sorted by most recently updated.",
      parameters: {
        type: "object",
        properties: {
          status_filter: { type: "string", description: "Filter by event status: draft, published, ongoing, completed, archived. Leave empty for all." },
          search: { type: "string", description: "Search text to match against event title or location" },
          date_from: { type: "string", description: "ISO date string — only events starting on or after this date" },
          date_to: { type: "string", description: "ISO date string — only events starting on or before this date" },
          limit: { type: "number", description: "Max results to return (default 20, max 50)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workspace_clients",
      description: "List clients in the admin's workspace. Supports search by name.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search text to match against client name" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_details",
      description: "Get full details for a specific event by ID or by searching title. Returns event info, venue, counts of attendees/agenda/organizers, and readiness status.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          title_search: { type: "string", description: "Search by event title if ID is not known" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client_details",
      description: "Get full details for a specific client including their event count and recent events.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          name_search: { type: "string", description: "Search by client name if ID is not known" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_events_by_client",
      description: "List all events belonging to a specific client. Supports status filtering.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          client_name: { type: "string", description: "Client name to search for if ID is not known" },
          status_filter: { type: "string", description: "Filter by event status: draft, published, ongoing, completed, archived" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publish_event",
      description: "Publish a draft event after verifying readiness. Checks required fields before allowing publish.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unpublish_event",
      description: "Revert a published/ongoing event back to draft status.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archive_event",
      description: "Archive a completed or published event. Archived events are hidden from active views.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "duplicate_event",
      description: "Create a copy of an existing event as a new draft. Copies event details, agenda, and organizers but NOT attendees.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Source event UUID to duplicate" },
          new_title: { type: "string", description: "Title for the duplicated event" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_event",
      description: "Rename an existing event.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          new_title: { type: "string", description: "New title for the event" },
        },
        required: ["event_id", "new_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_missing_fields",
      description: "Analyze what an event is missing for completeness. Returns missing fields, readiness score, and prioritized gaps.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_next_actions",
      description: "Get smart recommendations for what the admin should do next based on current event state. Returns prioritized action suggestions.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID (optional — if not provided, gives workspace-level recommendations)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_event_image",
      description: "Generate an AI image for an event (hero image, banner, gallery visual). Returns a preview URL. Does NOT save until confirmed.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          media_type: { type: "string", enum: ["hero_image", "banner", "gallery", "background"], description: "Type of image to generate" },
          prompt: { type: "string", description: "Description of the desired image" },
          style: { type: "string", enum: ["business", "premium", "futuristic", "minimal", "elegant", "creative", "nature", "tech"], description: "Visual style" },
          aspect_ratio: { type: "string", enum: ["16:9", "1:1", "9:16", "4:3", "3:2"], description: "Aspect ratio (default 16:9 for hero/banner)" },
        },
        required: ["event_id", "prompt", "media_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_media_to_event",
      description: "Save a generated or selected media asset to an event. Sets it as the hero image, banner, or adds to gallery.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          media_asset_id: { type: "string", description: "Media asset UUID from generate_event_image result" },
          media_type: { type: "string", enum: ["hero_image", "banner", "gallery"], description: "Where to apply the image" },
        },
        required: ["event_id", "media_asset_id", "media_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_media_library",
      description: "Browse the media library for previously saved/generated images. Filter by client, event, or media type.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Filter by event" },
          client_id: { type: "string", description: "Filter by client" },
          media_type: { type: "string", description: "Filter by type: hero_image, banner, gallery, background, logo" },
          source_type: { type: "string", description: "Filter by source: ai_generated, uploaded, venue" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_hero_images",
      description: "AI-rank a set of candidate hero images for suitability to the current event. Uses event context, theme, audience, and optional brand kit to score and rank images. Returns ranked list with scores and explanations. Requires 2+ candidate images.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID for context" },
          candidate_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of media_asset IDs to rank",
          },
        },
        required: ["event_id", "candidate_ids"],
      },
    },
  },
  // ─── Phase 2: Upload, Brand Kit, Visual Pack tools ───────
  {
    type: "function",
    function: {
      name: "register_uploaded_media",
      description: "Register an image that the admin uploaded through the chat. Creates a media_assets record for the uploaded file. Call this when you see [UPLOADED_IMAGE: ...] in a message.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID to associate with" },
          file_path: { type: "string", description: "Storage path from the upload context" },
          file_name: { type: "string", description: "Original file name" },
          media_type: { type: "string", enum: ["hero_image", "banner", "gallery", "logo", "background"], description: "Type of media" },
        },
        required: ["file_path", "file_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_brand_kit",
      description: "Create a reusable brand kit with colors, typography, and visual mood for a client or workspace.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Brand kit name (e.g. 'Titan Cement Branding')" },
          client_id: { type: "string", description: "Client UUID to associate with" },
          primary_color: { type: "string", description: "Primary color hex (e.g. '#1E3A5F')" },
          secondary_color: { type: "string", description: "Secondary color hex" },
          accent_color: { type: "string", description: "Accent color hex" },
          typography_preference: { type: "string", enum: ["modern", "classic", "bold", "elegant", "minimal", "tech"], description: "Typography style" },
          visual_mood: { type: "array", items: { type: "string" }, description: "Visual mood keywords (e.g. ['premium', 'corporate', 'warm'])" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_brand_kit",
      description: "Retrieve a brand kit by client ID or name. Returns branding settings for use in image generation.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          name_search: { type: "string", description: "Search by brand kit name" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_visual_pack",
      description: "Save the current event's media assets and branding settings as a reusable visual pack.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Source event UUID" },
          pack_name: { type: "string", description: "Name for this visual pack" },
        },
        required: ["event_id", "pack_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_visual_pack",
      description: "Apply a previously saved visual pack to an event. First call with preview_only=true to show what will change, then call again with confirmed=true after admin approval.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Target event UUID" },
          pack_name: { type: "string", description: "Visual pack name to apply" },
          preview_only: { type: "boolean", description: "If true, return a summary of changes without applying. Default true." },
          confirmed: { type: "boolean", description: "Set to true only after admin confirms the preview. Executes the actual copy." },
        },
        required: ["event_id", "pack_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_analytics_summary",
      description: "Get analytics summary for a specific event: RSVP rate, attendance rate, no-show %, check-in count, message performance, and auto-generated insights.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workspace_analytics_summary",
      description: "Get workspace-level analytics: total events, total attendees, average RSVP rate, average attendance rate, average no-show rate, and top-performing events.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // ─── Communication Tools ───────────────────────────────
  {
    type: "function",
    function: {
      name: "prepare_communication_campaign",
      description: "Create a draft communication campaign for an event. Returns a preview summary with audience count and channels. Requires confirmation before sending.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
          campaign_type: { type: "string", enum: ["invitation", "attendance_confirmation", "reminder", "check_in", "follow_up"], description: "Type of campaign" },
          channels: { type: "array", items: { type: "string", enum: ["email", "whatsapp"] }, description: "Delivery channels" },
          audience_segment: { type: "string", enum: ["all", "pending", "confirmed"], description: "Audience segment (default: all)" },
        },
        required: ["event_id", "campaign_type", "channels"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_communication_campaign",
      description: "Send a previously prepared draft campaign. Only call AFTER admin confirms the preview.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign UUID to send" },
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["campaign_id", "event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_confirmation_stats",
      description: "Get attendance confirmation statistics for an event: invited, confirmed, pending, declined, confirmation rate, and channel breakdown.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_confirmation_segments",
      description: "List attendee segments: confirmed, pending, needs reminder. Returns counts and sample names for each segment.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_communication_performance",
      description: "Get communication delivery performance for an event: sent, delivered, opened, replied, failed — with channel breakdown.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_event_campaigns",
      description: "List all communication campaigns for an event with their status and delivery stats.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event UUID" },
        },
        required: ["event_id"],
      },
    },
  },
];

// ─── Tool Executor ─────────────────────────────────────────
type SupabaseClient = ReturnType<typeof createClient>;

interface ToolResult {
  success: boolean;
  result: Record<string, unknown>;
  error?: string;
  category?: FailureCategory;
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  db: SupabaseClient,
  userId: string,
  correlationId: string,
): Promise<ToolResult> {
  console.log(`[${correlationId}] tool=${toolName} args=${JSON.stringify(args)}`);

  try {
    switch (toolName) {
      case "find_or_create_client":
        return await toolFindOrCreateClient(db, userId, args as any);
      case "create_event_draft":
        return await toolCreateEventDraft(db, userId, args as any);
      case "update_event_basics":
        return await toolUpdateEventBasics(db, userId, args as any);
      case "set_event_venue":
        return await toolSetEventVenue(db, userId, args as any);
      case "search_venue_on_maps":
        return await toolSearchVenueOnMaps(db, userId, args as any, correlationId);
      case "save_selected_venue":
        return await toolSaveSelectedVenue(db, userId, args as any);
      case "get_venue_photos":
        return await toolGetVenuePhotos(db, userId, args as any, correlationId);
      case "save_selected_venue_photos":
        return await toolSaveSelectedVenuePhotos(db, userId, args as any);
      case "add_attendees_from_text":
        return await toolAddAttendeesFromText(db, userId, args as any);
      case "add_agenda_items":
        return await toolAddAgendaItems(db, userId, args as any);
      case "check_publish_readiness":
        return await toolCheckPublishReadiness(db, userId, args as any);
      case "generate_full_event_proposal":
        return await toolGenerateFullEventProposal(db, userId, args as any, correlationId);
      case "save_event_proposal":
        return await toolSaveEventProposal(db, userId, args as any, correlationId);
      case "apply_template":
        return await toolApplyTemplate(db, userId, args as any, correlationId);
      case "list_workspace_events":
        return await toolListWorkspaceEvents(db, userId, args as any);
      case "list_workspace_clients":
        return await toolListWorkspaceClients(db, userId, args as any);
      case "get_event_details":
        return await toolGetEventDetails(db, userId, args as any);
      case "get_client_details":
        return await toolGetClientDetails(db, userId, args as any);
      case "list_events_by_client":
        return await toolListEventsByClient(db, userId, args as any);
      case "publish_event":
        return await toolPublishEvent(db, userId, args as any);
      case "unpublish_event":
        return await toolUnpublishEvent(db, userId, args as any);
      case "archive_event":
        return await toolArchiveEvent(db, userId, args as any);
      case "duplicate_event":
        return await toolDuplicateEvent(db, userId, args as any);
      case "rename_event":
        return await toolRenameEvent(db, userId, args as any);
      case "get_missing_fields":
        return await toolGetMissingFields(db, userId, args as any);
      case "recommend_next_actions":
        return await toolRecommendNextActions(db, userId, args as any);
      case "generate_event_image":
        return await toolGenerateEventImage(db, userId, args as any, correlationId);
      case "save_media_to_event":
        return await toolSaveMediaToEvent(db, userId, args as any, correlationId);
      case "list_media_library":
        return await toolListMediaLibrary(db, userId, args as any);
      case "register_uploaded_media":
        return await toolRegisterUploadedMedia(db, userId, args as any, correlationId);
      case "create_brand_kit":
        return await toolCreateBrandKit(db, userId, args as any);
      case "get_brand_kit":
        return await toolGetBrandKit(db, userId, args as any);
      case "save_visual_pack":
        return await toolSaveVisualPack(db, userId, args as any, correlationId);
      case "apply_visual_pack":
        return await toolApplyVisualPack(db, userId, args as any, correlationId);
      case "get_event_analytics_summary":
        return await toolGetEventAnalytics(db, userId, args as any);
      case "get_workspace_analytics_summary":
        return await toolGetWorkspaceAnalytics(db, userId);
      case "prepare_communication_campaign":
        return await toolPrepareCommunicationCampaign(db, userId, args as any);
      case "send_communication_campaign":
        return await toolSendCommunicationCampaign(db, userId, args as any, correlationId);
      case "get_event_confirmation_stats":
        return await toolGetEventConfirmationStats(db, userId, args as any);
      case "list_confirmation_segments":
        return await toolListConfirmationSegments(db, userId, args as any);
      case "get_communication_performance":
        return await toolGetCommunicationPerformance(db, userId, args as any);
      case "list_event_campaigns":
        return await toolListEventCampaigns(db, userId, args as any);
      default:
        return { success: false, result: {}, error: `Unknown tool: ${toolName}`, category: "internal" };
    }
  } catch (err) {
    console.error(`[${correlationId}] tool error:`, err);
    const classified = classifyError(err);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }
}

// ─── Authorization Helpers ─────────────────────────────────

async function isAdminOrOwnerRole(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "owner"]);
  return (data?.length ?? 0) > 0;
}

async function canManageClient(db: SupabaseClient, userId: string, clientId: string): Promise<boolean> {
  const { data } = await db
    .from("clients")
    .select("id, created_by")
    .eq("id", clientId)
    .single();
  if (!data) return false;
  if (data.created_by === userId) return true;
  return await isAdminOrOwnerRole(db, userId);
}

async function canManageEvent(db: SupabaseClient, userId: string, eventId: string): Promise<{ allowed: boolean; event?: any }> {
  const { data: evt } = await db.from("events").select("*").eq("id", eventId).single();
  if (!evt) return { allowed: false };
  if (evt.created_by === userId) return { allowed: true, event: evt };
  if (await isAdminOrOwnerRole(db, userId)) return { allowed: true, event: evt };
  return { allowed: false };
}

// ─── Tool Implementations ──────────────────────────────────

async function toolFindOrCreateClient(
  db: SupabaseClient, userId: string,
  args: { name: string; slug?: string }
): Promise<ToolResult> {
  const { name, slug } = args;
  if (!name?.trim()) return { success: false, result: {}, error: "Client name is required", category: "validation" };

  const isPrivileged = await isAdminOrOwnerRole(db, userId);

  let query = db.from("clients").select("id, name, slug").ilike("name", name.trim()).limit(1);
  if (!isPrivileged) query = query.eq("created_by", userId);

  const { data: existing } = await query.single();

  if (existing) {
    return { success: true, result: { client_id: existing.id, name: existing.name, slug: existing.slug, action: "found_existing" } };
  }

  const clientSlug = slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: created, error } = await db
    .from("clients")
    .insert({ name: name.trim(), slug: clientSlug, created_by: userId })
    .select("id, name, slug")
    .single();

  if (error) {
    console.error(`[toolFindOrCreateClient] insert error: ${error.code} ${error.message}`);
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }
  return { success: true, result: { client_id: created.id, name: created.name, slug: created.slug, action: "created_new" } };
}

async function toolCreateEventDraft(
  db: SupabaseClient, userId: string,
  args: { title: string; client_id?: string; description?: string; start_date?: string; end_date?: string; location?: string; slug?: string }
): Promise<ToolResult> {
  if (!args.title?.trim()) return { success: false, result: {}, error: "Event title is required", category: "validation" };

  if (args.client_id) {
    const canManage = await canManageClient(db, userId, args.client_id);
    if (!canManage) return { success: false, result: {}, error: "You don't have permission to create events for this client", category: "permission" };
  }

  const startDate = args.start_date || new Date().toISOString();
  const endDate = args.end_date || new Date(Date.now() + 86400000).toISOString();
  const eventSlug = args.slug || args.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const insertData: Record<string, unknown> = {
    title: args.title.trim(),
    created_by: userId,
    status: "draft",
    start_date: startDate,
    end_date: endDate,
    slug: eventSlug,
  };
  if (args.client_id) insertData.client_id = args.client_id;
  if (args.description) insertData.description = args.description.trim();
  if (args.location) insertData.location = args.location.trim();

  const { data, error } = await db
    .from("events")
    .insert(insertData)
    .select("id, title, slug, status, start_date, end_date, client_id")
    .single();

  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }
  return { success: true, result: { event_id: data.id, title: data.title, slug: data.slug, status: data.status } };
}

async function toolUpdateEventBasics(
  db: SupabaseClient, userId: string,
  args: { event_id: string; [key: string]: unknown }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };

  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const updateFields: Record<string, unknown> = {};
  const allowedFields = ["title", "description", "start_date", "end_date", "location", "theme_id", "max_attendees"];
  for (const k of allowedFields) {
    if (args[k] !== undefined) updateFields[k] = args[k];
  }

  if (Object.keys(updateFields).length === 0) return { success: false, result: {}, error: "No fields to update", category: "validation" };

  const { error } = await db.from("events").update(updateFields).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, updated_fields: Object.keys(updateFields) } };
}

async function toolSetEventVenue(
  db: SupabaseClient, userId: string,
  args: { event_id: string; venue_name?: string; venue_address?: string; venue_map_link?: string; venue_notes?: string }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };

  const { allowed } = await canManageEvent(db, userId, args.event_id);
  if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const updateFields: Record<string, unknown> = {};
  if (args.venue_name) updateFields.venue_name = args.venue_name.trim();
  if (args.venue_address) updateFields.venue_address = args.venue_address.trim();
  if (args.venue_map_link) updateFields.venue_map_link = args.venue_map_link.trim();
  if (args.venue_notes) updateFields.venue_notes = args.venue_notes.trim();

  if (Object.keys(updateFields).length === 0) return { success: false, result: {}, error: "No venue fields provided", category: "validation" };

  const { error } = await db.from("events").update(updateFields).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, venue: updateFields } };
}

// ─── Venue Search & Photos Tools (Places API New) ──────────

const PLACES_API_NEW_BASE = "https://places.googleapis.com/v1";

async function toolSearchVenueOnMaps(
  db: SupabaseClient, userId: string,
  args: { query: string; event_id?: string },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.query?.trim()) return { success: false, result: {}, error: "Search query is required", category: "validation" };

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return { success: false, result: {}, error: "Google Maps integration is not configured. Please add GOOGLE_MAPS_API_KEY.", category: "external_api" };

  if (args.event_id) {
    const { allowed } = await canManageEvent(db, userId, args.event_id);
    if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };
  }

  try {
    // Places API (New) — Text Search
    const url = `${PLACES_API_NEW_BASE}/places:searchText`;
    const body = { textQuery: args.query.trim(), maxResultCount: 5 };
    const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.googleMapsUri";

    console.log(`[${correlationId}] Places API (New) searchText: "${args.query}" fieldMask=${fieldMask}`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    const responseText = await resp.text();
    console.log(`[${correlationId}] Places API status=${resp.status} bodyLength=${responseText.length}`);

    if (!resp.ok) {
      console.error(`[${correlationId}] Places API error response: ${responseText.substring(0, 500)}`);
      if (resp.status === 403) {
        return { success: false, result: {}, error: "Google Places API access denied. Check API key restrictions and ensure Places API (New) is enabled in Google Cloud Console.", category: "external_api" };
      }
      if (resp.status === 429) {
        return { success: false, result: {}, error: "Google Places API rate limit reached. Please try again in a moment.", category: "external_api" };
      }
      return { success: false, result: {}, error: `Venue search service error (HTTP ${resp.status}). Please try again.`, category: "external_api" };
    }

    const data = JSON.parse(responseText);

    if (!data.places?.length) {
      console.log(`[${correlationId}] No places found for query: "${args.query}"`);
      return { success: true, result: { venues: [], message: "No venues found for that query. Try a different name or add the city." } };
    }

    console.log(`[${correlationId}] Found ${data.places.length} places`);

    const venues = data.places.map((p: any) => ({
      place_id: p.id,
      name: p.displayName?.text || p.displayName || "Unknown",
      address: p.formattedAddress || "",
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingCount ?? 0,
      map_url: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      has_photos: (p.photos?.length || 0) > 0,
    }));

    return { success: true, result: { venues, query: args.query } };
  } catch (err) {
    console.error(`[${correlationId}] venue search error:`, err);
    return { success: false, result: {}, error: "Failed to search for venues. Please try again.", category: "external_api" };
  }
}

async function toolSaveSelectedVenue(
  db: SupabaseClient, userId: string,
  args: { event_id: string; place_id: string; name: string; address: string; lat: number; lng: number; map_url?: string }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };
  if (!args.place_id || !args.name) return { success: false, result: {}, error: "place_id and name are required", category: "validation" };

  const { allowed } = await canManageEvent(db, userId, args.event_id);
  if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const updateFields: Record<string, unknown> = {
    venue_name: args.name.trim(),
    venue_address: args.address.trim(),
    venue_lat: args.lat,
    venue_lng: args.lng,
    venue_place_id: args.place_id,
  };
  if (args.map_url) updateFields.venue_map_link = args.map_url;

  const { error } = await db.from("events").update(updateFields).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return {
    success: true,
    result: {
      event_id: args.event_id,
      venue_name: args.name,
      venue_address: args.address,
      place_id: args.place_id,
      action: "venue_saved",
    },
  };
}

async function toolGetVenuePhotos(
  db: SupabaseClient, userId: string,
  args: { place_id: string; event_id?: string },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.place_id) return { success: false, result: {}, error: "place_id is required", category: "validation" };

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return { success: false, result: {}, error: "Google Maps integration is not configured.", category: "external_api" };

  if (args.event_id) {
    const { allowed } = await canManageEvent(db, userId, args.event_id);
    if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };
  }

  try {
    // Places API (New) — Place Details for photos
    const url = `${PLACES_API_NEW_BASE}/places/${encodeURIComponent(args.place_id)}`;
    const fieldMask = "photos";

    console.log(`[${correlationId}] Places API (New) getPlace photos: ${args.place_id}`);

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    });

    const responseText = await resp.text();
    console.log(`[${correlationId}] Places photos API status=${resp.status} bodyLength=${responseText.length}`);

    if (!resp.ok) {
      console.error(`[${correlationId}] Places photos API error: ${responseText.substring(0, 500)}`);
      return { success: false, result: {}, error: "Photo service temporarily unavailable", category: "external_api" };
    }

    const data = JSON.parse(responseText);

    if (!data.photos?.length) {
      return { success: true, result: { photos: [], message: "No photos available for this venue." } };
    }

    console.log(`[${correlationId}] Found ${data.photos.length} photos for place ${args.place_id}`);

    // Places API (New) photos have `name` field like "places/PLACE_ID/photos/PHOTO_REF"
    const photos = data.photos.slice(0, 10).map((p: any, idx: number) => ({
      index: idx,
      photo_reference: p.name, // full resource name e.g. "places/xxx/photos/yyy"
      width: p.widthPx || 0,
      height: p.heightPx || 0,
      attributions: (p.authorAttributions || []).map((a: any) => a.displayName || a.uri || ""),
      // Places API (New) photo media URL
      preview_url: `${PLACES_API_NEW_BASE}/${p.name}/media?maxWidthPx=800&key=${apiKey}`,
    }));

    return { success: true, result: { photos, place_id: args.place_id, total: data.photos.length } };
  } catch (err) {
    console.error(`[${correlationId}] venue photos error:`, err);
    return { success: false, result: {}, error: "Failed to fetch venue photos.", category: "external_api" };
  }
}

async function toolSaveSelectedVenuePhotos(
  db: SupabaseClient, userId: string,
  args: { event_id: string; selected_photos: Array<{ photo_reference: string; width?: number; height?: number; attributions?: string[] }> }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };
  if (!args.selected_photos?.length) return { success: false, result: {}, error: "No photos selected", category: "validation" };

  const { allowed } = await canManageEvent(db, userId, args.event_id);
  if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const photoRefs = args.selected_photos.map(p => ({
    photo_reference: p.photo_reference,
    width: p.width || null,
    height: p.height || null,
    attributions: p.attributions || [],
  }));

  const { error } = await db.from("events").update({ venue_photo_refs: photoRefs }).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, saved_count: photoRefs.length, action: "photos_saved" } };
}

// ─── Existing Tools ────────────────────────────────────────

async function toolAddAttendeesFromText(
  db: SupabaseClient, userId: string,
  args: { event_id: string; text: string }
): Promise<ToolResult> {
  if (!args.event_id || !args.text?.trim()) return { success: false, result: {}, error: "event_id and text are required", category: "validation" };

  const { allowed } = await canManageEvent(db, userId, args.event_id);
  if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const lines = args.text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
  const attendees: Array<{ name: string; email: string; event_id: string }> = [];
  const skipped: string[] = [];

  for (const line of lines) {
    const angleMatch = line.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
    if (angleMatch) {
      attendees.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim(), event_id: args.event_id });
      continue;
    }
    const spaceEmailMatch = line.match(/^(.+?)\s+(\S+@\S+\.\S+)$/);
    if (spaceEmailMatch) {
      attendees.push({ name: spaceEmailMatch[1].trim(), email: spaceEmailMatch[2].trim(), event_id: args.event_id });
      continue;
    }
    if (line.includes("@")) {
      const namePart = line.split("@")[0].replace(/[._]/g, " ");
      attendees.push({ name: namePart, email: line, event_id: args.event_id });
      continue;
    }
    if (line.length > 1) {
      const placeholder = `${line.toLowerCase().replace(/\s+/g, ".")}@placeholder.local`;
      attendees.push({ name: line, email: placeholder, event_id: args.event_id });
    } else {
      skipped.push(line);
    }
  }

  if (attendees.length === 0) return { success: false, result: { skipped }, error: "No valid attendees parsed from text", category: "parsing" };

  const { error } = await db.from("attendees").insert(attendees);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { added: attendees.length, skipped: skipped.length, names: attendees.map(a => a.name) } };
}

async function toolAddAgendaItems(
  db: SupabaseClient, userId: string,
  args: { event_id: string; items: Array<{ title: string; description?: string; start_time?: string; end_time?: string; day_number?: number }> }
): Promise<ToolResult> {
  if (!args.event_id || !args.items?.length) return { success: false, result: {}, error: "event_id and items are required", category: "validation" };

  const { allowed } = await canManageEvent(db, userId, args.event_id);
  if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const { data: existing } = await db
    .from("agenda_items")
    .select("order_index")
    .eq("event_id", args.event_id)
    .order("order_index", { ascending: false })
    .limit(1);
  let nextIndex = (existing?.[0]?.order_index ?? -1) + 1;

  const rows = args.items.map((item) => ({
    event_id: args.event_id,
    title: item.title,
    description: item.description || null,
    start_time: item.start_time || null,
    end_time: item.end_time || null,
    day_number: item.day_number || 1,
    order_index: nextIndex++,
  }));

  const { error } = await db.from("agenda_items").insert(rows);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { added: rows.length, titles: rows.map(r => r.title) } };
}

async function toolCheckPublishReadiness(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };

  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const { count: attendeeCount } = await db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", args.event_id);
  const { count: agendaCount } = await db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", args.event_id);
  const { count: inviteCount } = await db.from("event_invites").select("id", { count: "exact", head: true }).eq("event_id", args.event_id);

  const checks = [
    { key: "client", label: "Client selected", ok: !!evt.client_id },
    { key: "title", label: "Event title", ok: !!evt.title?.trim() },
    { key: "slug", label: "Public URL slug", ok: !!evt.slug?.trim() },
    { key: "date", label: "Event date", ok: !!evt.event_date || !!evt.start_date },
    { key: "description", label: "Description", ok: !!evt.description?.trim() },
    { key: "hero", label: "Hero/cover image", ok: Array.isArray(evt.hero_images) && evt.hero_images.length > 0 },
    { key: "venue", label: "Venue or location", ok: !!(evt.venue_name?.trim() || evt.venue?.trim() || evt.location?.trim()) },
    { key: "attendees", label: "Attendees added", ok: (attendeeCount || 0) > 0 },
    { key: "agenda", label: "Agenda items", ok: (agendaCount || 0) > 0 },
  ];

  const passed = checks.filter(c => c.ok).length;
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  const score = Math.round((passed / checks.length) * 100);
  const ready = missing.length === 0;

  const nextSteps: string[] = [];
  if (!evt.client_id) nextSteps.push("Link a client to this event");
  if (!(attendeeCount || 0)) nextSteps.push("Add attendees");
  if (!(agendaCount || 0)) nextSteps.push("Create an agenda");
  if (!evt.description?.trim()) nextSteps.push("Add a description");
  if (!(Array.isArray(evt.hero_images) && evt.hero_images.length > 0)) nextSteps.push("Upload a hero image (via Hero Section in workspace)");

  return {
    success: true,
    result: {
      ready,
      score,
      passed,
      total: checks.length,
      missing,
      next_steps: nextSteps.slice(0, 3),
      attendee_count: attendeeCount || 0,
      agenda_count: agendaCount || 0,
    },
  };
}

// ─── Event Proposal Tools ──────────────────────────────────

async function toolGenerateFullEventProposal(
  db: SupabaseClient, userId: string,
  args: { description: string; client_name?: string; event_type?: string; expected_attendees?: number; duration_days?: number },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.description?.trim()) return { success: false, result: {}, error: "Event description is required", category: "validation" };

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return { success: false, result: {}, error: "AI not configured", category: "internal" };

  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
  const durationDays = args.duration_days || 1;

  const generationPrompt = `Generate a complete event proposal as JSON. The event should be professional and realistic.

Input:
- Description: ${args.description}
${args.client_name ? `- Client: ${args.client_name}` : ""}
${args.event_type ? `- Type: ${args.event_type}` : ""}
${args.expected_attendees ? `- Expected attendees: ${args.expected_attendees}` : ""}
- Duration: ${durationDays} day(s)

Return ONLY a JSON object with this exact structure:
{
  "client": { "name": "string", "slug": "lowercase-hyphenated" },
  "event": {
    "title": "string",
    "slug": "lowercase-hyphenated",
    "description": "2-3 sentence description",
    "start_date": "ISO datetime",
    "end_date": "ISO datetime",
    "location": "city/region text",
    "theme_id": "one of: corporate, elegant, modern, midnight-gala, creative-festival, tech-summit, nature-wellness, corporate-mui",
    "max_attendees": number
  },
  "agenda": [
    { "title": "string", "description": "string", "start_time": "HH:MM", "end_time": "HH:MM", "day_number": number }
  ],
  "venue_suggestion": "suggested venue name and city",
  "attendee_structure": {
    "target_count": number,
    "suggested_groups": ["group name 1", "group name 2"],
    "audience_description": "who should attend"
  },
  "communications": {
    "invitation_subject": "string",
    "invitation_body": "short invitation text",
    "reminder_subject": "string",
    "reminder_body": "short reminder text"
  },
  "branding": {
    "theme_id": "same as event.theme_id",
    "color_mood": "description of color palette mood",
    "tagline": "short catchy tagline for the event"
  },
  "publish_guidance": ["list of things needed before publishing"]
}

Create a realistic, well-paced agenda with appropriate breaks for ${durationDays} day(s). Set dates starting 30 days from now.`;

  try {
    const resp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an expert event planner. Return ONLY valid JSON, no markdown fences." },
          { role: "user", content: generationPrompt },
        ],
        temperature: 0.6,
        max_completion_tokens: 3000,
      }),
    });

    if (!resp.ok) {
      console.error(`[${correlationId}] proposal generation OpenAI error: ${resp.status}`);
      return { success: false, result: {}, error: "AI service temporarily unavailable", category: "external_api" };
    }

    const aiResult = await resp.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    let proposal: any;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
      proposal = JSON.parse(jsonStr);
    } catch {
      console.error(`[${correlationId}] Failed to parse proposal JSON:`, rawContent.substring(0, 200));
      return { success: false, result: {}, error: "AI returned an invalid proposal format. Please try again.", category: "parsing" };
    }

    return {
      success: true,
      result: {
        proposal,
        action: "proposal_generated",
        message: "Event proposal generated — awaiting admin review before saving.",
      },
    };
  } catch (err) {
    console.error(`[${correlationId}] proposal generation error:`, err);
    return { success: false, result: {}, error: "Failed to generate event proposal", category: "internal" };
  }
}

async function toolSaveEventProposal(
  db: SupabaseClient, userId: string,
  args: { proposal: any },
  correlationId: string,
): Promise<ToolResult> {
  const proposal = args.proposal;
  if (!proposal?.event?.title) return { success: false, result: {}, error: "Invalid proposal — missing event title", category: "validation" };

  const savedEntities: Record<string, unknown> = {};
  const failures: string[] = [];

  // 1. Find or create client
  if (proposal.client?.name) {
    const clientResult = await toolFindOrCreateClient(db, userId, {
      name: proposal.client.name,
      slug: proposal.client.slug,
    });
    if (clientResult.success) {
      savedEntities.client_id = clientResult.result.client_id;
      savedEntities.client_name = clientResult.result.name;
    } else {
      failures.push(`Client: ${clientResult.error}`);
    }
  }

  // 2. Create event draft
  const eventArgs: any = {
    title: proposal.event.title,
    description: proposal.event.description,
    start_date: proposal.event.start_date,
    end_date: proposal.event.end_date,
    location: proposal.event.location,
    slug: proposal.event.slug,
  };
  if (savedEntities.client_id) eventArgs.client_id = savedEntities.client_id;

  const eventResult = await toolCreateEventDraft(db, userId, eventArgs);
  if (!eventResult.success) {
    return { success: false, result: { savedEntities, failures }, error: `Failed to create event: ${eventResult.error}`, category: eventResult.category };
  }
  const eventId = eventResult.result.event_id as string;
  savedEntities.event_id = eventId;
  savedEntities.event_title = eventResult.result.title;

  // 3. Update theme if specified
  if (proposal.event.theme_id || proposal.event.max_attendees) {
    const updateArgs: any = { event_id: eventId };
    if (proposal.event.theme_id) updateArgs.theme_id = proposal.event.theme_id;
    if (proposal.event.max_attendees) updateArgs.max_attendees = proposal.event.max_attendees;
    const updateResult = await toolUpdateEventBasics(db, userId, updateArgs);
    if (!updateResult.success) failures.push(`Theme/settings: ${updateResult.error}`);
  }

  // 4. Add agenda items
  if (proposal.agenda?.length > 0) {
    const agendaResult = await toolAddAgendaItems(db, userId, {
      event_id: eventId,
      items: proposal.agenda,
    });
    if (agendaResult.success) {
      savedEntities.agenda_count = agendaResult.result.added;
    } else {
      failures.push(`Agenda: ${agendaResult.error}`);
    }
  }

  return {
    success: true,
    result: {
      ...savedEntities,
      failures: failures.length > 0 ? failures : undefined,
      action: "proposal_saved",
      venue_suggestion: proposal.venue_suggestion || null,
      communications: proposal.communications || null,
      branding: proposal.branding || null,
    },
  };
}

async function toolApplyTemplate(
  db: SupabaseClient, userId: string,
  args: { search_query: string; template_id?: string; event_title?: string; client_id?: string; event_date?: string },
  correlationId: string,
): Promise<ToolResult> {
  // Step 1: Find template(s)
  let templates: any[] = [];

  if (args.template_id) {
    const { data } = await db.from("event_templates").select("*").eq("id", args.template_id).single();
    if (data) templates = [data];
  } else {
    // Search by name/description/tags
    const query = args.search_query.toLowerCase();
    const { data } = await db.from("event_templates")
      .select("id, name, description, category, tags, included_sections, comm_templates, is_featured, event_type, expected_attendees")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    templates = (data || []).filter((t: any) =>
      t.name.toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query) ||
      (t.tags || []).some((tag: string) => tag.toLowerCase().includes(query)) ||
      (t.category || "").toLowerCase().includes(query)
    );
  }

  if (templates.length === 0) {
    return { success: true, result: { action: "no_templates_found", query: args.search_query, templates: [] } };
  }

  // If no event_title provided, return search results for user to pick
  if (!args.event_title && !args.template_id) {
    return {
      success: true,
      result: {
        action: "templates_found",
        templates: templates.slice(0, 5).map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: t.tags,
          sections: t.included_sections,
          has_comms: Object.values(t.comm_templates || {}).some((v: any) => !!v),
          is_featured: t.is_featured,
          event_type: t.event_type,
        })),
      },
    };
  }

  // Step 2: Apply template — create event from it
  const tpl = templates[0];
  if (!tpl.template_data && args.template_id) {
    // Need full data
    const { data: fullTpl } = await db.from("event_templates").select("*").eq("id", tpl.id).single();
    if (fullTpl) Object.assign(tpl, fullTpl);
  }

  const td = tpl.template_data || {};
  const title = args.event_title || td.title || "New Event from Template";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const startDate = args.event_date ? new Date(args.event_date).toISOString() : new Date().toISOString();
  const endDate = args.event_date ? new Date(new Date(args.event_date).getTime() + 86400000).toISOString() : new Date(Date.now() + 86400000).toISOString();

  // Resolve client
  let clientId = args.client_id || tpl.client_id;

  // Create event
  const eventInsert: Record<string, unknown> = {
    created_by: userId,
    title,
    slug,
    start_date: startDate,
    end_date: endDate,
    status: "draft",
  };
  if (clientId) eventInsert.client_id = clientId;
  if (td.description) eventInsert.description = td.description;
  if (td.venue_name) eventInsert.venue_name = td.venue_name;
  if (td.venue_address) eventInsert.venue_address = td.venue_address;
  if (td.theme_id) eventInsert.theme_id = td.theme_id;
  if (td.location) eventInsert.location = td.location;
  if (td.max_attendees) eventInsert.max_attendees = td.max_attendees;
  if (args.event_date) eventInsert.event_date = args.event_date;

  const { data: newEvent, error: evErr } = await db.from("events").insert(eventInsert).select("id, title, slug").single();
  if (evErr) {
    const classified = classifyError(evErr, evErr.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  const eventId = newEvent.id;
  const cloned: string[] = [];

  // Clone agenda
  if (td.agenda_items?.length) {
    const rows = td.agenda_items.map((item: any, i: number) => ({
      event_id: eventId, title: item.title, description: item.description,
      start_time: item.start_time, end_time: item.end_time,
      day_number: item.day_number || 1, order_index: item.order_index ?? i,
    }));
    const { error } = await db.from("agenda_items").insert(rows);
    if (!error) cloned.push(`${rows.length} agenda items`);
  }

  // Clone speakers
  if (td.speakers?.length) {
    const rows = td.speakers.map((s: any) => ({ event_id: eventId, name: s.name, title: s.title, bio: s.bio, photo_url: s.photo_url }));
    const { error } = await db.from("speakers").insert(rows);
    if (!error) cloned.push(`${rows.length} speakers`);
  }

  // Clone organizers
  if (td.organizers?.length) {
    const rows = td.organizers.map((o: any) => ({ event_id: eventId, name: o.name, role: o.role, email: o.email, mobile: o.mobile, photo_url: o.photo_url }));
    const { error } = await db.from("organizers").insert(rows);
    if (!error) cloned.push(`${rows.length} organizers`);
  }

  console.log(`[${correlationId}] apply_template: created event ${eventId} from template ${tpl.id}, cloned: ${cloned.join(", ")}`);

  return {
    success: true,
    result: {
      action: "template_applied",
      event_id: eventId,
      event_title: newEvent.title,
      event_slug: newEvent.slug,
      template_name: tpl.name,
      cloned: cloned,
      comm_templates: tpl.comm_templates || {},
    },
  };
}

// ─── Retrieval Tool Implementations ────────────────────────

async function toolListWorkspaceEvents(
  db: SupabaseClient, userId: string,
  args: { status_filter?: string; search?: string; date_from?: string; date_to?: string; limit?: number }
): Promise<ToolResult> {
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  const maxResults = Math.min(args.limit || 20, 50);

  let query = db.from("events")
    .select("id, title, slug, status, start_date, end_date, location, venue_name, event_date, client_id, readiness, readiness_details, clients(name)")
    .order("updated_at", { ascending: false })
    .limit(maxResults);

  // Workspace scoping: admin/owner see all, regular users see their own
  if (!isPrivileged) {
    query = query.eq("created_by", userId);
  }

  if (args.status_filter) {
    query = query.eq("status", args.status_filter);
  }

  if (args.search) {
    query = query.or(`title.ilike.%${args.search}%,location.ilike.%${args.search}%,venue_name.ilike.%${args.search}%`);
  }

  if (args.date_from) {
    query = query.gte("start_date", args.date_from);
  }
  if (args.date_to) {
    query = query.lte("start_date", args.date_to);
  }

  const { data, error } = await query;

  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  // Batch-fetch attendee counts for listed events
  const eventIds = (data || []).map((e: any) => e.id);
  const attendeeCounts: Record<string, number> = {};
  if (eventIds.length > 0) {
    const { data: attData } = await db.from("attendees")
      .select("event_id")
      .in("event_id", eventIds);
    for (const a of (attData || [])) {
      attendeeCounts[a.event_id] = (attendeeCounts[a.event_id] || 0) + 1;
    }
  }

  const events = (data || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    date: e.event_date || e.start_date,
    end_date: e.end_date,
    location: e.location || e.venue_name || null,
    client_name: e.clients?.name || null,
    slug: e.slug,
    readiness: e.readiness ?? false,
    readiness_score: (e.readiness_details as any)?.score ?? null,
    attendee_count: attendeeCounts[e.id] || 0,
  }));

  return {
    success: true,
    result: {
      events,
      total: events.length,
      message: events.length === 0
        ? `No events found${args.status_filter ? ` with status "${args.status_filter}"` : ""}${args.search ? ` matching "${args.search}"` : ""}.`
        : `Found ${events.length} event${events.length !== 1 ? "s" : ""}.`,
    },
  };
}

async function toolListWorkspaceClients(
  db: SupabaseClient, userId: string,
  args: { search?: string; limit?: number }
): Promise<ToolResult> {
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  const maxResults = Math.min(args.limit || 20, 50);

  let query = db.from("clients")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(maxResults);

  if (!isPrivileged) {
    query = query.eq("created_by", userId);
  }

  if (args.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  const clients = (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  return {
    success: true,
    result: {
      clients,
      total: clients.length,
      message: clients.length === 0
        ? `No clients found${args.search ? ` matching "${args.search}"` : ""}.`
        : `Found ${clients.length} client${clients.length !== 1 ? "s" : ""}.`,
    },
  };
}

async function toolGetEventDetails(
  db: SupabaseClient, userId: string,
  args: { event_id?: string; title_search?: string }
): Promise<ToolResult> {
  if (!args.event_id && !args.title_search) {
    return { success: false, result: {}, error: "Provide either event_id or title_search", category: "validation" };
  }

  let eventData: any = null;

  if (args.event_id) {
    const check = await canManageEvent(db, userId, args.event_id);
    if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };
    eventData = check.event;
  } else {
    // Search by title
    const isPrivileged = await isAdminOrOwnerRole(db, userId);
    let query = db.from("events").select("*").ilike("title", `%${args.title_search}%`).limit(1);
    if (!isPrivileged) query = query.eq("created_by", userId);
    const { data } = await query.single();
    if (!data) return { success: true, result: { found: false, message: `No event found matching "${args.title_search}".` } };
    eventData = data;
  }

  // Get counts
  const eid = eventData.id;
  const [attRes, agdRes, orgRes, spkRes] = await Promise.all([
    db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eid),
    db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", eid),
    db.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", eid),
    db.from("speakers" as any).select("id", { count: "exact", head: true }).eq("event_id", eid),
  ]);

  // Get client name
  let clientName: string | null = null;
  if (eventData.client_id) {
    const { data: cl } = await db.from("clients").select("name").eq("id", eventData.client_id).single();
    if (cl) clientName = cl.name;
  }

  return {
    success: true,
    result: {
      found: true,
      event: {
        id: eventData.id,
        title: eventData.title,
        slug: eventData.slug,
        status: eventData.status,
        description: eventData.description,
        date: eventData.event_date || eventData.start_date,
        end_date: eventData.end_date,
        location: eventData.location,
        venue_name: eventData.venue_name,
        venue_address: eventData.venue_address,
        theme: eventData.theme_id,
        client_name: clientName,
        max_attendees: eventData.max_attendees,
        readiness: eventData.readiness ?? false,
        readiness_score: (eventData.readiness_details as any)?.score ?? null,
        readiness_missing: (eventData.readiness_details as any)?.missing ?? [],
      },
      counts: {
        attendees: attRes.count ?? 0,
        agenda_items: agdRes.count ?? 0,
        organizers: orgRes.count ?? 0,
        speakers: (spkRes as any).count ?? 0,
      },
    },
  };
}

// ─── Phase 1 Additional Retrieval Tools ────────────────────

async function toolGetClientDetails(
  db: SupabaseClient, userId: string,
  args: { client_id?: string; name_search?: string }
): Promise<ToolResult> {
  if (!args.client_id && !args.name_search) {
    return { success: false, result: {}, error: "Provide either client_id or name_search", category: "validation" };
  }

  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let clientData: any = null;

  if (args.client_id) {
    const canManage = await canManageClient(db, userId, args.client_id);
    if (!canManage) return { success: false, result: {}, error: "Client not found or access denied", category: "permission" };
    const { data } = await db.from("clients").select("*").eq("id", args.client_id).single();
    clientData = data;
  } else {
    let query = db.from("clients").select("*").ilike("name", `%${args.name_search}%`).limit(1);
    if (!isPrivileged) query = query.eq("created_by", userId);
    const { data } = await query.single();
    if (!data) return { success: true, result: { found: false, message: `No client found matching "${args.name_search}".` } };
    clientData = data;
  }

  // Count events for this client
  let evQuery = db.from("events").select("id, title, status, start_date", { count: "exact" }).eq("client_id", clientData.id).limit(5).order("updated_at", { ascending: false });
  if (!isPrivileged) evQuery = evQuery.eq("created_by", userId);
  const { data: recentEvents, count: eventCount } = await evQuery;

  return {
    success: true,
    result: {
      found: true,
      client: { id: clientData.id, name: clientData.name, slug: clientData.slug, created_at: clientData.created_at },
      event_count: eventCount ?? 0,
      recent_events: (recentEvents || []).map((e: any) => ({ id: e.id, title: e.title, status: e.status, date: e.start_date })),
    },
  };
}

async function toolListEventsByClient(
  db: SupabaseClient, userId: string,
  args: { client_id?: string; client_name?: string; status_filter?: string; limit?: number }
): Promise<ToolResult> {
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let clientId = args.client_id;

  if (!clientId && args.client_name) {
    let cq = db.from("clients").select("id").ilike("name", `%${args.client_name}%`).limit(1);
    if (!isPrivileged) cq = cq.eq("created_by", userId);
    const { data: cl } = await cq.single();
    if (!cl) return { success: true, result: { events: [], total: 0, message: `No client found matching "${args.client_name}".` } };
    clientId = cl.id;
  }

  if (!clientId) return { success: false, result: {}, error: "Provide either client_id or client_name", category: "validation" };

  const maxResults = Math.min(args.limit || 20, 50);
  let query = db.from("events")
    .select("id, title, slug, status, start_date, end_date, location, venue_name, event_date")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(maxResults);

  if (!isPrivileged) query = query.eq("created_by", userId);
  if (args.status_filter) query = query.eq("status", args.status_filter);

  const { data, error } = await query;
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  const events = (data || []).map((e: any) => ({
    id: e.id, title: e.title, status: e.status, date: e.event_date || e.start_date, location: e.location || e.venue_name,
  }));

  return { success: true, result: { events, total: events.length, message: events.length === 0 ? "No events found for this client." : `Found ${events.length} event${events.length !== 1 ? "s" : ""}.` } };
}

// ─── Phase 2 — Event Lifecycle Tools ───────────────────────

async function toolPublishEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  const check = await canManageEvent(db, userId, args.event_id);
  if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const evt = check.event;
  if (evt.status === "published" || evt.status === "ongoing") {
    return { success: true, result: { event_id: evt.id, status: evt.status, message: "Event is already published." } };
  }
  if (evt.status === "archived") {
    return { success: false, result: {}, error: "Cannot publish an archived event. Unarchive it first.", category: "validation" };
  }

  // Readiness check
  const missing: string[] = [];
  if (!evt.title?.trim()) missing.push("title");
  if (!evt.start_date) missing.push("start date");
  if (!evt.end_date) missing.push("end date");
  if (!evt.description?.trim()) missing.push("description");

  const { count: attCount } = await db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", args.event_id);
  if ((attCount ?? 0) === 0) missing.push("at least 1 attendee");

  if (missing.length > 0) {
    return {
      success: false,
      result: { missing },
      error: `Cannot publish — missing: ${missing.join(", ")}. Fix these and try again.`,
      category: "validation",
    };
  }

  const { error } = await db.from("events").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, status: "published", title: evt.title, message: `"${evt.title}" is now published!` } };
}

async function toolUnpublishEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  const check = await canManageEvent(db, userId, args.event_id);
  if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const evt = check.event;
  if (evt.status === "draft") {
    return { success: true, result: { event_id: evt.id, status: "draft", message: "Event is already a draft." } };
  }
  if (evt.status !== "published" && evt.status !== "ongoing") {
    return { success: false, result: {}, error: `Cannot unpublish event with status "${evt.status}".`, category: "validation" };
  }

  const { error } = await db.from("events").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, status: "draft", title: evt.title, message: `"${evt.title}" reverted to draft.` } };
}

async function toolArchiveEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  const check = await canManageEvent(db, userId, args.event_id);
  if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const evt = check.event;
  if (evt.status === "archived") {
    return { success: true, result: { event_id: evt.id, status: "archived", message: "Event is already archived." } };
  }

  const { error } = await db.from("events").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, status: "archived", title: evt.title, message: `"${evt.title}" has been archived.` } };
}

async function toolDuplicateEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string; new_title?: string }
): Promise<ToolResult> {
  const check = await canManageEvent(db, userId, args.event_id);
  if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const src = check.event;
  const newTitle = args.new_title || `${src.title} (Copy)`;
  const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: newEvt, error: evErr } = await db.from("events").insert({
    created_by: userId,
    title: newTitle,
    slug: newSlug,
    description: src.description,
    start_date: src.start_date,
    end_date: src.end_date,
    location: src.location,
    venue_name: src.venue_name,
    venue_address: src.venue_address,
    venue_lat: src.venue_lat,
    venue_lng: src.venue_lng,
    venue_place_id: src.venue_place_id,
    venue_map_link: src.venue_map_link,
    venue_notes: src.venue_notes,
    venue_images: src.venue_images,
    venue_photo_refs: src.venue_photo_refs,
    theme_id: src.theme_id,
    client_id: src.client_id,
    max_attendees: src.max_attendees,
    transportation_notes: src.transportation_notes,
    status: "draft",
  }).select("id, title, slug").single();

  if (evErr) {
    const classified = classifyError(evErr, evErr.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  const cloned: string[] = [];

  // Copy agenda
  const { data: agendaItems } = await db.from("agenda_items").select("title, description, start_time, end_time, day_number, order_index").eq("event_id", args.event_id);
  if (agendaItems?.length) {
    await db.from("agenda_items").insert(agendaItems.map((a: any) => ({ ...a, event_id: newEvt.id })));
    cloned.push(`${agendaItems.length} agenda items`);
  }

  // Copy organizers
  const { data: organizers } = await db.from("organizers").select("name, role, email, mobile, photo_url").eq("event_id", args.event_id);
  if (organizers?.length) {
    await db.from("organizers").insert(organizers.map((o: any) => ({ ...o, event_id: newEvt.id })));
    cloned.push(`${organizers.length} organizers`);
  }

  // Copy speakers
  const { data: speakers } = await db.from("speakers" as any).select("name, title, bio, photo_url").eq("event_id", args.event_id);
  if (speakers?.length) {
    await db.from("speakers" as any).insert((speakers as any[]).map((s: any) => ({ ...s, event_id: newEvt.id })));
    cloned.push(`${speakers.length} speakers`);
  }

  return {
    success: true,
    result: {
      event_id: newEvt.id,
      title: newEvt.title,
      slug: newEvt.slug,
      source_event_id: args.event_id,
      cloned,
      message: `Duplicated "${src.title}" → "${newEvt.title}" (draft). Copied: ${cloned.join(", ") || "event details only"}.`,
    },
  };
}

async function toolRenameEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string; new_title: string }
): Promise<ToolResult> {
  if (!args.new_title?.trim()) return { success: false, result: {}, error: "New title is required", category: "validation" };

  const check = await canManageEvent(db, userId, args.event_id);
  if (!check.allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const oldTitle = check.event.title;
  const { error } = await db.from("events").update({ title: args.new_title.trim(), updated_at: new Date().toISOString() }).eq("id", args.event_id);
  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return { success: true, result: { event_id: args.event_id, old_title: oldTitle, new_title: args.new_title.trim(), message: `Renamed "${oldTitle}" → "${args.new_title.trim()}"` } };
}

// ─── Intelligence Tools ────────────────────────────────────

async function toolGetMissingFields(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };

  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const [attRes, agdRes, orgRes, invRes] = await Promise.all([
    db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
    db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
    db.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
    db.from("event_invites").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
  ]);

  const fields = [
    { field: "client", label: "Client linked", ok: !!evt.client_id, priority: "high" },
    { field: "title", label: "Event title", ok: !!evt.title?.trim(), priority: "critical" },
    { field: "description", label: "Description", ok: !!evt.description?.trim(), priority: "high" },
    { field: "dates", label: "Start & end dates", ok: !!evt.start_date && !!evt.end_date, priority: "critical" },
    { field: "slug", label: "Public URL slug", ok: !!evt.slug?.trim(), priority: "high" },
    { field: "venue", label: "Venue or location", ok: !!(evt.venue_name?.trim() || evt.location?.trim()), priority: "medium" },
    { field: "hero_image", label: "Hero/cover image", ok: Array.isArray(evt.hero_images) && evt.hero_images.length > 0, priority: "medium" },
    { field: "attendees", label: "Attendees added", ok: (attRes.count ?? 0) > 0, priority: "high" },
    { field: "agenda", label: "Agenda items", ok: (agdRes.count ?? 0) > 0, priority: "medium" },
    { field: "organizers", label: "Organizers", ok: (orgRes.count ?? 0) > 0, priority: "low" },
  ];

  const missing = fields.filter(f => !f.ok);
  const complete = fields.filter(f => f.ok);
  const score = Math.round((complete.length / fields.length) * 100);

  // Persist readiness to events table
  const readinessDetails = { score, missing: missing.map(m => m.field), complete: complete.map(c => c.field), checked_at: new Date().toISOString() };
  await db.from("events").update({ readiness: missing.length === 0, readiness_details: readinessDetails }).eq("id", args.event_id);

  return {
    success: true,
    result: {
      event_id: args.event_id,
      title: evt.title,
      score,
      ready: missing.length === 0,
      missing: missing.map(m => ({ field: m.field, label: m.label, priority: m.priority })),
      complete: complete.map(c => c.label),
      counts: {
        attendees: attRes.count ?? 0,
        agenda_items: agdRes.count ?? 0,
        organizers: orgRes.count ?? 0,
        invitations_sent: invRes.count ?? 0,
      },
    },
  };
}

async function toolRecommendNextActions(
  db: SupabaseClient, userId: string,
  args: { event_id?: string }
): Promise<ToolResult> {
  const recommendations: Array<{ action: string; reason: string; priority: "high" | "medium" | "low"; tool?: string }> = [];

  if (args.event_id) {
    const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
    if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

    const [attRes, agdRes, orgRes, invRes] = await Promise.all([
      db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
      db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
      db.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
      db.from("event_invites").select("id", { count: "exact", head: true }).eq("event_id", args.event_id),
    ]);

    const attCount = attRes.count ?? 0;
    const agdCount = agdRes.count ?? 0;
    const orgCount = orgRes.count ?? 0;
    const invCount = invRes.count ?? 0;

    if (!evt.description?.trim()) recommendations.push({ action: "Add event description", reason: "Helps attendees understand the event purpose", priority: "high", tool: "update_event_basics" });
    if (!evt.venue_name?.trim() && !evt.location?.trim()) recommendations.push({ action: "Set event venue", reason: "Attendees need to know where to go", priority: "high", tool: "search_venue_on_maps" });
    if (attCount === 0) recommendations.push({ action: "Add attendees", reason: "No attendees added yet", priority: "high", tool: "add_attendees_from_text" });
    if (agdCount === 0) recommendations.push({ action: "Create agenda", reason: "Structured agenda improves event quality", priority: "medium", tool: "add_agenda_items" });
    if (orgCount === 0) recommendations.push({ action: "Add organizers", reason: "Shows who is running the event", priority: "low" });
    if (!(Array.isArray(evt.hero_images) && evt.hero_images.length > 0)) recommendations.push({ action: "Generate or add hero image", reason: "Visual appeal for the public page — I can generate one with AI", priority: "medium", tool: "generate_event_image" });
    if (attCount > 0 && invCount === 0) recommendations.push({ action: "Send invitations", reason: `${attCount} attendees added but no invitations sent`, priority: "high" });
    if (evt.status === "draft" && !evt.description?.trim()) {
      // Don't recommend publish if basics are missing
    } else if (evt.status === "draft" && attCount > 0 && agdCount > 0) {
      recommendations.push({ action: "Check publish readiness", reason: "Event may be ready to go live", priority: "medium", tool: "check_publish_readiness" });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      success: true,
      result: {
        event_id: args.event_id,
        title: evt.title,
        status: evt.status,
        recommendations: recommendations.slice(0, 5),
        total_recommendations: recommendations.length,
      },
    };
  }

  // Workspace-level recommendations
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let evQuery = db.from("events").select("id, title, status, start_date").eq("status", "draft").order("updated_at", { ascending: false }).limit(5);
  if (!isPrivileged) evQuery = evQuery.eq("created_by", userId);
  const { data: drafts } = await evQuery;

  if (drafts?.length) {
    recommendations.push({ action: `Review ${drafts.length} draft event(s)`, reason: "Draft events may need attention", priority: "medium" });
  } else {
    recommendations.push({ action: "Create a new event", reason: "No draft events in workspace", priority: "high", tool: "create_event_draft" });
  }

  return { success: true, result: { recommendations, scope: "workspace" } };
}

// ─── Analytics Tools ───────────────────────────────────────

async function toolGetEventAnalytics(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
): Promise<ToolResult> {
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const [attRes, invRes, msgRes] = await Promise.all([
    db.from("attendees").select("id, confirmed, checked_in_at").eq("event_id", args.event_id),
    db.from("event_invites").select("id, status, opened_at").eq("event_id", args.event_id),
    db.from("message_logs").select("id, status, channel").eq("event_id", args.event_id),
  ]);

  const att = attRes.data || [];
  const inv = invRes.data || [];
  const msgs = msgRes.data || [];

  const total = att.length;
  const confirmed = att.filter((a: any) => a.confirmed).length;
  const checkedIn = att.filter((a: any) => a.checked_in_at).length;
  const noShow = confirmed > 0 ? confirmed - checkedIn : 0;
  const rsvpRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const attendanceRate = confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0;
  const noShowRate = confirmed > 0 ? Math.round((noShow / confirmed) * 100) : 0;

  const messagesSent = msgs.filter((m: any) => ["sent", "delivered", "read"].includes(m.status)).length;
  const messagesDelivered = msgs.filter((m: any) => ["delivered", "read"].includes(m.status)).length;
  const messagesOpened = inv.filter((i: any) => i.opened_at).length;
  const openRate = messagesSent > 0 ? Math.round((messagesOpened / messagesSent) * 100) : 0;

  // Auto-insights
  const insights: string[] = [];
  if (noShowRate > 25) insights.push(`High no-show rate (${noShowRate}%) — consider sending reminders.`);
  if (rsvpRate < 40 && total > 5) insights.push(`Low RSVP conversion (${rsvpRate}%).`);
  if (rsvpRate >= 70) insights.push(`Strong RSVP rate at ${rsvpRate}%.`);
  if (attendanceRate >= 80 && confirmed >= 10) insights.push(`Excellent attendance rate (${attendanceRate}%).`);
  if (messagesSent > 0 && messagesOpened === 0) insights.push("No messages opened yet.");

  return {
    success: true,
    result: {
      event_id: args.event_id,
      title: evt.title,
      status: evt.status,
      metrics: {
        totalInvited: total,
        confirmed,
        checkedIn,
        noShow,
        rsvpRate,
        attendanceRate,
        noShowRate,
        messagesSent,
        messagesDelivered,
        messagesOpened,
        openRate,
      },
      insights,
    },
  };
}

async function toolGetWorkspaceAnalytics(
  db: SupabaseClient, userId: string
): Promise<ToolResult> {
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let evQuery = db.from("events").select("id, title, status, start_date");
  if (!isPrivileged) evQuery = evQuery.eq("created_by", userId);
  const { data: events } = await evQuery;
  const allEvents = events || [];
  const eventIds = allEvents.map((e: any) => e.id);

  if (eventIds.length === 0) {
    return { success: true, result: { totalEvents: 0, totalAttendees: 0, avgRsvpRate: 0, avgAttendanceRate: 0, avgNoShowRate: 0, topEvents: [] } };
  }

  const { data: attendees } = await db
    .from("attendees")
    .select("id, event_id, confirmed, checked_in_at")
    .in("event_id", eventIds);

  const att = attendees || [];

  const eventMetrics = allEvents.map((ev: any) => {
    const evAtt = att.filter((a: any) => a.event_id === ev.id);
    const total = evAtt.length;
    const confirmed = evAtt.filter((a: any) => a.confirmed).length;
    const checkedIn = evAtt.filter((a: any) => a.checked_in_at).length;
    return {
      id: ev.id, title: ev.title, attendees: total,
      rsvpRate: total > 0 ? (confirmed / total) * 100 : 0,
      attendanceRate: confirmed > 0 ? (checkedIn / confirmed) * 100 : 0,
      noShowRate: confirmed > 0 ? ((confirmed - checkedIn) / confirmed) * 100 : 0,
    };
  });

  const withAtt = eventMetrics.filter((e: any) => e.attendees > 0);
  const avgRsvp = withAtt.length > 0 ? Math.round(withAtt.reduce((s: number, e: any) => s + e.rsvpRate, 0) / withAtt.length) : 0;
  const avgAttendance = withAtt.length > 0 ? Math.round(withAtt.reduce((s: number, e: any) => s + e.attendanceRate, 0) / withAtt.length) : 0;
  const avgNoShow = withAtt.length > 0 ? Math.round(withAtt.reduce((s: number, e: any) => s + e.noShowRate, 0) / withAtt.length) : 0;

  const topEvents = eventMetrics
    .filter((e: any) => e.attendees >= 5)
    .sort((a: any, b: any) => b.attendanceRate - a.attendanceRate)
    .slice(0, 5)
    .map((e: any) => ({ title: e.title, attendees: e.attendees, attendanceRate: Math.round(e.attendanceRate), rsvpRate: Math.round(e.rsvpRate) }));

  return {
    success: true,
    result: {
      totalEvents: allEvents.length,
      totalAttendees: att.length,
      avgRsvpRate: avgRsvp,
      avgAttendanceRate: avgAttendance,
      avgNoShowRate: avgNoShow,
      topEvents,
    },
  };
}

// ─── Media Tools ───────────────────────────────────────────

async function toolGenerateEventImage(
  db: SupabaseClient, userId: string,
  args: { event_id: string; media_type: string; prompt: string; style?: string; aspect_ratio?: string },
  correlationId: string,
): Promise<ToolResult> {
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return { success: false, result: {}, error: "Image generation not configured", category: "internal" };

  // Build DALL-E prompt
  const styleHint = args.style ? ` Style: ${args.style}.` : "";
  const typeHint = args.media_type === "banner" ? " This is a wide banner image." : args.media_type === "hero_image" ? " This is a hero/cover image for an event." : "";
  const fullPrompt = `${args.prompt}${styleHint}${typeHint} Professional, high quality, suitable for a corporate event platform. Event: "${evt.title}".`;

  // Map aspect ratio to DALL-E size
  const sizeMap: Record<string, string> = {
    "16:9": "1792x1024",
    "1:1": "1024x1024",
    "9:16": "1024x1792",
    "4:3": "1792x1024",
    "3:2": "1792x1024",
  };
  const size = sizeMap[args.aspect_ratio || "16:9"] || "1792x1024";

  console.log(`[${correlationId}] Generating image with DALL-E: size=${size}, prompt=${fullPrompt.substring(0, 100)}...`);

  try {
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size,
        quality: "standard",
        response_format: "b64_json",
      }),
    });

    if (!dalleRes.ok) {
      const errBody = await dalleRes.text();
      console.error(`[${correlationId}] DALL-E error: ${dalleRes.status} ${errBody}`);
      return { success: false, result: {}, error: "Image generation failed. Please try a different description.", category: "external_api" };
    }

    const dalleData = await dalleRes.json();
    const b64 = dalleData.data?.[0]?.b64_json;
    const revisedPrompt = dalleData.data?.[0]?.revised_prompt;

    if (!b64) return { success: false, result: {}, error: "No image was generated", category: "external_api" };

    // Upload to media-library bucket
    const fileName = `${userId}/${args.event_id}/${args.media_type}_${Date.now()}.png`;
    const imageBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

    const { error: uploadErr } = await db.storage
      .from("media-library")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: false });

    if (uploadErr) {
      console.error(`[${correlationId}] Upload error:`, uploadErr);
      return { success: false, result: {}, error: "Failed to save generated image", category: "internal" };
    }

    // Get signed URL for preview
    const { data: urlData } = await db.storage.from("media-library").createSignedUrl(fileName, 3600);
    const previewUrl = urlData?.signedUrl || "";

    // Save to media_assets table
    const { data: asset, error: assetErr } = await db.from("media_assets").insert({
      workspace_id: null,
      client_id: evt.client_id || null,
      event_id: args.event_id,
      media_type: args.media_type,
      source_type: "ai_generated",
      title: `AI Generated ${args.media_type} for ${evt.title}`,
      prompt_used: fullPrompt,
      style_tags: args.style ? [args.style] : [],
      file_url: fileName,
      thumbnail_url: fileName,
      approved: false,
      created_by: userId,
    }).select("id").single();

    if (assetErr) {
      console.error(`[${correlationId}] Asset save error:`, assetErr);
    }

    return {
      success: true,
      result: {
        media_asset_id: asset?.id || "",
        preview_url: previewUrl,
        media_type: args.media_type,
        prompt_used: revisedPrompt || fullPrompt,
        file_path: fileName,
        message: `Generated ${args.media_type} image. Review the preview and confirm to apply it to your event.`,
      },
    };
  } catch (err) {
    console.error(`[${correlationId}] Image generation error:`, err);
    return { success: false, result: {}, error: "Image generation failed unexpectedly", category: "external_api" };
  }
}

async function toolSaveMediaToEvent(
  db: SupabaseClient, userId: string,
  args: { event_id: string; media_asset_id: string; media_type: string },
  correlationId: string,
): Promise<ToolResult> {
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const { data: asset, error: assetErr } = await db.from("media_assets")
    .select("*")
    .eq("id", args.media_asset_id)
    .single();

  if (assetErr || !asset) return { success: false, result: {}, error: "Media asset not found", category: "validation" };

  // Copy from media-library to event-assets bucket
  const subfolder = args.media_type === "gallery" ? "gallery" : args.media_type === "banner" ? "banner" : "hero";
  const destPath = `events/${args.event_id}/${subfolder}/${Date.now()}-media.png`;

  const { data: fileData, error: dlErr } = await db.storage.from("media-library").download(asset.file_url);
  if (dlErr || !fileData) {
    console.error(`[${correlationId}] Download error:`, dlErr);
    return { success: false, result: {}, error: "Failed to retrieve image from library", category: "internal" };
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const { error: uploadErr } = await db.storage
    .from("event-assets")
    .upload(destPath, new Uint8Array(arrayBuffer), { contentType: "image/png", upsert: false });

  if (uploadErr) {
    console.error(`[${correlationId}] Event asset upload error:`, uploadErr);
    return { success: false, result: {}, error: "Failed to save image to event", category: "internal" };
  }

  // Determine overwrite vs append behavior
  let overwriteNote = "";

  if (args.media_type === "hero_image") {
    // REPLACE: hero image is the primary visual — replace existing
    const currentHero = Array.isArray(evt.hero_images) ? evt.hero_images : [];
    overwriteNote = currentHero.length > 0 ? ` (replaced ${currentHero.length} previous hero image${currentHero.length > 1 ? "s" : ""})` : "";
    const { error: updateErr } = await db.from("events").update({ hero_images: [destPath] }).eq("id", args.event_id);
    if (updateErr) return { success: false, result: {}, error: "Failed to update event hero images", category: "internal" };
  } else if (args.media_type === "gallery") {
    // APPEND: gallery accumulates images
    const currentGallery = Array.isArray(evt.gallery_images) ? evt.gallery_images : [];
    const updatedGallery = [...currentGallery, destPath];
    const { error: updateErr } = await db.from("events").update({ gallery_images: updatedGallery }).eq("id", args.event_id);
    if (updateErr) return { success: false, result: {}, error: "Failed to update event gallery", category: "internal" };
    overwriteNote = ` (gallery now has ${updatedGallery.length} image${updatedGallery.length > 1 ? "s" : ""})`;
  } else if (args.media_type === "banner") {
    overwriteNote = evt.cover_image ? " (replaced previous banner)" : "";
    const { error: updateErr } = await db.from("events").update({ cover_image: destPath }).eq("id", args.event_id);
    if (updateErr) return { success: false, result: {}, error: "Failed to update event banner", category: "internal" };
  }

  await db.from("media_assets").update({ approved: true, event_id: args.event_id }).eq("id", args.media_asset_id);

  return {
    success: true,
    result: {
      message: `Image saved as ${args.media_type} for "${evt.title}"${overwriteNote}`,
      event_id: args.event_id,
      media_type: args.media_type,
      file_path: destPath,
      overwrite_note: overwriteNote,
    },
  };
}

async function toolListMediaLibrary(
  db: SupabaseClient, userId: string,
  args: { event_id?: string; client_id?: string; media_type?: string; source_type?: string; limit?: number },
): Promise<ToolResult> {
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let query = db.from("media_assets")
    .select("id, media_type, source_type, title, prompt_used, style_tags, file_url, approved, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(args.limit || 10, 20));

  if (!isPrivileged) query = query.eq("created_by", userId);
  if (args.event_id) query = query.eq("event_id", args.event_id);
  if (args.client_id) query = query.eq("client_id", args.client_id);
  if (args.media_type) query = query.eq("media_type", args.media_type);
  if (args.source_type) query = query.eq("source_type", args.source_type);

  const { data, error } = await query;
  if (error) return { success: false, result: {}, error: "Failed to query media library", category: "internal" };

  return {
    success: true,
    result: {
      assets: (data || []).map(a => ({
        id: a.id,
        media_type: a.media_type,
        source_type: a.source_type,
        title: a.title,
        prompt: a.prompt_used,
        approved: a.approved,
        created_at: a.created_at,
      })),
      total: data?.length || 0,
    },
  };
}

// ─── Phase 2 Tool Implementations ──────────────────────────

async function toolRegisterUploadedMedia(
  db: SupabaseClient, userId: string,
  args: { event_id?: string; file_path: string; file_name: string; media_type?: string },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.file_path) return { success: false, result: {}, error: "file_path is required", category: "validation" };

  let eventId = args.event_id;
  let clientId: string | null = null;

  if (eventId) {
    const { allowed, event: evt } = await canManageEvent(db, userId, eventId);
    if (!allowed) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };
    clientId = evt?.client_id || null;
  }

  // Get a signed URL for preview
  const { data: urlData } = await db.storage.from("media-library").createSignedUrl(args.file_path, 3600);
  const previewUrl = urlData?.signedUrl || "";

  const { data: asset, error: assetErr } = await db.from("media_assets").insert({
    workspace_id: null,
    client_id: clientId,
    event_id: eventId || null,
    media_type: args.media_type || "hero_image",
    source_type: "uploaded",
    title: args.file_name,
    file_url: args.file_path,
    thumbnail_url: args.file_path,
    approved: false,
    created_by: userId,
  }).select("id").single();

  if (assetErr) {
    console.error(`[${correlationId}] Register upload error:`, assetErr);
    return { success: false, result: {}, error: "Failed to register uploaded image", category: "internal" };
  }

  return {
    success: true,
    result: {
      media_asset_id: asset?.id || "",
      preview_url: previewUrl,
      file_path: args.file_path,
      media_type: args.media_type || "hero_image",
      message: `Image "${args.file_name}" uploaded and registered. What would you like to do with it?`,
    },
  };
}

async function toolCreateBrandKit(
  db: SupabaseClient, userId: string,
  args: { name: string; client_id?: string; primary_color?: string; secondary_color?: string; accent_color?: string; typography_preference?: string; visual_mood?: string[] },
): Promise<ToolResult> {
  if (!args.name?.trim()) return { success: false, result: {}, error: "Brand kit name is required", category: "validation" };

  if (args.client_id) {
    const canManage = await canManageClient(db, userId, args.client_id);
    if (!canManage) return { success: false, result: {}, error: "Client not found or access denied", category: "permission" };
  }

  const { data, error } = await db.from("brand_kits").insert({
    name: args.name.trim(),
    client_id: args.client_id || null,
    primary_color: args.primary_color || null,
    secondary_color: args.secondary_color || null,
    accent_color: args.accent_color || null,
    typography_preference: args.typography_preference || "modern",
    visual_mood: args.visual_mood || [],
    style_tags: args.visual_mood ? args.visual_mood : [],
    created_by: userId,
  }).select("id, name").single();

  if (error) {
    const classified = classifyError(error, error.code);
    return { success: false, result: {}, error: classified.userMessage, category: classified.category };
  }

  return {
    success: true,
    result: {
      brand_kit_id: data.id,
      name: data.name,
      primary_color: args.primary_color,
      secondary_color: args.secondary_color,
      accent_color: args.accent_color,
      typography: args.typography_preference,
      mood: args.visual_mood,
      message: `Brand kit "${data.name}" created.`,
    },
  };
}

async function toolGetBrandKit(
  db: SupabaseClient, userId: string,
  args: { client_id?: string; name_search?: string },
): Promise<ToolResult> {
  if (!args.client_id && !args.name_search) {
    return { success: false, result: {}, error: "Provide either client_id or name_search", category: "validation" };
  }

  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let query = db.from("brand_kits").select("*").limit(5).order("created_at", { ascending: false });
  if (!isPrivileged) query = query.eq("created_by", userId);
  if (args.client_id) query = query.eq("client_id", args.client_id);
  if (args.name_search) query = query.ilike("name", `%${args.name_search}%`);

  const { data, error } = await query;
  if (error) return { success: false, result: {}, error: "Failed to query brand kits", category: "internal" };

  if (!data?.length) {
    return { success: true, result: { found: false, message: "No brand kits found. Would you like to create one?" } };
  }

  return {
    success: true,
    result: {
      found: true,
      brand_kits: data.map(bk => ({
        id: bk.id,
        name: bk.name,
        primary_color: bk.primary_color,
        secondary_color: bk.secondary_color,
        accent_color: bk.accent_color,
        typography: bk.typography_preference,
        mood: bk.visual_mood,
        client_id: bk.client_id,
      })),
    },
  };
}

async function toolSaveVisualPack(
  db: SupabaseClient, userId: string,
  args: { event_id: string; pack_name: string },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.event_id || !args.pack_name?.trim()) return { success: false, result: {}, error: "event_id and pack_name are required", category: "validation" };

  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  // Get existing media for this event
  const { data: mediaAssets } = await db.from("media_assets")
    .select("id, media_type, source_type, file_url, title, prompt_used, style_tags")
    .eq("event_id", args.event_id)
    .eq("approved", true)
    .limit(20);

  // Tag existing media with pack name
  if (mediaAssets?.length) {
    for (const asset of mediaAssets) {
      await db.from("media_assets").update({ visual_pack_name: args.pack_name.trim() }).eq("id", asset.id);
    }
  }

  // Also save event visual state as metadata
  const visualState = {
    hero_images: evt.hero_images,
    gallery_images: evt.gallery_images,
    cover_image: evt.cover_image,
    theme_id: evt.theme_id,
  };

  console.log(`[${correlationId}] Saved visual pack "${args.pack_name}" with ${mediaAssets?.length || 0} assets from event ${args.event_id}`);

  return {
    success: true,
    result: {
      pack_name: args.pack_name,
      asset_count: mediaAssets?.length || 0,
      visual_state: visualState,
      message: `Visual pack "${args.pack_name}" saved with ${mediaAssets?.length || 0} media assets.`,
    },
  };
}

async function toolApplyVisualPack(
  db: SupabaseClient, userId: string,
  args: { event_id: string; pack_name: string; preview_only?: boolean; confirmed?: boolean },
  correlationId: string,
): Promise<ToolResult> {
  if (!args.event_id || !args.pack_name?.trim()) return { success: false, result: {}, error: "event_id and pack_name are required", category: "validation" };

  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  // Find media assets with this pack name
  const isPrivileged = await isAdminOrOwnerRole(db, userId);
  let query = db.from("media_assets")
    .select("*")
    .eq("visual_pack_name", args.pack_name.trim())
    .limit(20);
  if (!isPrivileged) query = query.eq("created_by", userId);

  const { data: packAssets } = await query;

  if (!packAssets?.length) {
    return { success: true, result: { applied: false, message: `No visual pack found with name "${args.pack_name}".` } };
  }

  // Categorize pack assets
  const packHero = packAssets.filter(a => a.media_type === "hero_image");
  const packGallery = packAssets.filter(a => a.media_type === "gallery");
  const packBanner = packAssets.filter(a => a.media_type === "banner");

  const currentHeroCount = Array.isArray(evt.hero_images) ? evt.hero_images.length : 0;
  const currentGalleryCount = Array.isArray(evt.gallery_images) ? evt.gallery_images.length : 0;
  const currentHasBanner = !!evt.cover_image;

  // ── Preview mode (default) ──
  if (args.preview_only !== false && !args.confirmed) {
    const changes: string[] = [];
    if (packHero.length > 0) {
      changes.push(currentHeroCount > 0
        ? `Hero image: REPLACE current (${currentHeroCount}) with ${packHero.length} from pack`
        : `Hero image: Add ${packHero.length} from pack`);
    }
    if (packBanner.length > 0) {
      changes.push(currentHasBanner
        ? `Banner: REPLACE current banner with pack banner`
        : `Banner: Set from pack`);
    }
    if (packGallery.length > 0) {
      // Check for duplicates by title
      const existingTitles = new Set<string>();
      const { data: existingMedia } = await db.from("media_assets")
        .select("title, visual_pack_name")
        .eq("event_id", args.event_id)
        .eq("source_type", "visual_pack");
      existingMedia?.forEach(m => { if (m.title) existingTitles.add(m.title); });
      const newGallery = packGallery.filter(a => !a.title || !existingTitles.has(a.title));
      const dupeCount = packGallery.length - newGallery.length;
      if (newGallery.length > 0) changes.push(`Gallery: Add ${newGallery.length} images`);
      if (dupeCount > 0) changes.push(`Gallery: ${dupeCount} duplicate(s) will be skipped`);
    }

    if (changes.length === 0) {
      return { success: true, result: { preview: true, message: "This visual pack has no applicable assets for this event." } };
    }

    return {
      success: true,
      result: {
        preview: true,
        pack_name: args.pack_name,
        event_name: evt.title,
        changes,
        total_assets: packAssets.length,
        message: `Visual pack "${args.pack_name}" will make these changes to "${evt.title}":\n${changes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nDo you want to proceed?`,
      },
    };
  }

  // ── Confirmed execution ──
  // For hero/banner: REPLACE (clean overwrite), for gallery: APPEND (skip duplicates)
  const heroImages: string[] = [];  // Replace, not append
  const galleryImages: string[] = Array.isArray(evt.gallery_images) ? [...evt.gallery_images] : [];
  let coverImage = evt.cover_image;
  let copied = 0;
  let skipped = 0;

  // Get existing pack media for this event to detect duplicates
  const { data: existingPackMedia } = await db.from("media_assets")
    .select("title, visual_pack_name")
    .eq("event_id", args.event_id)
    .eq("source_type", "visual_pack");
  const existingTitles = new Set<string>();
  existingPackMedia?.forEach(m => { if (m.title) existingTitles.add(m.title); });

  for (const asset of packAssets) {
    // Skip gallery duplicates
    if (asset.media_type === "gallery" && asset.title && existingTitles.has(asset.title)) {
      skipped++;
      continue;
    }

    try {
      const destPath = `events/${args.event_id}/${asset.media_type}/${Date.now()}-pack-${copied}.png`;
      const { data: fileData } = await db.storage.from("media-library").download(asset.file_url);
      if (!fileData) continue;

      const arrayBuffer = await fileData.arrayBuffer();
      const { error: uploadErr } = await db.storage
        .from("event-assets")
        .upload(destPath, new Uint8Array(arrayBuffer), { contentType: "image/png", upsert: false });
      if (uploadErr) continue;

      if (asset.media_type === "hero_image") heroImages.push(destPath);
      else if (asset.media_type === "gallery") galleryImages.push(destPath);
      else if (asset.media_type === "banner") coverImage = destPath;

      await db.from("media_assets").insert({
        event_id: args.event_id,
        client_id: evt.client_id,
        media_type: asset.media_type,
        source_type: "visual_pack",
        title: asset.title,
        file_url: destPath,
        approved: true,
        created_by: userId,
        visual_pack_name: args.pack_name,
      });
      copied++;
    } catch (err) {
      console.error(`[${correlationId}] Pack asset copy error:`, err);
    }
  }

  // Update event — hero replaces, gallery appends, banner replaces
  const updatePayload: Record<string, unknown> = { gallery_images: galleryImages };
  if (heroImages.length > 0) updatePayload.hero_images = heroImages;
  if (packBanner.length > 0) updatePayload.cover_image = coverImage;

  await db.from("events").update(updatePayload).eq("id", args.event_id);

  const summary = [`${copied} asset(s) applied`];
  if (skipped > 0) summary.push(`${skipped} duplicate(s) skipped`);

  return {
    success: true,
    result: {
      applied: true,
      pack_name: args.pack_name,
      assets_copied: copied,
      duplicates_skipped: skipped,
      message: `Visual pack "${args.pack_name}" applied to "${evt.title}" — ${summary.join(", ")}.`,
    },
  };
}

// ─── Communication Tools ───────────────────────────────────

async function toolPrepareCommunicationCampaign(
  db: SupabaseClient, userId: string,
  args: { event_id: string; campaign_type: string; channels: string[]; audience_segment?: string }
): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const segment = args.audience_segment || "all";
  let countQuery = db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", args.event_id);
  if (segment === "pending") countQuery = countQuery.eq("confirmed", false);
  if (segment === "confirmed") countQuery = countQuery.eq("confirmed", true);
  const { count } = await countQuery;

  const { data: campaign, error } = await db.from("communication_campaigns").insert({
    event_id: args.event_id, created_by: userId, campaign_type: args.campaign_type,
    channels: args.channels, status: "draft", audience_filter: { segment }, audience_count: count || 0,
  }).select("id, campaign_type, channels, audience_count").single();

  if (error) return { success: false, result: {}, error: error.message, category: "internal" };

  const typeLabel: Record<string,string> = { invitation:"invitation", attendance_confirmation:"confirmation request", reminder:"reminder", check_in:"check-in", follow_up:"follow-up" };
  return { success: true, result: {
    campaign_id: (campaign as any).id, campaign_type: args.campaign_type, channels: args.channels,
    audience_count: count || 0, audience_segment: segment, event_name: evt.title, requires_confirmation: true,
    message: `Campaign ready: ${typeLabel[args.campaign_type]||args.campaign_type} to ${count||0} ${segment==="all"?"":segment+" "}attendees via ${args.channels.join(" and ")}.`,
  }};
}

async function toolSendCommunicationCampaign(
  db: SupabaseClient, userId: string,
  args: { campaign_id: string; event_id: string }, correlationId: string,
): Promise<ToolResult> {
  if (!args.campaign_id || !args.event_id) return { success: false, result: {}, error: "campaign_id and event_id required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed || !evt) return { success: false, result: {}, error: "Event not found or access denied", category: "permission" };

  const { data: campaign } = await db.from("communication_campaigns").select("*").eq("id", args.campaign_id).single();
  if (!campaign) return { success: false, result: {}, error: "Campaign not found", category: "validation" };
  const camp = campaign as any;
  if (camp.status !== "draft") return { success: false, result: {}, error: `Campaign already ${camp.status}`, category: "validation" };

  await db.from("communication_campaigns").update({ status: "sending", started_at: new Date().toISOString() }).eq("id", args.campaign_id);

  let attQ = db.from("attendees").select("id").eq("event_id", args.event_id);
  const seg = camp.audience_filter?.segment;
  if (seg === "pending") attQ = attQ.eq("confirmed", false);
  if (seg === "confirmed") attQ = attQ.eq("confirmed", true);
  const { data: atts } = await attQ;
  const ids = (atts||[]).map((a:any)=>a.id);

  if (!ids.length) {
    await db.from("communication_campaigns").update({ status: "completed", completed_at: new Date().toISOString(), audience_count: 0 }).eq("id", args.campaign_id);
    return { success: true, result: { sent_email:0, sent_whatsapp:0, total:0, message: "No attendees matched." }};
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const baseUrl = Deno.env.get("VITE_APP_URL") || "https://app.titanmeet.com";

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-event-invitations`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ event_id: args.event_id, attendee_ids: ids, base_url: baseUrl, channels: camp.channels, is_reminder: camp.campaign_type === "reminder" }),
    });
    const result = await resp.json();
    console.log(`[${correlationId}] campaign send: ${JSON.stringify(result).substring(0,300)}`);

    const recipients: any[] = [];
    if (result?.results) {
      for (const r of result.results) {
        for (const ch of camp.channels) {
          const st = r[ch==="email"?"email_status":"whatsapp_status"];
          if (st && st !== "skipped") recipients.push({ campaign_id: args.campaign_id, attendee_id: r.attendee_id, channel: ch, delivery_status: st==="sent"?"sent":"failed", error: r[ch==="email"?"email_error":"whatsapp_error"]||null, sent_at: st==="sent"?new Date().toISOString():null });
        }
      }
    }
    if (recipients.length) await db.from("campaign_recipients").insert(recipients);

    await db.from("communication_campaigns").update({ status: "completed", completed_at: new Date().toISOString(), audience_count: ids.length }).eq("id", args.campaign_id);
    const se = result?.sent_email||0, sw = result?.sent_whatsapp||0;
    return { success: true, result: { sent_email:se, sent_whatsapp:sw, failed_email:result?.failed_email||0, failed_whatsapp:result?.failed_whatsapp||0, total:ids.length, message: `Sent to ${ids.length} attendees. ${se} emails, ${sw} WhatsApp.` }};
  } catch (err) {
    await db.from("communication_campaigns").update({ status: "failed" }).eq("id", args.campaign_id);
    return { success: false, result: {}, error: "Campaign send failed", category: "external_api" };
  }
}

async function toolGetEventConfirmationStats(db: SupabaseClient, userId: string, args: { event_id: string }): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed||!evt) return { success: false, result: {}, error: "Access denied", category: "permission" };
  const [attR, logR] = await Promise.all([
    db.from("attendees").select("id, confirmed").eq("event_id", args.event_id),
    db.from("message_logs").select("channel, status").eq("event_id", args.event_id),
  ]);
  const atts = attR.data||[], logs = logR.data||[];
  const confirmed = atts.filter((a:any)=>a.confirmed).length, total = atts.length, pending = total - confirmed;
  const rate = total>0?Math.round((confirmed/total)*100):0;
  const eLogs = logs.filter((l:any)=>l.channel==="email"), wLogs = logs.filter((l:any)=>l.channel==="whatsapp");
  return { success: true, result: { event_name: evt.title, invited: total, confirmed, pending, declined: 0, confirmation_rate: rate,
    by_channel: { email: { sent: eLogs.length, failed: eLogs.filter((l:any)=>l.status==="failed").length }, whatsapp: { sent: wLogs.length, failed: wLogs.filter((l:any)=>["failed","undelivered"].includes(l.status)).length } },
    message: `${evt.title}: ${confirmed}/${total} confirmed (${rate}%), ${pending} pending.` }};
}

async function toolListConfirmationSegments(db: SupabaseClient, userId: string, args: { event_id: string }): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed||!evt) return { success: false, result: {}, error: "Access denied", category: "permission" };
  const { data: atts } = await db.from("attendees").select("id, name, confirmed, last_reminder_sent_at").eq("event_id", args.event_id);
  const all = atts||[], conf = all.filter((a:any)=>a.confirmed), pend = all.filter((a:any)=>!a.confirmed), needsR = pend.filter((a:any)=>!a.last_reminder_sent_at);
  return { success: true, result: { event_name: evt.title, total: all.length, segments: {
    confirmed: { count: conf.length, sample: conf.slice(0,5).map((a:any)=>a.name) },
    pending: { count: pend.length, sample: pend.slice(0,5).map((a:any)=>a.name) },
    needs_reminder: { count: needsR.length, sample: needsR.slice(0,5).map((a:any)=>a.name) },
  }, message: `${conf.length} confirmed, ${pend.length} pending, ${needsR.length} need reminder.` }};
}

async function toolGetCommunicationPerformance(db: SupabaseClient, userId: string, args: { event_id: string }): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed||!evt) return { success: false, result: {}, error: "Access denied", category: "permission" };
  const [logR, inR] = await Promise.all([
    db.from("message_logs").select("channel, status").eq("event_id", args.event_id),
    db.from("inbound_messages").select("id, channel").eq("event_id", args.event_id),
  ]);
  const logs = logR.data||[], inb = (inR.data||[]) as any[];
  const ch = (c:string) => { const cl = logs.filter((l:any)=>l.channel===c); return { sent:cl.length, delivered:cl.filter((l:any)=>["sent","delivered","read"].includes(l.status)).length, opened:cl.filter((l:any)=>l.status==="read").length, failed:cl.filter((l:any)=>["failed","undelivered"].includes(l.status)).length, replied:inb.filter((m:any)=>m.channel===c).length }; };
  const e = ch("email"), w = ch("whatsapp");
  return { success: true, result: { event_name: evt.title, total: { sent:logs.length, delivered:e.delivered+w.delivered, opened:e.opened+w.opened, failed:e.failed+w.failed, replied:inb.length }, email:e, whatsapp:w, message: `${logs.length} sent, ${e.delivered+w.delivered} delivered, ${e.failed+w.failed} failed.` }};
}

async function toolListEventCampaigns(db: SupabaseClient, userId: string, args: { event_id: string }): Promise<ToolResult> {
  if (!args.event_id) return { success: false, result: {}, error: "event_id required", category: "validation" };
  const { allowed, event: evt } = await canManageEvent(db, userId, args.event_id);
  if (!allowed||!evt) return { success: false, result: {}, error: "Access denied", category: "permission" };
  const { data: camps } = await db.from("communication_campaigns").select("id, campaign_type, channels, status, audience_count, created_at").eq("event_id", args.event_id).order("created_at", { ascending: false }).limit(20);
  const list = (camps||[]) as any[];
  const tl: Record<string,string> = { invitation:"Invitation", attendance_confirmation:"Confirmation", reminder:"Reminder", check_in:"Check-in", follow_up:"Follow-up" };
  return { success: true, result: { campaigns: list.map((c:any)=>({ id:c.id, type:tl[c.campaign_type]||c.campaign_type, channels:c.channels, status:c.status, audience:c.audience_count })), total: list.length, message: list.length? `${list.length} campaign(s) for "${evt.title}".` : "No campaigns yet." }};
}

// ─── Action Log Persistence ────────────────────────────────

async function persistActionLog(
  db: SupabaseClient,
  sessionId: string,
  userId: string,
  entries: ActionLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map(e => ({
    session_id: sessionId,
    user_id: userId,
    action_name: e.action,
    status: e.status,
    message: e.message,
    category: e.category || null,
    metadata: e.metadata || {},
  }));
  const { error } = await db.from("ai_action_logs").insert(rows);
  if (error) console.error(`[persistActionLog] error: ${error.message}`);
}


async function buildDraftState(
  db: SupabaseClient,
  userId: string,
  sessionState: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const state: Record<string, unknown> = { ...sessionState };

  const eventId = state.event_id as string | undefined;
  if (eventId) {
    const { data: evt } = await db.from("events").select("*, clients(id, name, slug)").eq("id", eventId).single();
    if (evt) {
      const { count: attCount } = await db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const { count: agdCount } = await db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const { count: orgCount } = await db.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const { count: spkCount } = await db.from("speakers").select("id", { count: "exact", head: true }).eq("event_id", eventId);

      // Event context for the panel
      state.eventContext = {
        clientId: (evt.clients as any)?.id,
        clientName: (evt.clients as any)?.name,
        eventId: evt.id,
        eventName: evt.title,
        eventStatus: evt.status,
        mode: "existing_draft",
      };
      state.event_status = evt.status;
      state.event_mode = "existing_draft";

      state.client = evt.clients ? { name: (evt.clients as any).name, slug: (evt.clients as any).slug, id: (evt.clients as any).id, status: "done" } : { status: "empty" };
      state.eventBasics = { title: evt.title, date: evt.event_date || evt.start_date, location: evt.location, status: evt.title ? "done" : "empty" };
      state.venue = {
        name: evt.venue_name,
        address: evt.venue_address,
        lat: evt.venue_lat,
        lng: evt.venue_lng,
        place_id: evt.venue_place_id,
        photo_count: Array.isArray(evt.venue_photo_refs) ? evt.venue_photo_refs.length : 0,
        status: evt.venue_name ? "done" : "empty",
      };
      state.organizers = { count: orgCount || 0, status: (orgCount || 0) > 0 ? "done" : "empty" };
      state.attendees = { count: attCount || 0, status: (attCount || 0) > 0 ? "done" : "empty" };
      state.agenda = { items: agdCount || 0, status: (agdCount || 0) > 0 ? "done" : "empty" };
      state.speakers = { count: spkCount || 0 };
      state.description = evt.description || undefined;
      state.themeId = evt.theme_id || undefined;

      // Media section
      const heroCount = Array.isArray(evt.hero_images) ? evt.hero_images.length : 0;
      const galleryCount = Array.isArray(evt.gallery_images) ? evt.gallery_images.length : 0;
      const hasBanner = !!evt.cover_image;
      const mediaStatus = heroCount > 0 ? "done" : (galleryCount > 0 || hasBanner) ? "partial" : "empty";
      state.media = { heroCount, galleryCount, hasBanner, status: mediaStatus };

      // Compute readiness
      const missing: string[] = [];
      if (!evt.client_id) missing.push("Client");
      if (!evt.title?.trim()) missing.push("Title");
      if (!evt.event_date && !evt.start_date) missing.push("Date");
      if (!evt.slug?.trim()) missing.push("Public URL");
      if (!evt.description?.trim()) missing.push("Description");
      if (!(Array.isArray(evt.hero_images) && evt.hero_images.length > 0)) missing.push("Cover image");
      if (!(evt.venue_name?.trim() || evt.location?.trim())) missing.push("Venue/Location");
      if ((attCount || 0) === 0) missing.push("Attendees");
      if ((agdCount || 0) === 0) missing.push("Agenda");

      const totalChecks = 9;
      const passedChecks = totalChecks - missing.length;
      const score = Math.round((passedChecks / totalChecks) * 100);

      state.publishReadiness = {
        score,
        missing,
        status: missing.length === 0 ? "done" : score >= 50 ? "partial" : "empty",
      };
    }
  } else if (state.client_id) {
    // Client selected but no event yet
    const { data: client } = await db.from("clients").select("id, name, slug").eq("id", state.client_id as string).single();
    if (client) {
      state.eventContext = {
        clientId: client.id,
        clientName: client.name,
      };
      state.client = { name: client.name, slug: client.slug, id: client.id, status: "done" };
    }
  }

  return state;
}

// ─── Main Handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", correlationId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", correlationId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured", correlationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { sessionId, message, context, voiceMode, ultraFastMode } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Message is required", correlationId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Rate limit check: overall AI requests ──
    const aiRateLimit = await checkAndIncrementUsage(db, user.id, "ai_requests", correlationId);
    if (!aiRateLimit.allowed) {
      const reason = aiRateLimit.burstBlocked
        ? "Too many requests in a short time. Please wait a moment and try again."
        : `You've reached your monthly AI request limit (${aiRateLimit.usage}/${aiRateLimit.limit}). Upgrade your plan for more.`;
      return new Response(
        JSON.stringify({
          error: reason,
          rateLimited: true,
          resource: "ai_requests",
          usage: aiRateLimit.usage,
          limit: aiRateLimit.limit,
          burstBlocked: aiRateLimit.burstBlocked,
          correlationId,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Session Management ──
    let session: any;

    if (sessionId) {
      const { data } = await db
        .from("ai_chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();
      session = data;
    }

    if (!session) {
      const { data: newSession, error: sessErr } = await db
        .from("ai_chat_sessions")
        .insert({
          user_id: user.id,
          client_id: context?.clientId || null,
          event_id: context?.eventId || null,
          title: message.substring(0, 80),
          status: "active",
          state_json: {},
        })
        .select("*")
        .single();

      if (sessErr) {
        console.error(`[${correlationId}] session create error:`, sessErr);
        return new Response(
          JSON.stringify({ error: "Failed to create session", correlationId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      session = newSession;
    }

    // ── Save user message ──
    await db.from("ai_chat_messages").insert({
      session_id: session.id,
      role: "user",
      content: message,
      metadata: { context },
    });

    // ── Load user memory (preferences, patterns, context) ──
    let memoryStr = "";
    const { data: userMemories } = await db
      .from("ai_user_memory")
      .select("key, value, memory_type, confidence_score, usage_count")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gte("confidence_score", 0.5)
      .order("confidence_score", { ascending: false })
      .limit(20);

    if (userMemories?.length) {
      const memLines = userMemories.map((m: any) => {
        const val = typeof m.value === "object" && m.value.display ? m.value.display : JSON.stringify(m.value);
        const strength = Number(m.confidence_score) >= 0.8 ? "strong" : "moderate";
        return `- ${m.key.replace(/_/g, " ")}: ${val} (${strength}, used ${m.usage_count}×)`;
      });
      memoryStr = `\n\n════════════════════════════════════════\nUSER MEMORY (learned preferences — use to suggest defaults)\n════════════════════════════════════════\n${memLines.join("\n")}\n\nWhen memory exists for a field, suggest it as the first option (e.g. "Use New Cairo?" 1. Yes 2. Change 3. Other). Say "Using your preferred [field]" when applying. Never auto-execute critical actions from memory alone.`;
    }

    // ── Load history ──
    const { data: history } = await db
      .from("ai_chat_messages")
      .select("role, content, metadata")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);

    const stateJson = session.state_json || {};

    let contextStr = "";
    if (stateJson.event_id) contextStr += `\nCurrent event ID: ${stateJson.event_id}`;
    if (stateJson.client_id || context?.clientId) contextStr += `\nCurrent client ID: ${stateJson.client_id || context?.clientId}`;
    if (context?.eventId) {
      contextStr += `\nEvent context ID: ${context.eventId}`;
      if (!stateJson.event_id) stateJson.event_id = context.eventId;
    }

    // ── Numbered option resolution ──
    // If the assistant previously presented numbered options, resolve numeric/spoken replies
    const activeOptions = stateJson.active_options as { options: string[]; context: string } | undefined;
    let resolvedMessage = message;

    if (activeOptions?.options?.length) {
      const trimmed = message.trim().toLowerCase();
      const spokenNumbers: Record<string, number> = {
        "one": 1, "first": 1, "the first": 1, "the first one": 1, "option one": 1, "option 1": 1, "number 1": 1, "number one": 1, "#1": 1,
        "two": 2, "second": 2, "the second": 2, "the second one": 2, "option two": 2, "option 2": 2, "number 2": 2, "number two": 2, "#2": 2,
        "three": 3, "third": 3, "the third": 3, "the third one": 3, "option three": 3, "option 3": 3, "number 3": 3, "number three": 3, "#3": 3,
        "four": 4, "fourth": 4, "the fourth": 4, "the fourth one": 4, "option four": 4, "option 4": 4, "number 4": 4, "number four": 4, "#4": 4,
        "five": 5, "fifth": 5, "the fifth": 5, "option five": 5, "option 5": 5, "number 5": 5, "#5": 5,
        "six": 6, "sixth": 6, "option six": 6, "option 6": 6, "number 6": 6, "#6": 6,
        "seven": 7, "seventh": 7, "option seven": 7, "option 7": 7, "#7": 7,
        "eight": 8, "eighth": 8, "option eight": 8, "option 8": 8, "#8": 8,
        "other": -1, "something else": -1, "none of these": -1, "none": -1, "custom": -1,
      };

      let resolvedIdx: number | null = null;

      // Check direct number
      const numMatch = trimmed.match(/^(\d+)\.?\s*$/);
      if (numMatch) resolvedIdx = parseInt(numMatch[1], 10);

      // Check spoken equivalents
      if (resolvedIdx === null && spokenNumbers[trimmed] !== undefined) {
        resolvedIdx = spokenNumbers[trimmed];
      }

      if (resolvedIdx !== null) {
        const opts = activeOptions.options;
        if (resolvedIdx === -1 || resolvedIdx === opts.length) {
          // "Other" selected
          resolvedMessage = `Other (custom answer for: ${activeOptions.context})`;
          console.log(`[${correlationId}] Option resolved: Other`);
        } else if (resolvedIdx >= 1 && resolvedIdx <= opts.length) {
          resolvedMessage = opts[resolvedIdx - 1];
          console.log(`[${correlationId}] Option resolved: ${resolvedIdx} → "${resolvedMessage}"`);
        }
      }

      // Clear active options after resolution (will be re-set if AI presents new ones)
      delete stateJson.active_options;
    }

    // ── Confirmation detection: check if user is confirming a pending action ──
    const confirmationPatterns = /^\s*(yes|yeah|yep|yup|sure|confirm|proceed|do it|go ahead|okay|ok|approved?|absolutely|please do|let'?s do it|update it|save it|go for it)\s*[.!]?\s*$/i;
    const isConfirmation = confirmationPatterns.test(message.trim());
    const pendingAction = stateJson.pending_action;
    let confirmationInjection = "";

    if (isConfirmation && pendingAction && pendingAction.awaiting_confirmation) {
      console.log(`[${correlationId}] Confirmation detected for pending action: ${pendingAction.tool}`);
      confirmationInjection = `\n\n⚠️ PENDING ACTION CONFIRMED — The user just confirmed the following action. Execute it NOW by calling the tool. Do NOT ask again.\nTool: ${pendingAction.tool}\nArguments: ${JSON.stringify(pendingAction.arguments)}\nAction: ${pendingAction.summary}`;
      delete stateJson.pending_action;
    }

    // If user's message was resolved from a numbered option, inject context for the AI
    const optionContext = resolvedMessage !== message
      ? `\n\n[The user selected option: "${resolvedMessage}" (originally typed: "${message}")]`
      : "";

    const voiceModePrompt = voiceMode ? VOICE_MODE_PROMPT : "";
    const ultraFastPrompt = ultraFastMode ? ULTRA_FAST_MODE_PROMPT : "";

    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + voiceModePrompt + ultraFastPrompt + memoryStr + (contextStr ? `\n\nCurrent context:${contextStr}` : "") + confirmationInjection + optionContext },
    ];

    for (const msg of (history || [])) {
      if (msg.role === "tool") {
        aiMessages.push({ role: "assistant", content: `[Tool result]: ${msg.content}` });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

    // ── First OpenAI call ──
    console.log(`[${correlationId}] calling OpenAI model=${model} history=${aiMessages.length}`);

    const openaiResp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.5,
        max_completion_tokens: 2000,
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error(`[${correlationId}] OpenAI error ${openaiResp.status}:`, errText);
      return new Response(
        JSON.stringify({ error: "AI service error", correlationId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResult = await openaiResp.json();
    const choice = aiResult.choices?.[0];

    // ── Action log for this request ──
    const actionLog: ActionLogEntry[] = [];

    // ── Handle tool calls ──
    if (choice?.finish_reason === "tool_calls" && choice?.message?.tool_calls) {
      const toolCalls = choice.message.tool_calls;

      const toolCallMessages: Array<{ role: string; content: string; tool_calls?: any; tool_call_id?: string }> = [
        ...aiMessages,
        choice.message,
      ];

      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        let toolArgs: Record<string, unknown>;
        try {
          toolArgs = JSON.parse(tc.function.arguments);
        } catch {
          toolArgs = {};
        }

        // Inject known IDs from session state
        if (stateJson.event_id && !toolArgs.event_id && toolName !== "find_or_create_client" && toolName !== "create_event_draft") {
          toolArgs.event_id = stateJson.event_id;
        }

        // ── Per-tool rate limiting for expensive external APIs ──
        const toolResource = getToolResource(toolName);
        if (toolResource) {
          const toolRateLimit = await checkAndIncrementUsage(db, user.id, toolResource, correlationId);
          if (!toolRateLimit.allowed) {
            const reason = toolRateLimit.burstBlocked
              ? "Too many requests — please wait a moment."
              : `Monthly limit reached for this feature (${toolRateLimit.usage}/${toolRateLimit.limit}).`;

            const logEntry: ActionLogEntry = {
              action: toolName,
              target: resolveToolTarget(toolName, toolArgs),
              status: "failed",
              message: reason,
              category: "validation",
              timestamp: new Date().toISOString(),
            };
            actionLog.push(logEntry);

            toolCallMessages.push({
              role: "tool",
              content: JSON.stringify({ success: false, result: {}, error: reason, category: "validation" }),
              tool_call_id: tc.id,
            });

            await db.from("ai_chat_messages").insert({
              session_id: session.id,
              role: "tool",
              content: JSON.stringify({ success: false, error: reason }),
              metadata: { tool_name: toolName, tool_call_id: tc.id, status: "failed", category: "rate_limit" },
            });
            continue;
          }
        }

        // Determine tool category for action log
        const isRetrievalTool = ["list_workspace_events", "list_workspace_clients", "get_event_details", "get_client_details", "list_events_by_client"].includes(toolName);
        const isIntelligenceTool = ["get_missing_fields", "recommend_next_actions", "check_publish_readiness", "get_event_analytics_summary", "get_workspace_analytics_summary"].includes(toolName);
        const isCommunicationTool = ["prepare_communication_campaign", "send_communication_campaign", "get_event_confirmation_stats", "list_confirmation_segments", "get_communication_performance", "list_event_campaigns"].includes(toolName);
        const toolCategory = isRetrievalTool ? "retrieval" : isIntelligenceTool ? "intelligence" : isCommunicationTool ? "communication" : undefined;

        // Add pending entry
        const logEntry: ActionLogEntry = {
          action: toolName,
          target: resolveToolTarget(toolName, toolArgs),
          status: "pending",
          message: `Executing ${formatToolDisplayName(toolName)}...`,
          category: toolCategory,
          timestamp: new Date().toISOString(),
        };
        actionLog.push(logEntry);

        const toolResult = await executeTool(toolName, toolArgs, db, user.id, correlationId);

        // Update log entry based on result
        if (toolResult.success) {
          logEntry.status = "success";
          logEntry.message = formatToolLabel(toolName, toolResult.result);
          logEntry.metadata = filterSafeMetadata(toolResult.result);

          // Track state changes — preserve partial progress
          if (toolName === "find_or_create_client" && toolResult.result.client_id) {
            stateJson.client_id = toolResult.result.client_id;
          }
          if (toolName === "create_event_draft" && toolResult.result.event_id) {
            stateJson.event_id = toolResult.result.event_id;
            await db.from("ai_chat_sessions").update({ event_id: toolResult.result.event_id as string }).eq("id", session.id);
          }
          if (toolName === "save_event_proposal" && toolResult.result.event_id) {
            stateJson.event_id = toolResult.result.event_id;
            if (toolResult.result.client_id) stateJson.client_id = toolResult.result.client_id;
            await db.from("ai_chat_sessions").update({ event_id: toolResult.result.event_id as string }).eq("id", session.id);
          }
          if (toolName === "apply_template" && toolResult.result.event_id) {
            stateJson.event_id = toolResult.result.event_id;
            await db.from("ai_chat_sessions").update({ event_id: toolResult.result.event_id as string }).eq("id", session.id);
          }
          if (toolName === "duplicate_event" && toolResult.result.event_id) {
            stateJson.event_id = toolResult.result.event_id;
            await db.from("ai_chat_sessions").update({ event_id: toolResult.result.event_id as string }).eq("id", session.id);
          }
        } else {
          logEntry.status = "failed";
          logEntry.message = toolResult.error || "Action failed";
          logEntry.category = toolResult.category;
        }

        await db.from("ai_chat_messages").insert({
          session_id: session.id,
          role: "tool",
          content: JSON.stringify(toolResult),
          metadata: { tool_name: toolName, tool_call_id: tc.id, status: logEntry.status, category: logEntry.category },
        });

        toolCallMessages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });

        // Always persist state after each tool — partial progress is kept
        await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);
      }

      // ── Memory capture: learn from successful tool executions ──
      await captureMemoryFromActions(db, user.id, actionLog, stateJson, correlationId);

      // ── Persist action log to ai_action_logs table ──
      await persistActionLog(db, session.id, user.id, actionLog);

      // Build frontend-compatible actions from action log
      const executedActions = actionLog.map(entry => ({
        type: entry.status === "failed" ? "warning" as const
            : entry.action === "search_venue_on_maps" ? "venue_search" as const
            : entry.action === "get_venue_photos" ? "venue_photos" as const
            : entry.action === "generate_full_event_proposal" ? "proposal" as const
            : entry.action.startsWith("check") ? "info" as const
            : "created" as const,
        label: entry.message,
        detail: entry.status === "failed" ? (entry.category || "error") : undefined,
        status: entry.status,
        data: resolveActionData(entry, actionLog, toolCalls, toolCallMessages),
      }));

      // ── Second OpenAI call for summary ──
      const summaryResp = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: toolCallMessages,
          temperature: 0.5,
          max_completion_tokens: 1000,
        }),
      });

      if (summaryResp.ok) {
        const summaryResult = await summaryResp.json();
        const summaryContent = summaryResult.choices?.[0]?.message?.content || "Actions completed.";

        // ── Detect if the summary asks for confirmation and store pending action ──
        const summaryConfirmMatch = summaryContent.match(/(?:do you want me to|shall I|would you like me to|should I|want me to)\s+(.+?)(?:\?|$)/i);
        if (summaryConfirmMatch && stateJson.event_id) {
          const actionText = summaryConfirmMatch[1].toLowerCase();
          let pendingTool = "";
          let pendingArgs: Record<string, unknown> = { event_id: stateJson.event_id };

          const locMatch = summaryContent.match(/(?:location|city)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);
          const venMatch = summaryContent.match(/(?:venue(?:\s+name)?)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);
          const titMatch = summaryContent.match(/(?:rename|title)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);

          if (actionText.includes("update") || actionText.includes("change") || actionText.includes("set")) {
            if (locMatch) {
              pendingTool = "update_event_basics";
              pendingArgs.location = locMatch[1].trim();
            } else if (venMatch) {
              pendingTool = "set_event_venue";
              pendingArgs.venue_name = venMatch[1].trim();
            } else if (titMatch) {
              pendingTool = "rename_event";
              pendingArgs.new_title = titMatch[1].trim();
            } else {
              pendingTool = "update_event_basics";
            }
          } else if (actionText.includes("publish")) {
            pendingTool = "publish_event";
          } else if (actionText.includes("archive")) {
            pendingTool = "archive_event";
          }

          if (pendingTool) {
            stateJson.pending_action = {
              tool: pendingTool,
              arguments: pendingArgs,
              summary: summaryConfirmMatch[1].trim(),
              awaiting_confirmation: true,
              created_at: new Date().toISOString(),
            };
            console.log(`[${correlationId}] Stored pending action from summary: ${pendingTool}`);
            await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);
          }
        }

        // Extract numbered options from summary for next-turn resolution
        extractAndStoreOptions(summaryContent, stateJson);
        await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);

        await db.from("ai_chat_messages").insert({ session_id: session.id, role: "assistant", content: summaryContent });

        const draftState = await buildDraftState(db, user.id, stateJson);

        return new Response(
          JSON.stringify({
            sessionId: session.id,
            reply: summaryContent,
            actions: executedActions,
            actionLog,
            draft: draftState,
            correlationId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Plain assistant response (no tool calls) ──
    const assistantContent = choice?.message?.content || "I'm ready to help. What would you like to do?";

    // ── Detect if the AI is asking for confirmation and capture pending action ──
    const confirmationAskPatterns = /(?:do you want me to|shall I|would you like me to|should I|want me to)\s+(.+?)(?:\?|$)/i;
    const confirmMatch = assistantContent.match(confirmationAskPatterns);
    if (confirmMatch && stateJson.event_id) {
      // Try to infer what action the AI wants to perform from its response
      const actionText = confirmMatch[1].toLowerCase();
      let pendingTool = "";
      let pendingArgs: Record<string, unknown> = { event_id: stateJson.event_id };

      // Parse common update patterns from the response
      const locationMatch = assistantContent.match(/(?:location|city)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);
      const venueMatch = assistantContent.match(/(?:venue(?:\s+name)?)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);
      const titleMatch = assistantContent.match(/(?:rename|title)\s+(?:to|as)\s+[""]?([^""?.]+)[""]?/i);

      if (actionText.includes("update") || actionText.includes("change") || actionText.includes("set")) {
        if (locationMatch) {
          pendingTool = "update_event_basics";
          pendingArgs.location = locationMatch[1].trim();
        } else if (venueMatch) {
          pendingTool = "set_event_venue";
          pendingArgs.venue_name = venueMatch[1].trim();
        } else if (titleMatch) {
          pendingTool = "rename_event";
          pendingArgs.new_title = titleMatch[1].trim();
        } else {
          // Generic update — try to extract field:value patterns
          pendingTool = "update_event_basics";
        }
      } else if (actionText.includes("publish")) {
        pendingTool = "publish_event";
      } else if (actionText.includes("archive")) {
        pendingTool = "archive_event";
      } else if (actionText.includes("unpublish")) {
        pendingTool = "unpublish_event";
      } else if (actionText.includes("duplicate") || actionText.includes("copy")) {
        pendingTool = "duplicate_event";
      }

      if (pendingTool) {
        stateJson.pending_action = {
          tool: pendingTool,
          arguments: pendingArgs,
          summary: confirmMatch[1].trim(),
          awaiting_confirmation: true,
          created_at: new Date().toISOString(),
        };
        console.log(`[${correlationId}] Stored pending action: ${pendingTool} args=${JSON.stringify(pendingArgs)}`);
      }
    }

    // ── Extract numbered options from assistant response for next-turn resolution ──
    extractAndStoreOptions(assistantContent, stateJson);

    await db.from("ai_chat_messages").insert({ session_id: session.id, role: "assistant", content: assistantContent });
    await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);

    const draftState = await buildDraftState(db, user.id, stateJson);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        reply: assistantContent,
        actions: actionLog.length > 0 ? actionLog.map(e => ({
          type: e.status === "failed" ? "warning" : "info",
          label: e.message,
          status: e.status,
        })) : undefined,
        actionLog: actionLog.length > 0 ? actionLog : undefined,
        draft: draftState,
        correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[${correlationId}] ai-event-builder error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error", correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Memory Capture ───────────────────────────────────────

async function captureMemoryFromActions(
  db: any,
  userId: string,
  actionLog: ActionLogEntry[],
  stateJson: Record<string, unknown>,
  correlationId: string,
): Promise<void> {
  try {
    const memoryUpdates: Array<{ key: string; value: Record<string, unknown>; type: string }> = [];

    for (const entry of actionLog) {
      if (entry.status !== "success") continue;
      const meta = entry.metadata || {};

      // Learn preferred location
      if (entry.action === "update_event_basics" && meta.location) {
        memoryUpdates.push({ key: "preferred_location", value: { display: meta.location, value: meta.location }, type: "preference" });
      }

      // Learn preferred venue
      if (entry.action === "save_selected_venue" && meta.venue_name) {
        memoryUpdates.push({ key: "preferred_venue", value: { display: meta.venue_name, value: meta.venue_name }, type: "preference" });
      }

      // Learn preferred client
      if (entry.action === "find_or_create_client" && meta.name) {
        memoryUpdates.push({ key: "preferred_client", value: { display: meta.name, client_id: meta.client_id }, type: "context" });
      }

      // Learn preferred theme
      if (entry.action === "update_event_basics" && meta.theme_id) {
        memoryUpdates.push({ key: "preferred_theme", value: { display: meta.theme_id, value: meta.theme_id }, type: "preference" });
      }

      // Track workflow patterns
      if (entry.action === "check_publish_readiness") {
        memoryUpdates.push({ key: "pattern_checks_readiness", value: { display: "Checks readiness after changes", pattern: "readiness_check" }, type: "pattern" });
      }
    }

    // Upsert memories with confidence increase
    for (const mem of memoryUpdates) {
      const { data: existing } = await db
        .from("ai_user_memory")
        .select("id, confidence_score, usage_count, value")
        .eq("user_id", userId)
        .eq("key", mem.key)
        .single();

      if (existing) {
        // Same value → increase confidence; different value → decrease slightly and update
        const sameValue = JSON.stringify(existing.value) === JSON.stringify(mem.value);
        const newConfidence = sameValue
          ? Math.min(1, Number(existing.confidence_score) + 0.1)
          : Math.max(0.3, Number(existing.confidence_score) - 0.15);

        await db.from("ai_user_memory").update({
          value: sameValue ? existing.value : mem.value,
          confidence_score: newConfidence,
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await db.from("ai_user_memory").insert({
          user_id: userId,
          memory_type: mem.type,
          key: mem.key,
          value: mem.value,
          confidence_score: 0.5,
          usage_count: 1,
          source: "inferred",
        });
      }
    }

    if (memoryUpdates.length > 0) {
      console.log(`[${correlationId}] Captured ${memoryUpdates.length} memory updates`);
    }
  } catch (err) {
    console.warn(`[${correlationId}] Memory capture error (non-fatal):`, err);
  }
}

// ─── Helpers ───────────────────────────────────────────────

function formatToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    find_or_create_client: "Find/Create Client",
    create_event_draft: "Create Event Draft",
    update_event_basics: "Update Event",
    set_event_venue: "Set Venue",
    search_venue_on_maps: "Search Venue",
    save_selected_venue: "Save Venue",
    get_venue_photos: "Fetch Venue Photos",
    save_selected_venue_photos: "Save Photos",
    add_attendees_from_text: "Add Attendees",
    add_agenda_items: "Add Agenda",
    check_publish_readiness: "Check Readiness",
    generate_full_event_proposal: "Generate Event Proposal",
    save_event_proposal: "Save Event Proposal",
    apply_template: "Apply Template",
    list_workspace_events: "List Events",
    list_workspace_clients: "List Clients",
    get_event_details: "Get Event Details",
    get_client_details: "Get Client Details",
    list_events_by_client: "List Client Events",
    publish_event: "Publish Event",
    unpublish_event: "Unpublish Event",
    archive_event: "Archive Event",
    duplicate_event: "Duplicate Event",
    rename_event: "Rename Event",
    get_missing_fields: "Check Missing Fields",
    recommend_next_actions: "Get Recommendations",
    register_uploaded_media: "Register Upload",
    create_brand_kit: "Create Brand Kit",
    get_brand_kit: "Get Brand Kit",
    save_visual_pack: "Save Visual Pack",
    apply_visual_pack: "Apply Visual Pack",
    get_event_analytics_summary: "Event Analytics",
    get_workspace_analytics_summary: "Workspace Analytics",
    prepare_communication_campaign: "Prepare Campaign",
    send_communication_campaign: "Send Campaign",
    get_event_confirmation_stats: "Confirmation Stats",
    list_confirmation_segments: "Confirmation Segments",
    get_communication_performance: "Communication Performance",
    list_event_campaigns: "List Campaigns",
  };
  return names[toolName] || toolName;
}

function resolveToolTarget(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "find_or_create_client") return (args.name as string) || "client";
  if (toolName === "create_event_draft") return (args.title as string) || "event";
  if (toolName === "search_venue_on_maps") return (args.query as string) || "venue";
  if (toolName === "generate_full_event_proposal") return (args.description as string)?.substring(0, 40) || "proposal";
  if (toolName === "save_event_proposal") return "full proposal";
  if (toolName === "apply_template") return (args.search_query as string) || "template";
  if (toolName === "list_workspace_events") return (args.status_filter as string) || "workspace events";
  if (toolName === "list_workspace_clients") return (args.search as string) || "workspace clients";
  if (toolName === "get_event_details") return (args.title_search as string) || (args.event_id as string)?.slice(0, 8) || "event";
  if (toolName === "get_client_details") return (args.name_search as string) || (args.client_id as string)?.slice(0, 8) || "client";
  if (toolName === "list_events_by_client") return (args.client_name as string) || "client events";
  if (toolName === "publish_event" || toolName === "unpublish_event" || toolName === "archive_event" || toolName === "rename_event") return `event:${(args.event_id as string)?.slice(0, 8) || ""}`;
  if (toolName === "duplicate_event") return (args.new_title as string) || `event:${(args.event_id as string)?.slice(0, 8) || ""}`;
  if (toolName === "get_missing_fields") return `event:${(args.event_id as string)?.slice(0, 8) || ""}`;
  if (toolName === "recommend_next_actions") return args.event_id ? `event:${(args.event_id as string)?.slice(0, 8) || ""}` : "workspace";
  if (toolName === "prepare_communication_campaign") return (args.campaign_type as string) || "campaign";
  if (toolName === "send_communication_campaign") return `campaign:${(args.campaign_id as string)?.slice(0, 8) || ""}`;
  if (toolName === "get_event_confirmation_stats" || toolName === "list_confirmation_segments" || toolName === "get_communication_performance" || toolName === "list_event_campaigns") return `event:${(args.event_id as string)?.slice(0, 8) || ""}`;
  if (args.event_id) return `event:${(args.event_id as string).slice(0, 8)}`;
  return toolName;
}

function filterSafeMetadata(result: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowed = ["client_id", "event_id", "action", "name", "title", "slug", "added", "score", "ready", "saved_count", "updated_fields", "venue_name", "template_name", "templates", "cloned", "events", "clients", "total", "message", "found", "event", "counts", "status", "old_title", "new_title", "source_event_id", "missing", "event_count", "recent_events", "client", "recommendations", "total_recommendations", "complete", "scope", "campaign_id", "campaign_type", "channels", "audience_count", "audience_segment", "sent_email", "sent_whatsapp", "failed_email", "failed_whatsapp", "confirmation_rate", "invited", "confirmed", "pending", "segments", "campaigns", "location", "theme_id"];
  for (const k of allowed) {
    if (result[k] !== undefined) safe[k] = result[k];
  }
  return safe;
}

function resolveActionData(
  entry: ActionLogEntry,
  _actionLog: ActionLogEntry[],
  toolCalls: any[],
  toolCallMessages: any[],
): any {
  // Find the tool result for this action from toolCallMessages
  const tc = toolCalls.find((t: any) => t.function.name === entry.action);
  if (!tc) return undefined;

  const resultMsg = toolCallMessages.find(
    (m: any) => m.role === "tool" && m.tool_call_id === tc.id
  );
  if (!resultMsg) return undefined;

  try {
    const parsed = JSON.parse(resultMsg.content);
    if (!parsed.success) return undefined;

    if (entry.action === "search_venue_on_maps") return { venues: parsed.result.venues };
    if (entry.action === "get_venue_photos") return { photos: parsed.result.photos, place_id: parsed.result.place_id };
    if (entry.action === "save_selected_venue") return { venue_saved: parsed.result };
    if (entry.action === "generate_full_event_proposal") return { proposal: parsed.result.proposal };
    if (entry.action === "save_event_proposal") return { saved: parsed.result };
    return undefined;
  } catch {
    return undefined;
  }
}

function formatToolLabel(toolName: string, result: Record<string, unknown>): string {
  switch (toolName) {
    case "find_or_create_client":
      return result.action === "created_new"
        ? `Created client "${result.name}"`
        : `Found client "${result.name}"`;
    case "create_event_draft":
      return `Created draft event "${result.title}"`;
    case "update_event_basics":
      return `Updated event (${(result.updated_fields as string[])?.join(", ")})`;
    case "set_event_venue":
      return `Set venue details`;
    case "search_venue_on_maps":
      return `Found ${(result.venues as any[])?.length || 0} venue matches`;
    case "save_selected_venue":
      return `Saved venue "${result.venue_name}"`;
    case "get_venue_photos":
      return `Found ${(result.photos as any[])?.length || 0} venue photos`;
    case "save_selected_venue_photos":
      return `Saved ${result.saved_count} venue photos`;
    case "add_attendees_from_text":
      return `Added ${result.added} attendees`;
    case "add_agenda_items":
      return `Added ${result.added} agenda items`;
    case "check_publish_readiness":
      return result.ready ? `Event is ready to publish (${result.score}%)` : `Readiness: ${result.score}% — ${(result.missing as string[])?.length} items missing`;
    case "generate_full_event_proposal":
      return `Generated event proposal — review before saving`;
    case "save_event_proposal":
      return `Saved event "${result.event_title}" with ${result.agenda_count || 0} agenda items`;
    case "apply_template":
      if (result.action === "templates_found") return `Found ${(result.templates as any[])?.length || 0} matching templates`;
      if (result.action === "no_templates_found") return `No templates found for "${result.query}"`;
      return `Applied template "${result.template_name}" → created "${result.event_title}"`;
    case "list_workspace_events":
      return (result.message as string) || `Listed ${result.total} events`;
    case "list_workspace_clients":
      return (result.message as string) || `Listed ${result.total} clients`;
    case "get_event_details":
      return result.found ? `Retrieved details for "${(result.event as any)?.title}"` : (result.message as string) || "Event not found";
    case "get_client_details":
      return result.found ? `Retrieved client "${(result.client as any)?.name}" (${result.event_count} events)` : (result.message as string) || "Client not found";
    case "list_events_by_client":
      return (result.message as string) || `Listed ${result.total} client events`;
    case "publish_event":
      return (result.message as string) || `Published event`;
    case "unpublish_event":
      return (result.message as string) || `Unpublished event`;
    case "archive_event":
      return (result.message as string) || `Archived event`;
    case "duplicate_event":
      return (result.message as string) || `Duplicated event`;
    case "rename_event":
      return (result.message as string) || `Renamed event`;
    case "get_missing_fields":
      return result.ready ? `Event is complete (${result.score}%)` : `${(result.missing as any[])?.length || 0} fields missing (${result.score}% complete)`;
    case "recommend_next_actions":
      return `${(result.recommendations as any[])?.length || 0} recommendations`;
    case "register_uploaded_media":
      return (result.message as string) || "Registered uploaded image";
    case "create_brand_kit":
      return (result.message as string) || `Created brand kit "${result.name}"`;
    case "get_brand_kit":
      return result.found ? `Found ${(result.brand_kits as any[])?.length || 0} brand kit(s)` : "No brand kits found";
    case "save_visual_pack":
      return (result.message as string) || `Saved visual pack`;
    case "apply_visual_pack":
      return (result.message as string) || `Applied visual pack`;
    case "get_event_analytics_summary":
      return `Analytics: ${(result.metrics as any)?.rsvpRate ?? 0}% RSVP, ${(result.metrics as any)?.attendanceRate ?? 0}% attendance`;
    case "get_workspace_analytics_summary":
      return `Workspace: ${result.totalEvents} events, ${result.totalAttendees} attendees`;
    case "prepare_communication_campaign":
      return (result.message as string) || `Prepared ${result.campaign_type} campaign for ${result.audience_count} recipients`;
    case "send_communication_campaign":
      return (result.message as string) || `Sent campaign: ${result.sent_email ?? 0} emails, ${result.sent_whatsapp ?? 0} WhatsApp`;
    case "get_event_confirmation_stats":
      return `Confirmed: ${result.confirmed ?? 0}/${result.invited ?? 0} (${result.confirmation_rate ?? 0}%)`;
    case "list_confirmation_segments":
      return (result.message as string) || `Segments retrieved`;
    case "get_communication_performance":
      return (result.message as string) || `Communication performance retrieved`;
    case "list_event_campaigns":
      return (result.message as string) || `Listed ${(result.campaigns as any[])?.length ?? 0} campaigns`;
    default:
      return toolName;
  }
}

// ─── Extract numbered options from AI response ─────────────
function extractAndStoreOptions(content: string, stateJson: Record<string, unknown>): void {
  // Match numbered list patterns like "1. Option text\n2. Option text\n3. Other"
  const lines = content.split("\n");
  const numberedLines: string[] = [];
  let contextLine = "";

  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\.\s+(.+)/);
    if (match) {
      numberedLines.push(match[2].trim());
    } else if (numberedLines.length === 0 && line.trim().endsWith("?")) {
      // Capture the question preceding the list as context
      contextLine = line.trim();
    }
  }

  // Only store if we found a meaningful numbered list (2+ items)
  if (numberedLines.length >= 2) {
    // Check if the last item is "Other" variant
    const lastItem = numberedLines[numberedLines.length - 1].toLowerCase();
    const isOtherLast = lastItem === "other" || lastItem.startsWith("other ") || lastItem === "none of these" || lastItem === "something else";

    stateJson.active_options = {
      options: numberedLines,
      context: contextLine || "choice",
      has_other: isOtherLast,
    };
  } else {
    // No numbered list in this response — clear stale options
    delete stateJson.active_options;
  }
}
