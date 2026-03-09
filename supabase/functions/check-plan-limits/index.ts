import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  starter: { clients: 3, active_events: 5, attendees: 500, emails: 2000, storage_gb: 5 },
  professional: { clients: 15, active_events: 25, attendees: 5000, emails: 20000, storage_gb: 25 },
  enterprise: { clients: 999999, active_events: 999999, attendees: 50000, emails: 200000, storage_gb: 100 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 13);

  try {
    // Auth
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
    if (!resource || !["clients", "active_events", "attendees", "emails", "storage"].includes(resource)) {
      return new Response(JSON.stringify({ allowed: false, reason: "Invalid resource type", correlationId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Get user's plan
    const { data: sub } = await serviceClient
      .from("account_subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .single();

    const planId = sub?.plan_id || "starter";
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
    const limit = limits[resource] ?? 0;

    // Billing cycle start
    const cycleStart = new Date();
    cycleStart.setDate(1);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleISO = cycleStart.toISOString();

    let currentUsage = 0;

    if (resource === "clients") {
      const { count } = await serviceClient.from("clients").select("id", { count: "exact", head: true }).eq("created_by", user.id);
      currentUsage = count || 0;
    } else if (resource === "active_events") {
      const { count } = await serviceClient.from("events").select("id", { count: "exact", head: true }).eq("created_by", user.id).in("status", ["draft", "published", "ongoing"]);
      currentUsage = count || 0;
    } else if (resource === "attendees") {
      // Count attendees across user's events this month
      const { data: eventIds } = await serviceClient.from("events").select("id").eq("created_by", user.id);
      if (eventIds && eventIds.length > 0) {
        const ids = eventIds.map((e: any) => e.id);
        const { count } = await serviceClient.from("attendees").select("id", { count: "exact", head: true }).in("event_id", ids);
        currentUsage = count || 0;
      }
    } else if (resource === "emails") {
      const { data: eventIds } = await serviceClient.from("events").select("id").eq("created_by", user.id);
      if (eventIds && eventIds.length > 0) {
        const ids = eventIds.map((e: any) => e.id);
        const { count } = await serviceClient.from("communications_log").select("id", { count: "exact", head: true }).eq("channel", "email").in("event_id", ids).gte("created_at", cycleISO);
        currentUsage = count || 0;
      }
    }

    const allowed = currentUsage < limit;

    console.log(`[check-plan-limits] ${correlationId} user=${user.id} plan=${planId} resource=${resource} usage=${currentUsage}/${limit} allowed=${allowed}`);

    return new Response(
      JSON.stringify({ allowed, reason: allowed ? "OK" : `${resource} limit reached (${currentUsage}/${limit})`, currentUsage, limit, planId, correlationId }),
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
