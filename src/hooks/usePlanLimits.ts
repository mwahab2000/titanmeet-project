import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── Plan limit definitions ── */
interface Limits {
  clients: number;
  activeEvents: number;
  attendeesPerMonth: number;
  emailsPerMonth: number;
  storageGB: number;
}

const PLAN_LIMITS: Record<string, Limits> = {
  starter: {
    clients: 3,
    activeEvents: 5,
    attendeesPerMonth: 500,
    emailsPerMonth: 2000,
    storageGB: 5,
  },
  professional: {
    clients: 15,
    activeEvents: 25,
    attendeesPerMonth: 5000,
    emailsPerMonth: 20000,
    storageGB: 25,
  },
  enterprise: {
    clients: Infinity,
    activeEvents: Infinity,
    attendeesPerMonth: 50000,
    emailsPerMonth: 200000,
    storageGB: 100,
  },
};

export interface ResourceStatus {
  used: number;
  limit: number;
  percent: number;
  /** Hard = block at limit; Soft = warn at 80%, block at 100% */
  isHard: boolean;
  /** True when existing usage already exceeded limit on load (grandfathered) */
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
  /** Can create a new item of this resource type? */
  canCreate: (resource: keyof Omit<PlanLimitsResult, "planId" | "loading" | "canCreate" | "refresh">) => boolean;
  refresh: () => void;
}

function buildStatus(used: number, limit: number, isHard: boolean): ResourceStatus {
  const percent = limit <= 0 || limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, percent, isHard, grandfathered: used > limit && limit !== Infinity };
}

export function usePlanLimits(): PlanLimitsResult {
  const { user } = useAuth();
  const [planId, setPlanId] = useState("starter");
  const [usage, setUsage] = useState({ clients: 0, activeEvents: 0, attendees: 0, emails: 0, storageMB: 0 });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // Billing cycle start = 1st of current month
      const cycleStart = new Date();
      cycleStart.setDate(1);
      cycleStart.setHours(0, 0, 0, 0);
      const cycleISO = cycleStart.toISOString();

      const [subRes, clientsRes, eventsRes, attendeesRes, emailsRes] = await Promise.all([
        supabase.from("account_subscriptions").select("plan_id").eq("user_id", user.id).single(),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["draft", "published", "ongoing"]),
        supabase.from("attendees").select("id", { count: "exact", head: true }).gte("confirmed_at", cycleISO),
        supabase.from("communications_log").select("id", { count: "exact", head: true }).eq("channel", "email").gte("created_at", cycleISO),
      ]);

      if (cancelled) return;

      setPlanId(subRes.data?.plan_id || "starter");
      setUsage({
        clients: clientsRes.count || 0,
        activeEvents: eventsRes.count || 0,
        attendees: attendeesRes.count || 0,
        emails: emailsRes.count || 0,
        storageMB: 0,
      });
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, tick]);

  const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;

  const result = useMemo<PlanLimitsResult>(() => {
    const clients = buildStatus(usage.clients, limits.clients, true);
    const activeEvents = buildStatus(usage.activeEvents, limits.activeEvents, true);
    const attendees = buildStatus(usage.attendees, limits.attendeesPerMonth, false);
    const emails = buildStatus(usage.emails, limits.emailsPerMonth, false);
    const storage = buildStatus(usage.storageMB / 1024, limits.storageGB, false);

    const canCreate = (resource: keyof Omit<PlanLimitsResult, "planId" | "loading" | "canCreate" | "refresh">) => {
      const r = { clients, activeEvents, attendees, emails, storage }[resource];
      if (!r) return true;
      if (r.limit === Infinity) return true;
      // Hard limits: block at limit
      if (r.isHard) return r.used < r.limit;
      // Soft limits: block at 100%
      return r.percent < 100;
    };

    return {
      planId,
      clients,
      activeEvents,
      attendees,
      emails,
      storage,
      loading,
      canCreate,
      refresh: () => setTick((t) => t + 1),
    };
  }, [planId, usage, limits, loading]);

  return result;
}
