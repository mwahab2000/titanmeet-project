import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_HISTORY = 30;

// ─── System Prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are the TitanMeet AI Builder — an expert event management assistant for administrators.

Your job is to help admins create clients, events, agendas, attendees, and manage event readiness through conversation.

RULES:
1. Guide the admin through event creation in a logical order: Client → Event basics → Venue → Organizers → Attendees → Agenda → Readiness check.
2. Ask ONE focused question at a time. Never dump a wall of questions.
3. Use tools to perform real actions. NEVER claim an action succeeded without tool confirmation.
4. If the admin gives enough info for an action, call the relevant tool immediately.
5. After a tool call, summarize what was done and suggest the next step.
6. If info is ambiguous, ask for clarification before calling a tool.
7. Keep responses concise, professional, and action-oriented.
8. Never expose internal IDs, database schemas, or system details to the admin.
9. Never fabricate data. If you don't know something, say so.
10. When parsing attendee lists, be flexible with formats (comma-separated, newlines, etc.).

You have access to tools for: finding/creating clients, creating event drafts, updating event details, setting venues, adding attendees, adding agenda items, and checking publish readiness.`;

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
      description: "Set venue details for an event.",
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
      name: "add_attendees_from_text",
      description: "Parse a free-text list of attendee names (and optionally emails) and add them to the event. Supports comma-separated, newline-separated, or 'Name <email>' format.",
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
];

// ─── Tool Executor ─────────────────────────────────────────
type SupabaseClient = ReturnType<typeof createClient>;

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  db: SupabaseClient,
  userId: string,
  correlationId: string,
): Promise<{ success: boolean; result: Record<string, unknown>; error?: string }> {
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
      case "add_attendees_from_text":
        return await toolAddAttendeesFromText(db, userId, args as any);
      case "add_agenda_items":
        return await toolAddAgendaItems(db, userId, args as any);
      case "check_publish_readiness":
        return await toolCheckPublishReadiness(db, userId, args as any);
      default:
        return { success: false, result: {}, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[${correlationId}] tool error:`, err);
    return { success: false, result: {}, error: err instanceof Error ? err.message : "Tool execution failed" };
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
    .select("id")
    .eq("id", clientId)
    .or(`created_by.eq.${userId}`)
    .single();
  if (data) return true;
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
) {
  const { name, slug } = args;
  if (!name?.trim()) return { success: false, result: {}, error: "Client name is required" };

  const isPrivileged = await isAdminOrOwnerRole(db, userId);

  // Search: own clients + admin sees all
  let query = db.from("clients").select("id, name, slug").ilike("name", name.trim()).limit(1);
  if (!isPrivileged) query = query.eq("created_by", userId);

  const { data: existing } = await query.single();

  if (existing) {
    return { success: true, result: { client_id: existing.id, name: existing.name, slug: existing.slug, action: "found_existing" } };
  }

  // Create new — always owned by current user
  const clientSlug = slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: created, error } = await db
    .from("clients")
    .insert({ name: name.trim(), slug: clientSlug, created_by: userId })
    .select("id, name, slug")
    .single();

  if (error) {
    console.error(`[toolFindOrCreateClient] insert error: ${error.code} ${error.message}`);
    const friendlyMsg = error.code === "42501"
      ? "Permission denied when creating client. Please contact support."
      : error.code === "23505"
      ? "A client with this slug already exists. Try a different name."
      : `Failed to create client: ${error.message}`;
    return { success: false, result: {}, error: friendlyMsg };
  }
  return { success: true, result: { client_id: created.id, name: created.name, slug: created.slug, action: "created_new" } };
}

async function toolCreateEventDraft(
  db: SupabaseClient, userId: string,
  args: { title: string; client_id?: string; description?: string; start_date?: string; end_date?: string; location?: string; slug?: string }
) {
  if (!args.title?.trim()) return { success: false, result: {}, error: "Event title is required" };

  // If client_id provided, verify user can manage that client
  if (args.client_id) {
    const canManage = await canManageClient(db, userId, args.client_id);
    if (!canManage) return { success: false, result: {}, error: "You don't have permission to create events for this client" };
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

  if (error) return { success: false, result: {}, error: `Failed to create event: ${error.message}` };
  return { success: true, result: { event_id: data.id, title: data.title, slug: data.slug, status: data.status } };
}

async function toolUpdateEventBasics(
  db: SupabaseClient, userId: string,
  args: { event_id: string; [key: string]: unknown }
) {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required" };

  // Verify ownership
  const { data: evt } = await db.from("events").select("id, created_by").eq("id", args.event_id).single();
  if (!evt || evt.created_by !== userId) return { success: false, result: {}, error: "Event not found or access denied" };

  const updateFields: Record<string, unknown> = {};
  const allowed = ["title", "description", "start_date", "end_date", "location", "theme_id", "max_attendees"];
  for (const k of allowed) {
    if (args[k] !== undefined) updateFields[k] = args[k];
  }

  if (Object.keys(updateFields).length === 0) return { success: false, result: {}, error: "No fields to update" };

  const { error } = await db.from("events").update(updateFields).eq("id", args.event_id);
  if (error) return { success: false, result: {}, error: `Update failed: ${error.message}` };

  return { success: true, result: { event_id: args.event_id, updated_fields: Object.keys(updateFields) } };
}

async function toolSetEventVenue(
  db: SupabaseClient, userId: string,
  args: { event_id: string; venue_name?: string; venue_address?: string; venue_map_link?: string; venue_notes?: string }
) {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required" };

  const { data: evt } = await db.from("events").select("id, created_by").eq("id", args.event_id).single();
  if (!evt || evt.created_by !== userId) return { success: false, result: {}, error: "Event not found or access denied" };

  const updateFields: Record<string, unknown> = {};
  if (args.venue_name) updateFields.venue_name = args.venue_name.trim();
  if (args.venue_address) updateFields.venue_address = args.venue_address.trim();
  if (args.venue_map_link) updateFields.venue_map_link = args.venue_map_link.trim();
  if (args.venue_notes) updateFields.venue_notes = args.venue_notes.trim();

  if (Object.keys(updateFields).length === 0) return { success: false, result: {}, error: "No venue fields provided" };

  const { error } = await db.from("events").update(updateFields).eq("id", args.event_id);
  if (error) return { success: false, result: {}, error: `Venue update failed: ${error.message}` };

  return { success: true, result: { event_id: args.event_id, venue: updateFields } };
}

async function toolAddAttendeesFromText(
  db: SupabaseClient, userId: string,
  args: { event_id: string; text: string }
) {
  if (!args.event_id || !args.text?.trim()) return { success: false, result: {}, error: "event_id and text are required" };

  const { data: evt } = await db.from("events").select("id, created_by").eq("id", args.event_id).single();
  if (!evt || evt.created_by !== userId) return { success: false, result: {}, error: "Event not found or access denied" };

  // Parse: support "Name <email>", "Name, email", or just names
  const lines = args.text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
  const attendees: Array<{ name: string; email: string; event_id: string }> = [];
  const skipped: string[] = [];

  for (const line of lines) {
    // Try "Name <email>" pattern
    const angleMatch = line.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
    if (angleMatch) {
      attendees.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim(), event_id: args.event_id });
      continue;
    }
    // Try "Name email@domain" pattern
    const spaceEmailMatch = line.match(/^(.+?)\s+(\S+@\S+\.\S+)$/);
    if (spaceEmailMatch) {
      attendees.push({ name: spaceEmailMatch[1].trim(), email: spaceEmailMatch[2].trim(), event_id: args.event_id });
      continue;
    }
    // Check if it's just an email
    if (line.includes("@")) {
      const namePart = line.split("@")[0].replace(/[._]/g, " ");
      attendees.push({ name: namePart, email: line, event_id: args.event_id });
      continue;
    }
    // Just a name — generate placeholder email
    if (line.length > 1) {
      const placeholder = `${line.toLowerCase().replace(/\s+/g, ".")}@placeholder.local`;
      attendees.push({ name: line, email: placeholder, event_id: args.event_id });
    } else {
      skipped.push(line);
    }
  }

  if (attendees.length === 0) return { success: false, result: { skipped }, error: "No valid attendees parsed from text" };

  const { error } = await db.from("attendees").insert(attendees);
  if (error) return { success: false, result: {}, error: `Insert failed: ${error.message}` };

  return { success: true, result: { added: attendees.length, skipped: skipped.length, names: attendees.map(a => a.name) } };
}

async function toolAddAgendaItems(
  db: SupabaseClient, userId: string,
  args: { event_id: string; items: Array<{ title: string; description?: string; start_time?: string; end_time?: string; day_number?: number }> }
) {
  if (!args.event_id || !args.items?.length) return { success: false, result: {}, error: "event_id and items are required" };

  const { data: evt } = await db.from("events").select("id, created_by").eq("id", args.event_id).single();
  if (!evt || evt.created_by !== userId) return { success: false, result: {}, error: "Event not found or access denied" };

  // Get current max order_index
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
  if (error) return { success: false, result: {}, error: `Insert failed: ${error.message}` };

  return { success: true, result: { added: rows.length, titles: rows.map(r => r.title) } };
}

async function toolCheckPublishReadiness(
  db: SupabaseClient, userId: string,
  args: { event_id: string }
) {
  if (!args.event_id) return { success: false, result: {}, error: "event_id is required" };

  const { data: evt, error: evtErr } = await db
    .from("events")
    .select("*")
    .eq("id", args.event_id)
    .single();

  if (evtErr || !evt) return { success: false, result: {}, error: "Event not found" };
  if (evt.created_by !== userId) return { success: false, result: {}, error: "Access denied" };

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

// ─── Draft State Builder ───────────────────────────────────

async function buildDraftState(
  db: SupabaseClient,
  userId: string,
  sessionState: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const state: Record<string, unknown> = { ...sessionState };

  // If we have an event_id, enrich with live data
  const eventId = state.event_id as string | undefined;
  if (eventId) {
    const { data: evt } = await db.from("events").select("*, clients(id, name, slug)").eq("id", eventId).single();
    if (evt) {
      const { count: attCount } = await db.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const { count: agdCount } = await db.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const { count: orgCount } = await db.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", eventId);

      state.client = evt.clients ? { name: (evt.clients as any).name, slug: (evt.clients as any).slug, id: (evt.clients as any).id, status: "done" } : { status: "empty" };
      state.eventBasics = { title: evt.title, date: evt.event_date || evt.start_date, location: evt.location, status: evt.title ? "done" : "empty" };
      state.venue = { name: evt.venue_name, address: evt.venue_address, status: evt.venue_name ? "done" : "empty" };
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

    // Auth client to verify user
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

    // Service role client for DB operations
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

    // Build context string for system prompt
    let contextStr = "";
    if (stateJson.event_id) contextStr += `\nCurrent event ID: ${stateJson.event_id}`;
    if (stateJson.client_id || context?.clientId) contextStr += `\nCurrent client ID: ${stateJson.client_id || context?.clientId}`;
    if (context?.eventId) {
      contextStr += `\nEvent context ID: ${context.eventId}`;
      if (!stateJson.event_id) stateJson.event_id = context.eventId;
    }

    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + (contextStr ? `\n\nCurrent context:${contextStr}` : "") },
    ];

    // Add history (skip tool messages for simplicity, include as system notes)
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
    const executedActions: Array<{ type: string; label: string; detail?: string }> = [];

    // ── Handle tool calls ──
    if (choice?.finish_reason === "tool_calls" && choice?.message?.tool_calls) {
      const toolCalls = choice.message.tool_calls;

      // Add assistant message with tool_calls to context
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

        const toolResult = await executeTool(toolName, toolArgs, db, user.id, correlationId);

        // Track state changes
        if (toolResult.success) {
          if (toolName === "find_or_create_client" && toolResult.result.client_id) {
            stateJson.client_id = toolResult.result.client_id;
          }
          if (toolName === "create_event_draft" && toolResult.result.event_id) {
            stateJson.event_id = toolResult.result.event_id;
            // Also link session to event
            await db.from("ai_chat_sessions").update({ event_id: toolResult.result.event_id as string }).eq("id", session.id);
          }

          executedActions.push({
            type: toolName.startsWith("check") ? "info" : "created",
            label: formatToolLabel(toolName, toolResult.result),
            detail: JSON.stringify(toolResult.result),
          });
        } else {
          executedActions.push({
            type: "warning",
            label: `Failed: ${toolName}`,
            detail: toolResult.error,
          });
        }

        // Save tool result as message
        await db.from("ai_chat_messages").insert({
          session_id: session.id,
          role: "tool",
          content: JSON.stringify(toolResult),
          metadata: { tool_name: toolName, tool_call_id: tc.id },
        });

        toolCallMessages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });
      }

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

        // Save and update state
        await db.from("ai_chat_messages").insert({ session_id: session.id, role: "assistant", content: summaryContent });
        await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);

        const draftState = await buildDraftState(db, user.id, stateJson);

        return new Response(
          JSON.stringify({
            sessionId: session.id,
            reply: summaryContent,
            actions: executedActions,
            draft: draftState,
            correlationId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Plain assistant response (no tool calls) ──
    const assistantContent = choice?.message?.content || "I'm ready to help. What would you like to do?";

    await db.from("ai_chat_messages").insert({ session_id: session.id, role: "assistant", content: assistantContent });
    await db.from("ai_chat_sessions").update({ state_json: stateJson }).eq("id", session.id);

    const draftState = await buildDraftState(db, user.id, stateJson);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        reply: assistantContent,
        actions: executedActions.length > 0 ? executedActions : undefined,
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
    case "add_attendees_from_text":
      return `Added ${result.added} attendees`;
    case "add_agenda_items":
      return `Added ${result.added} agenda items`;
    case "check_publish_readiness":
      return result.ready ? `Event is ready to publish (${result.score}%)` : `Readiness: ${result.score}% — ${(result.missing as string[])?.length} items missing`;
    default:
      return toolName;
  }
}
