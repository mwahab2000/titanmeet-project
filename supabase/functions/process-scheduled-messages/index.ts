/**
 * process-scheduled-messages
 *
 * Cron-compatible edge function that processes the scheduled_messages queue.
 * Picks up pending messages whose scheduled_at <= now() and dispatches them
 * through the appropriate channel (WhatsApp, email).
 *
 * Designed to be called by pg_cron every minute.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toWhatsAppAddress, maskedPhone } from "../_shared/phone.ts";

Deno.serve(async (req) => {
  // Accept GET (cron) or POST
  const correlationId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[process-scheduled][${correlationId}] ${msg}`, data ?? "");
  const logErr = (msg: string, data?: unknown) =>
    console.error(`[process-scheduled][${correlationId}] ${msg}`, data ?? "");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      logErr("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Config error", { status: 500 });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch pending messages ready to send (limit batch to 50)
    const now = new Date().toISOString();
    const { data: pending, error: fetchErr } = await db
      .from("scheduled_messages")
      .select("*, attendees(name, email, mobile), events(title, slug, client_id, clients(slug))")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchErr) {
      logErr("fetch error", fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!pending || pending.length === 0) {
      log("no pending messages");
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    log(`found ${pending.length} pending messages`);

    // Twilio config
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    let senderRaw = (Deno.env.get("TWILIO_WHATSAPP_FROM") || "").trim();
    if (senderRaw.toLowerCase().startsWith("whatsapp:")) senderRaw = senderRaw.slice(9);
    senderRaw = senderRaw.replace(/[\s\-().·]/g, "");
    if (senderRaw.startsWith("00") && senderRaw.length > 4) senderRaw = "+" + senderRaw.slice(2);
    if (senderRaw && !senderRaw.startsWith("+")) senderRaw = "+" + senderRaw;
    const TWILIO_FROM = senderRaw ? `whatsapp:${senderRaw}` : "";
    const whatsappReady = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);

    const WA_INVITE_TEMPLATE = (Deno.env.get("TWILIO_WHATSAPP_INVITE_TEMPLATE_SID") || "").trim();
    const WA_REMINDER_TEMPLATE = (Deno.env.get("TWILIO_WHATSAPP_REMINDER_TEMPLATE_SID") || "").trim();
    const WA_CHECKIN_TEMPLATE = (Deno.env.get("TWILIO_WHATSAPP_CHECKIN_TEMPLATE_SID") || "").trim();

    let processed = 0, sent = 0, failed = 0;

    for (const msg of pending) {
      processed++;
      const attendee = (msg as any).attendees;
      const event = (msg as any).events;

      // Mark as processing
      await db.from("scheduled_messages").update({ status: "processing" }).eq("id", msg.id);

      if (msg.channel === "whatsapp") {
        if (!whatsappReady) {
          await db.from("scheduled_messages").update({ status: "failed", error: "WhatsApp not configured" }).eq("id", msg.id);
          failed++;
          continue;
        }

        if (!attendee?.mobile) {
          await db.from("scheduled_messages").update({ status: "failed", error: "No phone number" }).eq("id", msg.id);
          failed++;
          continue;
        }

        const waTo = toWhatsAppAddress(attendee.mobile);
        if (!waTo) {
          await db.from("scheduled_messages").update({ status: "failed", error: "Invalid phone" }).eq("id", msg.id);
          failed++;
          continue;
        }

        try {
          // Get invite token for link
          const { data: invite } = await db
            .from("event_invites")
            .select("token")
            .eq("event_id", msg.event_id)
            .eq("attendee_id", msg.attendee_id)
            .single();

          const rootUrl = (msg.payload as any)?.base_url || "https://titanmeet.com";
          const inviteUrl = invite ? `${rootUrl}/i/${invite.token}` : rootUrl;
          const eventTitle = event?.title || "Event";

          // Select template based on message type
          let templateSid = "";
          if (msg.message_type === "checkin") templateSid = WA_CHECKIN_TEMPLATE;
          else if (msg.message_type === "reminder") templateSid = WA_REMINDER_TEMPLATE || WA_INVITE_TEMPLATE;
          else templateSid = WA_INVITE_TEMPLATE;

          const formParams: Record<string, string> = {
            To: waTo,
            From: TWILIO_FROM,
            StatusCallback: `${supabaseUrl}/functions/v1/twilio-status-callback`,
          };

          if (templateSid) {
            formParams.ContentSid = templateSid;
            formParams.ContentVariables = JSON.stringify({ 1: attendee.name, 2: eventTitle, 3: inviteUrl });
          } else {
            const bodyMap: Record<string, string> = {
              reminder: `Hi ${attendee.name}! ⏰\n\nReminder: *${eventTitle}* is coming up soon.\n\n👉 ${inviteUrl}\n\nPlease confirm your attendance!`,
              checkin: `Hi ${attendee.name}! 🎫\n\nTime to check in for *${eventTitle}*.\n\n👉 ${inviteUrl}?action=checkin`,
              invitation: `Hi ${attendee.name}! 🎉\n\nYou're invited to *${eventTitle}*.\n\n👉 ${inviteUrl}`,
            };
            formParams.Body = bodyMap[msg.message_type] || bodyMap.invitation;
          }

          const resp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams(formParams),
            },
          );

          const respData = await resp.json();
          if (!resp.ok) {
            const errMsg = respData?.message || `HTTP ${resp.status}`;
            await db.from("scheduled_messages").update({ status: "failed", error: errMsg }).eq("id", msg.id);
            failed++;
            logErr(`send failed: ${maskedPhone(attendee.mobile)}`, errMsg);
          } else {
            await db.from("scheduled_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", msg.id);
            sent++;
            log(`sent ${msg.message_type} to ${maskedPhone(attendee.mobile)}`);

            // Log to message_logs
            try {
              await db.from("message_logs").insert({
                event_id: msg.event_id,
                attendee_id: msg.attendee_id,
                channel: "whatsapp",
                to_address: waTo,
                provider: "twilio",
                provider_message_id: respData.sid,
                status: "queued",
                subject: msg.message_type,
                message_body: formParams.Body || `[template: ${templateSid}]`,
              });
            } catch (_) { /* don't block on log failure */ }
          }
        } catch (err) {
          await db.from("scheduled_messages").update({ status: "failed", error: String(err).slice(0, 500) }).eq("id", msg.id);
          failed++;
        }
      } else {
        // Email scheduled messages - invoke send-event-invitations for email
        // For now mark as failed with instruction
        await db.from("scheduled_messages").update({ status: "failed", error: "Email scheduled sends not yet implemented" }).eq("id", msg.id);
        failed++;
      }
    }

    log(`done: processed=${processed} sent=${sent} failed=${failed}`);
    return new Response(JSON.stringify({ correlationId, processed, sent, failed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    logErr("top-level error", String(err).slice(0, 300));
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
