import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map Triple-A statuses to our CHECK-constrained statuses
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Triple-A webhook received:", JSON.stringify(payload));

    // Verify webhook secret
    const webhookSecret = Deno.env.get("TRIPLEA_WEBHOOK_SECRET");
    if (webhookSecret && payload.notify_secret !== webhookSecret) {
      console.error("Webhook secret mismatch");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = payload.order_id;
    const tripleAStatus = payload.status || payload.payment_status;
    const paymentReference = payload.payment_reference || payload.id;

    // Build a unique provider event ID for idempotency
    const providerEventId = payload.webhook_id
      || (payload.id ? `${payload.id}_${tripleAStatus}` : `${orderId}_${tripleAStatus}_${Date.now()}`);

    if (!orderId) {
      console.error("No order_id in webhook payload");
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find payment intent
    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .select("*")
      .eq("internal_order_id", orderId)
      .single();

    if (piError || !paymentIntent) {
      console.error("Payment intent not found for order:", orderId);
      return new Response(JSON.stringify({ error: "Payment intent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already processed
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Map to internal status
    const internalStatus = STATUS_MAP[tripleAStatus] || "pending";

    // Log the event
    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "triple_a",
      event_type: tripleAStatus || "unknown",
      raw_payload: payload,
      provider_event_id: providerEventId,
    });

    // Update payment intent status
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

    // If payment is confirmed → activate/upgrade subscription
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

      // Log subscription activation
      await serviceClient.from("payment_events").insert({
        payment_intent_id: paymentIntent.id,
        provider: "triple_a",
        event_type: "subscription_activated",
        raw_payload: { plan_id: paymentIntent.plan_id, user_id: paymentIntent.user_id },
        provider_event_id: `${paymentIntent.internal_order_id}_sub_activated`,
      });

      console.log("Subscription activated successfully");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("triplea-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
