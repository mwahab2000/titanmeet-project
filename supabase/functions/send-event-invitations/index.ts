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

  // Top-level structured response — always returned
  const summary = {
    correlationId: crypto.randomUUID(),
    channels: [] as string[],
    sent_email: 0,
    sent_whatsapp: 0,
    failed_email: 0,
    failed_whatsapp: 0,
    skipped_no_email: 0,
    skipped_no_phone: 0,
    skipped_email_not_configured: 0,
    email_not_configured: false,
    whatsapp_not_configured: false,
    email_auth_failed: false,
    email_error_sample: "",
    whatsapp_error_sample: "",
    email_config_message: "",
    total: 0,
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ...summary, error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const { event_id, attendee_ids, channels, base_url, is_reminder } = body;
    const isReminder = is_reminder === true;
    if (!event_id) return json({ ...summary, error: "Missing event_id" }, 400);

    const sendChannels: string[] = Array.isArray(channels) && channels.length > 0
      ? channels.filter((c: string) => ["email", "whatsapp"].includes(c))
      : ["email"];
    if (sendChannels.length === 0) return json({ ...summary, error: "No valid channels" }, 400);
    summary.channels = sendChannels;

    // ── Pre-flight: check email config ──
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    const emailConfigured = !!(gmailUser && gmailPass);
    if (!emailConfigured && sendChannels.includes("email")) {
      summary.email_not_configured = true;
      summary.email_config_message = "GMAIL_USER and/or GMAIL_APP_PASSWORD secrets are not set in Supabase Edge Function settings.";
      console.warn("Email not configured:", summary.email_config_message);
    }

    // ── Pre-flight: check WhatsApp config ──
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
    const whatsappConfigured = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);
    if (!whatsappConfigured && sendChannels.includes("whatsapp")) {
      summary.whatsapp_not_configured = true;
    }

    // Verify ownership
    const { data: owns } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!owns) return json({ ...summary, error: "Forbidden" }, 403);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load event info
    const { data: eventData } = await db.from("events").select("title, slug, start_date, client_id, clients(slug)").eq("id", event_id).single();
    const eventTitle = eventData?.title || "Event";

    // Get attendees
    let attendeeQuery = db.from("attendees").select("id, name, email, mobile").eq("event_id", event_id);
    if (attendee_ids && attendee_ids.length > 0) {
      attendeeQuery = attendeeQuery.in("id", attendee_ids);
    }
    const { data: attendees } = await attendeeQuery;
    if (!attendees || attendees.length === 0) {
      summary.total = 0;
      return json(summary);
    }
    summary.total = attendees.length;

    // If only email channel and not configured, return early
    if (sendChannels.length === 1 && sendChannels[0] === "email" && !emailConfigured) {
      summary.skipped_email_not_configured = attendees.length;
      return json(summary);
    }
    // If only whatsapp channel and not configured, return early
    if (sendChannels.length === 1 && sendChannels[0] === "whatsapp" && !whatsappConfigured) {
      return json(summary);
    }

    // Ensure invites exist
    const existingInvites = await db.from("event_invites").select("id, attendee_id, token, status").eq("event_id", event_id);
    const existingMap = new Map((existingInvites.data || []).map((i: any) => [i.attendee_id, i]));

    const toInsert = attendees
      .filter(a => !existingMap.has(a.id))
      .map(a => ({ event_id, attendee_id: a.id }));
    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("event_invites")
        .insert(toInsert)
        .select("id, attendee_id, token, status");
      if (insertErr) {
        console.error("event_invites insert error:", JSON.stringify(insertErr));
        return json({ ...summary, error: "Failed to create invite tokens", detail: insertErr.message }, 500);
      }
      (inserted || []).forEach((i: any) => existingMap.set(i.attendee_id, i));
    }

    const rootUrl = base_url || "https://titanmeet.com";
    const now = new Date().toISOString();
    let emailAuthBroken = false;

    // Build public event URL
    const clientSlug = (eventData as any)?.clients?.slug;
    const eventSlug = eventData?.slug;
    const publicEventUrl = clientSlug && eventSlug ? `${rootUrl}/${clientSlug}/${eventSlug}` : null;

    for (const attendee of attendees) {
      const invite = existingMap.get(attendee.id);
      if (!invite) continue;
      const inviteUrl = `${rootUrl}/i/${invite.token}`;

      // ── Email ──
      if (sendChannels.includes("email")) {
        if (!emailConfigured) {
          summary.skipped_email_not_configured++;
        } else if (emailAuthBroken) {
          summary.skipped_email_not_configured++;
        } else if (!attendee.email) {
          summary.skipped_no_email++;
        } else {
          try {
            const confirmRsvpUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-rsvp?token=${invite.token}`;
            const html = isReminder
              ? buildReminderEmailHtml(eventTitle, attendee.name, inviteUrl, publicEventUrl, eventData?.start_date, confirmRsvpUrl)
              : buildEmailHtml(eventTitle, attendee.name, inviteUrl, publicEventUrl, eventData?.start_date, confirmRsvpUrl);
            const subject = isReminder
              ? `Reminder: Please confirm for ${eventTitle}`
              : `You're Invited: ${eventTitle}`;

            const emailRes = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-communication`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": req.headers.get("Authorization") || "",
                },
                body: JSON.stringify({
                  channel: "email",
                  to: attendee.email,
                  subject,
                  message: html,
                  event_id,
                }),
              }
            );

            if (emailRes.ok) {
              await db.from("event_invites").update({
                sent_via_email: true,
                email_sent_at: now,
                last_sent_at: now,
                status: invite.status === "created" ? "sent" : invite.status,
              }).eq("id", invite.id);
              summary.sent_email++;
            } else {
              const errBody = await emailRes.text();
              console.error("send-communication failed:", errBody);

              const errLower = errBody.toLowerCase();
              const isAuthError = errLower.includes("535") ||
                errLower.includes("username and password not accepted") ||
                errLower.includes("authentication") ||
                errLower.includes("invalid login") ||
                (errLower.includes("auth") && errLower.includes("fail"));

              if (isAuthError) {
                summary.email_auth_failed = true;
                emailAuthBroken = true;
                if (!summary.email_error_sample) {
                  summary.email_error_sample = "SMTP authentication failed. Use a Google Workspace App Password with 2-Step Verification enabled.";
                }
                // Count remaining as skipped
                summary.skipped_email_not_configured += (attendees.length - summary.sent_email - summary.failed_email - summary.skipped_no_email - summary.skipped_email_not_configured - 1);
                summary.failed_email++;
                // Don't break — continue to process WhatsApp for remaining attendees
              } else {
                if (!summary.email_error_sample) {
                  // Extract safe snippet
                  try {
                    const parsed = JSON.parse(errBody);
                    summary.email_error_sample = parsed.error || errBody.slice(0, 200);
                  } catch {
                    summary.email_error_sample = errBody.slice(0, 200);
                  }
                }
                summary.failed_email++;
              }
            }
          } catch (emailErr) {
            const errStr = String(emailErr);
            console.error("Email error:", errStr);
            if (errStr.includes("535") || errStr.includes("Username and Password not accepted") || errStr.includes("Invalid login")) {
              summary.email_auth_failed = true;
              emailAuthBroken = true;
              if (!summary.email_error_sample) {
                summary.email_error_sample = "SMTP authentication failed. Use a Google Workspace App Password with 2-Step Verification enabled.";
              }
            } else {
              if (!summary.email_error_sample) summary.email_error_sample = errStr.slice(0, 200);
            }
            summary.failed_email++;
          }
        }
      }

      // ── WhatsApp ──
      if (sendChannels.includes("whatsapp")) {
        if (!whatsappConfigured) {
          // already flagged
        } else if (!attendee.mobile) {
          summary.skipped_no_phone++;
        } else {
          try {
            const waTo = `whatsapp:${attendee.mobile.startsWith("+") ? attendee.mobile : "+" + attendee.mobile}`;
            const messageBody = isReminder
              ? `Hi ${attendee.name}! ⏰\n\nFriendly reminder: You're invited to *${eventTitle}*. We haven't received your confirmation yet.\n\n👉 ${inviteUrl}\n\nPlease confirm your attendance!`
              : `Hi ${attendee.name}! 🎉\n\nYou're invited to *${eventTitle}*!\n\n👉 ${inviteUrl}\n\nThis link is personal to you. We look forward to seeing you!`;

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
            const formData = new URLSearchParams();
            formData.append("From", TWILIO_FROM!);
            formData.append("To", waTo);
            formData.append("Body", messageBody);

            const twilioResp = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            });

            const twilioData = await twilioResp.json();
            if (!twilioResp.ok) throw new Error(twilioData.message || `Twilio error ${twilioResp.status}`);

            await db.from("event_invites").update({
              sent_via_whatsapp: true,
              whatsapp_sent_at: now,
              last_sent_at: now,
              status: invite.status === "created" ? "sent" : invite.status,
            }).eq("id", invite.id);

            await db.from("message_logs").insert({
              event_id,
              attendee_id: attendee.id,
              channel: "whatsapp",
              to_address: waTo,
              message_body: messageBody,
              provider: "twilio",
              provider_message_id: twilioData.sid || null,
              status: "sent",
            });

            summary.sent_whatsapp++;
          } catch (waErr) {
            console.error(`WhatsApp to ${attendee.mobile} failed:`, waErr);
            summary.failed_whatsapp++;
            if (!summary.whatsapp_error_sample) summary.whatsapp_error_sample = String(waErr).slice(0, 200);
            await db.from("message_logs").insert({
              event_id,
              attendee_id: attendee.id,
              channel: "whatsapp",
              to_address: `whatsapp:${attendee.mobile}`,
              message_body: "Failed to send",
              provider: "twilio",
              status: "failed",
              error: String(waErr),
            }).catch(() => {});
          }
        }
      }
    }

    return json(summary);
  } catch (err) {
    console.error("send-event-invitations top-level error:", err);
    summary.email_error_sample = summary.email_error_sample || String(err).slice(0, 200);
    return json({ ...summary, error: "Internal error" }, 200); // 200 so UI can still read the summary
  }
});

function buildEmailHtml(eventTitle: string, name: string, inviteUrl: string, publicEventUrl: string | null, startDate: string | null, confirmUrl?: string): string {
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">You're Invited!</h1>
        <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 16px;">${eventTitle}</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #334155; font-size: 16px; margin-bottom: 8px;">Hi ${name},</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">We're excited to invite you to <strong>${eventTitle}</strong>${dateStr ? ` on <strong>${dateStr}</strong>` : ""}.</p>
        <div style="text-align: center; margin: 24px 0;">
          ${confirmUrl ? `<a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 16px; margin-bottom: 12px;">Confirm My Attendance ✓</a><br><br>` : ""}
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">View Event Details</a>
        </div>
        ${publicEventUrl ? `<p style="color: #94a3b8; font-size: 12px; text-align: center;">Or view the event page: <a href="${publicEventUrl}" style="color: #6366f1;">${publicEventUrl}</a></p>` : ""}
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">This invitation is personal to you.</p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by TitanMeet</p>
      </div>
    </div>
  `;
}

function buildReminderEmailHtml(eventTitle: string, name: string, inviteUrl: string, publicEventUrl: string | null, startDate: string | null, confirmUrl?: string): string {
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Reminder: Please Confirm</h1>
        <p style="color: #fef3c7; margin: 8px 0 0; font-size: 16px;">${eventTitle}</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #334155; font-size: 16px; margin-bottom: 8px;">Hi ${name},</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">This is a friendly reminder that you've been invited to <strong>${eventTitle}</strong>${dateStr ? ` on <strong>${dateStr}</strong>` : ""}. We haven't received your confirmation yet.</p>
        <div style="text-align: center; margin: 24px 0;">
          ${confirmUrl ? `<a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 16px; margin-bottom: 12px;">Confirm My Attendance ✓</a><br><br>` : ""}
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">View Event Details</a>
        </div>
        ${publicEventUrl ? `<p style="color: #94a3b8; font-size: 12px; text-align: center;">Or view the event page: <a href="${publicEventUrl}" style="color: #6366f1;">${publicEventUrl}</a></p>` : ""}
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">This invitation is personal to you.</p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by TitanMeet</p>
      </div>
    </div>
  `;
}
