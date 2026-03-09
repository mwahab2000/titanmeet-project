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

export interface PlanLimitsResult {
  planId: string;
  clients: ResourceStatus;
  activeEvents: ResourceStatus;
  attendees: ResourceStatus;
  emails: ResourceStatus;
  storage: ResourceStatus;
  loading: boolean;
  cycleStart: Date | null;
  canCreate: (resource: keyof Pick<PlanLimitsResult, "clients" | "activeEvents" | "attendees" | "emails" | "storage">) => boolean;
  refresh: () => void;
}

function buildStatus(used: number, limit: number, isHard: boolean): ResourceStatus {
  const effective = limit <= 0 || limit === Infinity ? Infinity : limit;
  const percent = effective === Infinity ? 0 : Math.min(100, Math.round((used / effective) * 100));
  return { used, limit: effective, percent, isHard, grandfathered: used > effective && effective !== Infinity };
}

export function usePlanLimits(): PlanLimitsResult {
  const { user } = useAuth();
  const [planId, setPlanId] = useState("starter");
  const [limits, setLimits] = useState({ clients: 3, activeEvents: 5, attendees: 500, emails: 2000, storageGB: 5 });
  const [usage, setUsage] = useState({ clients: 0, activeEvents: 0, attendees: 0, emails: 0, storageBytes: 0 });
  const [cycleStart, setCycleStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // Fetch subscription + plan limits and usage in parallel
      const [subRes, usageRes] = await Promise.all([
        supabase
          .from("account_subscriptions")
          .select("plan_id, subscription_plans(max_clients, max_active_events, max_attendees, max_emails, max_storage_gb)")
          .eq("user_id", user.id)
          .single(),
        supabase.rpc("get_user_usage", { p_user_id: user.id }),
      ]);

      if (cancelled) return;

      const plan = subRes.data?.plan_id || "starter";
      setPlanId(plan);

      // Read limits from subscription_plans join
      const sp = (subRes.data as any)?.subscription_plans;
      if (sp) {
        setLimits({
          clients: sp.max_clients ?? 3,
          activeEvents: sp.max_active_events ?? 5,
          attendees: sp.max_attendees ?? 500,
          emails: sp.max_emails ?? 2000,
          storageGB: sp.max_storage_gb ?? 5,
        });
      }

      // Read usage from RPC result
      const u = usageRes.data as any;
      if (u) {
        setUsage({
          clients: u.clients ?? 0,
          activeEvents: u.activeEvents ?? 0,
          attendees: u.attendees ?? 0,
          emails: u.emails ?? 0,
          storageBytes: u.storageBytes ?? 0,
        });
        if (u.cycleStart) setCycleStart(new Date(u.cycleStart));
      }

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, tick]);

  const result = useMemo<PlanLimitsResult>(() => {
    const clients = buildStatus(usage.clients, limits.clients, true);
    const activeEvents = buildStatus(usage.activeEvents, limits.activeEvents, true);
    const attendees = buildStatus(usage.attendees, limits.attendees, false);
    const emails = buildStatus(usage.emails, limits.emails, false);
    const storage = buildStatus(usage.storageBytes / (1024 * 1024 * 1024), limits.storageGB, false);

    const canCreate = (resource: keyof Pick<PlanLimitsResult, "clients" | "activeEvents" | "attendees" | "emails" | "storage">) => {
      const r = { clients, activeEvents, attendees, emails, storage }[resource];
      if (!r) return true;
      if (r.limit === Infinity) return true;
      if (r.isHard) return r.used < r.limit;
      return r.percent < 100;
    };

    return { planId, clients, activeEvents, attendees, emails, storage, loading, cycleStart, canCreate, refresh: () => setTick(t => t + 1) };
  }, [planId, usage, limits, loading, cycleStart]);

  return result;
}
