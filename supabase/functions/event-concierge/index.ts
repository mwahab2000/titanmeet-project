import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function buildSystemPrompt(eventContext: string): string {
  return `You are a helpful event concierge for attendees. You ONLY answer questions about the specific event described below. If someone asks about something unrelated to this event, politely redirect them.

RULES:
- Only use information from the event context below
- Never invent or guess details not in the context
- Be concise, friendly, and helpful
- Do not reveal internal/admin information
- Do not reveal other attendees' personal information (emails, phone numbers)
- If information is not available, say so clearly
- Respond in the same language as the user's question when possible

EVENT CONTEXT:
${eventContext}`;
}

async function assembleEventContext(
  sb: ReturnType<typeof createClient>,
  eventId: string,
): Promise<string | null> {
  // Fetch event + related data in parallel
  const [eventRes, agendaRes, speakersRes, venueRes, announcementsRes, transportRes, dresscodeRes] =
    await Promise.all([
      sb.from("events").select("title, description, start_date, end_date, event_date, venue_name, venue_address, venue_notes, venue_map_link, status, transportation_notes").eq("id", eventId).single(),
      sb.from("agenda_items").select("title, description, start_time, end_time, day_number, order_index").eq("event_id", eventId).order("day_number").order("order_index"),
      sb.from("speakers").select("name, title, bio, day_number").eq("event_id", eventId),
      sb.from("events").select("venue_name, venue_address, venue_notes, venue_map_link, venue_lat, venue_lng").eq("id", eventId).single(),
      sb.from("announcements").select("text").eq("event_id", eventId),
      sb.from("transport_routes").select("name, day_number, departure_time, vehicle_type, notes, transport_pickup_points(name, address, pickup_time, stop_type, notes)").eq("event_id", eventId),
      sb.from("dress_codes").select("day_number, dress_type, custom_instructions").eq("event_id", eventId),
    ]);

  const event = eventRes.data;
  if (!event || !["published", "ongoing"].includes(event.status)) {
    return null;
  }

  const parts: string[] = [];

  // Basic info
  parts.push(`Event: ${event.title}`);
  if (event.description) parts.push(`Description: ${event.description}`);
  if (event.start_date) parts.push(`Start: ${event.start_date}`);
  if (event.end_date) parts.push(`End: ${event.end_date}`);
  if (event.event_date) parts.push(`Date: ${event.event_date}`);

  // Venue
  if (event.venue_name) parts.push(`Venue: ${event.venue_name}`);
  if (event.venue_address) parts.push(`Address: ${event.venue_address}`);
  if (event.venue_notes) parts.push(`Venue notes: ${event.venue_notes}`);
  if (event.venue_map_link) parts.push(`Map: ${event.venue_map_link}`);

  // Agenda
  if (agendaRes.data && agendaRes.data.length > 0) {
    parts.push("\nAgenda:");
    for (const item of agendaRes.data) {
      const time = item.start_time ? `${item.start_time}${item.end_time ? `-${item.end_time}` : ""}` : "";
      parts.push(`  Day ${item.day_number}: ${time} ${item.title}${item.description ? ` - ${item.description}` : ""}`);
    }
  }

  // Speakers
  if (speakersRes.data && speakersRes.data.length > 0) {
    parts.push("\nSpeakers:");
    for (const s of speakersRes.data) {
      parts.push(`  ${s.name}${s.title ? ` (${s.title})` : ""}${s.bio ? ` - ${s.bio}` : ""}`);
    }
  }

  // Announcements
  if (announcementsRes.data && announcementsRes.data.length > 0) {
    parts.push("\nAnnouncements:");
    for (const a of announcementsRes.data) {
      parts.push(`  - ${a.text}`);
    }
  }

  // Transport
  if (transportRes.data && transportRes.data.length > 0) {
    parts.push("\nTransportation:");
    for (const r of transportRes.data as any[]) {
      parts.push(`  Route: ${r.name}${r.departure_time ? ` at ${r.departure_time}` : ""}${r.vehicle_type ? ` (${r.vehicle_type})` : ""}`);
      if (r.transport_pickup_points) {
        for (const p of r.transport_pickup_points) {
          parts.push(`    Stop: ${p.name}${p.pickup_time ? ` at ${p.pickup_time}` : ""}${p.address ? ` - ${p.address}` : ""}`);
        }
      }
    }
  }
  if (event.transportation_notes) parts.push(`Transport notes: ${event.transportation_notes}`);

  // Dress code
  if (dresscodeRes.data && dresscodeRes.data.length > 0) {
    parts.push("\nDress Code:");
    for (const d of dresscodeRes.data) {
      parts.push(`  Day ${d.day_number}: ${d.dress_type}${d.custom_instructions ? ` - ${d.custom_instructions}` : ""}`);
    }
  }

  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured", correlationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { event_id, session_id, message, identifier, channel } = body;

    if (!event_id || !message) {
      return new Response(
        JSON.stringify({ error: "event_id and message are required", correlationId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Assemble event context
    const eventContext = await assembleEventContext(sb, event_id);
    if (!eventContext) {
      return new Response(
        JSON.stringify({ error: "Event not found or not public", correlationId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find or create session
    let activeSessionId = session_id;
    if (!activeSessionId) {
      // Try to find existing session by identifier
      if (identifier) {
        const { data: existing } = await sb
          .from("concierge_sessions")
          .select("id")
          .eq("event_id", event_id)
          .eq("identifier", identifier)
          .eq("channel", channel || "web")
          .order("created_at", { ascending: false })
          .limit(1);
        if (existing && existing.length > 0) {
          activeSessionId = existing[0].id;
        }
      }
      if (!activeSessionId) {
        // Resolve attendee if identifier is a phone number
        let attendeeId: string | null = null;
        if (identifier) {
          const { data: att } = await sb
            .from("attendees")
            .select("id")
            .eq("event_id", event_id)
            .eq("mobile", identifier)
            .limit(1);
          if (att && att.length > 0) attendeeId = att[0].id;
        }

        const { data: newSession, error: sessionErr } = await sb
          .from("concierge_sessions")
          .insert({
            event_id,
            attendee_id: attendeeId,
            channel: channel || "web",
            identifier: identifier || null,
          })
          .select("id")
          .single();

        if (sessionErr) {
          console.error("[concierge] Session create error:", sessionErr.message);
          return new Response(
            JSON.stringify({ error: "Failed to create session", correlationId }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        activeSessionId = newSession.id;
      }
    }

    // Save user message
    await sb.from("concierge_messages").insert({
      session_id: activeSessionId,
      role: "user",
      content: message,
    });

    // Load conversation history (last 20 messages)
    const { data: history } = await sb
      .from("concierge_messages")
      .select("role, content")
      .eq("session_id", activeSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const aiMessages = [
      { role: "system", content: buildSystemPrompt(eventContext) },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        temperature: 0.5,
        max_completion_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[concierge] OpenAI error ${response.status}:`, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable", correlationId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResult = await response.json();
    const reply = aiResult.choices?.[0]?.message?.content || "Sorry, I couldn't process your question.";

    // Save assistant message
    await sb.from("concierge_messages").insert({
      session_id: activeSessionId,
      role: "assistant",
      content: reply,
    });

    // Update session timestamp
    await sb
      .from("concierge_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeSessionId);

    return new Response(
      JSON.stringify({ reply, session_id: activeSessionId, correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[${correlationId}] concierge error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
