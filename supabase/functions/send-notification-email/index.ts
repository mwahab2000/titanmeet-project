import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const SITE_NAME = "TitanMeet";
const SITE_URL = "https://titanmeet.com";
const LOGO_URL =
  "https://qclaciklevavttipztrv.supabase.co/storage/v1/object/public/email-assets/TitanMeetLogo.png";

interface EmailData {
  type: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

function renderEmailHtml(data: EmailData): string {
  const ctaUrl = data.link
    ? `${SITE_URL}${data.link.startsWith("/") ? data.link : `/${data.link}`}`
    : SITE_URL;
  const ctaLabel = getCTALabel(data.type);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
    <tr><td align="center" style="padding:40px 20px">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td align="center" style="padding-bottom:24px">
          <img src="${LOGO_URL}" alt="${SITE_NAME}" height="40" style="height:40px;display:block" />
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">${escapeHtml(data.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(data.message)}</p>
          <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#111827">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${ctaLabel}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            This email was sent by ${SITE_NAME}. If you did not expect this, you can ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getCTALabel(type: string): string {
  switch (type) {
    case "support_reply":
    case "support_status_changed":
      return "View Ticket";
    case "payment_confirmed":
    case "payment_failed":
    case "payment_expired":
    case "subscription_upgraded":
      return "View Billing";
    default:
      return "Open TitanMeet";
  }
}

function getSubjectLine(data: EmailData): string {
  switch (data.type) {
    case "support_reply":
      return `New reply on your support ticket — ${SITE_NAME}`;
    case "support_status_changed":
      return `Ticket status updated — ${SITE_NAME}`;
    case "payment_confirmed":
      return `Payment confirmed — ${SITE_NAME}`;
    case "payment_failed":
      return `Payment failed — ${SITE_NAME}`;
    case "payment_expired":
      return `Payment expired — ${SITE_NAME}`;
    case "subscription_upgraded":
      return `Subscription upgraded — ${SITE_NAME}`;
    default:
      return `${data.title} — ${SITE_NAME}`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dedupeKey(data: EmailData): string {
  const meta = data.metadata || {};
  switch (data.type) {
    case "support_reply":
      return `support_reply_${meta.ticket_id}_${meta.message_id || ""}`;
    case "support_status_changed":
      return `support_status_${meta.ticket_id}_${meta.new_status || ""}`;
    case "payment_confirmed":
    case "payment_failed":
    case "payment_expired":
      return `payment_${data.type}_${meta.order_id || meta.payment_intent_id || ""}`;
    case "subscription_upgraded":
      return `sub_upgrade_${meta.plan_id}_${data.user_id}`;
    default:
      return `${data.type}_${data.user_id}_${Date.now()}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const internalSecret = req.headers.get("x-internal-secret");
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const isInternal = internalSecret === serviceKey;
    const isFromDb = authHeader === `Bearer ${anonKey}` || authHeader === `Bearer ${serviceKey}`;

    if (!isServiceRole && !isInternal && !isFromDb) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data: EmailData = await req.json();

    if (!data.type || !data.user_id || !data.title || !data.message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const key = dedupeKey(data);
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentLog } = await serviceClient
      .from("communications_log")
      .select("id")
      .eq("channel", "notification_email")
      .eq("recipient_info", key)
      .gte("created_at", oneHourAgo)
      .limit(1)
      .maybeSingle();

    if (recentLog) {
      console.log("Dedupe: email already sent for key:", key);
      return new Response(JSON.stringify({ success: true, deduplicated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(data.user_id);
    if (userError || !userData?.user?.email) {
      console.error("Could not find user email for:", data.user_id);
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = userData.user.email;

    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("Gmail credentials not configured");
      return new Response(JSON.stringify({ error: "Email service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const html = renderEmailHtml(data);
    const subject = getSubjectLine(data);

    const info = await transporter.sendMail({
      from: `${SITE_NAME} <${GMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html,
    });

    console.log("Notification email sent:", info.messageId, "to:", recipientEmail, "type:", data.type);

    await serviceClient.from("communications_log").insert({
      event_id: null,
      channel: "notification_email",
      recipient_info: key,
      message: data.message,
      subject,
      status: "sent",
    }).then(({ error }) => {
      if (error) console.warn("Failed to log notification email:", error.message);
    });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notification-email error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
