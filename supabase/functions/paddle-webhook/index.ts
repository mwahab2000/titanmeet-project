import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Signature Verification ───────────────────────────────────────────────────

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  try {
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(";")) {
      const [key, ...vals] = part.split("=");
      parts[key.trim()] = vals.join("=").trim();
    }
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
    const computed = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === h1;
  } catch (err) {
    console.error("[paddle-webhook] signature verification error:", err);
    return false;
  }
}

// ─── Plan Resolution ──────────────────────────────────────────────────────────

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
    const val = Deno.env.get(envKey);
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

// ─── Out-of-order protection ──────────────────────────────────────────────────
// Rule: We use Paddle's `occurred_at` (ISO-8601 from the event envelope) as the
// canonical ordering timestamp. Before applying any subscription status change,
// we compare it against account_subscriptions.updated_at. If the incoming event
// is older, we skip the mutation and log it as stale.

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

// ─── Audit logging (never silently fails) ─────────────────────────────────────

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

  // If no direct payment_intent_id, try to find one by subscription id
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
    // Create a minimal audit-only payment_intent so the event is never lost
    const { data: stub } = await serviceClient
      .from("payment_intents")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000", // sentinel for audit-only rows
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

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const jsonHeaders = { "Content-Type": "application/json" };

  // ── 1. ENFORCE webhook secret ──
  const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[paddle-webhook] FATAL: PADDLE_WEBHOOK_SECRET is not configured. Billing is misconfigured — refusing to process webhooks.");
    return new Response(
      JSON.stringify({ error: "Billing system misconfigured" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request body" }), { status: 400, headers: jsonHeaders });
  }

  // ── 2. Verify signature ──
  const signatureHeader = req.headers.get("Paddle-Signature");
  const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValid) {
    console.error("[paddle-webhook] Signature verification failed");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: jsonHeaders });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders });
  }

  const eventType = event.event_type as string;
  const eventData = (event.data || {}) as Record<string, unknown>;
  const eventId = (event.event_id || event.notification_id || "") as string;
  const occurredAt = (event.occurred_at || new Date().toISOString()) as string;

  console.log(`[paddle-webhook] received: ${eventType} event_id=${eventId}`);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── 3. Idempotency check ──
  if (eventId) {
    const { data: existing } = await serviceClient
      .from("payment_events")
      .select("id")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (existing) {
      console.log(`[paddle-webhook] duplicate skipped: ${eventId}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: jsonHeaders });
    }
  }

  const customData = (eventData.custom_data || {}) as Record<string, unknown>;
  const userId = customData.user_id as string | undefined;
  const priceToPlan = buildPriceToPlanMap();

  try {
    switch (eventType) {
      // ═══════════════════════════════════════════════════════════════════════
      case "transaction.completed": {
        const transactionId = eventData.id as string;
        const details = eventData.details as Record<string, unknown> | undefined;
        const totals = details?.totals as Record<string, unknown> | undefined;
        const amountCents = parseInt((totals?.grand_total as string) || "0", 10);
        const items = eventData.items as Array<Record<string, unknown>> | undefined;
        const priceId = (items?.[0]?.price as Record<string, unknown>)?.id as string | undefined;
        const planSlug = resolvePlanSlug(priceId, customData, priceToPlan);
        const subscriptionId = eventData.subscription_id as string | undefined;

        console.log(`[paddle-webhook] transaction.completed: user=${userId} plan=${planSlug} tx=${transactionId}`);

        if (!userId || !planSlug) {
          console.error("[paddle-webhook] Missing userId or planSlug — cannot process transaction", { userId, priceId });
          // Log the event for audit even though we can't process it
          await logPaymentEvent(serviceClient, {
            providerEventId: eventId,
            eventType,
            rawPayload: event,
            subscriptionId: subscriptionId,
          });
          break;
        }

        // Stale check
        if (await isStaleEvent(serviceClient, userId, occurredAt)) {
          console.log(`[paddle-webhook] stale event skipped: ${eventType} occurred_at=${occurredAt}`);
          await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
          break;
        }

        const internalOrderId = `TM-PDL-${crypto.randomUUID().slice(0, 8)}`;

        const { data: pi } = await serviceClient
          .from("payment_intents")
          .insert({
            user_id: userId,
            plan_id: planSlug,
            provider: "paddle",
            purchase_type: subscriptionId ? "monthly" : "one_time_30d",
            provider_payment_id: transactionId,
            provider_subscription_id: subscriptionId || null,
            internal_order_id: internalOrderId,
            amount_usd_cents: amountCents,
            currency: "USD",
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!pi) {
          console.error("[paddle-webhook] Failed to insert payment_intent for transaction", transactionId);
          throw new Error("payment_intent insert failed");
        }

        // Billing period
        const now = new Date();
        const billingPeriod = eventData.billing_period as Record<string, string> | undefined;
        const billingPeriodStart = billingPeriod?.starts_at || now.toISOString();
        const billingPeriodEnd = billingPeriod?.ends_at || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Update entitlement
        const { data: existingEnt } = await serviceClient
          .from("account_entitlements")
          .select("access_until")
          .eq("user_id", userId)
          .maybeSingle();

        const accessUntil = new Date(billingPeriodEnd);
        const finalAccess = existingEnt?.access_until
          ? new Date(Math.max(new Date(existingEnt.access_until).getTime(), accessUntil.getTime()))
          : accessUntil;

        const { error: entErr } = await serviceClient.from("account_entitlements").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          access_until: finalAccess.toISOString(),
          source: subscriptionId ? "subscription" : "one_time_payment",
          updated_at: now.toISOString(),
        }, { onConflict: "user_id" });

        if (entErr) {
          console.error("[paddle-webhook] account_entitlements upsert failed:", entErr.message);
          throw new Error("entitlement upsert failed");
        }

        const { error: subErr } = await serviceClient.from("account_subscriptions").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          provider: "paddle",
          provider_subscription_id: subscriptionId || null,
          current_period_start: billingPeriodStart,
          current_period_end: billingPeriodEnd,
          cancel_at_period_end: false,
          cancelled_at: null,
          scheduled_plan: null,
          scheduled_change_date: null,
          updated_at: occurredAt,
        }, { onConflict: "user_id" });

        if (subErr) {
          console.error("[paddle-webhook] account_subscriptions upsert failed:", subErr.message);
          throw new Error("subscription upsert failed");
        }

        // Audit log
        await logPaymentEvent(serviceClient, { paymentIntentId: pi.id, providerEventId: eventId, eventType, rawPayload: event });

        // ── Finalize discount redemption if discount was applied ──
        try {
          const discountData = eventData.discount as Record<string, unknown> | undefined;
          const paddleDiscountId = discountData?.id as string | undefined;
          if (paddleDiscountId && userId) {
            // Look up discount code by paddle_discount_id
            const { data: dc } = await serviceClient
              .from("discount_codes")
              .select("id")
              .eq("paddle_discount_id", paddleDiscountId)
              .maybeSingle();

            if (dc) {
              // Determine billing interval from price
              const billingCycle = (items?.[0]?.price as Record<string, unknown>)?.billing_cycle as Record<string, unknown> | undefined;
              const billingInterval = billingCycle?.interval === "year" ? "annual" : "monthly";

              // Try to finalize existing pending redemption
              const { data: pendingRedemption } = await serviceClient
                .from("discount_code_redemptions")
                .select("id")
                .eq("discount_code_id", dc.id)
                .eq("user_id", userId)
                .eq("status", "pending")
                .order("redeemed_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (pendingRedemption) {
                await serviceClient.from("discount_code_redemptions").update({
                  status: "applied",
                  subscription_id: subscriptionId || null,
                  paddle_customer_id: (eventData.customer_id as string) || null,
                  paddle_transaction_id: transactionId,
                }).eq("id", pendingRedemption.id);
                console.log(`[paddle-webhook] finalized discount redemption ${pendingRedemption.id}`);
              } else {
                // No pending record — create applied directly (webhook-only path)
                await serviceClient.from("discount_code_redemptions").insert({
                  discount_code_id: dc.id,
                  user_id: userId,
                  plan_applied: planSlug,
                  billing_interval: billingInterval,
                  subscription_id: subscriptionId || null,
                  paddle_customer_id: (eventData.customer_id as string) || null,
                  paddle_transaction_id: transactionId,
                  status: "applied",
                  metadata: { source: "webhook_direct" },
                });
                console.log(`[paddle-webhook] created applied discount redemption for code ${dc.id}`);
              }
            }
          }
        } catch (discountErr) {
          // Best-effort — don't fail the whole webhook for discount tracking
          console.error("[paddle-webhook] discount redemption tracking error:", discountErr);
        }

        // Notification (best-effort)
        try {
          await serviceClient.rpc("create_notification", {
            _user_id: userId,
            _type: "payment_confirmed",
            _title: "Payment confirmed",
            _message: `Your payment of $${(amountCents / 100).toFixed(2)} has been confirmed. Your ${planSlug} plan is now active.`,
            _link: "/dashboard/billing",
          });
        } catch { /* best-effort */ }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
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

        console.log(`[paddle-webhook] ${eventType}: user=${userId} plan=${planSlug} sub=${subscriptionId}`);

        if (!userId || !planSlug) {
          console.error(`[paddle-webhook] Missing userId or planSlug for ${eventType}`);
          await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
          break;
        }

        // Stale check
        if (await isStaleEvent(serviceClient, userId, occurredAt)) {
          console.log(`[paddle-webhook] stale event skipped: ${eventType} occurred_at=${occurredAt}`);
          await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
          break;
        }

        // Insert payment_intent for activated/renewed only
        let piId: string | null = null;
        if (eventType !== "subscription.updated") {
          const recurringDetails = eventData.recurring_transaction_details as Record<string, unknown> | undefined;
          const recurringTotals = recurringDetails?.totals as Record<string, unknown> | undefined;
          const details = eventData.details as Record<string, unknown> | undefined;
          const detailsTotals = details?.totals as Record<string, unknown> | undefined;
          const amountCents = parseInt((detailsTotals?.grand_total as string) || (recurringTotals?.grand_total as string) || "0", 10);

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

        // Update entitlement
        const { data: existingEnt } = await serviceClient
          .from("account_entitlements")
          .select("access_until")
          .eq("user_id", userId)
          .maybeSingle();

        const finalAccess = existingEnt?.access_until
          ? new Date(Math.max(new Date(existingEnt.access_until).getTime(), new Date(accessUntil).getTime()))
          : new Date(accessUntil);

        const { error: entErr } = await serviceClient.from("account_entitlements").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          access_until: finalAccess.toISOString(),
          source: "subscription",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (entErr) {
          console.error("[paddle-webhook] entitlement upsert failed:", entErr.message);
          throw new Error("entitlement upsert failed");
        }

        // Check scheduled plan
        const { data: currentSub } = await serviceClient
          .from("account_subscriptions")
          .select("scheduled_plan, scheduled_change_date")
          .eq("user_id", userId)
          .maybeSingle();

        const effectivePlan = (currentSub?.scheduled_plan && eventType === "subscription.updated")
          ? currentSub.scheduled_plan
          : planSlug;

        const updatePayload: Record<string, unknown> = {
          plan_id: effectivePlan,
          provider: "paddle",
          provider_subscription_id: subscriptionId,
          status: "active",
          current_period_start: periodStart,
          current_period_end: accessUntil,
          cancel_at_period_end: false,
          updated_at: occurredAt,
        };

        if (currentSub?.scheduled_plan && effectivePlan === currentSub.scheduled_plan) {
          updatePayload.scheduled_plan = null;
          updatePayload.scheduled_change_date = null;
        }

        const { error: subErr } = await serviceClient
          .from("account_subscriptions")
          .update(updatePayload)
          .eq("user_id", userId);

        if (subErr) {
          console.error("[paddle-webhook] subscription update failed:", subErr.message);
          throw new Error("subscription update failed");
        }

        // Audit log
        await logPaymentEvent(serviceClient, { paymentIntentId: piId, providerEventId: eventId, eventType, rawPayload: event, subscriptionId });

        // Notification (best-effort)
        try {
          const notifTitle = eventType === "subscription.renewed" ? "Subscription renewed"
            : eventType === "subscription.updated" ? "Plan updated"
            : "Subscription activated";
          await serviceClient.rpc("create_notification", {
            _user_id: userId,
            _type: "subscription_upgraded",
            _title: notifTitle,
            _message: `Your ${effectivePlan} subscription is now active until ${new Date(accessUntil).toLocaleDateString()}.`,
            _link: "/dashboard/billing",
          });
        } catch { /* best-effort */ }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      case "subscription.canceled": {
        const subscriptionId = eventData.id as string;
        console.log(`[paddle-webhook] subscription.canceled: user=${userId} sub=${subscriptionId}`);

        if (userId) {
          // Stale check
          if (await isStaleEvent(serviceClient, userId, occurredAt)) {
            console.log(`[paddle-webhook] stale cancellation skipped: occurred_at=${occurredAt}`);
            await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
            break;
          }

          const { error: subErr } = await serviceClient.from("account_subscriptions").update({
            cancel_at_period_end: true,
            cancelled_at: new Date().toISOString(),
            status: "canceled",
            updated_at: occurredAt,
          }).eq("user_id", userId);

          if (subErr) {
            console.error("[paddle-webhook] cancellation update failed:", subErr.message);
            throw new Error("cancellation update failed");
          }

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

        // Always audit log — even without userId
        await logPaymentEvent(serviceClient, { providerEventId: eventId, eventType, rawPayload: event, subscriptionId });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      case "transaction.payment_failed": {
        const transactionId = eventData.id as string;
        console.log(`[paddle-webhook] transaction.payment_failed: user=${userId} tx=${transactionId}`);

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

        // Always audit log
        await logPaymentEvent(serviceClient, {
          providerEventId: eventId,
          eventType,
          rawPayload: event,
          subscriptionId: eventData.subscription_id as string | undefined,
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      default:
        console.log(`[paddle-webhook] unhandled event type: ${eventType}`);
        // Intentionally ignored — return 200
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    // ── 4. Real failures return non-200 so Paddle retries ──
    console.error(`[paddle-webhook] PROCESSING ERROR for ${eventType}:`, err);
    return new Response(
      JSON.stringify({ error: "Internal processing error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
