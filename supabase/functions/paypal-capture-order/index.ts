import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  apiBase: string,
  correlationId: string
): Promise<{ token?: string; error?: string }> {
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
      return { error: `PayPal auth failed (${res.status})` };
    }
    const data = await res.json();
    return { token: data.access_token };
  } catch (err) {
    console.error(`[${correlationId}] PayPal auth exception:`, err);
    return { error: String(err) };
  }
}

Deno.serve(async (req) => {
  // Top-level correlationId for logging — declared outside try so catch can use it
  let correlationId = "unknown";
  let jsonHeaders: Record<string, string> = { "Content-Type": "application/json" };

  try {
    if (req.method === "OPTIONS") return handleCorsOptions(req);

    const corsHeaders = getCorsHeaders(req);
    jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
    correlationId = crypto.randomUUID().slice(0, 12);

    console.log(`[${correlationId}] paypal-capture-order invoked, method=${req.method}`);

    // 1) Validate env
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const paypalApiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
      return new Response(
        JSON.stringify({ code: "unauthorized", correlationId }),
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

    // 3) Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ code: "invalid_json", correlationId }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const orderId = (body.order_id || body.orderID) as string | undefined;
    if (!orderId) {
      return new Response(
        JSON.stringify({ code: "missing_fields", correlationId, missing: ["order_id"] }),
        { status: 400, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] order_id=${orderId}`);

    // 4) Service role client for DB ops
    const serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);

    // Find payment intent
    const { data: paymentIntent, error: piError } = await serviceClient
      .from("payment_intents")
      .select("*")
      .eq("provider_payment_id", orderId)
      .eq("user_id", user.id)
      .single();

    if (piError || !paymentIntent) {
      console.error(`[${correlationId}] Payment intent not found: order=${orderId} user=${user.id}`, piError?.message);
      return new Response(
        JSON.stringify({ code: "payment_not_found", correlationId, order_id: orderId }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // Idempotent check
    if (paymentIntent.status === "paid" || paymentIntent.status === "confirmed") {
      console.log(`[${correlationId}] Already captured, returning success`);
      return new Response(
        JSON.stringify({ status: "already_captured", payment_intent_id: paymentIntent.id, correlationId }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // 5) Get PayPal access token
    const tokenResult = await getPayPalAccessToken(paypalClientId!, paypalClientSecret!, paypalApiBase, correlationId);
    if (tokenResult.error || !tokenResult.token) {
      try {
        await serviceClient.from("payment_events").insert({
          payment_intent_id: paymentIntent.id,
          provider: "paypal",
          event_type: "error",
          raw_payload: { error: tokenResult.error },
          provider_event_id: `${orderId}_token_failed`,
        });
      } catch { /* swallow */ }
      return new Response(
        JSON.stringify({ code: "paypal_token_failed", correlationId, error: tokenResult.error }),
        { status: 502, headers: jsonHeaders }
      );
    }

    // 6) Capture PayPal order
    console.log(`[${correlationId}] Capturing PayPal order ${orderId}`);
    const captureRes = await fetch(`${paypalApiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
    });

    const captureData = await captureRes.json();
    const paypalDebugId = captureRes.headers.get("paypal-debug-id") || captureData.debug_id || null;

    if (!captureRes.ok || captureData.status !== "COMPLETED") {
      const errorDetails = captureData.details?.[0] || {};
      const issueCode = errorDetails.issue || captureData.name || "UNKNOWN";
      const issueDesc = errorDetails.description || captureData.message || "Capture failed";

      // Log at warn level for expected sandbox issues, error for unexpected
      const isSandboxExpected = issueCode === "COMPLIANCE_VIOLATION" || issueCode === "INSTRUMENT_DECLINED";
      const logFn = isSandboxExpected ? console.warn : console.error;
      logFn(`[${correlationId}] PayPal capture failed: status=${captureRes.status} issue=${issueCode} debug_id=${paypalDebugId}`);

      try {
        await serviceClient.from("payment_events").insert({
          payment_intent_id: paymentIntent.id,
          provider: "paypal",
          event_type: "capture_failed",
          raw_payload: captureData,
          provider_event_id: `${orderId}_capture_failed`,
        });
      } catch { /* swallow */ }

      let userMessage = "Payment capture failed. Please try again.";
      let httpStatus = 502;

      if (issueCode === "COMPLIANCE_VIOLATION") {
        userMessage = "Card/guest checkout is not supported in the PayPal sandbox. Please use a PayPal sandbox buyer account to complete payment.";
        httpStatus = 422;
      } else if (issueCode === "INSTRUMENT_DECLINED") {
        userMessage = "The payment method was declined. Please try a different payment method or use your PayPal account.";
        httpStatus = 422;
      } else if (issueCode === "ORDER_NOT_APPROVED") {
        userMessage = "The order was not approved. Please complete the PayPal checkout before capturing.";
        httpStatus = 400;
      }

      return new Response(
        JSON.stringify({
          code: issueCode === "COMPLIANCE_VIOLATION" ? "sandbox_card_not_supported" : "paypal_capture_failed",
          correlationId,
          issue: issueCode,
          description: issueDesc,
          debug_id: paypalDebugId,
          error: userMessage,
        }),
        { status: httpStatus, headers: jsonHeaders }
      );
    }

    console.log(`[${correlationId}] PayPal order captured successfully: ${orderId}`);

    // 7) Update payment intent
    await serviceClient.from("payment_intents").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: captureData,
    }).eq("id", paymentIntent.id);

    try {
      await serviceClient.from("payment_events").insert({
        payment_intent_id: paymentIntent.id,
        provider: "paypal",
        event_type: "captured",
        raw_payload: captureData,
        provider_event_id: `${orderId}_captured`,
      });
    } catch { /* swallow */ }

    // 8) Update entitlement
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

    // 9) Update subscription period
    await serviceClient.from("account_subscriptions").update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: finalAccessUntil.toISOString(),
    }).eq("user_id", paymentIntent.user_id);

    // 10) Audit log
    await serviceClient.from("admin_audit_log").insert({
      actor_user_id: paymentIntent.user_id,
      action_type: "one_time_30d_paid",
      target_id: paymentIntent.id,
      details: {
        plan_id: paymentIntent.plan_id,
        amount_cents: paymentIntent.amount_usd_cents,
        order_id: orderId,
      },
    }).catch(() => {/* swallow */});

    // 11) Notification
    await serviceClient.rpc("create_notification", {
      _user_id: paymentIntent.user_id,
      _type: "payment_confirmed",
      _title: "Payment confirmed",
      _message: `Your payment of $${(paymentIntent.amount_usd_cents / 100).toFixed(2)} has been confirmed. Access active for 30 days.`,
      _link: "/dashboard/billing",
    }).catch(() => {/* swallow */});

    console.log(`[${correlationId}] Complete. access_until=${finalAccessUntil.toISOString()}`);

    return new Response(
      JSON.stringify({
        status: "paid",
        payment_intent_id: paymentIntent.id,
        access_until: finalAccessUntil.toISOString(),
        correlationId,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ code: "internal_error", correlationId, error: message }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

// Test with:
// curl -X POST https://qclaciklevavttipztrv.supabase.co/functions/v1/paypal-capture-order \
//   -H "Authorization: Bearer <access_token>" \
//   -H "apikey: <anon_key>" \
//   -H "Content-Type: application/json" \
//   -d '{"order_id":"<paypal_order_id>"}'
