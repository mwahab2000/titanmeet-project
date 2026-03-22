/**
 * send-checkin-whatsapp
 *
 * Sends WhatsApp check-in messages to event attendees with a tokenized check-in link.
 * Attendees tap the link to confirm their arrival.
 *
 * Required secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 * Optional: TWILIO_WHATSAPP_CHECKIN_TEMPLATE_SID (falls back to freeform if within 24h window)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { toWhatsAppAddress, maskedPhone } from "../_shared/phone.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const correlationId = crypto.randomUUID();

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const log = (msg: string, data?: unknown) =>
    console.log(`[send-checkin][${correlationId}] ${msg}`, data ?? "");
  const logErr = (msg: string, data?: unknown) =>
    console.error(`[send-checkin][${correlationId}] ${msg}`, data ?? "");

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized", correlationId }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = await req.json();
    const { event_id, attendee_ids, base_url } = body;
    if (!event_id) return json({ error: "Missing event_id", correlationId }, 400);

    // Ownership check
    const { data: owns } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!owns) return json({ error: "Forbidden", correlationId }, 403);

    // Twilio config
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    let senderRaw = (Deno.env.get("TWILIO_WHATSAPP_FROM") || "").trim();
    if (senderRaw.toLowerCase().startsWith("whatsapp:")) senderRaw = senderRaw.slice(9);
    senderRaw = senderRaw.replace(/[\s\-().·]/g, "");
    if (senderRaw.startsWith("00") && senderRaw.length > 4) senderRaw = "+" + senderRaw.slice(2);
    if (senderRaw && !senderRaw.startsWith("+")) senderRaw = "+" + senderRaw;
    const TWILIO_FROM = senderRaw ? `whatsapp:${senderRaw}` : "";

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      return json({ error: "WhatsApp not configured", correlationId, whatsapp_not_configured: true }, 400);
    }

    // Service role client
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load event
    const { data: eventData } = await db
      .from("events")
      .select("title, slug, client_id, clients(slug)")
      .eq("id", event_id)
      .single();
    if (!eventData) return json({ error: "Event not found", correlationId }, 404);

    const eventTitle = eventData.title || "Event";
    const rootUrl = base_url || "https://titanmeet.com";

    // Load attendees
    let q = db.from("attendees").select("id, name, mobile").eq("event_id", event_id).is("checked_in_at", null);
    if (Array.isArray(attendee_ids) && attendee_ids.length > 0) q = q.in("id", attendee_ids);
    const { data: attendees, error: attErr } = await q;
    if (attErr) return json({ error: "Failed to load attendees", correlationId }, 500);
    if (!attendees || attendees.length === 0) return json({ correlationId, sent: 0, skipped: 0, failed: 0, total: 0 });

    // Load invite tokens
    const { data: invites } = await db
      .from("event_invites")
      .select("attendee_id, token")
      .eq("event_id", event_id);
    const tokenMap = new Map((invites || []).map((i: any) => [i.attendee_id, i.token]));

    const WA_CHECKIN_TEMPLATE = (Deno.env.get("TWILIO_WHATSAPP_CHECKIN_TEMPLATE_SID") || "").trim();

    let sent = 0, failed = 0, skipped = 0;
    const results: any[] = [];

    for (const att of attendees) {
      if (!att.mobile) { skipped++; results.push({ attendee_id: att.id, status: "skipped_no_phone" }); continue; }
      const waTo = toWhatsAppAddress(att.mobile);
      if (!waTo) { skipped++; results.push({ attendee_id: att.id, status: "invalid_phone" }); continue; }

      const token = tokenMap.get(att.id);
      const checkinUrl = token ? `${rootUrl}/i/${token}?action=checkin` : rootUrl;

      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
        const formParams: Record<string, string> = {
          To: waTo,
          From: TWILIO_FROM,
          StatusCallback: `${supabaseUrl}/functions/v1/twilio-status-callback`,
        };

        if (WA_CHECKIN_TEMPLATE) {
          formParams.ContentSid = WA_CHECKIN_TEMPLATE;
          formParams.ContentVariables = JSON.stringify({ 1: att.name, 2: eventTitle, 3: checkinUrl });
        } else {
          formParams.Body = `Hi ${att.name}! 🎫\n\nTime to check in for *${eventTitle}*.\n\n👉 ${checkinUrl}\n\nTap the link to confirm your arrival!`;
        }

        const resp = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(formParams),
        });

        const respData = await resp.json();
        if (!resp.ok) {
          failed++;
          const errMsg = respData?.message || `HTTP ${resp.status}`;
          results.push({ attendee_id: att.id, status: "failed", error: errMsg });
          logErr(`checkin send failed for ${maskedPhone(att.mobile)}`, errMsg);
        } else {
          sent++;
          results.push({ attendee_id: att.id, status: "sent", sid: respData.sid });

          // Log message
          try {
            await db.from("message_logs").insert({
              event_id,
              attendee_id: att.id,
              channel: "whatsapp",
              to_address: waTo,
              provider: "twilio",
              provider_message_id: respData.sid,
              status: "queued",
              subject: "check-in",
              message_body: formParams.Body || `[template: ${WA_CHECKIN_TEMPLATE}]`,
            });
          } catch (_) { /* logging failure shouldn't block */ }
        }
      } catch (err) {
        failed++;
        results.push({ attendee_id: att.id, status: "failed", error: String(err).slice(0, 200) });
      }
    }

    log(`done: sent=${sent} failed=${failed} skipped=${skipped}`);
    return json({ correlationId, sent, failed, skipped, total: attendees.length, results });
  } catch (err) {
    logErr("top-level error", String(err).slice(0, 300));
    return json({ error: "Internal error", correlationId }, 500);
  }
});
