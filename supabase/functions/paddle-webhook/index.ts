import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
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
      ["sign"]
    );

    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${ts}:${rawBody}`)
    );

    const computed = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computed === h1;
  } catch (err) {
    console.error("Paddle signature verification error:", err);
    return false;
  }
}

/** Map Paddle price IDs to plan slugs using server-side env vars */
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

/** Resolve plan slug from price ID or custom_data fallback */
function resolvePlanSlug(
  priceId: string | undefined,
  customData: Record<string, any>,
  priceToPlan: Record<string, string>
): string | null {
  if (priceId && priceToPlan[priceId]) return priceToPlan[priceId];
  // Fallback: custom_data.plan_id (set by PaddleCheckoutButton)
  if (customData?.plan_id) return customData.plan_id;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const jsonHeaders = { "Content-Type": "application/json" };

  try {
    const rawBody = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    const signatureHeader = req.headers.get("Paddle-Signature");

    if (webhookSecret) {
      const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error("Paddle webhook signature verification failed");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: jsonHeaders });
      }
    } else {
      console.warn("PADDLE_WEBHOOK_SECRET not set — skipping signature verification");
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const eventData = event.data || {};
    const eventId = event.event_id || event.notification_id || "";

    console.log("Paddle webhook received:", eventType, "event_id:", eventId);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check
    if (eventId) {
      const { data: existing } = await serviceClient
        .from("payment_events")
        .select("id")
        .eq("provider_event_id", eventId)
        .maybeSingle();

      if (existing) {
        console.log("Duplicate webhook skipped:", eventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: jsonHeaders });
      }
    }

    const customData = eventData.custom_data || {};
    const userId = customData.user_id;
    const priceToPlan = buildPriceToPlanMap();

    switch (eventType) {
      case "transaction.completed": {
        const transactionId = eventData.id;
        const amountCents = parseInt(eventData.details?.totals?.grand_total || "0", 10);
        const priceId = eventData.items?.[0]?.price?.id;
        const planSlug = resolvePlanSlug(priceId, customData, priceToPlan);

        console.log(`transaction.completed: user=${userId} plan=${planSlug} price=${priceId} tx=${transactionId} amount=${amountCents}`);

        if (!userId || !planSlug) {
          console.error("Missing userId or planSlug", { userId, priceId, customData });
          break;
        }

        const internalOrderId = `TM-PDL-${crypto.randomUUID().slice(0, 8)}`;

        // Upsert payment intent
        const { data: pi } = await serviceClient
          .from("payment_intents")
          .insert({
            user_id: userId,
            plan_id: planSlug,
            provider: "paddle",
            purchase_type: eventData.subscription_id ? "monthly" : "one_time_30d",
            provider_payment_id: transactionId,
            provider_subscription_id: eventData.subscription_id || null,
            internal_order_id: internalOrderId,
            amount_usd_cents: amountCents,
            currency: "USD",
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .select()
          .single();

        // Determine billing period
        const now = new Date();
        const billingPeriodStart = eventData.billing_period?.starts_at || now.toISOString();
        const billingPeriodEnd = eventData.billing_period?.ends_at || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

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

        await serviceClient.from("account_entitlements").upsert({
          user_id: userId,
          access_until: finalAccess.toISOString(),
          source: eventData.subscription_id ? "subscription" : "one_time_payment",
          updated_at: now.toISOString(),
        }, { onConflict: "user_id" });

        // Update account_subscriptions
        await serviceClient.from("account_subscriptions").upsert({
          user_id: userId,
          plan_id: planSlug,
          status: "active",
          provider: "paddle",
          provider_subscription_id: eventData.subscription_id || null,
          current_period_start: billingPeriodStart,
          current_period_end: billingPeriodEnd,
          cancel_at_period_end: false,
          cancelled_at: null,
          scheduled_plan: null,
          scheduled_change_date: null,
          updated_at: now.toISOString(),
        }, { onConflict: "user_id" });

        // Log event
        if (pi) {
          try {
            await serviceClient.from("payment_events").insert({
              payment_intent_id: pi.id,
              provider: "paddle",
              event_type: "transaction.completed",
              raw_payload: event,
              provider_event_id: eventId,
            });
          } catch { /* swallow */ }
        }

        // Notification
        try {
          await serviceClient.rpc("create_notification", {
            _user_id: userId,
            _type: "payment_confirmed",
            _title: "Payment confirmed",
            _message: `Your payment of $${(amountCents / 100).toFixed(2)} has been confirmed. Your ${planSlug} plan is now active.`,
            _link: "/dashboard/billing",
          });
        } catch { /* swallow */ }
        break;
      }

      case "subscription.activated":
      case "subscription.renewed":
      case "subscription.updated": {
        const subscriptionId = eventData.id;
        const periodEnd = eventData.current_billing_period?.ends_at;
        const accessUntil = periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const periodStart = eventData.current_billing_period?.starts_at || new Date().toISOString();
        const priceId = eventData.items?.[0]?.price?.id;
        const planSlug = resolvePlanSlug(priceId, customData, priceToPlan);

        console.log(`${eventType}: user=${userId} plan=${planSlug} price=${priceId} sub=${subscriptionId} until=${accessUntil}`);

        if (userId && planSlug) {
          const internalOrderId = `TM-SUB-${crypto.randomUUID().slice(0, 8)}`;
          const amountCents = parseInt(eventData.details?.totals?.grand_total || eventData.recurring_transaction_details?.totals?.grand_total || "0", 10);

          // Only insert payment_intent for activated/renewed (not for scheduled updates)
          let pi: any = null;
          if (eventType !== "subscription.updated") {
            const { data } = await serviceClient
              .from("payment_intents")
              .insert({
                user_id: userId,
                plan_id: planSlug,
                provider: "paddle",
                purchase_type: "monthly",
                provider_payment_id: subscriptionId,
                internal_order_id: internalOrderId,
                amount_usd_cents: amountCents,
                currency: "USD",
                status: "active",
                paid_at: new Date().toISOString(),
              })
              .select()
              .single();
            pi = data;
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

          await serviceClient.from("account_entitlements").upsert({
            user_id: userId,
            access_until: finalAccess.toISOString(),
            source: "subscription",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          // Check if a scheduled plan change has taken effect
          const { data: currentSub } = await serviceClient
            .from("account_subscriptions")
            .select("scheduled_plan, scheduled_change_date")
            .eq("user_id", userId)
            .maybeSingle();

          const effectivePlan = (currentSub?.scheduled_plan && eventType === "subscription.updated")
            ? currentSub.scheduled_plan
            : planSlug;

          // Update account_subscriptions
          const updatePayload: Record<string, any> = {
            plan_id: effectivePlan,
            provider: "paddle",
            provider_subscription_id: subscriptionId,
            status: "active",
            current_period_start: periodStart,
            current_period_end: accessUntil,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          };

          // If the scheduled plan matches the new effective plan, clear the schedule
          if (currentSub?.scheduled_plan && effectivePlan === currentSub.scheduled_plan) {
            updatePayload.scheduled_plan = null;
            updatePayload.scheduled_change_date = null;
          }

          await serviceClient.from("account_subscriptions").update(updatePayload).eq("user_id", userId);

          // Log event
          if (pi) {
            try {
              await serviceClient.from("payment_events").insert({
                payment_intent_id: pi.id,
                provider: "paddle",
                event_type: eventType,
                raw_payload: event,
                provider_event_id: eventId,
              });
            } catch { /* swallow */ }
          }

          // Notification
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
          } catch { /* swallow */ }
        }
        break;
      }

      case "subscription.canceled": {
        const subscriptionId = eventData.id;
        console.log(`subscription.canceled: user=${userId} sub=${subscriptionId}`);

        if (userId) {
          await serviceClient.from("account_subscriptions").update({
            cancel_at_period_end: true,
            cancelled_at: new Date().toISOString(),
            status: "canceled",
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);

          try {
            await serviceClient.rpc("create_notification", {
              _user_id: userId,
              _type: "payment_expired",
              _title: "Subscription canceled",
              _message: "Your subscription has been canceled. Access continues until end of current period.",
              _link: "/dashboard/billing",
            });
          } catch { /* swallow */ }
        }

        // Log event
        try {
          const { data: pi } = await serviceClient
            .from("payment_intents")
            .select("id")
            .eq("provider_payment_id", subscriptionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pi) {
            await serviceClient.from("payment_events").insert({
              payment_intent_id: pi.id,
              provider: "paddle",
              event_type: "subscription.canceled",
              raw_payload: event,
              provider_event_id: eventId,
            });
          }
        } catch { /* swallow */ }
        break;
      }

      case "transaction.payment_failed": {
        const transactionId = eventData.id;
        console.log(`transaction.payment_failed: user=${userId} tx=${transactionId}`);

        if (userId) {
          const { data: existingPi } = await serviceClient
            .from("payment_intents")
            .select("id")
            .eq("provider_payment_id", transactionId)
            .maybeSingle();

          if (existingPi) {
            await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", existingPi.id);
            try {
              await serviceClient.from("payment_events").insert({
                payment_intent_id: existingPi.id,
                provider: "paddle",
                event_type: "transaction.payment_failed",
                raw_payload: event,
                provider_event_id: eventId,
              });
            } catch { /* swallow */ }
          }
        }
        break;
      }

      default:
        console.log("Unhandled Paddle event type:", eventType);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paddle-webhook error:", err);
    return new Response(JSON.stringify({ received: true, error: "Internal error" }), { status: 200, headers: jsonHeaders });
  }
});
