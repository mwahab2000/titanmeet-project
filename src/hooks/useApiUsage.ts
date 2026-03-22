import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApiResourceType = "ai_requests" | "ai_heavy" | "maps_search" | "maps_photos" | "whatsapp_sends";

export interface ApiUsageEntry {
  resource_type: string;
  usage_count: number;
  limit: number;
  percent: number;
  remaining: number;
  warning: boolean;   // ≥80%
  blocked: boolean;   // ≥100%
}

export interface ApiUsageResult {
  usage: Record<ApiResourceType, ApiUsageEntry>;
  loading: boolean;
  refresh: () => void;
  /** The single highest-severity warning to show, if any */
  topWarning: ApiUsageEntry | null;
}

const RESOURCE_LABELS: Record<string, string> = {
  ai_requests: "AI requests",
  ai_heavy: "AI generation",
  maps_search: "venue searches",
  maps_photos: "venue photo lookups",
  whatsapp_sends: "WhatsApp messages",
};

const PLAN_LIMIT_COLS: Record<string, string> = {
  ai_requests: "max_ai_requests",
  ai_heavy: "max_ai_heavy",
  maps_search: "max_maps_searches",
  maps_photos: "max_maps_photos",
  whatsapp_sends: "max_whatsapp_sends",
};

const DEFAULT_LIMITS: Record<string, number> = {
  ai_requests: 100,
  ai_heavy: 20,
  maps_search: 50,
  maps_photos: 100,
  whatsapp_sends: 500,
};

function buildEntry(used: number, limit: number): ApiUsageEntry {
  const effective = limit <= 0 ? Infinity : limit;
  const percent = effective === Infinity ? 0 : Math.min(100, Math.round((used / effective) * 100));
  return {
    resource_type: "",
    usage_count: used,
    limit: effective,
    percent,
    remaining: effective === Infinity ? Infinity : Math.max(0, effective - used),
    warning: percent >= 80 && percent < 100,
    blocked: percent >= 100,
  };
}

export function useApiUsage(): ApiUsageResult {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<Record<string, number>>({});
  const [limits, setLimits] = useState<Record<string, number>>(DEFAULT_LIMITS);
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
      const periodStr = periodStart.toISOString();

      const [usageRes, planRes] = await Promise.all([
        supabase
          .from("api_usage_tracking")
          .select("resource_type, usage_count")
          .eq("user_id", user.id)
          .gte("period_start", periodStr),
        supabase
          .from("account_subscriptions")
          .select("plan_id, subscription_plans(max_ai_requests, max_ai_heavy, max_maps_searches, max_maps_photos, max_whatsapp_sends)")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (cancelled) return;

      const ud: Record<string, number> = {};
      for (const row of (usageRes.data || []) as any[]) {
        ud[row.resource_type] = (ud[row.resource_type] || 0) + (row.usage_count || 0);
      }
      setUsageData(ud);

      const sp = (planRes.data as any)?.subscription_plans;
      if (sp) {
        const lim: Record<string, number> = {};
        for (const [key, col] of Object.entries(PLAN_LIMIT_COLS)) {
          lim[key] = sp[col] ?? DEFAULT_LIMITS[key];
        }
        setLimits(lim);
      }

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, tick]);

  const result = useMemo<ApiUsageResult>(() => {
    const keys: ApiResourceType[] = ["ai_requests", "ai_heavy", "maps_search", "maps_photos", "whatsapp_sends"];
    const usage = {} as Record<ApiResourceType, ApiUsageEntry>;
    let topWarning: ApiUsageEntry | null = null;

    for (const key of keys) {
      const entry = buildEntry(usageData[key] || 0, limits[key] || DEFAULT_LIMITS[key]);
      entry.resource_type = key;
      usage[key] = entry;

      if (entry.blocked && (!topWarning || !topWarning.blocked)) {
        topWarning = entry;
      } else if (entry.warning && !topWarning) {
        topWarning = entry;
      }
    }

    return { usage, loading, refresh: () => setTick(t => t + 1), topWarning };
  }, [usageData, limits, loading]);

  return result;
}

export function getResourceLabel(type: string): string {
  return RESOURCE_LABELS[type] || type;
}
