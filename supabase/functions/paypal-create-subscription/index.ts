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
  if (!res.ok) throw new Error("Failed to authenticate with PayPal");
  return (await res.json()).access_token;
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

    const paypalPlanId = Deno.env.get(`PAYPAL_PLAN_ID_${plan_id.toUpperCase()}`);
    if (!paypalPlanId) {
      return new Response(JSON.stringify({ error: "No PayPal plan configured for this tier" }), { status: 400, headers: jsonHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: plan } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: jsonHeaders });
    }

    const internalOrderId = `TM-SUB-${crypto.randomUUID().slice(0, 8)}`;

    // Create payment intent for the subscription
    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .insert({
        user_id: user.id,
        plan_id,
        provider: "paypal",
        purchase_type: "monthly",
        internal_order_id: internalOrderId,
        amount_usd_cents: plan.monthly_price_cents,
        currency: "USD",
        status: "pending",
      })
      .select()
      .single();

    if (piError || !paymentIntent) {
      console.error("Failed to create payment intent:", piError);
      return new Response(JSON.stringify({ error: "Failed to create subscription" }), { status: 500, headers: jsonHeaders });
    }

    // Create PayPal subscription
    const accessToken = await getPayPalAccessToken();
    const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";
    const successUrl = Deno.env.get("PAYPAL_SUCCESS_URL") || "https://titanmeet.com/dashboard/billing?payment=success";
    const cancelUrl = Deno.env.get("PAYPAL_CANCEL_URL") || "https://titanmeet.com/dashboard/billing?payment=cancelled";

    const subPayload = {
      plan_id: paypalPlanId,
      subscriber: {
        email_address: user.email || undefined,
      },
      application_context: {
        brand_name: "TitanMeet",
        return_url: successUrl,
        cancel_url: cancelUrl,
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
      },
      custom_id: internalOrderId,
    };

    const subRes = await fetch(`${apiBase}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subPayload),
    });

    if (!subRes.ok) {
      const errBody = await subRes.text();
      console.error("PayPal create subscription failed:", errBody);
      await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", paymentIntent.id);
      return new Response(JSON.stringify({ error: "Failed to create PayPal subscription" }), { status: 502, headers: jsonHeaders });
    }

    const subData = await subRes.json();
    const approvalLink = subData.links?.find((l: any) => l.rel === "approve")?.href;

    await serviceClient.from("payment_intents").update({
      provider_subscription_id: subData.id,
      checkout_url: approvalLink,
      status: "awaiting_payment",
      metadata: subData,
    }).eq("id", paymentIntent.id);

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "paypal",
      event_type: "subscription_created",
      raw_payload: subData,
      provider_event_id: `${subData.id}_created`,
    });

    console.log("PayPal subscription created:", subData.id, "approval:", approvalLink);

    return new Response(JSON.stringify({
      payment_intent_id: paymentIntent.id,
      subscription_id: subData.id,
      approval_url: approvalLink,
      plan_name: plan.name,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paypal-create-subscription error:", err);
    return new Response(JSON.stringify({ error: "An error occurred." }), { status: 500, headers: jsonHeaders });
  }
});
