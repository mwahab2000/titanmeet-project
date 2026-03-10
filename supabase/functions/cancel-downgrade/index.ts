import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Cancels a previously scheduled downgrade by reverting the Paddle subscription
 * back to the current plan's price and clearing scheduled_plan fields.
 */
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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sub } = await serviceClient
      .from("account_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!sub || !sub.provider_subscription_id || !sub.scheduled_plan) {
      return new Response(JSON.stringify({ error: "No scheduled downgrade found" }), { status: 404, headers: jsonHeaders });
    }

    // Revert Paddle subscription to current plan price
    const billingInterval = sub.purchase_type === "annual" ? "ANNUAL" : "MONTHLY";
    const currentPriceId = Deno.env.get(`PADDLE_PRICE_${sub.plan_id.toUpperCase()}_${billingInterval}`) || "";

    if (currentPriceId) {
      const paddleApiKey = Deno.env.get("PADDLE_API_KEY")!;
      const paddleEnv = (Deno.env.get("PADDLE_API_BASE") || "sandbox").includes("sandbox") ? "sandbox" : "live";
      const apiBase = paddleEnv === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

      await fetch(`${apiBase}/subscriptions/${sub.provider_subscription_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: currentPriceId, quantity: 1 }],
          proration_billing_mode: "do_not_bill",
        }),
      });
    }

    // Clear scheduled change in DB
    await serviceClient.from("account_subscriptions").update({
      scheduled_plan: null,
      scheduled_change_date: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("cancel-downgrade error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), { status: 500, headers: jsonHeaders });
  }
});
