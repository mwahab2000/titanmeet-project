import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(html("Missing token."), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
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
    return new Response(html("Invalid or expired token."), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }

  if (rsvp.used_at) {
    return new Response(html("You have already confirmed your attendance. Thank you!"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }

  if (rsvp.expires_at && new Date(rsvp.expires_at) < new Date()) {
    return new Response(html("This invitation link has expired."), {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }

  const now = new Date().toISOString();

  await supabase
    .from("rsvp_tokens")
    .update({ used_at: now })
    .eq("id", rsvp.id);

  await supabase
    .from("attendees")
    .update({ confirmed: true, confirmed_at: now })
    .eq("id", rsvp.attendee_id);

  return new Response(
    html("Your attendance has been confirmed! Thank you for your response."),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    }
  );
});

function html(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RSVP Confirmation</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8f9fa;}
.card{background:white;padding:3rem;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:480px;}
h1{color:#1a1a2e;margin-bottom:1rem;}</style>
</head>
<body><div class="card"><h1>TitanMeet</h1><p>${message}</p></div></body>
</html>`;
}
