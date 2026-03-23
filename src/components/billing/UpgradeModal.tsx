import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Mail, CheckCircle, Zap, ArrowRight } from "lucide-react";
import { useUpgradeModal, type UpgradeTrigger } from "@/hooks/useUpgradeModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import PaddleCheckoutButton from "@/components/billing/PaddleCheckoutButton";
import DiscountCodeInput from "@/components/billing/DiscountCodeInput";
import { PLANS, PLAN_ORDER, ANNUAL_DISCOUNT_PERCENT, type PlanId } from "@/config/pricing";
import { useIsMobile } from "@/hooks/use-mobile";
import { type DiscountValidationResult, calculateDiscountedPrice, formatDiscountSummary } from "@/lib/discount-api";

const HEADLINES: Record<UpgradeTrigger, string> = {
  clients: "Need more clients?",
  events: "Running more events?",
  attendees: "Expecting more attendees?",
  emails: "Need to send more emails?",
  storage: "Running out of space?",
  ai_prompts: "Need more AI power?",
  ai_images: "Need more AI images?",
  whatsapp: "Need more WhatsApp messages?",
  brand_kits: "Need brand kits?",
  feature: "Unlock this feature",
};

const TRIGGER_LABEL: Record<UpgradeTrigger, string> = {
  clients: "clients",
  events: "events",
  attendees: "attendees per event",
  emails: "emails",
  storage: "storage",
  ai_prompts: "AI prompts",
  ai_images: "AI images",
  whatsapp: "WhatsApp messages",
  brand_kits: "brand kits",
  feature: "this feature",
};

interface UpgradeComparison {
  label: string;
  current: string;
  next: string;
}

function getNextPlan(current: PlanId): PlanId | null {
  const idx = PLAN_ORDER.indexOf(current);
  if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[idx + 1];
}

function getKeyComparisons(currentId: PlanId, nextId: PlanId, trigger: UpgradeTrigger): UpgradeComparison[] {
  const c = PLANS[currentId]?.limits;
  const n = PLANS[nextId]?.limits;
  if (!c || !n) return [];

  const fmt = (v: number) => (v === Infinity ? "Unlimited" : v.toLocaleString());
  const comparisons: UpgradeComparison[] = [];

  // Always show the triggered resource first
  const resourceMap: Record<string, { label: string; currentKey: keyof typeof c; nextKey: keyof typeof n }> = {
    clients: { label: "Clients", currentKey: "clients", nextKey: "clients" },
    events: { label: "Events / month", currentKey: "events", nextKey: "events" },
    attendees: { label: "Attendees / event", currentKey: "attendeesPerEvent", nextKey: "attendeesPerEvent" },
    emails: { label: "Emails / month", currentKey: "emailMessages", nextKey: "emailMessages" },
    ai_prompts: { label: "AI prompts / month", currentKey: "aiPrompts", nextKey: "aiPrompts" },
    ai_images: { label: "AI images / month", currentKey: "aiImages", nextKey: "aiImages" },
    whatsapp: { label: "WhatsApp / month", currentKey: "whatsappMessages", nextKey: "whatsappMessages" },
    brand_kits: { label: "Brand kits", currentKey: "brandKits", nextKey: "brandKits" },
    storage: { label: "Events / month", currentKey: "events", nextKey: "events" },
    feature: { label: "Events / month", currentKey: "events", nextKey: "events" },
  };

  const primary = resourceMap[trigger];
  if (primary) {
    comparisons.push({
      label: primary.label,
      current: fmt(c[primary.currentKey]),
      next: fmt(n[primary.nextKey]),
    });
  }

  // Add 2-3 more key comparisons
  const extras: { label: string; ck: keyof typeof c; nk: keyof typeof n }[] = [
    { label: "Events / month", ck: "events", nk: "events" },
    { label: "AI prompts", ck: "aiPrompts", nk: "aiPrompts" },
    { label: "WhatsApp messages", ck: "whatsappMessages", nk: "whatsappMessages" },
    { label: "Attendees / event", ck: "attendeesPerEvent", nk: "attendeesPerEvent" },
  ];

  for (const e of extras) {
    if (comparisons.length >= 4) break;
    if (comparisons.some((x) => x.label === e.label)) continue;
    if (c[e.ck] !== n[e.nk]) {
      comparisons.push({ label: e.label, current: fmt(c[e.ck]), next: fmt(n[e.nk]) });
    }
  }

  return comparisons;
}

function ModalBody() {
  const { trigger, featureLabel, closeUpgradeModal } = useUpgradeModal();
  const planLimits = usePlanLimits();
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);

  const handleSuccess = useCallback(
    (_txId: string) => {
      closeUpgradeModal();
    },
    [closeUpgradeModal]
  );

  if (!trigger) return null;

  const currentPlanId = (planLimits.planId as PlanId) || "starter";
  const nextPlanId = getNextPlan(currentPlanId);
  const currentPlan = PLANS[currentPlanId];
  const nextPlan = nextPlanId ? PLANS[nextPlanId] : null;
  const isEnterprise = currentPlanId === "enterprise";

  const headline = trigger === "feature" && featureLabel ? `Unlock ${featureLabel}` : HEADLINES[trigger];
  const comparisons = nextPlanId ? getKeyComparisons(currentPlanId, nextPlanId, trigger) : [];

  const price = nextPlan
    ? isAnnual
      ? nextPlan.annualMonthlyPrice
      : nextPlan.monthlyPrice
    : 0;
  const priceId = nextPlan
    ? isAnnual
      ? nextPlan.paddlePriceIdAnnual
      : nextPlan.paddlePriceIdMonthly
    : "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold">{headline}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {trigger === "feature"
            ? `This feature requires ${nextPlan?.name || "a higher"} plan.`
            : `You've reached your ${currentPlan?.name} limit for ${TRIGGER_LABEL[trigger]}.`}
        </p>
      </div>

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
        <>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAnnual(false)}
              className={`text-sm font-medium transition-colors ${
                !isAnnual ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-12 h-6 rounded-full bg-muted transition-colors"
              aria-label="Toggle annual billing"
            >
              <motion.div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-primary"
                animate={{ left: isAnnual ? "calc(100% - 22px)" : "2px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isAnnual ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Annual
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
                Save {ANNUAL_DISCOUNT_PERCENT}%
              </Badge>
            </button>
          </div>

          {/* Plan comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Current plan */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 opacity-60">
              <Badge variant="outline" className="text-[10px]">
                Current
              </Badge>
              <h3 className="font-display font-bold">{currentPlan?.name}</h3>
              <p className="text-sm text-muted-foreground">
                ${currentPlan?.monthlyPrice}/mo
              </p>
            </div>

            {/* Next plan */}
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-2 relative">
              {nextPlan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 shadow-sm gap-1 text-[10px]">
                    <Crown className="h-2.5 w-2.5" /> Popular
                  </Badge>
                </div>
              )}
              <Badge variant="outline" className="text-[10px] border-primary text-primary">
                Upgrade to
              </Badge>
              <h3 className="font-display font-bold">{nextPlan.name}</h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isAnnual ? "annual" : "monthly"}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-muted-foreground"
                >
                  ${price}/mo
                  {isAnnual && (
                    <span className="text-[10px] ml-1 text-emerald-600 dark:text-emerald-400">
                      (${nextPlan.annualTotalPrice}/yr)
                    </span>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Key gains */}
          {comparisons.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                What you'll unlock
              </p>
              {comparisons.map((c) => (
                <div key={c.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/60 line-through text-xs">{c.current}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.next}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Discount code */}
          <DiscountCodeInput
            planId={nextPlanId!}
            interval={isAnnual ? "annual" : "monthly"}
            onApplied={(r) => setAppliedDiscount(r)}
            onCleared={() => setAppliedDiscount(null)}
          />

          {/* CTA */}
          {priceId ? (
            <PaddleCheckoutButton
              priceId={priceId}
              planId={nextPlanId!}
              type="subscription"
              paddleDiscountId={appliedDiscount?.discount?.paddle_discount_id}
              onSuccess={handleSuccess}
            />
          ) : (
            <Button
              className="w-full gap-2"
              onClick={() => {
                closeUpgradeModal();
                navigate("/dashboard/billing");
              }}
            >
              <Zap className="h-4 w-4" /> Upgrade to {nextPlan.name}
            </Button>
          )}

          <div className="text-center space-y-0.5">
            <p className="text-xs text-muted-foreground">
              You'll be credited for unused days on your current plan.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Secure payments via Paddle. Cancel anytime.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function UpgradeModal() {
  const { isOpen, closeUpgradeModal } = useUpgradeModal();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
        <DrawerContent className="px-4 pb-8 pt-4">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Upgrade Plan</DrawerTitle>
            <DrawerDescription>Choose your next plan</DrawerDescription>
          </DrawerHeader>
          <ModalBody />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Upgrade Plan</DialogTitle>
          <DialogDescription>Choose your next plan</DialogDescription>
        </DialogHeader>
        <ModalBody />
      </DialogContent>
    </Dialog>
  );
}
