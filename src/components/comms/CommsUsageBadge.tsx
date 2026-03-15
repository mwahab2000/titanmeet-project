import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Mail, MessageSquare, AlertTriangle } from "lucide-react";

export function CommsUsageBadge() {
  const limits = usePlanLimits();

  if (limits.loading) return null;

  const emailRemaining = limits.emails.limit === Infinity
    ? "∞"
    : Math.max(0, limits.emails.limit - limits.emails.used);

  return (
    <div className="px-3 py-2 border-t border-border bg-muted/30 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Usage This Cycle
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Mail className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] text-muted-foreground flex-1">Email</span>
          <span className="text-[10px] font-medium">
            {limits.emails.used}/{limits.emails.limit === Infinity ? "∞" : limits.emails.limit}
          </span>
        </div>
        {limits.emails.limit !== Infinity && (
          <Progress
            value={limits.emails.percent}
            className={`h-1 ${
              limits.emails.percent >= 100 ? "[&>div]:bg-destructive" :
              limits.emails.percent >= 80 ? "[&>div]:bg-yellow-500" :
              "[&>div]:bg-emerald-500"
            }`}
          />
        )}
        {limits.emails.percent >= 80 && limits.emails.limit !== Infinity && (
          <p className="text-[9px] text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {limits.emails.percent >= 100
              ? "Email limit reached. Upgrade to continue sending."
              : `${limits.emails.percent}% of email quota used.`}
          </p>
        )}
      </div>
    </div>
  );
}
