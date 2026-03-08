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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { survey_id, event_id, invite_ids, base_url, channels } = body;
    if (!survey_id || !event_id) return json({ error: "Missing fields" }, 400);

    // Determine channels: default to ['email']
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

    // Get event + survey info
    const { data: eventData } = await db.from("events").select("title").eq("id", event_id).single();
    const { data: surveyData } = await db.from("surveys").select("title").eq("id", survey_id).single();

    // Get invites to send
    let query = db
      .from("survey_invites")
      .select("*, attendees(name, email, mobile)")
      .eq("survey_id", survey_id);

    if (invite_ids && invite_ids.length > 0) {
      query = query.in("id", invite_ids);
    } else {
      // Send to those not yet sent via the requested channels
      query = query.in("status", ["created", "sent", "opened"]);
    }

    const { data: invites } = await query;
    if (!invites || invites.length === 0) return json({ sent_email: 0, sent_whatsapp: 0, message: "No invites to send" });

    const rootUrl = base_url || "https://titanmeet.com";
    const now = new Date().toISOString();
    let sentEmail = 0, sentWhatsapp = 0, failedEmail = 0, failedWhatsapp = 0;
    let skippedNoPhone = 0, skippedNoEmail = 0;

    // Setup email transport if needed
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

    for (const invite of invites) {
      const attendee = invite.attendees;
      if (!attendee) continue;
      const surveyUrl = `${rootUrl}/s/${invite.token}`;

      // ── Email ──
      if (sendChannels.includes("email")) {
        if (!attendee.email) {
          skippedNoEmail++;
        } else if (transporter) {
          try {
            const html = buildEmailHtml(eventData?.title, surveyData?.title, attendee.name, surveyUrl);
            const info = await transporter.sendMail({
              from: `TitanMeet <${Deno.env.get("GMAIL_USER")}>`,
              to: attendee.email,
              subject: `Survey: ${surveyData?.title || "Feedback"} - ${eventData?.title || "Event"}`,
              html,
            });

            await db.from("survey_invites").update({
              sent_via_email: true,
              email_sent_at: now,
              last_sent_at: now,
              sent_at: invite.sent_at || now,
              status: invite.status === "created" ? "sent" : invite.status,
            }).eq("id", invite.id);

            await db.from("message_logs").insert({
              event_id,
              survey_id,
              attendee_id: invite.attendee_id,
              channel: "email",
              to_address: attendee.email,
              subject: `Survey: ${surveyData?.title || "Feedback"}`,
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
              event_id, survey_id, attendee_id: invite.attendee_id,
              channel: "email", to_address: attendee.email,
              message_body: "Failed to send", provider: "gmail",
              status: "failed", error: String(emailErr),
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
            const messageBody = `Hi ${attendee.name}! 📋\n\nYou're invited to complete a survey for *${eventData?.title || "our event"}*:\n\n*${surveyData?.title || "Survey"}*\n\n👉 ${surveyUrl}\n\nThis link is unique to you. Thank you!`;

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

            if (!twilioResp.ok) {
              throw new Error(twilioData.message || `Twilio error ${twilioResp.status}`);
            }

            await db.from("survey_invites").update({
              sent_via_whatsapp: true,
              whatsapp_sent_at: now,
              last_sent_at: now,
              sent_at: invite.sent_at || now,
              status: invite.status === "created" ? "sent" : invite.status,
            }).eq("id", invite.id);

            await db.from("message_logs").insert({
              event_id, survey_id, attendee_id: invite.attendee_id,
              channel: "whatsapp", to_address: waTo,
              message_body: messageBody, provider: "twilio",
              provider_message_id: twilioData.sid || null,
              status: "sent",
            });

            sentWhatsapp++;
          } catch (waErr) {
            console.error(`WhatsApp to ${attendee.mobile} failed:`, waErr);
            failedWhatsapp++;
            await db.from("message_logs").insert({
              event_id, survey_id, attendee_id: invite.attendee_id,
              channel: "whatsapp",
              to_address: `whatsapp:${attendee.mobile}`,
              message_body: "Failed to send", provider: "twilio",
              status: "failed", error: String(waErr),
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
      total: invites.length,
    });
  } catch (err) {
    console.error("send-survey-links error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

function buildEmailHtml(eventTitle: string | undefined, surveyTitle: string | undefined, name: string, surveyUrl: string): string {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${eventTitle || "Event"}</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #334155; font-size: 16px; margin-bottom: 8px;">Hi ${name},</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">We'd love to hear your feedback. Please take a moment to complete our survey:</p>
        <h2 style="color: #1e293b; font-size: 18px; margin: 16px 0 8px;">${surveyTitle || "Survey"}</h2>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #3b82f6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Take Survey</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">This link is unique to you. Please do not share it.</p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by TitanMeet</p>
      </div>
    </div>
  `;
}
