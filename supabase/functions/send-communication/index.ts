import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { normalizePhone, isE164, maskedPhone } from "../_shared/phone.ts";

const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_PER_EVENT = 200;

class AppError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

async function sendTwilio(toRaw: string, body: string, isWhatsApp: boolean) {
  // Required secrets (set in Supabase → Settings → Edge Functions → Secrets):
  //   TWILIO_ACCOUNT_SID      – Twilio Account SID (starts with "AC…")
  //   TWILIO_AUTH_TOKEN        – Twilio Auth Token
  //   TWILIO_WHATSAPP_FROM    – WhatsApp sender, e.g. whatsapp:+14155238886
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromRaw = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

  if (!sid || !token || !fromRaw) {
    throw new AppError("Messaging service unavailable — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in Supabase secrets", 500);
  }

  const to = normalizePhone(toRaw);
  if (!to) {
    throw new AppError(`Invalid recipient phone number: ${maskedPhone(toRaw)}`, 400);
  }

  const from = normalizePhone(fromRaw);
  if (!from || !isE164(from)) {
    throw new AppError("Messaging service misconfigured — TWILIO_WHATSAPP_FROM is not valid E.164", 500);
  }

  if (!isE164(to)) {
    throw new AppError(`Invalid recipient phone number: ${maskedPhone(toRaw)}`, 400);
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
    console.error("Twilio error:", err);
    throw new AppError("Failed to send message", res.status >= 400 && res.status < 500 ? 400 : 500);
  }

  return await res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new AppError("Email service unavailable", 500);

  const { createTransport } = await import("npm:nodemailer@6");
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    tls: { rejectUnauthorized: false },
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

async function checkRateLimit(eventId: string): Promise<boolean> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await serviceClient
    .from("communications_log")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .gte("created_at", oneHourAgo);

  return count !== null && count >= RATE_LIMIT_MAX_PER_EVENT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);

  const corsHeaders = getCorsHeaders(req);
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

    if (await checkRateLimit(event_id)) {
      throw new AppError("Rate limit exceeded. Try again later.", 429);
    }

    let result: any;
    if (channel === "email") {
      const safeMessage = String(message)
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
        .replace(/on\w+\s*=\s*'[^']*'/gi, "");
      // If message looks like HTML, send as-is
      // If plain text, wrap in paragraph tags
      const isHtml = safeMessage.trim().startsWith("<");
      const htmlBody = isHtml ? safeMessage : `<p>${safeMessage.replace(/\n/g, "<br>")}</p>`;
      await sendEmail(to, subject || "(No subject)", htmlBody);
      result = { sent: true };
    } else if (channel === "sms") {
      result = await sendTwilio(to, message, false);
    } else if (channel === "whatsapp") {
      result = await sendTwilio(to, message, true);
    } else {
      throw new AppError("Invalid channel", 400);
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
    const clientMessage = err instanceof AppError ? err.message : "An error occurred. Please try again.";
    if (!(err instanceof AppError)) {
      console.error("send-communication error:", err);
    }

    return new Response(JSON.stringify({ error: clientMessage }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
