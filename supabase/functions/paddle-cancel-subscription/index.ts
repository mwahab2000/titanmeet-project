import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Authenticate user
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

    // Get user's subscription
    const { data: sub, error: subError } = await serviceClient
      .from("account_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError || !sub || !sub.provider_subscription_id) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), { status: 404, headers: jsonHeaders });
    }

    if (sub.cancel_at_period_end) {
      return new Response(JSON.stringify({ success: true, message: "Already canceling" }), { status: 200, headers: jsonHeaders });
    }

    // Call Paddle API to cancel
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleApiKey) {
      return new Response(JSON.stringify({ error: "Paddle API key not configured" }), { status: 500, headers: jsonHeaders });
    }

    const paddleEnv = (Deno.env.get("PADDLE_API_BASE") || "sandbox").includes("sandbox") ? "sandbox" : "live";
    const apiBase = paddleEnv === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

    const cancelRes = await fetch(`${apiBase}/subscriptions/${sub.provider_subscription_id}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });

    if (!cancelRes.ok) {
      const errBody = await cancelRes.text();
      console.error("Paddle cancel failed:", cancelRes.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to cancel subscription with Paddle" }), { status: 502, headers: jsonHeaders });
    }

    // Update local DB
    await serviceClient.from("account_subscriptions").update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Audit log
    try {
      await serviceClient.from("admin_audit_log").insert({
        actor_user_id: user.id,
        action_type: "subscription_cancelled",
        target_id: sub.id,
        details: { provider: "paddle", subscription_id: sub.provider_subscription_id },
      });
    } catch { /* swallow */ }

    console.log("Subscription cancelled for user:", user.id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("paddle-cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), { status: 500, headers: jsonHeaders });
  }
});
