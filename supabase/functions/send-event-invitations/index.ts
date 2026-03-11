/**
 * send-event-invitations
 *
 * Sends invitation or reminder emails (and/or WhatsApp messages) to event attendees.
 *
 * Required Supabase secrets for EMAIL:
 *   GMAIL_USER            – Google Workspace email address used as the SMTP sender
 *   GMAIL_APP_PASSWORD    – App Password generated from Google Account → Security →
 *                           2-Step Verification → App Passwords.
 *                           (NOT the regular Gmail password; 2-Step Verification must be enabled)
 *
 * Required Supabase secrets for WHATSAPP (optional):
 *   TWILIO_ACCOUNT_SID    – Twilio Account SID
 *   TWILIO_AUTH_TOKEN      – Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM   – Twilio WhatsApp sender number (e.g. whatsapp:+14155238886)
 *
 * Auto-provided by Supabase runtime:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { normalizePhone, toWhatsAppAddress, maskedPhone } from "../_shared/phone.ts";
import nodemailer from "npm:nodemailer@6";

interface AttendeeResult {
  attendee_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  email_status: string;
  whatsapp_status: string;
  email_error: string | null;
  whatsapp_error: string | null;
  invite_id: string | null;
}

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
    console.log(`[send-event-invitations][${correlationId}] ${msg}`, data ?? "");
  const logErr = (msg: string, data?: unknown) =>
    console.error(`[send-event-invitations][${correlationId}] ${msg}`, data ?? "");

  const summary = {
    correlationId,
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
    smtp_connection_failed: false,
    total: 0,
    results: [] as AttendeeResult[],
  };

  try {
    // ── Auth ──
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
    const { event_id, attendee_ids, channels, base_url, is_reminder } = body;
    const isReminder = is_reminder === true;
    if (!event_id) return json({ error: "Missing event_id", correlationId }, 400);

    log("request", {
      event_id,
      attendee_count: Array.isArray(attendee_ids) ? attendee_ids.length : 0,
      channels,
      is_reminder,
    });

    // ── Ownership ──
    const { data: owns, error: ownsErr } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!owns) {
      log("ownership denied", ownsErr?.message);
      return json({ error: "Forbidden", correlationId }, 403);
    }
    log("ownership verified");

    // ── Channels ──
    const sendChannels: string[] =
      Array.isArray(channels) && channels.length > 0
        ? channels.filter((c: string) => ["email", "whatsapp"].includes(c))
        : ["email"];
    if (sendChannels.length === 0) return json({ error: "No valid channels", correlationId }, 400);
    summary.channels = sendChannels;

    // ── Validate email secrets ──
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    const emailConfigured = !!(gmailUser && gmailPass);

    if (!emailConfigured && sendChannels.includes("email")) {
      summary.email_not_configured = true;
      const missing: string[] = [];
      if (!gmailUser) missing.push("GMAIL_USER");
      if (!gmailPass) missing.push("GMAIL_APP_PASSWORD");
      log("email secrets missing", missing);
    }

    // ── Validate WhatsApp secrets ──
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    let TWILIO_FROM_RAW = (Deno.env.get("TWILIO_WHATSAPP_FROM") || "").trim();

    // Strip whatsapp: prefix if present, then normalise the number
    let senderNumber = TWILIO_FROM_RAW;
    if (senderNumber.toLowerCase().startsWith("whatsapp:")) {
      senderNumber = senderNumber.slice(9);
    }
    // Remove ALL formatting: spaces, dashes, parentheses, dots
    senderNumber = senderNumber.replace(/[\s\-().·]/g, "");
    // Handle 00-prefix
    if (senderNumber.startsWith("00") && senderNumber.length > 4) {
      senderNumber = "+" + senderNumber.slice(2);
    }
    // Ensure leading +
    if (senderNumber && !senderNumber.startsWith("+")) {
      senderNumber = "+" + senderNumber;
    }
    // Rebuild canonical whatsapp:+E164
    const TWILIO_FROM = senderNumber ? `whatsapp:${senderNumber}` : "";

    // Strict validation: must be whatsapp:+<digits only>
    const SENDER_VALID = /^whatsapp:\+[1-9]\d{6,14}$/.test(TWILIO_FROM);
    if (TWILIO_FROM && !SENDER_VALID) {
      logErr("Invalid TWILIO_WHATSAPP_FROM after normalisation", TWILIO_FROM);
      if (sendChannels.includes("whatsapp") && sendChannels.length === 1) {
        return json({
          ...summary,
          whatsapp_not_configured: true,
          error: "Invalid TWILIO_WHATSAPP_FROM format. Expected whatsapp:+E164 with no spaces. Got: " + TWILIO_FROM,
        }, 400);
      }
    }

    const whatsappConfigured = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && SENDER_VALID);

    if (!whatsappConfigured && sendChannels.includes("whatsapp")) {
      summary.whatsapp_not_configured = true;
      if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
        log("whatsapp secrets incomplete");
      }
    }

    if (whatsappConfigured) {
      log("WhatsApp sender ready", TWILIO_FROM);
      log("NOTE: Ensure this number is WhatsApp-enabled in Twilio Console or connected to the Twilio WhatsApp Sandbox. An active SMS/voice number alone is not sufficient for WhatsApp.");
    }

    // ── Service-role client (bypasses RLS) ──
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      logErr("SUPABASE_SERVICE_ROLE_KEY is missing");
      return json({ ...summary, error: "Server configuration error: missing service role key" }, 500);
    }
    log("service role key present: true");
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Load event ──
    const { data: eventData, error: eventErr } = await db
      .from("events")
      .select("title, slug, start_date, client_id, clients(slug)")
      .eq("id", event_id)
      .single();
    if (eventErr) {
      logErr("event lookup failed", eventErr.message);
      return json({ ...summary, error: "Event not found" }, 404);
    }
    const eventTitle = eventData?.title || "Event";
    const clientSlug = (eventData as any)?.clients?.slug;
    const eventSlug = eventData?.slug;
    const rootUrl = base_url || "https://titanmeet.com";
    const publicEventUrl = clientSlug && eventSlug ? `${rootUrl}/${clientSlug}/${eventSlug}` : null;
    log("event loaded", { title: eventTitle, slug: eventSlug });

    // ── Load attendees ──
    log("querying attendees", { event_id, filter_ids: Array.isArray(attendee_ids) ? attendee_ids.length : "all" });
    let q = db.from("attendees").select("id, name, email, mobile").eq("event_id", event_id);
    if (Array.isArray(attendee_ids) && attendee_ids.length > 0) q = q.in("id", attendee_ids);
    const { data: attendees, error: attErr } = await q;

    if (attErr) {
      logErr("attendee query failed", { message: attErr.message, code: attErr.code, details: attErr.details, hint: attErr.hint });
      return json({ ...summary, error: `Failed to load attendees: ${attErr.message}` }, 500);
    }
    if (!attendees || attendees.length === 0) {
      log("no attendees found");
      return json({ ...summary, total: 0 });
    }
    summary.total = attendees.length;
    log(`found ${attendees.length} attendees`);

    // ── Early exit: sole channel not configured ──
    if (sendChannels.length === 1 && sendChannels[0] === "email" && !emailConfigured) {
      summary.skipped_email_not_configured = attendees.length;
      summary.results = attendees.map((a) =>
        makeResult(a, "skipped_not_configured", "not_requested", null),
      );
      return json(summary);
    }
    if (sendChannels.length === 1 && sendChannels[0] === "whatsapp" && !whatsappConfigured) {
      summary.results = attendees.map((a) =>
        makeResult(a, "not_requested", "skipped_not_configured", null),
      );
      return json(summary);
    }

    // ── Ensure invite tokens exist ──
    const { data: existingInvites } = await db
      .from("event_invites")
      .select("id, attendee_id, token, status")
      .eq("event_id", event_id);
    const existingMap = new Map((existingInvites || []).map((i: any) => [i.attendee_id, i]));

    const toInsert = attendees
      .filter((a) => !existingMap.has(a.id))
      .map((a) => ({ event_id, attendee_id: a.id }));
    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("event_invites")
        .insert(toInsert)
        .select("id, attendee_id, token, status");
      if (insertErr) {
        logErr("invite insert failed", insertErr.message);
        return json({ ...summary, error: "Failed to create invite tokens" }, 500);
      }
      (inserted || []).forEach((i: any) => existingMap.set(i.attendee_id, i));
    }

    // ── SMTP transporter: create once, verify once before the send loop ──
    let transporter: any = null;
    let emailUsable = false;

    if (emailConfigured && sendChannels.includes("email")) {
      try {
        transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user: gmailUser, pass: gmailPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        });
        log("SMTP transporter created");
      } catch (e) {
        logErr("SMTP transport creation failed", sanitizeError(String(e)));
        summary.smtp_connection_failed = true;
      }

      if (transporter) {
        try {
          await transporter.verify();
          emailUsable = true;
          log("SMTP verify succeeded — ready to send");
        } catch (verifyErr: any) {
          const errStr = String(verifyErr);
          const errCode = verifyErr?.responseCode || verifyErr?.code || "";
          const isAuth =
            String(errCode) === "535" ||
            errStr.includes("535") ||
            errStr.includes("Username and Password not accepted") ||
            errStr.includes("Invalid login");

          if (isAuth) {
            summary.email_auth_failed = true;
            logErr("SMTP auth failed — check GMAIL_USER and GMAIL_APP_PASSWORD secrets");
          } else {
            summary.smtp_connection_failed = true;
            logErr("SMTP connection/verify failed", sanitizeError(errStr));
          }
        }
      }

      if (!emailUsable && sendChannels.length === 1) {
        const reason = summary.email_auth_failed
          ? "SMTP authentication failed. Ensure GMAIL_APP_PASSWORD is a valid Google App Password."
          : "SMTP connection to smtp.gmail.com:587 failed.";

        summary.skipped_email_not_configured = attendees.length;
        summary.results = attendees.map((a) => {
          const r = makeResult(a, "skipped_not_configured", "not_requested", existingMap.get(a.id)?.id ?? null);
          r.email_error = reason;
          return r;
        });
        log("early exit — email unusable");
        return json(summary);
      }
    }

    // ── Send loop ──
    const now = new Date().toISOString();

    for (const attendee of attendees) {
      const invite = existingMap.get(attendee.id);
      const inviteUrl = invite ? `${rootUrl}/i/${invite.token}` : null;
      const confirmRsvpUrl = invite
        ? `${supabaseUrl}/functions/v1/confirm-rsvp?token=${invite.token}`
        : undefined;

      const result: AttendeeResult = {
        attendee_id: attendee.id,
        name: attendee.name,
        email: attendee.email || null,
        mobile: attendee.mobile || null,
        email_status: "not_requested",
        whatsapp_status: "not_requested",
        email_error: null,
        whatsapp_error: null,
        invite_id: invite?.id ?? null,
      };

      if (!invite) {
        result.email_status = "failed";
        result.email_error = "No invite token";
        result.whatsapp_status = "failed";
        result.whatsapp_error = "No invite token";
        summary.results.push(result);
        continue;
      }

      // ── Email ──
      if (sendChannels.includes("email")) {
        if (!emailUsable) {
          summary.skipped_email_not_configured++;
          result.email_status = "skipped_not_configured";
          if (summary.email_auth_failed) result.email_error = "SMTP auth failed";
          else if (summary.smtp_connection_failed) result.email_error = "SMTP connection failed";
          else if (summary.email_not_configured) result.email_error = "Email secrets not configured";
        } else if (!attendee.email) {
          summary.skipped_no_email++;
          result.email_status = "skipped_no_email";
        } else {
          try {
            const subject = isReminder
              ? `Reminder: Please confirm for ${eventTitle}`
              : `You're Invited: ${eventTitle}`;
            const html = isReminder
              ? buildReminderEmailHtml(eventTitle, attendee.name, inviteUrl!, publicEventUrl, eventData?.start_date, confirmRsvpUrl)
              : buildEmailHtml(eventTitle, attendee.name, inviteUrl!, publicEventUrl, eventData?.start_date, confirmRsvpUrl);

            await transporter.sendMail({
              from: `TitanMeet <${gmailUser}>`,
              to: attendee.email,
              subject,
              html,
            });

            await db
              .from("event_invites")
              .update({
                sent_via_email: true,
                email_sent_at: now,
                last_sent_at: now,
                status: invite.status === "created" ? "sent" : invite.status,
              })
              .eq("id", invite.id);

            summary.sent_email++;
            result.email_status = "sent";
            log(`email sent to ${attendee.email}`);
          } catch (emailErr: any) {
            summary.failed_email++;
            result.email_status = "failed";
            result.email_error = sanitizeError(String(emailErr));
            logErr(`email failed for ${attendee.email}`, result.email_error);
          }
        }
      }

      // ── WhatsApp ──
      if (sendChannels.includes("whatsapp")) {
        if (!whatsappConfigured) {
          result.whatsapp_status = "skipped_not_configured";
        } else if (!attendee.mobile) {
          summary.skipped_no_phone++;
          result.whatsapp_status = "skipped_no_phone";
        } else {
          const waTo = toWhatsAppAddress(attendee.mobile);
          if (!waTo) {
            summary.skipped_no_phone++;
            result.whatsapp_status = "invalid_phone";
            result.whatsapp_error = `Cannot normalise "${maskedPhone(attendee.mobile)}" to E.164 format.`;
            logErr(`invalid phone for ${attendee.name}`, maskedPhone(attendee.mobile));
            summary.results.push(result);
            continue;
          }

          try {
            const messageBody = isReminder
              ? `Hi ${attendee.name}! ⏰\n\nFriendly reminder: You're invited to *${eventTitle}*. We haven't received your confirmation yet.\n\n👉 ${inviteUrl}\n\nPlease confirm your attendance!`
              : `Hi ${attendee.name}! 🎉\n\nYou're invited to *${eventTitle}*!\n\n👉 ${inviteUrl}\n\nThis link is personal to you. We look forward to seeing you!`;

            const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-callback`;

            const formData = new URLSearchParams();
            formData.append("From", TWILIO_FROM!);
            formData.append("To", waTo);
            formData.append("Body", messageBody);
            formData.append("StatusCallback", statusCallbackUrl);

            const twilioResp = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData.toString(),
              },
            );
            const twilioData = await twilioResp.json();
            if (!twilioResp.ok) throw new Error(twilioData.message || `Twilio ${twilioResp.status}`);

            // Twilio accepted the message — NOT yet delivered. Store as "accepted".
            const twilioSid = twilioData.sid || null;
            const initialStatus = twilioData.status || "accepted"; // typically "queued" or "accepted"

            await db
              .from("event_invites")
              .update({
                sent_via_whatsapp: true,
                whatsapp_sent_at: now,
                last_sent_at: now,
                status: invite.status === "created" ? "sent" : invite.status,
              })
              .eq("id", invite.id);

            try {
              const { error: mlErr } = await db.from("message_logs").insert({
                event_id,
                attendee_id: attendee.id,
                channel: "whatsapp",
                to_address: waTo,
                message_body: messageBody,
                provider: "twilio",
                provider_message_id: twilioSid,
                status: initialStatus,
              });
              if (mlErr) logErr("message_logs insert failed", mlErr.message);
            } catch (logInsertErr) {
              logErr("message_logs insert threw", String(logInsertErr).slice(0, 200));
            }

            summary.sent_whatsapp++;
            result.whatsapp_status = initialStatus;
            log(`whatsapp accepted by Twilio for ${maskedPhone(attendee.mobile)}`, { sid: twilioSid, status: initialStatus });
          } catch (waErr) {
            summary.failed_whatsapp++;
            result.whatsapp_status = "failed";
            result.whatsapp_error = sanitizeError(String(waErr));
            logErr(`whatsapp failed for ${maskedPhone(attendee.mobile)}`, result.whatsapp_error);

            // Log failure to message_logs — never crash main flow
            try {
              const { error: mlErr } = await db
                .from("message_logs")
                .insert({
                  event_id,
                  attendee_id: attendee.id,
                  channel: "whatsapp",
                  to_address: waTo,
                  message_body: "Failed to send",
                  provider: "twilio",
                  status: "failed",
                  error: sanitizeError(String(waErr)),
                });
              if (mlErr) logErr("message_logs insert failed", mlErr.message);
            } catch (logInsertErr) {
              logErr("message_logs insert threw", String(logInsertErr).slice(0, 200));
            }
          }
        }
      }

      summary.results.push(result);
    }

    log("complete", {
      sent_email: summary.sent_email,
      sent_whatsapp: summary.sent_whatsapp,
      failed_email: summary.failed_email,
      failed_whatsapp: summary.failed_whatsapp,
    });

    return json(summary);
  } catch (err) {
    logErr("top-level error", String(err).slice(0, 300));
    return json({ ...summary, error: "Internal server error" }, 500);
  }
});

// ── Helpers ──

function makeResult(
  a: { id: string; name: string; email: string; mobile: string | null },
  emailStatus: string,
  whatsappStatus: string,
  inviteId: string | null,
): AttendeeResult {
  return {
    attendee_id: a.id,
    name: a.name,
    email: a.email || null,
    mobile: a.mobile || null,
    email_status: emailStatus,
    whatsapp_status: whatsappStatus,
    email_error: null,
    whatsapp_error: null,
    invite_id: inviteId,
  };
}

function sanitizeError(err: string): string {
  return err.replace(/pass[^\s]*/gi, "***").slice(0, 200);
}

function buildEmailHtml(
  eventTitle: string,
  name: string,
  inviteUrl: string,
  publicEventUrl: string | null,
  startDate: string | null,
  confirmUrl?: string,
): string {
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
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
    </div>`;
}

function buildReminderEmailHtml(
  eventTitle: string,
  name: string,
  inviteUrl: string,
  publicEventUrl: string | null,
  startDate: string | null,
  confirmUrl?: string,
): string {
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
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
    </div>`;
}
