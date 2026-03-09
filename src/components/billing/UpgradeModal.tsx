import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, ArrowRight, Mail } from "lucide-react";
import { useUpgradeModal, type UpgradeTrigger } from "@/hooks/useUpgradeModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import PaddleCheckoutButton from "@/components/billing/PaddleCheckoutButton";
import { useCallback } from "react";

const HEADLINES: Record<UpgradeTrigger, string> = {
  clients: "Need more clients?",
  events: "Running more events?",
  attendees: "Expecting more attendees?",
  emails: "Need to send more emails?",
  storage: "Running out of space?",
};

type PlanId = "starter" | "professional" | "enterprise";

interface PlanLimitData {
  name: string;
  price: string;
  limits: Record<UpgradeTrigger, string>;
  popular?: boolean;
}

const PLAN_DATA: Record<PlanId, PlanLimitData> = {
  starter: {
    name: "Starter",
    price: "$49/mo",
    limits: { clients: "3", events: "5", attendees: "500", emails: "2,000", storage: "5 GB" },
  },
  professional: {
    name: "Professional",
    price: "$149/mo",
    popular: true,
    limits: { clients: "15", events: "25", attendees: "5,000", emails: "20,000", storage: "25 GB" },
  },
  enterprise: {
    name: "Enterprise",
    price: "$399/mo",
    limits: { clients: "Unlimited", events: "Unlimited", attendees: "50,000", emails: "200,000", storage: "100 GB" },
  },
};

const PLAN_ORDER: PlanId[] = ["starter", "professional", "enterprise"];

const PADDLE_PRICE_IDS: Record<string, string> = {
  starter: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || "",
  professional: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY || "",
  enterprise: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || "",
};

function getNextPlan(current: PlanId): PlanId | null {
  const idx = PLAN_ORDER.indexOf(current);
  if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[idx + 1];
}

export default function UpgradeModal() {
  const { isOpen, trigger, closeUpgradeModal } = useUpgradeModal();
  const { planId } = usePlanLimits();

  const currentPlanId = (planId as PlanId) || "starter";
  const nextPlanId = getNextPlan(currentPlanId);
  const currentPlan = PLAN_DATA[currentPlanId];
  const nextPlan = nextPlanId ? PLAN_DATA[nextPlanId] : null;

  const handleSuccess = useCallback((_txId: string) => {
    closeUpgradeModal();
  }, [closeUpgradeModal]);

  if (!trigger) return null;

  const headline = HEADLINES[trigger];
  const isEnterprise = currentPlanId === "enterprise";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{headline}</DialogTitle>
          <DialogDescription>
            Upgrade your plan to unlock higher limits.
          </DialogDescription>
        </DialogHeader>

        {isEnterprise ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">
              You're on our highest tier. Contact our sales team for custom limits.
            </p>
            <Button className="gap-2" onClick={() => window.open("mailto:sales@titanmeet.com")}>
              <Mail className="h-4 w-4" /> Contact Sales
            </Button>
          </div>
        ) : nextPlan ? (
          <div className="space-y-4">
            {/* Side by side comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current plan */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 opacity-70">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</p>
                <h3 className="font-display font-bold">{currentPlan.name}</h3>
                <p className="text-sm text-muted-foreground">{currentPlan.price}</p>
                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-medium text-destructive">
                    {currentPlan.limits[trigger]} {trigger}
                  </p>
                </div>
              </div>

              {/* Next plan */}
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-2 relative">
                {nextPlan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 shadow-sm gap-1 text-[10px]">
                      <Crown className="h-2.5 w-2.5" /> Most Popular
                    </Badge>
                  </div>
                )}
                <p className="text-xs font-medium text-primary uppercase tracking-wider">Upgrade to</p>
                <h3 className="font-display font-bold">{nextPlan.name}</h3>
                <p className="text-sm text-muted-foreground">{nextPlan.price}</p>
                <div className="pt-2 border-t border-primary/20">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {nextPlan.limits[trigger]} {trigger}
                  </p>
                </div>
              </div>
            </div>

            {/* Arrow between */}
            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>

            {/* Checkout button */}
            {PADDLE_PRICE_IDS[nextPlanId!] ? (
              <PaddleCheckoutButton
                priceId={PADDLE_PRICE_IDS[nextPlanId!]}
                planId={nextPlanId!}
                type="subscription"
                onSuccess={handleSuccess}
              />
            ) : (
              <Button className="w-full" onClick={() => { closeUpgradeModal(); window.location.href = "/dashboard/billing"; }}>
                View Plans
              </Button>
            )}

            {/* Proration + small print */}
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">
                You'll be credited for unused days on your current plan.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cancel anytime. No contracts.
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
