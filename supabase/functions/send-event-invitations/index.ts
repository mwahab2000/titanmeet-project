import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const { event_id, attendee_ids, channels, base_url, is_reminder } = body;
    const isReminder = is_reminder === true;
    if (!event_id) return json({ error: "Missing event_id" }, 400);

    const sendChannels: string[] = Array.isArray(channels) && channels.length > 0
      ? channels.filter((c: string) => ["email", "whatsapp"].includes(c))
      : ["email"];
    if (sendChannels.length === 0) return json({ error: "No valid channels" }, 400);

    // Verify ownership
    const { data: owns } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!owns) return json({ error: "Forbidden" }, 403);

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
    if (!attendees || attendees.length === 0) return json({ sent_email: 0, sent_whatsapp: 0, total: 0, message: "No attendees" });

    // Ensure invites exist for all attendees (upsert)
    const existingInvites = await db.from("event_invites").select("id, attendee_id, token, status").eq("event_id", event_id);
    const existingMap = new Map((existingInvites.data || []).map((i: any) => [i.attendee_id, i]));

    const toInsert = attendees.filter(a => !existingMap.has(a.id)).map(a => ({
      event_id,
      attendee_id: a.id,
    }));
    if (toInsert.length > 0) {
      await db.from("event_invites").insert(toInsert);
      // Reload after insert
      const { data: newInvites } = await db.from("event_invites").select("id, attendee_id, token, status").eq("event_id", event_id);
      (newInvites || []).forEach((i: any) => existingMap.set(i.attendee_id, i));
    }

    const rootUrl = base_url || "https://titanmeet.com";
    const now = new Date().toISOString();
    let sentEmail = 0, sentWhatsapp = 0, failedEmail = 0, failedWhatsapp = 0;
    let skippedNoPhone = 0, skippedNoEmail = 0;

    // Build public event URL
    const clientSlug = (eventData as any)?.clients?.slug;
    const eventSlug = eventData?.slug;
    const publicEventUrl = clientSlug && eventSlug ? `${rootUrl}/${clientSlug}/${eventSlug}` : null;

    // Setup email transport
    let transporter: any = null;
    if (sendChannels.includes("email")) {
      const GMAIL_USER = Deno.env.get("GMAIL_USER");
      const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
      if (GMAIL_USER && GMAIL_APP_PASSWORD) {
        transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        });
      }
    }

    // Twilio config
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

    for (const attendee of attendees) {
      const invite = existingMap.get(attendee.id);
      if (!invite) continue;
      const inviteUrl = `${rootUrl}/i/${invite.token}`;

      // ── Email ──
      if (sendChannels.includes("email")) {
        if (!attendee.email) {
          skippedNoEmail++;
        } else if (transporter) {
          try {
            const confirmRsvpUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-rsvp?token=${invite.token}`;
            const html = isReminder
              ? buildReminderEmailHtml(eventTitle, attendee.name, inviteUrl, publicEventUrl, eventData?.start_date, confirmRsvpUrl)
              : buildEmailHtml(eventTitle, attendee.name, inviteUrl, publicEventUrl, eventData?.start_date, confirmRsvpUrl);
            const subject = isReminder
              ? `Reminder: Please confirm for ${eventTitle}`
              : `You're Invited: ${eventTitle}`;
            const info = await transporter.sendMail({
              from: `TitanMeet <${Deno.env.get("GMAIL_USER")}>`,
              to: attendee.email,
              subject,
              html,
            });

            await db.from("event_invites").update({
              sent_via_email: true,
              email_sent_at: now,
              last_sent_at: now,
              status: invite.status === "created" ? "sent" : invite.status,
            }).eq("id", invite.id);

            await db.from("message_logs").insert({
              event_id,
              attendee_id: attendee.id,
              channel: "email",
              to_address: attendee.email,
              subject: `You're Invited: ${eventTitle}`,
              message_body: html,
              provider: "gmail",
              provider_message_id: info?.messageId || null,
              status: "sent",
            });

            sentEmail++;
          } catch (emailErr) {
            console.error(`Email to ${attendee.email} failed:`, emailErr);
            failedEmail++;
            await db.from("message_logs").insert({
              event_id,
              attendee_id: attendee.id,
              channel: "email",
              to_address: attendee.email,
              message_body: "Failed to send",
              provider: "gmail",
              status: "failed",
              error: String(emailErr),
            });
          }
        }
      }

      // ── WhatsApp ──
      if (sendChannels.includes("whatsapp")) {
        if (!attendee.mobile) {
          skippedNoPhone++;
        } else if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
          try {
            const waTo = `whatsapp:${attendee.mobile.startsWith("+") ? attendee.mobile : "+" + attendee.mobile}`;
            const messageBody = `Hi ${attendee.name}! 🎉\n\nYou're invited to *${eventTitle}*!\n\n👉 ${inviteUrl}\n\nThis link is personal to you. We look forward to seeing you!`;

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
            const formData = new URLSearchParams();
            formData.append("From", TWILIO_FROM);
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

            sentWhatsapp++;
          } catch (waErr) {
            console.error(`WhatsApp to ${attendee.mobile} failed:`, waErr);
            failedWhatsapp++;
            await db.from("message_logs").insert({
              event_id,
              attendee_id: attendee.id,
              channel: "whatsapp",
              to_address: `whatsapp:${attendee.mobile}`,
              message_body: "Failed to send",
              provider: "twilio",
              status: "failed",
              error: String(waErr),
            });
          }
        } else {
          console.warn("Twilio not configured, skipping WhatsApp");
        }
      }
    }

    return json({
      sent_email: sentEmail,
      sent_whatsapp: sentWhatsapp,
      failed_email: failedEmail,
      failed_whatsapp: failedWhatsapp,
      skipped_no_phone: skippedNoPhone,
      skipped_no_email: skippedNoEmail,
      total: attendees.length,
    });
  } catch (err) {
    console.error("send-event-invitations error:", err);
    return json({ error: "Internal error" }, 500);
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
