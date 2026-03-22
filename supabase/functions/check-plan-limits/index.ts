import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ------------------------------------------------------------------ */
/*  Resource definitions                                               */
/* ------------------------------------------------------------------ */

interface ResourceDef {
  planCol: string;
  usageKey: string;
  label: string;
  errorCode: string;
  isHard: boolean; // hard = block at limit; soft = warn at 80%, block at 100%
}

const RESOURCES: Record<string, ResourceDef> = {
  clients:            { planCol: "max_clients",            usageKey: "clients",      label: "clients",                errorCode: "PLAN_LIMIT_EXCEEDED_CLIENTS",     isHard: true },
  active_events:      { planCol: "max_active_events",      usageKey: "activeEvents", label: "events / month",         errorCode: "PLAN_LIMIT_EXCEEDED_EVENTS",      isHard: true },
  attendees_per_event:{ planCol: "max_attendees_per_event", usageKey: "",            label: "attendees per event",    errorCode: "PLAN_LIMIT_EXCEEDED_ATTENDEES",   isHard: true },
  admin_users:        { planCol: "max_admin_users",        usageKey: "",             label: "admin users",            errorCode: "PLAN_LIMIT_EXCEEDED_ADMIN_USERS", isHard: true },
  emails:             { planCol: "max_emails",             usageKey: "emails",       label: "emails / month",         errorCode: "PLAN_LIMIT_EXCEEDED_EMAILS",      isHard: false },
  whatsapp:           { planCol: "max_whatsapp_sends",     usageKey: "",             label: "WhatsApp messages / month", errorCode: "PLAN_LIMIT_EXCEEDED_WHATSAPP", isHard: false },
  ai_prompts:         { planCol: "max_ai_requests",        usageKey: "",             label: "AI Builder prompts / month", errorCode: "PLAN_LIMIT_EXCEEDED_AI_PROMPTS", isHard: false },
  ai_images:          { planCol: "max_ai_images",          usageKey: "",             label: "AI images / month",      errorCode: "PLAN_LIMIT_EXCEEDED_AI_IMAGES",   isHard: false },
  brand_kits:         { planCol: "max_brand_kits",         usageKey: "",             label: "brand kits",             errorCode: "PLAN_LIMIT_EXCEEDED_BRAND_KITS",  isHard: true },
  storage:            { planCol: "max_storage_gb",         usageKey: "storageBytes", label: "storage (GB)",           errorCode: "PLAN_LIMIT_EXCEEDED_STORAGE",     isHard: false },
};

const FEATURE_GATES: Record<string, string> = {
  segmentation:        "has_segmentation",
  workspace_analytics: "has_workspace_analytics",
  live_dashboard:      "has_live_dashboard",
};

const PLAN_SELECT_COLS = [
  "max_clients", "max_active_events", "max_attendees_per_event", "max_admin_users",
  "max_emails", "max_whatsapp_sends", "max_ai_requests", "max_ai_images",
  "max_brand_kits", "max_storage_gb", "max_maps_searches", "max_maps_photos",
  "has_segmentation", "has_workspace_analytics", "has_live_dashboard",
  "has_ai_concierge", "campaign_tier", "support_tier", "burst_per_minute",
].join(", ");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function effectiveLimit(raw: number | null | undefined, fallback = 0): number {
  const v = raw ?? fallback;
  return v >= 999999 ? Infinity : v;
}

function computePercent(used: number, limit: number): number {
  if (limit === Infinity) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

async function getUsageCount(
  serviceClient: any,
  userId: string,
  resource: string,
  eventId?: string,
): Promise<number> {
  // For resources with RPC-based usage
  if (RESOURCES[resource]?.usageKey && RESOURCES[resource].usageKey !== "") {
    const { data } = await serviceClient.rpc("get_user_usage", { p_user_id: userId });
    const key = RESOURCES[resource].usageKey;
    let val = (data as any)?.[key] ?? 0;
    if (resource === "storage") val = val / (1024 * 1024 * 1024);
    return val;
  }

  // Custom queries per resource type
  switch (resource) {
    case "attendees_per_event": {
      if (!eventId) return 0;
      const { count } = await serviceClient
        .from("attendees")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      return count ?? 0;
    }
    case "admin_users": {
      const { count } = await serviceClient
        .from("user_roles")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    }
    case "whatsapp": {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const { data } = await serviceClient
        .from("api_usage_tracking")
        .select("usage_count")
        .eq("user_id", userId)
        .eq("resource_type", "whatsapp_sends")
        .gte("period_start", periodStart.toISOString());
      return (data || []).reduce((sum: number, r: any) => sum + (r.usage_count || 0), 0);
    }
    case "ai_prompts": {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const { data } = await serviceClient
        .from("api_usage_tracking")
        .select("usage_count")
        .eq("user_id", userId)
        .eq("resource_type", "ai_requests")
        .gte("period_start", periodStart.toISOString());
      return (data || []).reduce((sum: number, r: any) => sum + (r.usage_count || 0), 0);
    }
    case "ai_images": {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const { data } = await serviceClient
        .from("api_usage_tracking")
        .select("usage_count")
        .eq("user_id", userId)
        .eq("resource_type", "ai_heavy")
        .gte("period_start", periodStart.toISOString());
      return (data || []).reduce((sum: number, r: any) => sum + (r.usage_count || 0), 0);
    }
    case "brand_kits": {
      const { count } = await serviceClient
        .from("brand_kits")
        .select("id", { count: "exact", head: true })
        .eq("created_by", userId);
      return count ?? 0;
    }
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

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

    // Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ allowed: false, error_code: "UNAUTHORIZED", correlationId }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { resource, feature, event_id } = body;

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get plan from subscription
    const { data: sub } = await serviceClient
      .from("account_subscriptions")
      .select(`plan_id, provider, current_period_start, current_period_end, subscription_plans(${PLAN_SELECT_COLS})`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planId = sub?.plan_id || "starter";
    const sp = (sub as any)?.subscription_plans || {};

    // ---- Feature gate check ----
    if (feature) {
      const col = FEATURE_GATES[feature];
      if (!col) {
        return new Response(JSON.stringify({
          allowed: false,
          error_code: "INVALID_FEATURE",
          message: `Unknown feature: ${feature}`,
          correlationId,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const hasFeature = sp[col] === true || sp[col] === "basic" || sp[col] === "advanced";
      console.log(`[check-plan-limits] ${correlationId} feature=${feature} plan=${planId} has=${hasFeature}`);

      return new Response(JSON.stringify({
        allowed: hasFeature,
        error_code: hasFeature ? null : "FEATURE_NOT_AVAILABLE_ON_PLAN",
        message: hasFeature ? "OK" : `${feature} is not available on your ${planId} plan. Upgrade to access this feature.`,
        plan_id: planId,
        feature,
        upgrade_recommended: !hasFeature,
        correlationId,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Resource quota check ----
    if (!resource || !RESOURCES[resource]) {
      return new Response(JSON.stringify({
        allowed: false,
        error_code: "INVALID_RESOURCE",
        message: `Invalid resource type: ${resource}`,
        correlationId,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const def = RESOURCES[resource];
    const limit = effectiveLimit(sp[def.planCol]);
    const currentUsage = await getUsageCount(serviceClient, user.id, resource, event_id);

    // Check for per-user override (grandfathering)
    const { data: override } = await serviceClient
      .from("plan_limit_overrides")
      .select("custom_limit, is_grandfathered")
      .eq("user_id", user.id)
      .eq("resource", resource)
      .maybeSingle();

    const effectiveLimitVal = override?.custom_limit != null ? effectiveLimit(override.custom_limit) : limit;
    const isGrandfathered = override?.is_grandfathered === true || (currentUsage > effectiveLimitVal && effectiveLimitVal !== Infinity);

    const percent = computePercent(currentUsage, effectiveLimitVal);
    const allowed = effectiveLimitVal === Infinity || currentUsage < effectiveLimitVal;

    // Warning thresholds
    const WARNING_THRESHOLD = 80;
    const warningLevel = percent >= 100 ? "hard_block" : percent >= WARNING_THRESHOLD ? "soft_warning" : "ok";

    console.log(`[check-plan-limits] ${correlationId} user=${user.id} plan=${planId} resource=${resource} usage=${currentUsage}/${effectiveLimitVal} allowed=${allowed} level=${warningLevel}`);

    const friendlyMessage = allowed
      ? (warningLevel === "soft_warning"
        ? `You've used ${percent}% of your monthly ${def.label} limit (${Math.round(currentUsage)}/${effectiveLimitVal === Infinity ? "∞" : effectiveLimitVal}).`
        : "OK")
      : `You've reached your ${def.label} limit (${Math.round(currentUsage)}/${effectiveLimitVal}). Upgrade your plan to continue.`;

    return new Response(JSON.stringify({
      allowed,
      error_code: allowed ? null : def.errorCode,
      message: friendlyMessage,
      current_usage: Math.round(currentUsage),
      limit: effectiveLimitVal === Infinity ? null : effectiveLimitVal,
      percent,
      plan_id: planId,
      warning_level: warningLevel,
      is_grandfathered: isGrandfathered,
      upgrade_recommended: !allowed || warningLevel === "soft_warning",
      resource,
      correlationId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[check-plan-limits] ${correlationId} error:`, err.message);
    return new Response(JSON.stringify({
      allowed: false,
      error_code: "INTERNAL_ERROR",
      message: "An internal error occurred while checking plan limits.",
      correlationId,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
