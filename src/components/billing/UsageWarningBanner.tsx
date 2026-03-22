import { useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, ArrowUpRight, Shield } from "lucide-react";
import { usePlanLimits, type ResourceStatus } from "@/hooks/usePlanLimits";
import { useUpgradeModal, type UpgradeTrigger } from "@/hooks/useUpgradeModal";
import { PLANS } from "@/config/pricing";

const RESOURCE_LABELS: Record<string, string> = {
  clients: "clients",
  activeEvents: "active events",
  aiPrompts: "AI prompts",
  aiImages: "AI images",
  emails: "emails",
  whatsapp: "WhatsApp messages",
  brandKits: "brand kits",
  storage: "storage",
};

const TRIGGER_MAP: Record<string, UpgradeTrigger> = {
  clients: "clients",
  activeEvents: "events",
  aiPrompts: "ai_prompts",
  aiImages: "ai_images",
  emails: "emails",
  whatsapp: "whatsapp",
  brandKits: "brand_kits",
  storage: "storage",
};

const UPGRADE_COPY: Record<string, string> = {
  clients: "Upgrade for more client capacity.",
  activeEvents: "Upgrade to run more events this month.",
  aiPrompts: "Upgrade to Professional for 6× more AI capacity.",
  aiImages: "Upgrade for more AI image generation.",
  emails: "Upgrade for higher email volume.",
  whatsapp: "Upgrade for more WhatsApp messages.",
  brandKits: "Upgrade to create brand kits.",
  storage: "Upgrade for more storage space.",
};

const DISMISS_KEY = "usage_banner_dismissed";

type ResourceKey = "clients" | "activeEvents" | "aiPrompts" | "aiImages" | "emails" | "whatsapp" | "brandKits" | "storage";
const KEYS: ResourceKey[] = ["clients", "activeEvents", "aiPrompts", "aiImages", "emails", "whatsapp", "brandKits", "storage"];

interface Props {
  /** Only show warnings for specific resources */
  filterResources?: ResourceKey[];
  /** Compact mode for inline placement */
  compact?: boolean;
}

export default function UsageWarningBanner({ filterResources, compact }: Props = {}) {
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

  const keys = filterResources || KEYS;
  const hardLimitHit: ResourceKey[] = [];
  const softWarning: ResourceKey[] = [];
  const grandfathered: ResourceKey[] = [];

  for (const key of keys) {
    const s: ResourceStatus = (limits as any)[key];
    if (!s || s.limit === Infinity) continue;
    if (s.grandfathered) grandfathered.push(key);
    else if (s.percent >= 100) hardLimitHit.push(key);
    else if (s.percent >= 80) softWarning.push(key);
  }

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const nextPlanName = (() => {
    const idx = ["starter", "professional", "enterprise"].indexOf(limits.planId);
    if (idx < 0 || idx >= 2) return null;
    return PLANS[["starter", "professional", "enterprise"][idx + 1]]?.name;
  })();

  const banners: React.ReactNode[] = [];

  // Hard limit banners
  if (hardLimitHit.length > 0 && !dismissed.includes("hard")) {
    const firstKey = hardLimitHit[0];
    banners.push(
      <Alert key="hard" className="border-destructive/40 bg-destructive/5 relative">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">Limit Reached</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm">
            You've reached your {hardLimitHit.map((k) => RESOURCE_LABELS[k]).join(" and ")} limit.
            {nextPlanName && ` Upgrade to ${nextPlanName} to continue.`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => openUpgradeModal(TRIGGER_MAP[firstKey])}>
              Upgrade Now <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            {!compact && (
              <button onClick={() => dismiss("hard")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Soft warning (80-99%)
  if (softWarning.length > 0 && !dismissed.includes("soft")) {
    const firstKey = softWarning[0];
    const s: ResourceStatus = (limits as any)[firstKey];
    banners.push(
      <Alert key="soft" className="border-yellow-500/30 bg-yellow-500/5 relative">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-600 dark:text-yellow-400">Approaching Limit</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm">
            You've used {s.percent}% of your {RESOURCE_LABELS[firstKey]} quota.{" "}
            {UPGRADE_COPY[firstKey]}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal(TRIGGER_MAP[firstKey])}>
              Upgrade <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <button onClick={() => dismiss("soft")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Grandfathered
  if (grandfathered.length > 0 && !dismissed.includes("grandfathered")) {
    const firstKey = grandfathered[0];
    banners.push(
      <Alert key="gf" className="border-orange-500/30 bg-orange-500/5 relative">
        <Shield className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-600 dark:text-orange-400">Over Plan Limits</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm">
            Your account exceeds current plan limits for {grandfathered.map((k) => RESOURCE_LABELS[k]).join(", ")}.
            Existing data is safe — upgrade to create new resources.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal(TRIGGER_MAP[firstKey])}>
              Upgrade <ArrowUpRight className="h-3 w-3 ml-1" />
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
