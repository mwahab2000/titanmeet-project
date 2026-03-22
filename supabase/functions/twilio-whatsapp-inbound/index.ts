import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Twilio signature verification ─────────────────────────── */

async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  // Build the data string: URL + sorted params concatenated as key=value
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) {
    data += k + params[k];
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

/* ── Helpers ───────────────────────────────────────────────── */

function stripWhatsAppPrefix(raw: string): string {
  if (raw.toLowerCase().startsWith("whatsapp:")) {
    return raw.slice(9);
  }
  return raw;
}

function twimlResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml", ...corsHeaders },
  });
}

/* ── Main handler ──────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!TWILIO_AUTH_TOKEN) {
    console.error("[inbound] TWILIO_AUTH_TOKEN not configured");
    return new Response("Server misconfigured", { status: 500 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Parse form body
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  // Verify Twilio signature
  const twilioSignature = req.headers.get("x-twilio-signature") || "";
  const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-whatsapp-inbound`;

  const valid = await validateTwilioSignature(
    TWILIO_AUTH_TOKEN,
    twilioSignature,
    webhookUrl,
    params,
  );

  if (!valid) {
    console.warn("[inbound] Invalid Twilio signature");
    return new Response("Forbidden", { status: 403 });
  }

  // Extract fields
  const rawFrom = params.From || "";
  const rawTo = params.To || "";
  const body = params.Body || "";
  const messageSid = params.MessageSid || null;

  const fromPhone = stripWhatsAppPrefix(rawFrom);
  const toPhone = stripWhatsAppPrefix(rawTo);

  console.log(
    `[inbound] Message from ${fromPhone.slice(0, 5)}***${fromPhone.slice(-2)}, SID=${messageSid}`,
  );

  // Init Supabase service client
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve attendee by mobile
  let attendeeId: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;
  let resolvedStatus = "unknown";
  let resolutionReason: string | null = null;

  const { data: attendeeRows } = await sb
    .from("attendees")
    .select("id, event_id, name")
    .eq("mobile", fromPhone);

  if (attendeeRows && attendeeRows.length > 0) {
    // Attendee found — could be multiple events
    if (attendeeRows.length === 1) {
      attendeeId = attendeeRows[0].id;
    }

    // Look up most recent outbound message_log for any matched attendee
    const attendeeIds = attendeeRows.map((a) => a.id);
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recentLogs } = await sb
      .from("message_logs")
      .select("event_id, attendee_id, created_at")
      .in("attendee_id", attendeeIds)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      eventId = recentLogs[0].event_id;
      attendeeId = recentLogs[0].attendee_id;
      resolvedStatus = "resolved";
      resolutionReason = "matched_via_recent_message_log";

      // Get client_id from event
      const { data: eventRow } = await sb
        .from("events")
        .select("client_id")
        .eq("id", eventId)
        .single();
      if (eventRow) {
        clientId = eventRow.client_id;
      }
    } else if (attendeeRows.length === 1) {
      // Single attendee match but no recent message log — use their event
      eventId = attendeeRows[0].event_id;
      resolvedStatus = "resolved";
      resolutionReason = "single_attendee_match";

      const { data: eventRow } = await sb
        .from("events")
        .select("client_id")
        .eq("id", eventId!)
        .single();
      if (eventRow) {
        clientId = eventRow.client_id;
      }
    } else {
      // Multiple attendee records, no recent log — ambiguous
      resolvedStatus = "ambiguous";
      resolutionReason = `${attendeeRows.length}_attendee_records_no_recent_log`;
    }
  } else {
    resolvedStatus = "unknown";
    resolutionReason = "no_attendee_match";
  }

  // Insert inbound message
  const { error: insertError } = await sb.from("inbound_messages").insert({
    provider: "twilio",
    channel: "whatsapp",
    provider_message_id: messageSid,
    from_phone: fromPhone,
    to_phone: toPhone,
    body,
    attendee_id: attendeeId,
    event_id: eventId,
    client_id: clientId,
    resolved_status: resolvedStatus,
    resolution_reason: resolutionReason,
    raw_payload: params,
  });

  if (insertError) {
    console.error("[inbound] Insert error:", insertError.message);
  }

  // ── Concierge routing: check for action keywords ──
  const bodyLower = body.trim().toLowerCase();

  // Check-in keyword
  if (resolvedStatus === "resolved" && eventId && attendeeId) {
    if (bodyLower === "checkin" || bodyLower === "check in" || bodyLower === "check-in" || bodyLower === "arrived") {
      // Mark check-in
      const { data: att } = await sb
        .from("attendees")
        .select("checked_in_at")
        .eq("id", attendeeId)
        .single();

      if (att?.checked_in_at) {
        return twimlResponse("You're already checked in! ✅ See you at the event.");
      }

      await sb
        .from("attendees")
        .update({ checked_in_at: new Date().toISOString(), checked_in_via: "whatsapp_reply" })
        .eq("id", attendeeId);

      return twimlResponse("You're checked in! ✅ Welcome to the event.");
    }

    // RSVP keywords
    if (bodyLower === "yes" || bodyLower === "confirm" || bodyLower === "accept") {
      await sb
        .from("attendees")
        .update({ confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("id", attendeeId);
      return twimlResponse("Your attendance is confirmed! ✅ We look forward to seeing you.");
    }

    if (bodyLower === "no" || bodyLower === "decline" || bodyLower === "cancel") {
      await sb
        .from("attendees")
        .update({ confirmed: false })
        .eq("id", attendeeId);
      return twimlResponse("We've noted that you can't attend. Thank you for letting us know.");
    }
  }

  // ── Concierge-ready: tag messages for future AI routing ──
  // If resolved and body doesn't match a known keyword, tag for concierge
  if (resolvedStatus === "resolved") {
    // Update the inbound message to flag it needs concierge attention
    if (insertError === null || insertError === undefined) {
      // The message is already inserted above; we could update it with a concierge flag
      // For now, the Communications Center inbox handles this
    }
    return twimlResponse("Thanks! Your message was received. An event organizer will get back to you.");
  } else {
    return twimlResponse(
      "Thanks! Please reply with your event code or email so we can route your message.",
    );
  }
});
