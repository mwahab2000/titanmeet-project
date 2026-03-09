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
  features: string[];
  popular?: boolean;
}

const PLAN_DATA: Record<PlanId, PlanLimitData> = {
  starter: {
    name: "Starter",
    price: "$49/mo",
    limits: { clients: "3", events: "5", attendees: "500", emails: "2,000", storage: "5 GB" },
    features: ["3 clients", "5 active events", "500 attendees/mo", "2,000 emails/mo", "5 GB storage", "Standard support"],
  },
  professional: {
    name: "Professional",
    price: "$149/mo",
    popular: true,
    limits: { clients: "15", events: "25", attendees: "5,000", emails: "20,000", storage: "25 GB" },
    features: ["15 clients", "25 active events", "5,000 attendees/mo", "20,000 emails/mo", "25 GB storage", "Priority support"],
  },
  enterprise: {
    name: "Enterprise",
    price: "$399/mo",
    limits: { clients: "Unlimited", events: "Unlimited", attendees: "50,000", emails: "200,000", storage: "100 GB" },
    features: ["Unlimited clients", "Unlimited events", "50,000 attendees/mo", "200,000 emails/mo", "100 GB storage", "Dedicated support"],
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

function buildSubheadline(trigger: UpgradeTrigger, plan: PlanLimitData): string {
  const limit = plan.limits[trigger];
  switch (trigger) {
    case "clients": return `You've reached your ${limit} client limit on ${plan.name}.`;
    case "events": return `You've reached your ${limit} event limit on ${plan.name}.`;
    case "storage": return `You've used all ${limit} on ${plan.name}.`;
    case "attendees": return `You've reached ${limit} attendees this billing cycle.`;
    case "emails": return `You've reached ${limit} emails this billing cycle.`;
  }
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
  const currentPlan = PLAN_DATA[currentPlanId];
  const nextPlan = nextPlanId ? PLAN_DATA[nextPlanId] : null;

  const headline = HEADLINES[trigger];
  const subheadline = buildSubheadline(trigger, currentPlan);
  const isEnterprise = currentPlanId === "enterprise";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{headline}</DialogTitle>
          <DialogDescription>{subheadline}</DialogDescription>
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
            {/* Side by side comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current plan */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 opacity-70">
                <Badge variant="outline" className="text-[10px]">Current</Badge>
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
                <Badge variant="outline" className="text-[10px] border-primary text-primary">Upgrade to</Badge>
                <h3 className="font-display font-bold">{nextPlan.name}</h3>
                <p className="text-sm text-muted-foreground">{nextPlan.price}</p>
                <div className="pt-2 border-t border-primary/20">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {nextPlan.limits[trigger]} {trigger}
                  </p>
                </div>
                {/* Feature list */}
                <ul className="space-y-1 pt-1">
                  {nextPlan.features.map((f) => (
                    <li key={f} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
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
              <Button className="w-full" onClick={() => { closeUpgradeModal(); navigate("/dashboard/billing"); }}>
                Upgrade to {nextPlan.name}
              </Button>
            )}

            {/* Proration + small print */}
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">
                You'll be credited for unused days on your current plan.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cancel anytime. No contracts. Secured by Paddle.
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
