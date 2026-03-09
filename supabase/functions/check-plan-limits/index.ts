import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESOURCE_TO_PLAN_COL: Record<string, string> = {
  clients: "max_clients",
  active_events: "max_active_events",
  attendees: "max_attendees",
  emails: "max_emails",
  storage: "max_storage_gb",
};

const RESOURCE_TO_USAGE_KEY: Record<string, string> = {
  clients: "clients",
  active_events: "activeEvents",
  attendees: "attendees",
  emails: "emails",
  storage: "storageBytes",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 13);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ allowed: false, reason: "Unauthorized", correlationId }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { resource } = await req.json();
    if (!resource || !RESOURCE_TO_PLAN_COL[resource]) {
      return new Response(JSON.stringify({ allowed: false, reason: "Invalid resource type", correlationId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Get plan limits from subscription_plans table
    const { data: sub } = await serviceClient
      .from("account_subscriptions")
      .select("plan_id, subscription_plans(max_clients, max_active_events, max_attendees, max_emails, max_storage_gb)")
      .eq("user_id", user.id)
      .single();

    const planId = sub?.plan_id || "starter";
    const sp = (sub as any)?.subscription_plans;

    // Fallback limits if no plan found
    const planCol = RESOURCE_TO_PLAN_COL[resource];
    let limit = sp?.[planCol] ?? 0;
    // Enterprise-level huge numbers treated as Infinity
    if (limit >= 999999) limit = Infinity;

    // Get usage via RPC
    const { data: usageData } = await serviceClient.rpc("get_user_usage", { p_user_id: user.id });
    const usageKey = RESOURCE_TO_USAGE_KEY[resource];
    let currentUsage = (usageData as any)?.[usageKey] ?? 0;

    // For storage, convert bytes to GB for comparison
    if (resource === "storage") {
      currentUsage = currentUsage / (1024 * 1024 * 1024);
    }

    const allowed = limit === Infinity || currentUsage < limit;
    const isGrandfathered = currentUsage > limit && limit !== Infinity;

    console.log(`[check-plan-limits] ${correlationId} user=${user.id} plan=${planId} resource=${resource} usage=${currentUsage}/${limit} allowed=${allowed} grandfathered=${isGrandfathered}`);

    return new Response(
      JSON.stringify({ allowed, reason: allowed ? "OK" : `${resource} limit reached (${Math.round(currentUsage)}/${limit})`, currentUsage: Math.round(currentUsage), limit, planId, isGrandfathered, correlationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[check-plan-limits] ${correlationId} error:`, err.message);
    return new Response(
      JSON.stringify({ allowed: false, reason: "Internal error", correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
