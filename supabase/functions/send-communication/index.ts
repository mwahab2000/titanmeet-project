import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

class AppError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function normalizePhone(value: string) {
  const trimmed = (value || "").trim();
  const cleaned = trimmed.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  return cleaned;
}

function isE164(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

async function sendTwilio(toRaw: string, body: string, isWhatsApp: boolean) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromRaw = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  if (!sid || !token || !fromRaw) {
    throw new AppError("Twilio credentials are not configured", 500);
  }

  const to = normalizePhone(toRaw);
  const from = normalizePhone(fromRaw);

  if (!isE164(from)) {
    throw new AppError("TWILIO_PHONE_NUMBER must be in E.164 format (example: +201000079333)", 400);
  }

  if (!isE164(to)) {
    throw new AppError(`Recipient phone must be in E.164 format (example: +201234567890). Received: ${toRaw}`, 400);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.set("Body", body);
  formData.set("To", isWhatsApp ? `whatsapp:${to}` : to);
  formData.set("From", isWhatsApp ? `whatsapp:${from}` : from);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new AppError(err.message || `Twilio error ${res.status}`, res.status >= 400 && res.status < 500 ? 400 : 500);
  }

  return await res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new AppError("Gmail credentials not configured", 500);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: `TitanMeet <${GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

async function updateLogStatus(logId: string, patch: { status: "sent" | "failed"; error_message?: string | null }) {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  await serviceClient
    .from("communications_log")
    .update({ status: patch.status })
    .eq("id", logId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let parsedBody: any = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new AppError("Unauthorized", 401);
    }

    parsedBody = await req.json();
    const { channel, to, message, subject, event_id, log_id } = parsedBody;

    if (!channel || !to || !message || !event_id) {
      throw new AppError("Missing required fields", 400);
    }

    const { data: ownsData } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!ownsData) {
      throw new AppError("Forbidden", 403);
    }

    let result: any;
    if (channel === "email") {
      await sendEmail(to, subject || "(No subject)", `<p>${String(message).replace(/\n/g, "<br>")}</p>`);
      result = { sent: true };
    } else if (channel === "sms") {
      result = await sendTwilio(to, message, false);
    } else if (channel === "whatsapp") {
      result = await sendTwilio(to, message, true);
    } else {
      throw new AppError(`Unknown channel: ${channel}`, 400);
    }

    if (log_id) await updateLogStatus(log_id, { status: "sent" });

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (parsedBody?.log_id) {
      await updateLogStatus(parsedBody.log_id, { status: "failed" }).catch(() => null);
    }

    const status = err instanceof AppError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
