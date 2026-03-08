import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

// --- Env validation helper ---
function requireEnv(name: string): string | null {
  return Deno.env.get(name) || null;
}

async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  apiBase: string,
  correlationId: string
): Promise<{ token?: string; error?: Response }> {
  try {
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
      console.error(`[${correlationId}] PayPal auth failed: status=${res.status} body=${errText.slice(0, 500)}`);
      return {
        error: new Response(
          JSON.stringify({
            code: "paypal_token_failed",
            correlationId,
            status: res.status,
            bodySnippet: errText.slice(0, 200),
          }),
          { status: 502 }
        ),
      };
    }

    const data = await res.json();
    return { token: data.access_token };
  } catch (err) {
    console.error(`[${correlationId}] PayPal auth exception:`, err);
    return {
      error: new Response(
        JSON.stringify({
          code: "paypal_token_failed",
          correlationId,
          message: String(err),
        }),
        { status: 502 }
      ),
    };
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return handleCorsOptions(req);

  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const correlationId = crypto.randomUUID().slice(0, 12);

  console.log(`[${correlationId}] paypal-create-order invoked, method=${req.method}`);

  try {
    // 1) Validate environment variables
    const paypalClientId = requireEnv("PAYPAL_CLIENT_ID");
    const paypalClientSecret = requireEnv("PAYPAL_CLIENT_SECRET");
    const paypalApiBase = requireEnv("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const missingEnv: string[] = [];
    if (!paypalClientId) missingEnv.push("PAYPAL_CLIENT_ID");
    if (!paypalClientSecret) missingEnv.push("PAYPAL_CLIENT_SECRET");
    if (!supabaseUrl) missingEnv.push("SUPABASE_URL");
    if (!supabaseAnonKey) missingEnv.push("SUPABASE_ANON_KEY");
    if (!supabaseServiceKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missingEnv.length > 0) {
      console.error(`[${correlationId}] Missing env vars:`, missingEnv);
      return new Response(
        JSON.stringify({ code: "missing_env", correlationId, missing: missingEnv }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // 2) Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn(`[${correlationId}] No auth header`);
      return new Response(
        JSON.stringify({ code: "unauthorized", correlationId, message: "Missing Authorization header" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn(`[${correlationId}] Auth failed:`, userError?.message);
      return new Response(
        JSON.stringify({ code: "unauthorized", correlationId, message: userError?.message || "Invalid token" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] Authenticated user=${user.id}`);

    // 3) Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ code: "invalid_json", correlationId }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { plan_id } = body;
    if (!plan_id || typeof plan_id !== "string") {
      return new Response(
        JSON.stringify({ code: "missing_fields", correlationId, missing: ["plan_id"], received: typeof plan_id }),
        { status: 400, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] plan_id=${plan_id}`);

    // 4) Fetch plan from DB using service role client
    const serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);

    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError) {
      console.error(`[${correlationId}] Plan query error: code=${planError.code} msg=${planError.message} details=${planError.details}`);
      return new Response(
        JSON.stringify({
          code: "plan_query_failed",
          correlationId,
          dbError: planError.message,
          dbCode: planError.code,
          hint: planError.hint,
          plan_id,
        }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (!plan) {
      console.error(`[${correlationId}] Plan not found for id="${plan_id}"`);
      return new Response(
        JSON.stringify({ code: "plan_not_found", correlationId, plan_id }),
        { status: 404, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] Plan found: name=${plan.name} price=${plan.monthly_price_cents}c`);

    const amountUsd = (plan.monthly_price_cents / 100).toFixed(2);
    const internalOrderId = `TM-${crypto.randomUUID().slice(0, 8)}`;

    // 5) Create payment intent
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
      console.error(`[${correlationId}] payment_intent insert failed:`, piError?.message, piError?.code);
      return new Response(
        JSON.stringify({
          code: "payment_intent_failed",
          correlationId,
          dbError: piError?.message,
        }),
        { status: 500, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] Payment intent created: id=${paymentIntent.id}`);

    // 6) Create PayPal order
    const tokenResult = await getPayPalAccessToken(
      paypalClientId!,
      paypalClientSecret!,
      paypalApiBase,
      correlationId
    );

    if (tokenResult.error) {
      // Update payment intent to failed
      await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", paymentIntent.id);
      // Clone the error response to add CORS headers
      const errBody = await tokenResult.error.text();
      return new Response(errBody, { status: 502, headers: jsonHeaders });
    }

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: internalOrderId,
          description: `TitanMeet ${plan.name} Plan - 30 days`,
          amount: { currency_code: "USD", value: amountUsd },
        },
      ],
      application_context: {
        brand_name: "TitanMeet",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
      },
    };

    console.log(`[${correlationId}] Creating PayPal order: ${amountUsd} USD`);

    const orderRes = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error(`[${correlationId}] PayPal create order failed: status=${orderRes.status} body=${errBody.slice(0, 500)}`);
      await serviceClient.from("payment_intents").update({ status: "failed" }).eq("id", paymentIntent.id);
      return new Response(
        JSON.stringify({
          code: "paypal_order_failed",
          correlationId,
          status: orderRes.status,
          bodySnippet: errBody.slice(0, 200),
        }),
        { status: 502, headers: jsonHeaders }
      );
    }

    const orderData = await orderRes.json();
    const approveUrl = orderData.links?.find((l: any) => l.rel === "approve")?.href;

    console.log(`[${correlationId}] PayPal order created: orderId=${orderData.id}`);

    // 7) Update payment intent with PayPal order info
    await serviceClient
      .from("payment_intents")
      .update({
        provider_payment_id: orderData.id,
        status: "awaiting_payment",
        metadata: orderData,
      })
      .eq("id", paymentIntent.id);

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "paypal",
      event_type: "order_created",
      raw_payload: orderData,
      provider_event_id: `${orderData.id}_created`,
    });

    // 8) Return success
    return new Response(
      JSON.stringify({
        payment_intent_id: paymentIntent.id,
        order_id: orderData.id,
        orderId: orderData.id,
        approveUrl,
        status: "awaiting_payment",
        amount_usd: amountUsd,
        plan_name: plan.name,
        correlationId,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error(`[${correlationId}] Unhandled error:`, err);
    return new Response(
      JSON.stringify({
        code: "internal_error",
        correlationId,
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

// Test with:
// curl -X POST https://qclaciklevavttipztrv.supabase.co/functions/v1/paypal-create-order \
//   -H "Authorization: Bearer <access_token>" \
//   -H "apikey: <anon_key>" \
//   -H "Content-Type: application/json" \
//   -d '{"plan_id":"starter"}'
