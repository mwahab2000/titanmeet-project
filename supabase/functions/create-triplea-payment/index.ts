import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const TRIPLEA_API_BASE = "https://api.triple-a.io/api/v2";

async function getTripleAAccessToken(): Promise<string> {
  const clientId = Deno.env.get("TRIPLEA_CLIENT_ID");
  const clientSecret = Deno.env.get("TRIPLEA_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Triple-A credentials not configured");
  }

  const res = await fetch(`${TRIPLEA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Triple-A auth failed:", errText);
    throw new Error("Failed to authenticate with Triple-A");
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email;
    const { plan_id } = await req.json();

    if (!plan_id || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing plan_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountUsdCents = plan.monthly_price_cents;
    const amountUsd = (amountUsdCents / 100).toFixed(2);

    const { data: subscription } = await serviceClient
      .from("account_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single();

    const internalOrderId = `TM-${crypto.randomUUID().slice(0, 8)}`;

    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .insert({
        user_id: userId,
        subscription_id: subscription?.id || null,
        plan_id: plan_id,
        provider: "triple_a",
        internal_order_id: internalOrderId,
        amount_usd_cents: amountUsdCents,
        currency: "USD",
        status: "pending",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (piError || !paymentIntent) {
      console.error("Failed to create payment intent:", piError);
      return new Response(JSON.stringify({ error: "Failed to create payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getTripleAAccessToken();
    const merchantId = Deno.env.get("TRIPLEA_MERCHANT_ID");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/triplea-webhook`;
    const successUrl = Deno.env.get("TRIPLEA_SUCCESS_URL") || "https://titanmeet.com/dashboard/billing?payment=success";
    const cancelUrl = Deno.env.get("TRIPLEA_CANCEL_URL") || "https://titanmeet.com/dashboard/billing?payment=cancelled";

    const tripleAPayload: Record<string, unknown> = {
      type: "widget",
      merchant_key: merchantId,
      order_currency: "USD",
      order_amount: parseFloat(amountUsd),
      payer_id: userId,
      order_id: internalOrderId,
      notify_url: webhookUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
      notify_secret: Deno.env.get("TRIPLEA_WEBHOOK_SECRET") || "",
    };

    if (userEmail) {
      tripleAPayload.payer_email = userEmail;
    }

    console.log("Creating Triple-A payment for order:", internalOrderId, "amount:", amountUsd);

    const tripleARes = await fetch(`${TRIPLEA_API_BASE}/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tripleAPayload),
    });

    if (!tripleARes.ok) {
      const errBody = await tripleARes.text();
      console.error("Triple-A create payment failed:", errBody);

      await serviceClient
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("id", paymentIntent.id);

      return new Response(JSON.stringify({ error: "Failed to create crypto payment" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tripleAData = await tripleARes.json();
    const checkoutUrl = tripleAData.hosted_url || tripleAData.payment_url || null;

    await serviceClient
      .from("payment_intents")
      .update({
        provider_payment_id: tripleAData.payment_reference || tripleAData.id || null,
        checkout_url: checkoutUrl,
        status: "awaiting_payment",
        metadata: tripleAData,
      })
      .eq("id", paymentIntent.id);

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "triple_a",
      event_type: "payment_created",
      raw_payload: tripleAData,
      provider_event_id: `${internalOrderId}_created`,
    });

    console.log("Triple-A payment created. Checkout URL:", checkoutUrl);

    return new Response(
      JSON.stringify({
        payment_intent_id: paymentIntent.id,
        checkout_url: checkoutUrl,
        order_id: internalOrderId,
        status: "awaiting_payment",
        amount_usd: amountUsd,
        plan_name: plan.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-triplea-payment error:", err);
    return new Response(JSON.stringify({ error: "An error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
