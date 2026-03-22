import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ResourceStatus {
  used: number;
  limit: number;
  percent: number;
  /** Hard = block at limit (clients, events); Soft = warn 80%, block 100% */
  isHard: boolean;
  /** True when existing usage already exceeds limit (grandfathered) */
  grandfathered: boolean;
}

export interface FeatureGates {
  segmentation: boolean;
  workspaceAnalytics: boolean;
  liveDashboard: boolean;
  aiConcierge: string; // 'none' | 'basic' | 'advanced'
  campaignTier: string; // 'basic' | 'advanced'
}

export interface PlanLimitsResult {
  planId: string;
  billingInterval: string; // 'monthly' | 'annual'
  clients: ResourceStatus;
  activeEvents: ResourceStatus;
  attendeesPerEvent: ResourceStatus;
  adminUsers: ResourceStatus;
  aiPrompts: ResourceStatus;
  aiImages: ResourceStatus;
  emails: ResourceStatus;
  whatsapp: ResourceStatus;
  brandKits: ResourceStatus;
  storage: ResourceStatus;
  features: FeatureGates;
  loading: boolean;
  cycleStart: Date | null;
  canCreate: (resource: string) => boolean;
  hasFeature: (feature: keyof FeatureGates) => boolean;
  refresh: () => void;
}

function buildStatus(used: number, limit: number, isHard: boolean): ResourceStatus {
  const effective = limit <= 0 || limit >= 999999 ? Infinity : limit;
  const percent = effective === Infinity ? 0 : Math.min(100, Math.round((used / effective) * 100));
  return { used, limit: effective, percent, isHard, grandfathered: used > effective && effective !== Infinity };
}

const ALL_PLAN_COLS = [
  "max_clients", "max_active_events", "max_attendees_per_event", "max_admin_users",
  "max_emails", "max_whatsapp_sends", "max_ai_requests", "max_ai_images",
  "max_brand_kits", "max_storage_gb",
  "has_segmentation", "has_workspace_analytics", "has_live_dashboard",
  "has_ai_concierge", "campaign_tier",
].join(", ");

export function usePlanLimits(): PlanLimitsResult {
  const { user } = useAuth();
  const [planId, setPlanId] = useState("starter");
  const [billingInterval, setBillingInterval] = useState("monthly");
  const [sp, setSp] = useState<any>({});
  const [usage, setUsage] = useState<any>({});
  const [apiUsage, setApiUsage] = useState<Record<string, number>>({});
  const [brandKitCount, setBrandKitCount] = useState(0);
  const [cycleStart, setCycleStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const [subRes, usageRes, apiRes, bkRes] = await Promise.all([
        supabase
          .from("account_subscriptions")
          .select(`plan_id, provider, current_period_start, subscription_plans(${ALL_PLAN_COLS})`)
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("get_user_usage", { p_user_id: user.id }),
        supabase
          .from("api_usage_tracking")
          .select("resource_type, usage_count")
          .eq("user_id", user.id)
          .gte("period_start", periodStart.toISOString()),
        supabase
          .from("brand_kits")
          .select("id", { count: "exact", head: true })
          .eq("created_by", user.id),
      ]);

      if (cancelled) return;

      const plan = subRes.data?.plan_id || "starter";
      setPlanId(plan);

      // Detect annual billing from provider subscription ID convention
      const provider = subRes.data?.provider || "paddle";
      setBillingInterval(provider === "paddle" ? "monthly" : "monthly"); // Will be enhanced when Paddle annual is live

      const planData = (subRes.data as any)?.subscription_plans || {};
      setSp(planData);

      if (subRes.data?.current_period_start) {
        setCycleStart(new Date(subRes.data.current_period_start));
      }

      const u = usageRes.data as any;
      if (u) setUsage(u);

      // Aggregate API usage
      const agg: Record<string, number> = {};
      for (const row of (apiRes.data || []) as any[]) {
        agg[row.resource_type] = (agg[row.resource_type] || 0) + (row.usage_count || 0);
      }
      setApiUsage(agg);

      setBrandKitCount(bkRes.count ?? 0);

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const result = useMemo<PlanLimitsResult>(() => {
    const clients = buildStatus(usage.clients ?? 0, sp.max_clients ?? 3, true);
    const activeEvents = buildStatus(usage.activeEvents ?? 0, sp.max_active_events ?? 3, true);
    const attendeesPerEvent = buildStatus(0, sp.max_attendees_per_event ?? 300, true); // Per-event, checked contextually
    const adminUsers = buildStatus(0, sp.max_admin_users ?? 1, true);
    const aiPrompts = buildStatus(apiUsage.ai_requests ?? 0, sp.max_ai_requests ?? 500, false);
    const aiImages = buildStatus(apiUsage.ai_heavy ?? 0, sp.max_ai_images ?? 20, false);
    const emails = buildStatus(usage.emails ?? 0, sp.max_emails ?? 2000, false);
    const whatsapp = buildStatus(apiUsage.whatsapp_sends ?? 0, sp.max_whatsapp_sends ?? 500, false);
    const brandKits = buildStatus(brandKitCount, sp.max_brand_kits ?? 0, true);
    const storage = buildStatus((usage.storageBytes ?? 0) / (1024 * 1024 * 1024), sp.max_storage_gb ?? 5, false);

    const features: FeatureGates = {
      segmentation: sp.has_segmentation ?? false,
      workspaceAnalytics: sp.has_workspace_analytics ?? false,
      liveDashboard: sp.has_live_dashboard ?? false,
      aiConcierge: sp.has_ai_concierge ?? "none",
      campaignTier: sp.campaign_tier ?? "basic",
    };

    const canCreate = (resource: string) => {
      const map: Record<string, ResourceStatus> = {
        clients, activeEvents, active_events: activeEvents, attendeesPerEvent,
        attendees_per_event: attendeesPerEvent, adminUsers, admin_users: adminUsers,
        aiPrompts, ai_prompts: aiPrompts, aiImages, ai_images: aiImages,
        emails, whatsapp, brandKits, brand_kits: brandKits, storage,
      };
      const r = map[resource];
      if (!r) return true;
      if (r.limit === Infinity) return true;
      if (r.isHard) return r.used < r.limit;
      return r.percent < 100;
    };

    const hasFeature = (feature: keyof FeatureGates) => {
      const val = features[feature];
      if (typeof val === "boolean") return val;
      return val !== "none";
    };

    return {
      planId, billingInterval,
      clients, activeEvents, attendeesPerEvent, adminUsers,
      aiPrompts, aiImages, emails, whatsapp, brandKits, storage,
      features, loading, cycleStart, canCreate, hasFeature, refresh,
    };
  }, [planId, billingInterval, usage, sp, apiUsage, brandKitCount, loading, cycleStart]);

  return result;
}
