import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-to-server webhook: Triple-A calls this endpoint directly.
// No browser CORS needed. We return minimal headers for safety.

async function sendNotificationEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: { type: string; user_id: string; title: string; message: string; link?: string; metadata?: Record<string, unknown> }
) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": serviceRoleKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn("Notification email failed:", res.status, body);
    }
  } catch (e) {
    console.warn("Notification email error:", e);
  }
}

const STATUS_MAP: Record<string, string> = {
  new: "pending",
  crypto_detected: "awaiting_payment",
  crypto_confirmed: "confirmed",
  done: "confirmed",
  expired: "expired",
  cancelled: "cancelled",
  overpaid: "confirmed",
  underpaid: "awaiting_payment",
};

Deno.serve(async (req) => {
  // Webhook endpoint — no browser CORS preflight expected
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Triple-A webhook received:", JSON.stringify(payload));

    const webhookSecret = Deno.env.get("TRIPLEA_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("TRIPLEA_WEBHOOK_SECRET is not configured — rejecting webhook");
      return new Response(JSON.stringify({ error: "Service misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (payload.notify_secret !== webhookSecret) {
      console.error("Webhook secret mismatch");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const orderId = payload.order_id;
    const tripleAStatus = payload.status || payload.payment_status;
    const paymentReference = payload.payment_reference || payload.id;

    const providerEventId = payload.webhook_id
      || (payload.id ? `${payload.id}_${tripleAStatus}` : `${orderId}_${tripleAStatus}_${Date.now()}`);

    if (!orderId) {
      console.error("No order_id in webhook payload");
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .select("*")
      .eq("internal_order_id", orderId)
      .single();

    if (piError || !paymentIntent) {
      console.error("Payment intent not found for order:", orderId);
      return new Response(JSON.stringify({ error: "Payment intent not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (providerEventId) {
      const { data: existing } = await serviceClient
        .from("payment_events")
        .select("id")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();

      if (existing) {
        console.log("Duplicate webhook skipped:", providerEventId);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const internalStatus = STATUS_MAP[tripleAStatus] || "pending";

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "triple_a",
      event_type: tripleAStatus || "unknown",
      raw_payload: payload,
      provider_event_id: providerEventId,
    });

    const updateData: Record<string, unknown> = {
      status: internalStatus,
      provider_payment_id: paymentReference || paymentIntent.provider_payment_id,
    };

    if (internalStatus === "confirmed" && !paymentIntent.paid_at) {
      updateData.paid_at = new Date().toISOString();
    }

    await serviceClient
      .from("payment_intents")
      .update(updateData)
      .eq("id", paymentIntent.id);

    if (internalStatus === "confirmed") {
      console.log("Payment confirmed, activating subscription for user:", paymentIntent.user_id, "plan:", paymentIntent.plan_id);

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: existingSub } = await serviceClient
        .from("account_subscriptions")
        .select("id")
        .eq("user_id", paymentIntent.user_id)
        .single();

      if (existingSub) {
        await serviceClient
          .from("account_subscriptions")
          .update({
            plan_id: paymentIntent.plan_id,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .eq("user_id", paymentIntent.user_id);
      } else {
        await serviceClient.from("account_subscriptions").insert({
          user_id: paymentIntent.user_id,
          plan_id: paymentIntent.plan_id,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
      }

      await serviceClient.from("payment_events").insert({
        payment_intent_id: paymentIntent.id,
        provider: "triple_a",
        event_type: "subscription_activated",
        raw_payload: { plan_id: paymentIntent.plan_id, user_id: paymentIntent.user_id },
        provider_event_id: `${paymentIntent.internal_order_id}_sub_activated`,
      });

      console.log("Subscription activated successfully");

      await serviceClient.rpc("create_notification", {
        _user_id: paymentIntent.user_id,
        _type: "subscription_upgraded",
        _title: "Subscription upgraded",
        _message: `Your subscription has been upgraded to the ${paymentIntent.plan_id} plan.`,
        _link: "/dashboard/billing",
        _metadata: JSON.stringify({ plan_id: paymentIntent.plan_id }),
      });

      await serviceClient.rpc("create_notification", {
        _user_id: paymentIntent.user_id,
        _type: "payment_confirmed",
        _title: "Payment confirmed",
        _message: `Your crypto payment of $${(paymentIntent.amount_usd_cents / 100).toFixed(2)} has been confirmed.`,
        _link: "/dashboard/billing",
        _metadata: JSON.stringify({ order_id: paymentIntent.internal_order_id }),
      });

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const srvKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await sendNotificationEmail(supabaseUrl, srvKey, {
        type: "payment_confirmed",
        user_id: paymentIntent.user_id,
        title: "Payment confirmed",
        message: `Your crypto payment of $${(paymentIntent.amount_usd_cents / 100).toFixed(2)} for the ${paymentIntent.plan_id} plan has been confirmed.`,
        link: "/dashboard/billing",
        metadata: { order_id: paymentIntent.internal_order_id, payment_intent_id: paymentIntent.id },
      });
      await sendNotificationEmail(supabaseUrl, srvKey, {
        type: "subscription_upgraded",
        user_id: paymentIntent.user_id,
        title: "Subscription upgraded",
        message: `Your subscription has been upgraded to the ${paymentIntent.plan_id} plan. Enjoy your new features!`,
        link: "/dashboard/billing",
        metadata: { plan_id: paymentIntent.plan_id },
      });
    }

    if (["expired", "failed", "cancelled"].includes(internalStatus)) {
      const notifType = internalStatus === "expired" ? "payment_expired" : "payment_failed";
      await serviceClient.rpc("create_notification", {
        _user_id: paymentIntent.user_id,
        _type: notifType,
        _title: internalStatus === "expired" ? "Payment expired" : "Payment failed",
        _message: internalStatus === "expired"
          ? `Your payment for the ${paymentIntent.plan_id} plan has expired. Please try again.`
          : `Your payment for the ${paymentIntent.plan_id} plan has ${internalStatus}. Please try again.`,
        _link: "/dashboard/billing",
        _metadata: JSON.stringify({ order_id: paymentIntent.internal_order_id }),
      });

      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const srvKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const notifType2 = internalStatus === "expired" ? "payment_expired" : "payment_failed";
      await sendNotificationEmail(supabaseUrl2, srvKey2, {
        type: notifType2,
        user_id: paymentIntent.user_id,
        title: internalStatus === "expired" ? "Payment expired" : "Payment failed",
        message: internalStatus === "expired"
          ? `Your payment for the ${paymentIntent.plan_id} plan has expired. Please try again.`
          : `Your payment for the ${paymentIntent.plan_id} plan has ${internalStatus}. Please try again.`,
        link: "/dashboard/billing",
        metadata: { order_id: paymentIntent.internal_order_id, payment_intent_id: paymentIntent.id },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("triplea-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
