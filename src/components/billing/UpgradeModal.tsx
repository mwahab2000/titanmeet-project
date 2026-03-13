import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Mail, CheckCircle } from "lucide-react";
import { useUpgradeModal, type UpgradeTrigger } from "@/hooks/useUpgradeModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import PaddleCheckoutButton from "@/components/billing/PaddleCheckoutButton";
import { useCallback } from "react";
import { PLANS, PLAN_ORDER, VOICE_MINUTES_NOTE, type PlanId } from "@/config/pricing";

const HEADLINES: Record<UpgradeTrigger, string> = {
  clients: "Need more clients?",
  events: "Running more events?",
  attendees: "Expecting more attendees?",
  emails: "Need to send more emails?",
  storage: "Running out of space?",
};

const TRIGGER_LIMIT_KEY: Record<UpgradeTrigger, string> = {
  clients: "clients",
  events: "events",
  attendees: "attendees",
  emails: "emails",
  storage: "storage",
};

function getNextPlan(current: PlanId): PlanId | null {
  const idx = PLAN_ORDER.indexOf(current);
  if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[idx + 1];
}

function getLimitDisplay(planId: PlanId, trigger: UpgradeTrigger): string {
  const plan = PLANS[planId];
  if (!plan) return "—";
  const key = TRIGGER_LIMIT_KEY[trigger];
  if (key === "clients") return plan.limits.clients === Infinity ? "Unlimited" : String(plan.limits.clients);
  if (key === "events") return plan.limits.events === Infinity ? "Unlimited" : String(plan.limits.events);
  // fallback for attendees/emails/storage not in new limits — show features
  return "See plan";
}

export default function UpgradeModal() {
  const { isOpen, trigger, closeUpgradeModal } = useUpgradeModal();
  const planLimits = usePlanLimits();
  const navigate = useNavigate();

  const handleSuccess = useCallback((_txId: string) => {
    closeUpgradeModal();
  }, [closeUpgradeModal]);

  if (!trigger) return null;

  const currentPlanId = (planLimits.planId as PlanId) || "starter";
  const nextPlanId = getNextPlan(currentPlanId);
  const currentPlan = PLANS[currentPlanId];
  const nextPlan = nextPlanId ? PLANS[nextPlanId] : null;

  const headline = HEADLINES[trigger];
  const isEnterprise = currentPlanId === "enterprise";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{headline}</DialogTitle>
          <DialogDescription>
            You've reached your {currentPlan?.name} limit for {trigger}.
          </DialogDescription>
        </DialogHeader>

        {isEnterprise ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">You're on our highest plan.</p>
            <Button
              className="gap-2"
              onClick={() => {
                closeUpgradeModal();
                navigate("/dashboard/support");
              }}
            >
              <Mail className="h-4 w-4" /> Contact Support
            </Button>
          </div>
        ) : nextPlan ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Current plan */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 opacity-70">
                <Badge variant="outline" className="text-[10px]">Current</Badge>
                <h3 className="font-display font-bold">{currentPlan.name}</h3>
                <p className="text-sm text-muted-foreground">${currentPlan.monthlyPrice}/mo</p>
                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-medium text-destructive">
                    {getLimitDisplay(currentPlanId, trigger)} {trigger}
                  </p>
                </div>
              </div>

              {/* Next plan */}
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-2 relative">
                {nextPlan.highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 shadow-sm gap-1 text-[10px]">
                      <Crown className="h-2.5 w-2.5" /> Most Popular
                    </Badge>
                  </div>
                )}
                <Badge variant="outline" className="text-[10px] border-primary text-primary">Upgrade to</Badge>
                <h3 className="font-display font-bold">{nextPlan.name}</h3>
                <p className="text-sm text-muted-foreground">${nextPlan.monthlyPrice}/mo</p>
                <div className="pt-2 border-t border-primary/20">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {getLimitDisplay(nextPlanId!, trigger)} {trigger}
                  </p>
                </div>
                <ul className="space-y-1 pt-1">
                  {nextPlan.features.map((f) => (
                    <li key={f.text} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {nextPlan.paddlePriceIdMonthly ? (
              <PaddleCheckoutButton
                priceId={nextPlan.paddlePriceIdMonthly}
                planId={nextPlanId!}
                type="subscription"
                onSuccess={handleSuccess}
              />
            ) : (
              <Button className="w-full" onClick={() => { closeUpgradeModal(); navigate("/dashboard/billing"); }}>
                Upgrade to {nextPlan.name}
              </Button>
            )}

            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">
                You'll be credited for unused days on your current plan.
              </p>
              <p className="text-[11px] text-muted-foreground">
                {VOICE_MINUTES_NOTE}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
