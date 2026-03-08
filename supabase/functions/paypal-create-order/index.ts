import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("PayPal auth failed:", errText);
    throw new Error("Failed to authenticate with PayPal");
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const { plan_id } = await req.json();
    if (!plan_id || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing plan_id" }), { status: 400, headers: jsonHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: jsonHeaders });
    }

    const amountUsd = (plan.monthly_price_cents / 100).toFixed(2);
    const internalOrderId = `TM-${crypto.randomUUID().slice(0, 8)}`;

    // Create payment intent
    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .insert({
        user_id: user.id,
        plan_id,
        provider: "paypal",
        purchase_type: "one_time_30d",
        internal_order_id: internalOrderId,
        amount_usd_cents: plan.monthly_price_cents,
        currency: "USD",
        status: "pending",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (piError || !paymentIntent) {
      console.error("Failed to create payment intent:", piError);
      return new Response(JSON.stringify({ error: "Failed to create payment" }), { status: 500, headers: jsonHeaders });
    }

    // Create PayPal order
    const accessToken = await getPayPalAccessToken();
    const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: internalOrderId,
        description: `TitanMeet ${plan.name} Plan - 30 days`,
        amount: {
          currency_code: "USD",
          value: amountUsd,
        },
      }],
      application_context: {
        brand_name: "TitanMeet",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
      },
    };

    const orderRes = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error("PayPal create order failed:", errBody);
      await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", paymentIntent.id);
      return new Response(JSON.stringify({ error: "Failed to create PayPal order" }), { status: 502, headers: jsonHeaders });
    }

    const orderData = await orderRes.json();

    await serviceClient.from("payment_intents").update({
      provider_payment_id: orderData.id,
      status: "awaiting_payment",
      metadata: orderData,
    }).eq("id", paymentIntent.id);

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "paypal",
      event_type: "order_created",
      raw_payload: orderData,
      provider_event_id: `${orderData.id}_created`,
    });

    console.log("PayPal order created:", orderData.id);

    return new Response(JSON.stringify({
      payment_intent_id: paymentIntent.id,
      order_id: orderData.id,
      status: "awaiting_payment",
      amount_usd: amountUsd,
      plan_name: plan.name,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paypal-create-order error:", err);
    return new Response(JSON.stringify({ error: "An error occurred. Please try again." }), { status: 500, headers: jsonHeaders });
  }
});
