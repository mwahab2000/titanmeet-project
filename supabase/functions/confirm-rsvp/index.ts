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

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) return json({ error: "Missing token" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Look up token in event_invites table (unified token system)
  const { data: invite, error } = await supabase
    .from("event_invites")
    .select("id, attendee_id, status, rsvp_at, opened_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return json({ error: "Invalid or expired token" }, 404);
  }

  // Already confirmed
  if (invite.status === "rsvp_yes" || invite.rsvp_at) {
    return json({ success: true, already_confirmed: true });
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

  return json({ success: true, already_confirmed: false });
});
