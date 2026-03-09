import React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";
import { useUpgradeModal, type UpgradeTrigger } from "@/hooks/useUpgradeModal";
import type { ResourceStatus } from "@/hooks/usePlanLimits";

interface PlanLimitGateProps {
  resource: ResourceStatus;
  resourceLabel: string;
  planName: string;
  /** Which trigger to pass to the upgrade modal */
  upgradeTrigger?: UpgradeTrigger;
  children: React.ReactNode;
}

/**
 * Wraps a creation form/section. If at hard limit → replaces children with upgrade prompt.
 * If at soft limit 80-99% → shows warning above children.
 * If at soft limit 100% → blocks with upgrade prompt.
 */
export function PlanLimitGate({ resource, resourceLabel, planName, upgradeTrigger, children }: PlanLimitGateProps) {
  const { openUpgradeModal } = useUpgradeModal();

  const handleUpgrade = () => {
    if (upgradeTrigger) {
      openUpgradeModal(upgradeTrigger);
    }
  };

  const atHardLimit = resource.isHard && resource.used >= resource.limit && resource.limit !== Infinity;
  const atSoftBlock = !resource.isHard && resource.percent >= 100 && resource.limit !== Infinity;
  const atSoftWarn = !resource.isHard && resource.percent >= 80 && resource.percent < 100;

  if (atHardLimit) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <Lock className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">Plan Limit Reached</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            You've reached your <strong className="capitalize">{planName}</strong> limit of{" "}
            <strong>{resource.limit} {resourceLabel}</strong>.
            {resource.grandfathered && " Your existing data is safe — you just can't create new ones."}
          </p>
          <Button size="sm" onClick={handleUpgrade}>
            Upgrade Plan
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (atSoftBlock) {
    return (
      <div className="space-y-4">
        <Alert className="border-destructive/50 bg-destructive/10">
          <Lock className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Monthly Limit Reached</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              You've used <strong>{resource.used.toLocaleString()}</strong> of your{" "}
              <strong>{resource.limit.toLocaleString()} {resourceLabel}/mo</strong> limit.
              Upgrade to continue.
            </p>
            <Button size="sm" onClick={handleUpgrade}>
              Upgrade Plan
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      {atSoftWarn && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-4">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Usage Warning</AlertTitle>
          <AlertDescription>
            You've used {resource.percent}% of your monthly {resourceLabel} limit ({resource.used.toLocaleString()}/{resource.limit.toLocaleString()}).
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
}
