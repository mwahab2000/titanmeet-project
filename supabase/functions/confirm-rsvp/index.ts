import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const appUrl = Deno.env.get("VITE_APP_URL") || "https://titanmeet.com";

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/invalid` },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Look up token in event_invites table (unified token system)
  const { data: invite, error } = await supabase
    .from("event_invites")
    .select("id, attendee_id, status, opened_at, rsvp_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/invalid` },
    });
  }

  // Check if attendee is already confirmed
  const { data: attendee } = await supabase
    .from("attendees")
    .select("confirmed, name, event_id")
    .eq("id", invite.attendee_id)
    .single();

  if (!attendee) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/invalid` },
    });
  }

  // Fetch event title
  const { data: eventData } = await supabase
    .from("events")
    .select("title")
    .eq("id", attendee.event_id)
    .single();

  const attendeeName = attendee.name || "";
  const eventTitle = eventData?.title || "";

  if (attendee.confirmed) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${appUrl}/rsvp/already-confirmed?name=${encodeURIComponent(attendeeName)}&event=${encodeURIComponent(eventTitle)}`,
      },
    });
  }

  const now = new Date().toISOString();

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

  const redirectUrl = `${appUrl}/rsvp/confirmed?name=${encodeURIComponent(attendeeName)}&event=${encodeURIComponent(eventTitle)}`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: redirectUrl },
  });
});
