import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "https://titanmeet.com",
  "https://www.titanmeet.com",
];
const REPLIT_RE = /^https:\/\/.*\.replit\.app$/;
const REPLIT_DEV_RE = /^https:\/\/.*\.repl\.co$/;
const SUBDOMAIN_RE = /^https:\/\/[a-z0-9-]+\.titanmeet\.com$/;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (SUBDOMAIN_RE.test(origin)) return cb(null, true);
      if (REPLIT_RE.test(origin)) return cb(null, true);
      if (REPLIT_DEV_RE.test(origin)) return cb(null, true);
      cb(null, true); // open in dev; tighten in prod if needed
    },
    credentials: true,
  }),
);

// ── Raw body for webhook signature verification ───────────────────────────────
app.use("/api/webhooks/paddle", express.raw({ type: "application/json" }));

// ── JSON body for everything else ─────────────────────────────────────────────
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSupabaseServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseUserClient(authHeader: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
}

async function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = getSupabaseUserClient(authHeader);
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

// ── PADDLE WEBHOOK ────────────────────────────────────────────────────────────

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  try {
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(";")) {
      const [k, ...vals] = part.split("=");
      parts[k.trim()] = vals.join("=").trim();
    }
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;
    const computed = crypto
      .createHmac("sha256", secret)
      .update(`${ts}:${rawBody}`)
      .digest("hex");
    return computed === h1;
  } catch {
    return false;
  }
}

function buildPriceToPlanMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const entries = [
    { envKey: "PADDLE_PRICE_STARTER_MONTHLY", plan: "starter" },
    { envKey: "PADDLE_PRICE_STARTER_ANNUAL", plan: "starter" },
    { envKey: "PADDLE_PRICE_PROFESSIONAL_MONTHLY", plan: "professional" },
    { envKey: "PADDLE_PRICE_PROFESSIONAL_ANNUAL", plan: "professional" },
    { envKey: "PADDLE_PRICE_ENTERPRISE_MONTHLY", plan: "enterprise" },
    { envKey: "PADDLE_PRICE_ENTERPRISE_ANNUAL", plan: "enterprise" },
  ];
  for (const { envKey, plan } of entries) {
    const val = process.env[envKey];
    if (val) map[val] = plan;
  }
  return map;
}

function resolvePlanSlug(
  priceId: string | undefined,
  customData: Record<string, unknown>,
  priceToPlan: Record<string, string>,
): string | null {
  if (priceId && priceToPlan[priceId]) return priceToPlan[priceId];
  if (customData?.plan_id && typeof customData.plan_id === "string") return customData.plan_id;
  return null;
}

async function isStaleEvent(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  occurredAt: string,
): Promise<boolean> {
  const { data } = await serviceClient
    .from("account_subscriptions")
    .select("updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.updated_at) return false;
  return new Date(occurredAt) < new Date(data.updated_at);
}

async function logPaymentEvent(
  serviceClient: ReturnType<typeof createClient>,
  opts: {
    paymentIntentId?: string | null;
    providerEventId: string;
    eventType: string;
    rawPayload: unknown;
    subscriptionId?: string;
  },
) {
  let piId = opts.paymentIntentId;
  if (!piId && opts.subscriptionId) {
    const { data } = await serviceClient
      .from("payment_intents")
      .select("id")
      .eq("provider_payment_id", opts.subscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    piId = data?.id ?? null;
  }
  if (!piId) {
    const { data: stub } = await serviceClient
      .from("payment_intents")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        plan_id: "unknown",
        provider: "paddle",
        purchase_type: "audit_stub",
        internal_order_id: `TM-AUDIT-${crypto.randomUUID().slice(0, 8)}`,
        amount_usd_cents: 0,
        currency: "USD",
        status: "audit_stub",
        metadata: { reason: "no_matching_intent", event_type: opts.eventType },
      })
      .select("id")
      .single();
    piId = stub?.id;
  }
  if (piId) {
    await serviceClient.from("payment_events").insert({
      payment_intent_id: piId,
      provider: "paddle",
      event_type: opts.eventType,
      raw_payload: opts.rawPayload,
      provider_event_id: opts.providerEventId,
    });
  }
}

app.post("/api/webhooks/paddle", async (req, res) => {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[paddle-webhook] PADDLE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Billing system misconfigured" });
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);
  const signatureHeader = req.headers["paddle-signature"] as string | null;

  const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValid) {
    console.error("[paddle-webhook] Signature verification failed");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const eventType = event.event_type as string;
  const eventData = (event.data || {}) as Record<string, unknown>;
  const eventId = (event.event_id || event.notification_id || "") as string;
  const occurredAt = (event.occurred_at || new Date().toISOString()) as string;
  const customData = (eventData.custom_data || {}) as Record<string, unknown>;
  const userId = customData?.user_id as string | undefined;

  console.log(`[paddle-webhook] received: ${eventType} event_id=${eventId}`);

  const serviceClient = getSupabaseServiceClient();
  const priceToPlan = buildPriceToPlanMap();

  try {
    // Idempotency check
    if (eventId) {
      const { data: existing } = await serviceClient
        .from("payment_events")
        .select("id")
        .eq("provider_event_id", eventId)
        .maybeSingle();
      if (existing) {
        console.log(`[paddle-webhook] duplicate event skipped: ${eventId}`);
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    switch (eventType) {
      case "subscription.activated":
      case "subscription.renewed":
      case "subscription.updated": {
        const subscriptionId = eventData.id as string;
        const currentBillingPeriod = eventData.current_billing_period as Record<string, string> | undefined;
        const periodEnd = currentBillingPeriod?.ends_at;
        const accessUntil = periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const periodStart = currentBillingPeriod?.starts_at || new Date().toISOString();
        const items = eventData.items as Array<Record<string, unknown>> | undefined;
        const priceId = (items?.[0]?.price as Record<string, unknown>)?.id as string | undefined;
        const planSlug = resolvePlanSlug(priceId, customData, priceToPlan);

        if (!userId || !planSlug) {
          await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
          break;
        }
        if (await isStaleEvent(serviceClient, userId, occurredAt)) {
          await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
          break;
        }

        let piId: string | null = null;
        if (eventType !== "subscription.updated") {
          const details = eventData.details as Record<string, unknown> | undefined;
          const detailsTotals = details?.totals as Record<string, unknown> | undefined;
          const amountCents = parseInt((detailsTotals?.grand_total as string) || "0", 10);
          const { data: piData } = await serviceClient
            .from("payment_intents")
            .insert({
              user_id: userId,
              plan_id: planSlug,
              provider: "paddle",
              purchase_type: "monthly",
              provider_payment_id: subscriptionId,
              internal_order_id: `TM-SUB-${crypto.randomUUID().slice(0, 8)}`,
              amount_usd_cents: amountCents,
              currency: "USD",
              status: "active",
              paid_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          piId = piData?.id ?? null;
        }

        const { data: existingEnt } = await serviceClient
          .from("account_entitlements")
          .select("access_until")
          .eq("user_id", userId)
          .maybeSingle();
        const finalAccess = existingEnt?.access_until
          ? new Date(Math.max(new Date(existingEnt.access_until).getTime(), new Date(accessUntil).getTime()))
          : new Date(accessUntil);

        await serviceClient.from("account_entitlements").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          access_until: finalAccess.toISOString(),
          source: "subscription",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        await serviceClient.from("account_subscriptions").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          paddle_subscription_id: subscriptionId,
          current_period_start: periodStart,
          current_period_end: accessUntil,
          cancel_at_period_end: false,
          updated_at: occurredAt,
        }, { onConflict: "user_id" });

        try {
          await serviceClient.rpc("create_notification", {
            _user_id: userId,
            _type: "subscription_upgraded",
            _title: "Subscription updated",
            _message: `Your plan has been updated to ${planSlug}.`,
            _link: "/dashboard/billing",
          });
        } catch { /* best-effort */ }

        await logPaymentEvent(serviceClient, { paymentIntentId: piId, providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
        break;
      }

      case "subscription.canceled": {
        const subscriptionId = eventData.id as string;
        if (userId) {
          if (!(await isStaleEvent(serviceClient, userId, occurredAt))) {
            await serviceClient.from("account_subscriptions").update({
              cancel_at_period_end: true,
              cancelled_at: new Date().toISOString(),
              status: "canceled",
              updated_at: occurredAt,
            }).eq("user_id", userId);
            try {
              await serviceClient.rpc("create_notification", {
                _user_id: userId,
                _type: "payment_expired",
                _title: "Subscription canceled",
                _message: "Your subscription has been canceled. Access continues until end of current period.",
                _link: "/dashboard/billing",
              });
            } catch { /* best-effort */ }
          }
        }
        await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
        break;
      }

      case "transaction.payment_failed": {
        const transactionId = eventData.id as string;
        if (userId) {
          const { data: existingPi } = await serviceClient
            .from("payment_intents")
            .select("id")
            .eq("provider_payment_id", transactionId)
            .maybeSingle();
          if (existingPi) {
            await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", existingPi.id);
          }
        }
        await logPaymentEvent(serviceClient, {
          providerEventId: eventId,
          eventType,
          rawPayload: event,
          subscriptionId: eventData.subscription_id as string | undefined,
        });
        break;
      }

      default:
        console.log(`[paddle-webhook] unhandled event: ${eventType}`);
        return res.status(200).json({ received: true, ignored: true });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[paddle-webhook] error for ${eventType}:`, err);
    return res.status(500).json({ error: "Internal processing error" });
  }
});

// ── CHECK PLAN LIMITS ─────────────────────────────────────────────────────────

const PLAN_LIMIT_RESOURCES: Record<string, { planCol: string; label: string; errorCode: string; isHard: boolean }> = {
  clients: { planCol: "max_clients", label: "clients", errorCode: "PLAN_LIMIT_EXCEEDED_CLIENTS", isHard: true },
  active_events: { planCol: "max_active_events", label: "events / month", errorCode: "PLAN_LIMIT_EXCEEDED_EVENTS", isHard: true },
  attendees_per_event: { planCol: "max_attendees_per_event", label: "attendees per event", errorCode: "PLAN_LIMIT_EXCEEDED_ATTENDEES", isHard: true },
  admin_users: { planCol: "max_admin_users", label: "admin users", errorCode: "PLAN_LIMIT_EXCEEDED_ADMIN_USERS", isHard: true },
  emails: { planCol: "max_emails", label: "emails / month", errorCode: "PLAN_LIMIT_EXCEEDED_EMAILS", isHard: false },
  whatsapp: { planCol: "max_whatsapp_sends", label: "WhatsApp messages / month", errorCode: "PLAN_LIMIT_EXCEEDED_WHATSAPP", isHard: false },
  ai_prompts: { planCol: "max_ai_requests", label: "AI Builder prompts / month", errorCode: "PLAN_LIMIT_EXCEEDED_AI_PROMPTS", isHard: false },
  ai_images: { planCol: "max_ai_images", label: "AI images / month", errorCode: "PLAN_LIMIT_EXCEEDED_AI_IMAGES", isHard: false },
  brand_kits: { planCol: "max_brand_kits", label: "brand kits", errorCode: "PLAN_LIMIT_EXCEEDED_BRAND_KITS", isHard: true },
  storage: { planCol: "max_storage_gb", label: "storage (GB)", errorCode: "PLAN_LIMIT_EXCEEDED_STORAGE", isHard: false },
};

const FEATURE_GATES: Record<string, string> = {
  segmentation: "has_segmentation",
  workspace_analytics: "has_workspace_analytics",
  live_dashboard: "has_live_dashboard",
};

function effectiveLimit(raw: number | null | undefined, fallback = 0): number {
  const v = raw ?? fallback;
  return v >= 999999 ? Infinity : v;
}

function computePercent(used: number, limit: number): number {
  if (limit === Infinity) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

app.post("/api/functions/check-plan-limits", async (req, res) => {
  const correlationId = crypto.randomUUID();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ allowed: false, error_code: "UNAUTHORIZED", message: "Unauthorized", correlationId });
  }

  try {
    const userClient = getSupabaseUserClient(authHeader);
    const serviceClient = getSupabaseServiceClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ allowed: false, error_code: "UNAUTHORIZED", message: "Unauthorized", correlationId });

    const { resource, feature, event_id: eventId, current_count: currentCount } = req.body;

    // Feature gate check
    if (feature) {
      const col = FEATURE_GATES[feature];
      if (!col) {
        return res.status(400).json({ allowed: false, error_code: "UNKNOWN_FEATURE", message: `Unknown feature: ${feature}`, correlationId });
      }
      const { data: sub } = await serviceClient
        .from("account_subscriptions")
        .select(`plan_id, subscription_plans(${col})`)
        .eq("user_id", user.id)
        .maybeSingle();
      const planId = (sub as any)?.plan_id || "starter";
      const hasFeature = (sub as any)?.subscription_plans?.[col] === true;
      return res.json({ allowed: hasFeature, error_code: hasFeature ? null : "FEATURE_NOT_AVAILABLE_ON_PLAN", message: hasFeature ? "OK" : `This feature is not available on your current plan.`, plan_id: planId, feature, correlationId });
    }

    if (!resource || !PLAN_LIMIT_RESOURCES[resource]) {
      return res.status(400).json({ allowed: false, error_code: "UNKNOWN_RESOURCE", message: `Unknown resource: ${resource}`, correlationId });
    }

    const def = PLAN_LIMIT_RESOURCES[resource];

    const { data: sub } = await serviceClient
      .from("account_subscriptions")
      .select(`plan_id, subscription_plans(*)`)
      .eq("user_id", user.id)
      .maybeSingle();

    const planId = (sub as any)?.plan_id || "starter";
    const plan = (sub as any)?.subscription_plans || {};
    const rawLimit = plan[def.planCol];
    const limit = effectiveLimit(rawLimit);

    let currentUsage = 0;
    if (typeof currentCount === "number") {
      currentUsage = currentCount;
    } else {
      switch (resource) {
        case "clients": {
          const { count } = await serviceClient.from("clients").select("id", { count: "exact", head: true }).eq("created_by", user.id);
          currentUsage = count || 0;
          break;
        }
        case "active_events": {
          const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
          const { count } = await serviceClient.from("events").select("id", { count: "exact", head: true }).eq("created_by", user.id).gte("created_at", startOfMonth.toISOString());
          currentUsage = count || 0;
          break;
        }
        case "attendees_per_event": {
          if (eventId) {
            const { count } = await serviceClient.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId);
            currentUsage = count || 0;
          }
          break;
        }
        default:
          currentUsage = 0;
      }
    }

    const { data: override } = await serviceClient
      .from("plan_limit_overrides")
      .select("custom_limit, is_grandfathered")
      .eq("user_id", user.id)
      .eq("resource", resource)
      .maybeSingle();

    const effectiveLimitVal = override?.custom_limit != null ? effectiveLimit(override.custom_limit) : limit;
    const isGrandfathered = override?.is_grandfathered === true;
    const percent = computePercent(currentUsage, effectiveLimitVal);
    const allowed = effectiveLimitVal === Infinity || currentUsage < effectiveLimitVal;
    const warningLevel = percent >= 100 ? "hard_block" : percent >= 80 ? "soft_warning" : "ok";

    const friendlyMessage = allowed
      ? (warningLevel === "soft_warning" ? `You've used ${percent}% of your monthly ${def.label} limit.` : "OK")
      : `You've reached your ${def.label} limit. Upgrade your plan to continue.`;

    return res.json({
      allowed, error_code: allowed ? null : def.errorCode, message: friendlyMessage,
      current_usage: Math.round(currentUsage), limit: effectiveLimitVal === Infinity ? null : effectiveLimitVal,
      percent, plan_id: planId, warning_level: warningLevel, is_grandfathered: isGrandfathered,
      upgrade_recommended: !allowed || warningLevel === "soft_warning", resource, correlationId,
    });
  } catch (err: any) {
    console.error(`[check-plan-limits] error:`, err.message);
    return res.status(500).json({ allowed: false, error_code: "INTERNAL_ERROR", message: "Internal error checking plan limits.", correlationId });
  }
});

// ── SEND EVENT INVITATIONS ────────────────────────────────────────────────────

function buildInvitationEmailHtml(
  eventTitle: string, name: string, inviteUrl: string,
  publicEventUrl: string | null, startDate: string | null, confirmUrl?: string,
): string {
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  return `<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">You're Invited!</h1>
      <p style="color:#e0e7ff;margin:8px 0 0;font-size:16px;">${eventTitle}</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;margin-bottom:8px;">Hi ${name},</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;">We're excited to invite you to <strong>${eventTitle}</strong>${dateStr ? ` on <strong>${dateStr}</strong>` : ""}.</p>
      <div style="text-align:center;margin:24px 0;">
        ${confirmUrl ? `<a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#22c55e);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:16px;margin-bottom:12px;">Confirm My Attendance ✓</a><br><br>` : ""}
        <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View Event Details</a>
      </div>
      ${publicEventUrl ? `<p style="color:#94a3b8;font-size:12px;text-align:center;">Or view the event page: <a href="${publicEventUrl}" style="color:#6366f1;">${publicEventUrl}</a></p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px 24px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">Powered by TitanMeet</p>
    </div>
  </div>`;
}

function buildReminderEmailHtml(
  eventTitle: string, name: string, inviteUrl: string,
  publicEventUrl: string | null, startDate: string | null, confirmUrl?: string,
): string {
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  return `<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">Reminder: Please Confirm</h1>
      <p style="color:#fef3c7;margin:8px 0 0;font-size:16px;">${eventTitle}</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;margin-bottom:8px;">Hi ${name},</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;">This is a friendly reminder that you've been invited to <strong>${eventTitle}</strong>${dateStr ? ` on <strong>${dateStr}</strong>` : ""}.</p>
      <div style="text-align:center;margin:24px 0;">
        ${confirmUrl ? `<a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#22c55e);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:16px;margin-bottom:12px;">Confirm My Attendance ✓</a><br><br>` : ""}
        <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View Event Details</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 24px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">Powered by TitanMeet</p>
    </div>
  </div>`;
}

app.post("/api/functions/send-event-invitations", async (req, res) => {
  const correlationId = crypto.randomUUID();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", correlationId });
  }

  const summary = {
    correlationId, channels: [] as string[],
    sent_email: 0, sent_whatsapp: 0, failed_email: 0, failed_whatsapp: 0,
    skipped_no_email: 0, skipped_no_phone: 0, skipped_email_not_configured: 0,
    email_not_configured: false, whatsapp_not_configured: false,
    email_auth_failed: false, smtp_connection_failed: false,
    total: 0, results: [] as any[],
  };

  try {
    const userClient = getSupabaseUserClient(authHeader);
    const serviceClient = getSupabaseServiceClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized", correlationId });

    const { event_id, attendee_ids, channels, base_url, is_reminder } = req.body;
    const isReminder = is_reminder === true;
    if (!event_id) return res.status(400).json({ error: "Missing event_id", correlationId });

    const { data: owns } = await userClient.rpc("owns_event", { _event_id: event_id });
    if (!owns) return res.status(403).json({ error: "Forbidden", correlationId });

    const sendChannels: string[] = Array.isArray(channels) && channels.length > 0
      ? channels.filter((c: string) => ["email", "whatsapp"].includes(c))
      : ["email"];
    summary.channels = sendChannels;

    const { data: eventData } = await serviceClient
      .from("events")
      .select("title, start_date, slug, client_id, clients(slug)")
      .eq("id", event_id)
      .single();
    const eventTitle = eventData?.title || "Your Event";
    const eventStartDate = eventData?.start_date || null;

    // Load invites
    let inviteQuery = serviceClient
      .from("event_invites")
      .select("id, attendee_id, token, status, attendees(name, email, mobile)")
      .eq("event_id", event_id);
    if (Array.isArray(attendee_ids) && attendee_ids.length > 0) {
      inviteQuery = inviteQuery.in("attendee_id", attendee_ids);
    }
    const { data: invites } = await inviteQuery;
    summary.total = (invites || []).length;

    // Email setup
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const emailConfigured = !!(gmailUser && gmailPass);
    summary.email_not_configured = !emailConfigured;

    let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
    if (emailConfigured && sendChannels.includes("email")) {
      try {
        transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: gmailUser, pass: gmailPass },
        });
      } catch {
        summary.smtp_connection_failed = true;
      }
    }

    // WhatsApp setup
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
    const waConfigured = !!(twilioSid && twilioToken && twilioFrom);
    summary.whatsapp_not_configured = !waConfigured;
    const waInviteTemplate = process.env.TWILIO_WHATSAPP_INVITE_TEMPLATE_SID;
    const waReminderTemplate = process.env.TWILIO_WHATSAPP_REMINDER_TEMPLATE_SID;

    const baseUrl = base_url || process.env.VITE_APP_URL || "https://titanmeet.com";

    for (const invite of (invites || []) as any[]) {
      const attendee = invite.attendees;
      const name = attendee?.name || "Guest";
      const email = attendee?.email || null;
      const mobile = attendee?.mobile || null;
      const token = invite.token;
      const inviteUrl = `${baseUrl}/invite/${token}`;
      const confirmUrl = `${baseUrl}/invite/${token}?confirm=1`;
      const publicEventUrl = null;

      const result: any = {
        attendee_id: invite.attendee_id,
        name,
        email,
        mobile,
        email_status: "skipped",
        whatsapp_status: "skipped",
        email_error: null,
        whatsapp_error: null,
        invite_id: invite.id,
      };

      // Email
      if (sendChannels.includes("email")) {
        if (!emailConfigured) {
          result.email_status = "skipped_not_configured";
          summary.skipped_email_not_configured++;
        } else if (!email) {
          result.email_status = "skipped_no_email";
          summary.skipped_no_email++;
        } else if (transporter) {
          try {
            const html = isReminder
              ? buildReminderEmailHtml(eventTitle, name, inviteUrl, publicEventUrl, eventStartDate, confirmUrl)
              : buildInvitationEmailHtml(eventTitle, name, inviteUrl, publicEventUrl, eventStartDate, confirmUrl);
            await transporter.sendMail({
              from: `TitanMeet <${gmailUser}>`,
              to: email,
              subject: isReminder ? `Reminder: ${eventTitle}` : `You're invited: ${eventTitle}`,
              html,
            });
            result.email_status = "sent";
            summary.sent_email++;
            await serviceClient.from("event_invites").update({
              sent_via_email: true,
              email_sent_at: new Date().toISOString(),
              last_sent_at: new Date().toISOString(),
            }).eq("id", invite.id);
            await serviceClient.from("message_logs").insert({
              event_id, attendee_id: invite.attendee_id,
              channel: "email", status: "sent",
              message_type: isReminder ? "reminder" : "invitation",
            });
          } catch (err: any) {
            result.email_status = "failed";
            result.email_error = err.message;
            summary.failed_email++;
          }
        }
      }

      // WhatsApp
      if (sendChannels.includes("whatsapp")) {
        if (!waConfigured) {
          result.whatsapp_status = "skipped_not_configured";
        } else if (!mobile) {
          result.whatsapp_status = "skipped_no_phone";
          summary.skipped_no_phone++;
        } else {
          try {
            const waTo = mobile.startsWith("whatsapp:") ? mobile : `whatsapp:${mobile}`;
            const templateSid = isReminder ? (waReminderTemplate || waInviteTemplate) : waInviteTemplate;
            const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
            const twilioBody: Record<string, string> = {
              To: waTo, From: twilioFrom!,
              Body: isReminder ? `Reminder: You're invited to ${eventTitle}. Confirm: ${confirmUrl}` : `You're invited to ${eventTitle}. View: ${inviteUrl}`,
            };
            if (templateSid) {
              twilioBody.ContentSid = templateSid;
              twilioBody.ContentVariables = JSON.stringify({ 1: name, 2: eventTitle, 3: inviteUrl });
            }
            const form = new URLSearchParams(twilioBody);
            const twilioRes = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() }
            );
            if (twilioRes.ok) {
              result.whatsapp_status = "sent";
              summary.sent_whatsapp++;
            } else {
              const err = await twilioRes.json();
              result.whatsapp_status = "failed";
              result.whatsapp_error = err.message;
              summary.failed_whatsapp++;
            }
          } catch (err: any) {
            result.whatsapp_status = "failed";
            result.whatsapp_error = err.message;
            summary.failed_whatsapp++;
          }
        }
      }

      summary.results.push(result);
    }

    return res.json(summary);
  } catch (err: any) {
    console.error("[send-event-invitations] error:", err.message);
    return res.status(500).json({ error: "Internal error", correlationId });
  }
});

// ── VALIDATE DISCOUNT ─────────────────────────────────────────────────────────

app.post("/api/functions/validate-discount", async (req, res) => {
  const authHeader = req.headers.authorization;
  const correlationId = crypto.randomUUID();

  try {
    const serviceClient = getSupabaseServiceClient();
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = getSupabaseUserClient(authHeader);
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const body = req.body;
    const { action } = body;

    if (action === "record_redemption") {
      const { discountCodeId, customerEmail, subscriptionId, paddleCustomerId, paddleTransactionId, planApplied, billingInterval, status } = body;
      const redemptionStatus = status || "pending";

      if (redemptionStatus === "applied" && paddleTransactionId) {
        const { data: existing } = await serviceClient
          .from("discount_code_redemptions")
          .select("id")
          .eq("discount_code_id", discountCodeId)
          .eq("user_id", userId || body.userId)
          .eq("status", "pending")
          .order("redeemed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          await serviceClient.from("discount_code_redemptions").update({
            status: "applied", subscription_id: subscriptionId,
            paddle_customer_id: paddleCustomerId, paddle_transaction_id: paddleTransactionId,
            customer_email: customerEmail, metadata: body.metadata || {},
          }).eq("id", existing.id);
          return res.json({ ok: true, updated: true });
        }
      }

      const { error } = await serviceClient.from("discount_code_redemptions").insert({
        discount_code_id: discountCodeId,
        user_id: userId || body.userId,
        customer_email: customerEmail,
        subscription_id: subscriptionId,
        paddle_customer_id: paddleCustomerId,
        paddle_transaction_id: paddleTransactionId,
        plan_applied: planApplied,
        billing_interval: billingInterval,
        status: redemptionStatus,
        metadata: body.metadata || {},
      });
      if (error) {
        if (error.code === "23505") return res.json({ ok: true, duplicate: true });
        return res.status(400).json({ error: error.message });
      }
      return res.json({ ok: true });
    }

    // Validate discount code
    const { code, plan_id, billing_interval } = body;
    if (!code) return res.status(400).json({ valid: false, error: "Missing code" });

    const normalized = code.trim().toUpperCase();
    const { data: discount, error: discErr } = await serviceClient
      .from("discount_codes")
      .select("*")
      .eq("code", normalized)
      .eq("is_active", true)
      .maybeSingle();

    if (discErr || !discount) return res.json({ valid: false, error: "Invalid or expired discount code" });

    const now = new Date();
    if (discount.starts_at && new Date(discount.starts_at) > now) return res.json({ valid: false, error: "Discount code is not yet active" });
    if (discount.expires_at && new Date(discount.expires_at) < now) return res.json({ valid: false, error: "Discount code has expired" });

    if (plan_id && Array.isArray(discount.applicable_plans) && !discount.applicable_plans.includes(plan_id)) {
      return res.json({ valid: false, error: "This code is not valid for the selected plan" });
    }
    if (billing_interval && Array.isArray(discount.applicable_intervals) && !discount.applicable_intervals.includes(billing_interval)) {
      return res.json({ valid: false, error: "This code is not valid for the selected billing interval" });
    }

    if (discount.max_redemptions) {
      const { count } = await serviceClient
        .from("discount_code_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_code_id", discount.id)
        .eq("status", "applied");
      if ((count || 0) >= discount.max_redemptions) return res.json({ valid: false, error: "Discount code has reached its maximum redemptions" });
    }

    return res.json({
      valid: true,
      discount_id: discount.id,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      paddle_discount_id: discount.paddle_discount_id,
      description: discount.description,
    });
  } catch (err: any) {
    console.error("[validate-discount] error:", err.message);
    return res.status(500).json({ valid: false, error: "Internal error" });
  }
});

// ── AI ASSISTANT ──────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPTS: Record<string, string> = {
  event_builder: `You are an expert event planner. Given event parameters, generate professional event details. Return ONLY a JSON object:\n{\n  "title": string,\n  "slug": string (URL-friendly, lowercase, hyphens),\n  "description": string (2-3 paragraphs),\n  "heroTagline": string (compelling, max 10 words),\n  "dressCode": string,\n  "suggestedTheme": string,\n  "agenda": [{"time": "HH:MM", "title": string, "duration_minutes": number, "speaker": string}]\n}`,
  communications_draft: `You are an expert event communications specialist. Draft a professional message. Return ONLY a JSON object:\n{\n  "subject": string,\n  "body": string\n}\nThe body should be professional, warm, and concise (under 200 words).`,
  best_send_time: `You are a communications timing expert. Return ONLY a JSON object:\n{\n  "recommendedTime": string,\n  "reason": string\n}`,
  survey_analysis: `You are a data analyst. Analyze survey responses and return ONLY a JSON object:\n{\n  "summary": string,\n  "keyThemes": [string, string, string],\n  "sentiment": {"positive": number, "neutral": number, "negative": number},\n  "topInsights": [string, string, string],\n  "npsScore": number | null\n}`,
  dashboard_insights: `You are an event management advisor. Return ONLY a JSON array:\n[\n  {"icon": string, "message": string, "severity": "info" | "warning" | "tip"}\n]\nProvide 3-5 insights.`,
  agenda_generation: `You are an expert event agenda designer. Return ONLY a JSON array:\n[\n  {"time": "HH:MM", "title": string, "description": string, "duration_minutes": number, "type": string}\n]`,
  seo_optimization: `You are an SEO specialist. Return ONLY a JSON object:\n{\n  "improvedTitle": string,\n  "metaDescription": string,\n  "improvedDescription": string,\n  "suggestedSlug": string,\n  "seoTips": [string, string, string]\n}`,
  event_chat: `You are TitanMeet AI, a helpful event management assistant. Be concise, friendly, and actionable.`,
};

app.post("/api/functions/ai-assistant", async (req, res) => {
  const correlationId = crypto.randomUUID();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", correlationId });
  }

  try {
    const userClient = getSupabaseUserClient(authHeader);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized", correlationId });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(500).json({ error: "AI not configured", correlationId });

    const { action, prompt, context, messages: chatMessages } = req.body;
    const systemPrompt = AI_SYSTEM_PROMPTS[action];
    if (!systemPrompt) return res.status(400).json({ error: `Unknown action: ${action}`, correlationId });

    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const isChat = action === "event_chat";
    const aiMessages: Array<{ role: string; content: string }> = [];

    if (isChat) {
      const contextStr = context ? `\n\nCurrent event context:\n${JSON.stringify(context, null, 2)}` : "";
      aiMessages.push({ role: "system", content: systemPrompt + contextStr });
      if (Array.isArray(chatMessages)) {
        for (const m of chatMessages) aiMessages.push({ role: m.role, content: m.content });
      }
    } else {
      aiMessages.push({ role: "system", content: systemPrompt });
      let userPrompt = prompt || "";
      if (context) userPrompt = `Context:\n${JSON.stringify(context, null, 2)}\n\nRequest: ${userPrompt}`;
      aiMessages.push({ role: "user", content: userPrompt });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: aiMessages, temperature: isChat ? 0.7 : 0.3, max_completion_tokens: isChat ? 1000 : 2000 }),
    });

    if (!openaiRes.ok) {
      const status = openaiRes.status;
      if (status === 429) return res.status(429).json({ error: "AI rate limit exceeded. Please try again.", correlationId });
      if (status === 401) return res.status(500).json({ error: "Invalid OpenAI API key.", correlationId });
      return res.status(500).json({ error: "AI service temporarily unavailable", correlationId });
    }

    const aiResult = await openaiRes.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    if (isChat) return res.json({ result: rawContent, correlationId });

    let parsed: unknown;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: "AI returned malformed response.", raw: rawContent, correlationId });
    }

    return res.json({ result: parsed, correlationId });
  } catch (err: any) {
    console.error("[ai-assistant] error:", err.message);
    return res.status(500).json({ error: "Internal error", correlationId });
  }
});

// ── EVENT CONCIERGE ───────────────────────────────────────────────────────────

app.post("/api/functions/event-concierge", async (req, res) => {
  const correlationId = crypto.randomUUID();
  const authHeader = req.headers.authorization;

  try {
    const serviceClient = getSupabaseServiceClient();
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = getSupabaseUserClient(authHeader);
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(500).json({ error: "AI not configured", correlationId });

    const { event_id, message, attendee_token, session_id } = req.body;
    if (!event_id || !message) return res.status(400).json({ error: "Missing event_id or message", correlationId });

    const { data: event } = await serviceClient
      .from("events")
      .select("title, description, start_date, end_date, venue_name, venue_address, status")
      .eq("id", event_id)
      .single();

    if (!event || !["published", "ongoing"].includes(event.status)) {
      return res.status(404).json({ error: "Event not found or not available", correlationId });
    }

    const contextParts = [`Event: ${event.title}`];
    if (event.description) contextParts.push(`Description: ${event.description}`);
    if (event.venue_name) contextParts.push(`Venue: ${event.venue_name}`);
    if (event.venue_address) contextParts.push(`Address: ${event.venue_address}`);
    if (event.start_date) contextParts.push(`Start: ${event.start_date}`);
    if (event.end_date) contextParts.push(`End: ${event.end_date}`);
    const eventContext = contextParts.join("\n");

    const systemPrompt = `You are a helpful event concierge for attendees. You ONLY answer questions about the specific event described below. Be concise, friendly, and helpful.\n\nEVENT CONTEXT:\n${eventContext}`;

    let activeSessionId = session_id;
    if (!activeSessionId) {
      const sessionData: any = { event_id, session_type: "attendee_concierge" };
      if (userId) sessionData.user_id = userId;
      if (attendee_token) sessionData.attendee_token = attendee_token;
      const { data: sess } = await serviceClient.from("concierge_sessions").insert(sessionData).select("id").single();
      activeSessionId = sess?.id;
    }

    if (activeSessionId) {
      await serviceClient.from("concierge_messages").insert({ session_id: activeSessionId, role: "user", content: message });
    }

    const { data: historyRows } = activeSessionId
      ? await serviceClient.from("concierge_messages").select("role, content").eq("session_id", activeSessionId).order("created_at").limit(20)
      : { data: [] };

    const aiMessages: Array<{ role: string; content: string }> = [{ role: "system", content: systemPrompt }];
    for (const row of (historyRows || []) as any[]) aiMessages.push({ role: row.role, content: row.content });

    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: aiMessages, temperature: 0.5, max_completion_tokens: 800 }),
    });

    if (!openaiRes.ok) return res.status(502).json({ error: "AI service temporarily unavailable", correlationId });

    const aiResult = await openaiRes.json();
    const reply = aiResult.choices?.[0]?.message?.content || "Sorry, I couldn't process your question.";

    if (activeSessionId) {
      await serviceClient.from("concierge_messages").insert({ session_id: activeSessionId, role: "assistant", content: reply });
      await serviceClient.from("concierge_sessions").update({ updated_at: new Date().toISOString() }).eq("id", activeSessionId);
    }

    return res.json({ reply, session_id: activeSessionId, correlationId });
  } catch (err: any) {
    console.error("[event-concierge] error:", err.message);
    return res.status(500).json({ error: "Internal error", correlationId });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ── SERVE STATIC FRONTEND ─────────────────────────────────────────────────────

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[TitanMeet] Server running on port ${PORT}`);
});

export default app;
