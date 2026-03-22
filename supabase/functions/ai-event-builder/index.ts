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

// ─── System Prompt v3 (Guided Context + Production) ────────
const SYSTEM_PROMPT = `You are TitanMeet AI Builder — an execution partner for workspace administrators to create, manage, and operate events.

You operate within a single workspace context. You are operational, not conversational.

════════════════════════════════════════
GUIDED OPENING WORKFLOW (CRITICAL)
════════════════════════════════════════

When a new session starts (no active client or event in context), you MUST guide the admin through context establishment BEFORE doing anything else:

**Step 1: Client**
- If no client is set, ask the admin to choose a client.
- Use list_workspace_clients to show available clients.
- If the admin names a client directly, use find_or_create_client.
- Once a client is established, move to Step 2.

**Step 2: Event Mode**
- Ask: "Would you like to create a new event, or continue working on an existing draft?"
- If the admin asks to list events or mentions a specific event, use list_events_by_client or get_event_details.

**Step 3: Event Selection**
- If creating new: use create_event_draft (ask for title at minimum).
- If continuing draft: use list_events_by_client with status_filter "draft" to show options, then get_event_details once selected.

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
- After a successful action, confirm briefly and suggest the next useful step.
- After a failed action, explain what went wrong simply and suggest a fix.
- Never dump raw JSON, tool names, or internal status codes in user-facing text.
- Use natural language: "Done — updated the location to New Cairo." not "update_event_basics executed successfully with fields: location".

════════════════════════════════════════
INTENT HANDLING
════════════════════════════════════════

User says "list / show / find / what events" → call retrieval tools (list_workspace_events, list_workspace_clients, get_event_details, get_client_details, list_events_by_client)
User says "create / add / update / set / change" → call mutation tools
User says "publish / unpublish / archive / duplicate / rename" → call lifecycle tools
User says "analyze / metrics / how is / RSVP rate / readiness" → call intelligence tools (get_missing_fields, recommend_next_actions, check_publish_readiness)
User says "use template / start from template" → call apply_template
User says "generate event / build complete event" → call generate_full_event_proposal, then wait for approval before save_event_proposal

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
2. Present top results with address and rating.
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
2. If multiple found, present them and ask admin to pick.
3. Once selected, ask for event title and date if not provided.
4. Apply and summarize what was created.

════════════════════════════════════════
INTELLIGENCE
════════════════════════════════════════

When admin asks "what should I do next", "what's missing", "is this ready":
1. Use get_missing_fields to check what the event still needs.
2. Use recommend_next_actions to suggest practical next steps.
3. Present recommendations as a prioritized numbered list.

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
- Example: "Here are your draft events:\\n1. Sales Kickoff — March 10\\n2. Tech Summit — April 5"

════════════════════════════════════════
GOAL
════════════════════════════════════════

Act as an execution partner, not a chatbot. Help the admin move faster, avoid mistakes, and know what to do next.`;



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
  if (!(Array.isArray(evt.hero_images) && evt.hero_images.length > 0)) nextSteps.push("Upload a hero image");

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
    if (!(Array.isArray(evt.hero_images) && evt.hero_images.length > 0)) recommendations.push({ action: "Upload hero image", reason: "Visual appeal for the public page", priority: "medium" });
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
    const { sessionId, message, context } = body;

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

    // ── Confirmation detection: check if user is confirming a pending action ──
    const confirmationPatterns = /^\s*(yes|yeah|yep|yup|sure|confirm|proceed|do it|go ahead|okay|ok|approved?|absolutely|please do|let'?s do it|update it|save it|go for it)\s*[.!]?\s*$/i;
    const isConfirmation = confirmationPatterns.test(message.trim());
    const pendingAction = stateJson.pending_action;
    let confirmationInjection = "";

    if (isConfirmation && pendingAction && pendingAction.awaiting_confirmation) {
      console.log(`[${correlationId}] Confirmation detected for pending action: ${pendingAction.tool}`);
      confirmationInjection = `\n\n⚠️ PENDING ACTION CONFIRMED — The user just confirmed the following action. Execute it NOW by calling the tool. Do NOT ask again.\nTool: ${pendingAction.tool}\nArguments: ${JSON.stringify(pendingAction.arguments)}\nAction: ${pendingAction.summary}`;
      // Clear pending action from state (will be persisted after execution)
      delete stateJson.pending_action;
    }

    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + (contextStr ? `\n\nCurrent context:${contextStr}` : "") + confirmationInjection },
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
        const isIntelligenceTool = ["get_missing_fields", "recommend_next_actions", "check_publish_readiness"].includes(toolName);
        const toolCategory = isRetrievalTool ? "retrieval" : isIntelligenceTool ? "intelligence" : undefined;

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
  if (args.event_id) return `event:${(args.event_id as string).slice(0, 8)}`;
  return toolName;
}

function filterSafeMetadata(result: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowed = ["client_id", "event_id", "action", "name", "title", "slug", "added", "score", "ready", "saved_count", "updated_fields", "venue_name", "template_name", "templates", "cloned", "events", "clients", "total", "message", "found", "event", "counts", "status", "old_title", "new_title", "source_event_id", "missing", "event_count", "recent_events", "client", "recommendations", "total_recommendations", "complete", "scope"];
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
    default:
      return toolName;
  }
}
