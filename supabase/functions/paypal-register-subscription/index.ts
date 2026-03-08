import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

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

    const { plan_id, subscription_id } = await req.json();
    if (!plan_id || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing plan_id" }), { status: 400, headers: jsonHeaders });
    }
    if (!subscription_id || typeof subscription_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing subscription_id" }), { status: 400, headers: jsonHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get plan details
    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: jsonHeaders });
    }

    const internalOrderId = `TM-SUB-${crypto.randomUUID().slice(0, 8)}`;

    // Create payment intent
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
        status: "awaiting_payment",
        provider_subscription_id: subscription_id,
      })
      .select()
      .single();

    if (piError || !paymentIntent) {
      console.error("Failed to create payment intent:", piError);
      return new Response(JSON.stringify({ error: "Failed to record subscription" }), { status: 500, headers: jsonHeaders });
    }

    // Insert payment event
    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "paypal",
      event_type: "subscription_created",
      raw_payload: { subscription_id, plan_id, user_id: user.id },
      provider_event_id: `${subscription_id}_registered`,
    });

    // Update account_subscriptions
    await serviceClient.from("account_subscriptions").update({
      plan_id,
      provider: "paypal",
      provider_subscription_id: subscription_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Audit log
    await serviceClient.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action_type: "subscription_registered",
      target_id: paymentIntent.id,
      details: {
        plan_id,
        subscription_id,
        amount_cents: plan.monthly_price_cents,
      },
    });

    console.log("Subscription registered:", subscription_id, "for user:", user.id);

    return new Response(JSON.stringify({
      status: "registered",
      payment_intent_id: paymentIntent.id,
      subscription_id,
      plan_name: plan.name,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paypal-register-subscription error:", err);
    return new Response(JSON.stringify({ error: "An error occurred." }), { status: 500, headers: jsonHeaders });
  }
});
