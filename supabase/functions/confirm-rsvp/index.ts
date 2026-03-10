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

  const { data: rsvp, error } = await supabase
    .from("rsvp_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !rsvp) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/invalid` },
    });
  }

  if (rsvp.used_at) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/already-confirmed` },
    });
  }

  if (rsvp.expires_at && new Date(rsvp.expires_at) < new Date()) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/rsvp/invalid` },
    });
  }

  // Fetch attendee name & event title for the confirmation page
  const { data: attendeeData } = await supabase
    .from("attendees")
    .select("name, events(title)")
    .eq("id", rsvp.attendee_id)
    .single();

  const attendeeName = attendeeData?.name || "";
  const eventTitle = (attendeeData as any)?.events?.title || "";

  const now = new Date().toISOString();

  await supabase
    .from("rsvp_tokens")
    .update({ used_at: now })
    .eq("id", rsvp.id);

  await supabase
    .from("attendees")
    .update({ confirmed: true, confirmed_at: now })
    .eq("id", rsvp.attendee_id);

  const redirectUrl = `${appUrl}/rsvp/confirmed?name=${encodeURIComponent(attendeeName)}&event=${encodeURIComponent(eventTitle)}`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: redirectUrl },
  });
});
