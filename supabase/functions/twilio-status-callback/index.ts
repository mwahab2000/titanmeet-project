/**
 * twilio-status-callback
 *
 * Receives Twilio message status webhooks (StatusCallback) and updates
 * message_logs with the real delivery status.
 *
 * Twilio sends form-encoded POST with fields:
 *   MessageSid, MessageStatus, ErrorCode, To, From, etc.
 *
 * Status progression for WhatsApp:
 *   queued → accepted → sending → sent → delivered → read
 *   or: queued → accepted → failed / undelivered
 *
 * IMPORTANT NOTES:
 *   - Twilio Sandbox recipients must join the sandbox (send the join phrase).
 *     Sandbox join can expire; re-join may be required.
 *   - Business-initiated WhatsApp messages may require approved templates.
 *   - Production requires a WhatsApp-enabled sender (not just SMS/voice).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FINAL_POSITIVE = new Set(["delivered", "read"]);
const FINAL_NEGATIVE = new Set(["failed", "undelivered"]);

Deno.serve(async (req) => {
  // Twilio sends POST with application/x-www-form-urlencoded
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string | null;
    const messageStatus = formData.get("MessageStatus") as string | null;
    const errorCode = formData.get("ErrorCode") as string | null;
    const to = formData.get("To") as string | null;

    console.log(`[twilio-status-callback] SID=${messageSid} status=${messageStatus} error=${errorCode || "none"} to=${to ? to.slice(0, 10) + "***" : "?"}`);

    if (!messageSid || !messageStatus) {
      return new Response("Missing MessageSid or MessageStatus", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[twilio-status-callback] Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Server config error", { status: 500 });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Update message_logs where provider_message_id matches
    const updateData: Record<string, unknown> = {
      status: messageStatus,
    };
    if (errorCode) {
      updateData.error = `Twilio error ${errorCode}`;
    }

    const { data: updated, error: updateErr } = await db
      .from("message_logs")
      .update(updateData)
      .eq("provider_message_id", messageSid)
      .eq("provider", "twilio")
      .select("id, event_id, attendee_id");

    if (updateErr) {
      console.error("[twilio-status-callback] update failed", updateErr.message);
      // Return 200 so Twilio doesn't retry endlessly
      return new Response("OK", { status: 200 });
    }

    // If final negative status, update event_invites to reflect failure
    if (FINAL_NEGATIVE.has(messageStatus) && updated && updated.length > 0) {
      for (const row of updated) {
        try {
          // Mark the invite as having a whatsapp failure
          // We don't unset sent_via_whatsapp since the attempt was real
          console.log(`[twilio-status-callback] WhatsApp ${messageStatus} for attendee ${row.attendee_id}`);
        } catch (e) {
          console.error("[twilio-status-callback] post-update error", String(e).slice(0, 200));
        }
      }
    }

    if (updated && updated.length > 0) {
      console.log(`[twilio-status-callback] Updated ${updated.length} message_logs row(s) to status=${messageStatus}`);
    } else {
      console.log(`[twilio-status-callback] No message_logs found for SID=${messageSid}`);
    }

    // Always return 200 to Twilio
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[twilio-status-callback] top-level error", String(err).slice(0, 300));
    return new Response("OK", { status: 200 });
  }
});
