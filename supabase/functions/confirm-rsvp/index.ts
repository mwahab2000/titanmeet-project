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

  // Support both GET (link click) and POST (API call)
  let token: string | null = null;
  let action: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    token = url.searchParams.get("token");
    action = url.searchParams.get("action");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      token = body.token || null;
      action = body.action || null;
    } catch {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
      action = url.searchParams.get("action");
    }
  }

  if (!token) return json({ error: "Missing token" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Look up token in event_invites table
  const { data: invite, error } = await supabase
    .from("event_invites")
    .select("id, attendee_id, status, rsvp_at, opened_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return json({ error: "Invalid or expired token" }, 404);
  }

  const now = new Date().toISOString();

  // ── Check-in action ──
  if (action === "checkin") {
    // Check if already checked in
    const { data: attendee } = await supabase
      .from("attendees")
      .select("checked_in_at")
      .eq("id", invite.attendee_id)
      .single();

    if (attendee?.checked_in_at) {
      return json({ success: true, already_checked_in: true, action: "checkin" });
    }

    // Mark as checked in
    await supabase
      .from("attendees")
      .update({ checked_in_at: now, checked_in_via: "whatsapp_link" })
      .eq("id", invite.attendee_id);

    // Also mark as confirmed if not already
    await supabase
      .from("attendees")
      .update({ confirmed: true, confirmed_at: now })
      .eq("id", invite.attendee_id)
      .is("confirmed_at", null);

    // Track opened
    if (!invite.opened_at) {
      await supabase
        .from("event_invites")
        .update({ opened_at: now })
        .eq("id", invite.id);
    }

    return json({ success: true, already_checked_in: false, action: "checkin" });
  }

  // ── RSVP action (default) ──

  // Already confirmed
  if (invite.status === "rsvp_yes" || invite.rsvp_at) {
    return json({ success: true, already_confirmed: true });
  }

  // Mark attendee as confirmed
  await supabase
    .from("attendees")
    .update({ confirmed: true, confirmed_at: now })
    .eq("id", invite.attendee_id);

  // Update event_invites status
  await supabase
    .from("event_invites")
    .update({
      status: "rsvp_yes",
      rsvp_at: now,
      opened_at: invite.opened_at || now,
    })
    .eq("id", invite.id);

  return json({ success: true, already_confirmed: false });
});
