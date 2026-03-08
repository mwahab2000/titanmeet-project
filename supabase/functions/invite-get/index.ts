import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Missing token" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invite, error } = await db
      .from("event_invites")
      .select("id, event_id, attendee_id, status, opened_at, rsvp_at, attendees(name), events(title, slug, client_id, clients(slug))")
      .eq("token", token)
      .single();

    if (error || !invite) return json({ error: "Invalid token" }, 404);

    // Mark as opened if not already RSVP'd
    if (!invite.opened_at && !["rsvp_yes", "rsvp_no", "maybe"].includes(invite.status)) {
      const now = new Date().toISOString();
      await db.from("event_invites").update({
        opened_at: now,
        status: invite.status === "created" || invite.status === "sent" ? "opened" : invite.status,
      }).eq("id", invite.id);
    }

    const event = invite.events as any;
    const clientSlug = event?.clients?.slug;
    const eventSlug = event?.slug;

    return json({
      event_id: invite.event_id,
      event_title: event?.title || "Event",
      event_slug: eventSlug,
      client_slug: clientSlug,
      attendee_name: (invite.attendees as any)?.name || "Guest",
      status: invite.status,
      rsvp_at: invite.rsvp_at,
    });
  } catch (err) {
    console.error("invite-get error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
