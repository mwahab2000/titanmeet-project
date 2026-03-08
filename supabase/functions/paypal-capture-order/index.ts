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

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: jsonHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find payment intent by provider_payment_id (PayPal order id)
    const { data: paymentIntent } = await serviceClient
      .from("payment_intents")
      .select("*")
      .eq("provider_payment_id", order_id)
      .eq("user_id", user.id)
      .single();

    if (!paymentIntent) {
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: jsonHeaders });
    }

    // Idempotent: if already paid/confirmed, return success
    if (paymentIntent.status === "paid" || paymentIntent.status === "confirmed") {
      return new Response(JSON.stringify({ status: "already_captured", payment_intent_id: paymentIntent.id }), { status: 200, headers: jsonHeaders });
    }

    // Capture the PayPal order
    const accessToken = await getPayPalAccessToken();
    const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";

    const captureRes = await fetch(`${apiBase}/v2/checkout/orders/${order_id}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok || captureData.status !== "COMPLETED") {
      console.error("PayPal capture failed:", JSON.stringify(captureData));

      await serviceClient.from("payment_events").insert({
        payment_intent_id: paymentIntent.id,
        provider: "paypal",
        event_type: "error",
        raw_payload: captureData,
        provider_event_id: `${order_id}_capture_failed`,
      });

      return new Response(JSON.stringify({ error: "Payment capture failed" }), { status: 502, headers: jsonHeaders });
    }

    // Update payment intent
    await serviceClient.from("payment_intents").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: captureData,
    }).eq("id", paymentIntent.id);

    await serviceClient.from("payment_events").insert({
      payment_intent_id: paymentIntent.id,
      provider: "paypal",
      event_type: "captured",
      raw_payload: captureData,
      provider_event_id: `${order_id}_captured`,
    });

    // Update entitlement: access_until = max(existing, now + 30 days)
    const now = new Date();
    const newAccessUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: existingEnt } = await serviceClient
      .from("account_entitlements")
      .select("access_until")
      .eq("user_id", paymentIntent.user_id)
      .maybeSingle();

    const finalAccessUntil = existingEnt?.access_until
      ? new Date(Math.max(new Date(existingEnt.access_until).getTime(), newAccessUntil.getTime()))
      : newAccessUntil;

    await serviceClient.from("account_entitlements").upsert({
      user_id: paymentIntent.user_id,
      access_until: finalAccessUntil.toISOString(),
      source: "one_time_30d",
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

    // Update account subscription period
    await serviceClient.from("account_subscriptions").update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: finalAccessUntil.toISOString(),
    }).eq("user_id", paymentIntent.user_id);

    // Audit log
    await serviceClient.from("admin_audit_log").insert({
      actor_user_id: paymentIntent.user_id,
      action_type: "one_time_30d_paid",
      target_id: paymentIntent.id,
      details: {
        plan_id: paymentIntent.plan_id,
        amount_cents: paymentIntent.amount_usd_cents,
        order_id,
      },
    });

    // Notifications
    await serviceClient.rpc("create_notification", {
      _user_id: paymentIntent.user_id,
      _type: "payment_confirmed",
      _title: "Payment confirmed",
      _message: `Your payment of $${(paymentIntent.amount_usd_cents / 100).toFixed(2)} has been confirmed. Access active for 30 days.`,
      _link: "/dashboard/billing",
    });

    console.log("PayPal order captured:", order_id, "access until:", finalAccessUntil.toISOString());

    return new Response(JSON.stringify({
      status: "paid",
      payment_intent_id: paymentIntent.id,
      access_until: finalAccessUntil.toISOString(),
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paypal-capture-order error:", err);
    return new Response(JSON.stringify({ error: "An error occurred." }), { status: 500, headers: jsonHeaders });
  }
});
