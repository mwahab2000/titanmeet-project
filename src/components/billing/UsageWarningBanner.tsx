import { useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, ArrowUpRight } from "lucide-react";
import { usePlanLimits, type ResourceStatus } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

const RESOURCE_LABELS: Record<string, string> = {
  clients: "clients",
  activeEvents: "active events",
  attendees: "attendees",
  emails: "emails",
  storage: "storage",
};

const TRIGGER_MAP: Record<string, "clients" | "events" | "attendees" | "emails" | "storage"> = {
  clients: "clients",
  activeEvents: "events",
  attendees: "attendees",
  emails: "emails",
  storage: "storage",
};

const DISMISS_KEY = "usage_banner_dismissed";

type ResourceKey = "clients" | "activeEvents" | "attendees" | "emails" | "storage";
const KEYS: ResourceKey[] = ["clients", "activeEvents", "attendees", "emails", "storage"];

export default function UsageWarningBanner() {
  const limits = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) setDismissed(JSON.parse(stored));
    } catch {}
  }, []);

  if (limits.loading) return null;

  const hardLimitHit: ResourceKey[] = [];
  const grandfathered: ResourceKey[] = [];

  for (const key of KEYS) {
    const s: ResourceStatus = limits[key];
    if (s.grandfathered) grandfathered.push(key);
    else if (s.isHard && s.percent >= 100) hardLimitHit.push(key);
  }

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const banners: React.ReactNode[] = [];

  if (hardLimitHit.length > 0 && !dismissed.includes("hard")) {
    const firstTrigger = TRIGGER_MAP[hardLimitHit[0]];
    banners.push(
      <Alert key="hard" className="border-yellow-500/50 bg-yellow-500/10 relative">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-600 dark:text-yellow-400">Limit Reached</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            You've reached your {hardLimitHit.map((k) => RESOURCE_LABELS[k]).join(" and ")} limit. Upgrade to continue.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal(firstTrigger)}>
              Upgrade Now <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <button onClick={() => dismiss("hard")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (grandfathered.length > 0 && !dismissed.includes("grandfathered")) {
    const firstTrigger = TRIGGER_MAP[grandfathered[0]];
    banners.push(
      <Alert key="gf" className="border-orange-500/50 bg-orange-500/10 relative">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-600 dark:text-orange-400">Over Plan Limits</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            Your account exceeds current plan limits. Existing data is safe — upgrade to create new {grandfathered.map((k) => RESOURCE_LABELS[k]).join(", ")}.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal(firstTrigger)}>
              Upgrade Now <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <button onClick={() => dismiss("grandfathered")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (banners.length === 0) return null;

  return <div className="space-y-2 mb-4">{banners}</div>;
}
