import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useApiUsage, getResourceLabel, type ApiUsageEntry } from "@/hooks/useApiUsage";

export function AIBuilderUsageBanner() {
  const { usage, loading, topWarning } = useApiUsage();

  if (loading || !topWarning) return null;

  const label = getResourceLabel(topWarning.resource_type);

  if (topWarning.blocked) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10 mx-4 mt-2">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive text-sm">Monthly {label} limit reached</AlertTitle>
        <AlertDescription className="text-xs">
          You've used {topWarning.usage_count.toLocaleString()} of {topWarning.limit.toLocaleString()} {label} this month.
          Upgrade your plan or wait for the next billing period.
        </AlertDescription>
      </Alert>
    );
  }

  if (topWarning.warning) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10 mx-4 mt-2">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-600 dark:text-yellow-400 text-sm">
          {topWarning.percent}% of {label} used
        </AlertTitle>
        <AlertDescription className="text-xs">
          {topWarning.usage_count.toLocaleString()} of {topWarning.limit.toLocaleString()} — {topWarning.remaining.toLocaleString()} remaining this month.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
