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

    const { newPlanSlug } = await req.json();
    if (!newPlanSlug || !["starter", "professional", "enterprise"].includes(newPlanSlug)) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: jsonHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's subscription
    const { data: sub, error: subError } = await serviceClient
      .from("account_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError || !sub || !sub.provider_subscription_id) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), { status: 404, headers: jsonHeaders });
    }

    // Determine the price ID for the new plan
    // We need to look up the Paddle price ID from env vars
    const billingInterval = sub.purchase_type === "annual" ? "ANNUAL" : "MONTHLY";
    const priceEnvKey = `VITE_PADDLE_PRICE_${newPlanSlug.toUpperCase()}_${billingInterval}`;
    // Edge functions don't have VITE_ vars — use non-prefixed versions
    const newPriceId = Deno.env.get(`PADDLE_PRICE_${newPlanSlug.toUpperCase()}_${billingInterval}`)
      || Deno.env.get(priceEnvKey)
      || "";

    if (!newPriceId) {
      return new Response(JSON.stringify({ error: "Price ID not configured for target plan" }), { status: 500, headers: jsonHeaders });
    }

    // Call Paddle API to schedule the plan change
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleApiKey) {
      return new Response(JSON.stringify({ error: "Paddle API key not configured" }), { status: 500, headers: jsonHeaders });
    }

    const paddleEnv = (Deno.env.get("PADDLE_API_BASE") || "sandbox").includes("sandbox") ? "sandbox" : "live";
    const apiBase = paddleEnv === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

    const updateRes = await fetch(`${apiBase}/subscriptions/${sub.provider_subscription_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: newPriceId, quantity: 1 }],
        proration_billing_mode: "do_not_bill",
        on_payment_failure: "prevent_change",
      }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      console.error("Paddle schedule change failed:", updateRes.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to schedule plan change with Paddle" }), { status: 502, headers: jsonHeaders });
    }

    // Update local DB with scheduled change
    await serviceClient.from("account_subscriptions").update({
      scheduled_plan: newPlanSlug,
      scheduled_change_date: sub.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Audit log
    try {
      await serviceClient.from("admin_audit_log").insert({
        actor_user_id: user.id,
        action_type: "plan_change_scheduled",
        target_id: sub.id,
        details: {
          provider: "paddle",
          subscription_id: sub.provider_subscription_id,
          from_plan: sub.plan_id,
          to_plan: newPlanSlug,
          effective_date: sub.current_period_end,
        },
      });
    } catch { /* swallow */ }

    console.log("Plan change scheduled for user:", user.id, "to:", newPlanSlug);

    return new Response(JSON.stringify({
      success: true,
      scheduled_plan: newPlanSlug,
      effective_date: sub.current_period_end,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("schedule-plan-change error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), { status: 500, headers: jsonHeaders });
  }
});
