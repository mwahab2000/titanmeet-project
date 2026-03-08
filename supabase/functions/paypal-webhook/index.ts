import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-to-server webhook: PayPal calls this endpoint directly.
// No browser CORS needed.

async function verifyPayPalWebhook(req: Request, body: string): Promise<boolean> {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID not configured");
    return false;
  }

  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error("Missing PayPal webhook signature headers");
    return false;
  }

  // Verify via PayPal API
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) return false;

  // Get access token
  const tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) return false;
  const { access_token } = await tokenRes.json();

  const verifyRes = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  });

  if (!verifyRes.ok) {
    const errText = await verifyRes.text();
    console.error("PayPal webhook verification API error:", errText);
    return false;
  }

  const verifyData = await verifyRes.json();
  return verifyData.verification_status === "SUCCESS";
}

async function sendNotificationEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: { type: string; user_id: string; title: string; message: string; link?: string; metadata?: Record<string, unknown> }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": serviceRoleKey },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Notification email error:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const bodyText = await req.text();

    // Verify webhook signature
    const isValid = await verifyPayPalWebhook(req, bodyText);
    if (!isValid) {
      console.error("PayPal webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const event = JSON.parse(bodyText);
    const eventType = event.event_type;
    const eventId = event.id; // PayPal event ID for idempotency
    const resource = event.resource || {};

    console.log("PayPal webhook received:", eventType, "event_id:", eventId);

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
        return new Response(JSON.stringify({ success: true, duplicate: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const srvKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Handle different PayPal event types
    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        // One-time payment captured (handled by capture endpoint too, but webhook is backup)
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (!orderId) break;

        const { data: pi } = await serviceClient
          .from("payment_intents")
          .select("*")
          .eq("provider_payment_id", orderId)
          .maybeSingle();

        if (pi && pi.status !== "paid" && pi.status !== "confirmed") {
          await serviceClient.from("payment_intents").update({
            status: "paid",
            paid_at: new Date().toISOString(),
          }).eq("id", pi.id);

          // Update entitlement
          const now = new Date();
          const newAccess = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const { data: ent } = await serviceClient.from("account_entitlements")
            .select("access_until").eq("user_id", pi.user_id).maybeSingle();
          const finalAccess = ent?.access_until
            ? new Date(Math.max(new Date(ent.access_until).getTime(), newAccess.getTime()))
            : newAccess;

          await serviceClient.from("account_entitlements").upsert({
            user_id: pi.user_id,
            access_until: finalAccess.toISOString(),
            source: "one_time_30d",
            updated_at: now.toISOString(),
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subId = resource.id;
        const customId = resource.custom_id; // our internal order id

        const { data: pi } = await serviceClient
          .from("payment_intents")
          .select("*")
          .eq("provider_subscription_id", subId)
          .maybeSingle();

        if (pi) {
          const now = new Date();
          const billingInfo = resource.billing_info;
          const nextBilling = billingInfo?.next_billing_time
            ? new Date(billingInfo.next_billing_time)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          // Update/create account subscription
          const { data: existingSub } = await serviceClient
            .from("account_subscriptions")
            .select("id")
            .eq("user_id", pi.user_id)
            .single();

          if (existingSub) {
            await serviceClient.from("account_subscriptions").update({
              plan_id: pi.plan_id,
              status: "active",
              provider: "paypal",
              provider_subscription_id: subId,
              current_period_start: now.toISOString(),
              current_period_end: nextBilling.toISOString(),
              cancel_at_period_end: false,
            }).eq("user_id", pi.user_id);
          }

          // Update entitlement
          const { data: ent } = await serviceClient.from("account_entitlements")
            .select("access_until").eq("user_id", pi.user_id).maybeSingle();
          const finalAccess = ent?.access_until
            ? new Date(Math.max(new Date(ent.access_until).getTime(), nextBilling.getTime()))
            : nextBilling;

          await serviceClient.from("account_entitlements").upsert({
            user_id: pi.user_id,
            access_until: finalAccess.toISOString(),
            source: "paypal_subscription",
            updated_at: now.toISOString(),
          }, { onConflict: "user_id" });

          await serviceClient.from("payment_intents").update({
            status: "active",
            paid_at: now.toISOString(),
          }).eq("id", pi.id);

          // Notify
          await serviceClient.rpc("create_notification", {
            _user_id: pi.user_id,
            _type: "subscription_upgraded",
            _title: "Subscription activated",
            _message: `Your ${pi.plan_id} monthly subscription is now active.`,
            _link: "/dashboard/billing",
          });

          await sendNotificationEmail(supabaseUrl, srvKey, {
            type: "subscription_upgraded",
            user_id: pi.user_id,
            title: "Subscription activated",
            message: `Your ${pi.plan_id} monthly subscription is now active.`,
            link: "/dashboard/billing",
          });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED":
      case "PAYMENT.SALE.COMPLETED": {
        const subId = resource.billing_agreement_id || resource.id;
        if (!subId) break;

        const { data: sub } = await serviceClient
          .from("account_subscriptions")
          .select("*")
          .eq("provider_subscription_id", subId)
          .maybeSingle();

        if (sub) {
          const now = new Date();
          const nextPeriod = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          await serviceClient.from("account_subscriptions").update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: nextPeriod.toISOString(),
          }).eq("id", sub.id);

          // Extend entitlement
          const { data: ent } = await serviceClient.from("account_entitlements")
            .select("access_until").eq("user_id", sub.user_id).maybeSingle();
          const finalAccess = ent?.access_until
            ? new Date(Math.max(new Date(ent.access_until).getTime(), nextPeriod.getTime()))
            : nextPeriod;

          await serviceClient.from("account_entitlements").upsert({
            user_id: sub.user_id,
            access_until: finalAccess.toISOString(),
            source: "paypal_subscription",
            updated_at: now.toISOString(),
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const subId = resource.id;
        const { data: sub } = await serviceClient
          .from("account_subscriptions")
          .select("*")
          .eq("provider_subscription_id", subId)
          .maybeSingle();

        if (sub) {
          await serviceClient.from("account_subscriptions").update({
            cancel_at_period_end: true,
            status: eventType.includes("CANCELLED") ? "canceled" : sub.status,
          }).eq("id", sub.id);

          // Do NOT revoke access early — entitlement remains until current_period_end

          await serviceClient.rpc("create_notification", {
            _user_id: sub.user_id,
            _type: "payment_expired",
            _title: "Subscription canceled",
            _message: `Your subscription has been canceled. Access continues until ${new Date(sub.current_period_end).toLocaleDateString()}.`,
            _link: "/dashboard/billing",
          });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subId = resource.id;
        const { data: sub } = await serviceClient
          .from("account_subscriptions")
          .select("*")
          .eq("provider_subscription_id", subId)
          .maybeSingle();

        if (sub) {
          await serviceClient.from("account_subscriptions").update({
            status: "expired",
          }).eq("id", sub.id);
        }
        break;
      }

      default:
        console.log("Unhandled PayPal event type:", eventType);
    }

    // Always log the event
    // Find related payment intent for logging
    let piId: string | null = null;
    const subId = resource.id || resource.billing_agreement_id;
    if (subId) {
      const { data: pi } = await serviceClient
        .from("payment_intents")
        .select("id")
        .or(`provider_payment_id.eq.${subId},provider_subscription_id.eq.${subId}`)
        .maybeSingle();
      piId = pi?.id || null;
    }

    if (piId) {
      await serviceClient.from("payment_events").insert({
        payment_intent_id: piId,
        provider: "paypal",
        event_type: eventType,
        raw_payload: event,
        provider_event_id: eventId,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("paypal-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
