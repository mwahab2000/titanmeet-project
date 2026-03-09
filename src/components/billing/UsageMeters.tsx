import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { usePlanLimits, type ResourceStatus } from "@/hooks/usePlanLimits";

const RESOURCE_META: Record<string, { label: string; description: string }> = {
  clients: { label: "Clients", description: "Active client accounts" },
  activeEvents: { label: "Events", description: "Currently active events" },
  attendees: { label: "Attendees", description: "Registrations this billing cycle" },
  emails: { label: "Emails", description: "Emails sent this billing cycle" },
  storage: { label: "Storage", description: "Files and media stored (GB)" },
};

type ResourceKey = "clients" | "activeEvents" | "attendees" | "emails" | "storage";
const RESOURCE_KEYS: ResourceKey[] = ["clients", "activeEvents", "attendees", "emails", "storage"];

function barColor(status: ResourceStatus): string {
  if (status.grandfathered) return "[&>div]:bg-orange-500";
  if (status.percent >= 100) return "[&>div]:bg-destructive";
  if (status.percent >= 80) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-emerald-500";
}

function formatValue(key: ResourceKey, value: number, limit: number): string {
  if (limit === Infinity) return `${value} / ∞`;
  const suffix = key === "storage" ? " GB" : "";
  const displayVal = key === "storage" ? value.toFixed(1) : String(value);
  return `${displayVal}${suffix} / ${limit}${suffix}`;
}

function getResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

interface UsageMetersProps {
  compact?: boolean;
}

function SkeletonRows({ compact }: { compact: boolean }) {
  return (
    <>
      {RESOURCE_KEYS.map((key) => (
        <div key={key} className={compact ? "space-y-1" : "space-y-1.5"}>
          <div className="flex justify-between">
            <Skeleton className={compact ? "h-3 w-14" : "h-4 w-16"} />
            <Skeleton className={compact ? "h-3 w-12" : "h-3.5 w-16"} />
          </div>
          <Skeleton className={`${compact ? "h-1.5" : "h-2"} w-full`} />
          {!compact && <Skeleton className="h-3 w-40" />}
        </div>
      ))}
    </>
  );
}

export default function UsageMeters({ compact = false }: UsageMetersProps) {
  const limits = usePlanLimits();

  const isNoPlan = !limits.loading && limits.planId === "starter" && limits.clients.limit === 0;

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <div className="flex items-center justify-between">
          <div>
            {limits.loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <CardTitle className="font-display text-sm">
                {compact
                  ? "Usage"
                  : `Current Plan: ${limits.planId.charAt(0).toUpperCase() + limits.planId.slice(1)}`}
              </CardTitle>
            )}
            {!compact && !limits.loading && (
              <CardDescription>Resource usage for the current billing cycle</CardDescription>
            )}
          </div>
          {compact && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground" asChild>
              <Link to="/dashboard/billing">Manage Plan →</Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className={compact ? "space-y-3" : "space-y-4"}>
        {limits.loading ? (
          <SkeletonRows compact={compact} />
        ) : isNoPlan ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No active plan — upgrade to get started</p>
            <Button size="sm" asChild>
              <Link to="/dashboard/billing">View Plans</Link>
            </Button>
          </div>
        ) : (
          <TooltipProvider>
            {RESOURCE_KEYS.map((key) => {
              const status: ResourceStatus = limits[key];
              const meta = RESOURCE_META[key];
              const displayPercent = Math.min(status.percent, 100);

              const bar = (
                <div key={key} className={compact ? "space-y-1" : "space-y-1.5"}>
                  <div className="flex justify-between text-sm">
                    <span className={`font-medium ${compact ? "text-xs" : ""}`}>{meta.label}</span>
                    <span
                      className={`${compact ? "text-[10px]" : "text-xs"} ${
                        status.percent >= 100
                          ? "text-destructive font-semibold"
                          : status.percent >= 80
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {formatValue(key, status.used, status.limit)}
                    </span>
                  </div>
                  <Progress
                    value={displayPercent}
                    className={`${compact ? "h-1.5" : "h-2"} ${barColor(status)}`}
                  />
                  {!compact && (
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  )}
                </div>
              );

              if (status.grandfathered) {
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">{bar}</div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <span>You're over the limit — existing data kept, new creation blocked</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return bar;
            })}
          </TooltipProvider>
        )}

        {!compact && !limits.loading && !isNoPlan && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Attendees and emails reset on {getResetDate()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
