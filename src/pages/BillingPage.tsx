import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PLANS, PLAN_ORDER, formatLimit, VOICE_MINUTES_NOTE } from "@/config/pricing";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, ShieldCheck, Crown, Link as LinkIcon, Check } from "lucide-react";
import { useBilling } from "@/hooks/useBilling";
import { formatCents, usagePercent } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSearchParams, Link } from "react-router-dom";
import PaddleCheckoutButton from "@/components/billing/PaddleCheckoutButton";
import UsageMeters from "@/components/billing/UsageMeters";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, variant: "outline" },
  awaiting_payment: { label: "Awaiting Payment", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  paid: { label: "Paid", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  confirmed: { label: "Confirmed", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  active: { label: "Active", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  expired: { label: "Expired", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
  failed: { label: "Failed", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
  canceled: { label: "Canceled", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

const PLAN_ORDER_IDX: Record<string, number> = Object.fromEntries(PLAN_ORDER.map((id, i) => [id, i]));

const RESOURCE_LABELS_DG: Record<string, string> = {
  clients: "clients",
  events: "active events",
  attendees: "attendees",
  emails: "emails",
  storage: "storage (GB)",
};

const RESOURCE_LINKS: Record<string, string> = {
  clients: "/dashboard/clients",
  events: "/dashboard/events",
  attendees: "/dashboard/attendees",
  emails: "/dashboard/billing",
  storage: "/dashboard/settings",
};

const BillingPage = () => {
  const { user } = useAuth();
  const { plans, subscription, currentPlan, usage, loading } = useBilling();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentIntents, setPaymentIntents] = useState<any[]>([]);
  const [entitlement, setEntitlement] = useState<{ access_until: string; source: string } | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [schedulingDowngrade, setSchedulingDowngrade] = useState(false);
  const [cancellingDowngrade, setCancellingDowngrade] = useState(false);
  const [downgradeDialog, setDowngradeDialog] = useState<{ planId: string; blocked: boolean; issues: { resource: string; current: number; limit: number }[] } | null>(null);
  const planLimits = usePlanLimits();

  const loadPaymentIntents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_intents" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setPaymentIntents((data as any[]) || []);
    setLoadingPayments(false);
  }, [user]);

  const loadEntitlement = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("account_entitlements" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setEntitlement(data as any);
  }, [user]);

  useEffect(() => {
    loadPaymentIntents();
    loadEntitlement();
  }, [loadPaymentIntents, loadEntitlement]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment submitted! Your access will be updated shortly.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => { loadPaymentIntents(); loadEntitlement(); }, 3000);
      setTimeout(() => { loadPaymentIntents(); loadEntitlement(); }, 8000);
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment was cancelled. You can try again anytime.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, loadPaymentIntents, loadEntitlement]);

  useEffect(() => {
    const hasActive = paymentIntents.some((pi) => pi.status === "pending" || pi.status === "awaiting_payment");
    if (!hasActive) return;
    const interval = setInterval(() => { loadPaymentIntents(); loadEntitlement(); }, 15000);
    return () => clearInterval(interval);
  }, [paymentIntents, loadPaymentIntents, loadEntitlement]);

  const handlePaddleSuccess = useCallback(async (_transactionId: string) => {
    toast.success("Payment received! Activating your access...");
    setTimeout(() => { loadPaymentIntents(); loadEntitlement(); }, 3000);
    setTimeout(() => { loadPaymentIntents(); loadEntitlement(); }, 8000);
  }, [loadPaymentIntents, loadEntitlement]);

  const handleCancelSubscription = useCallback(async () => {
    try {
      setCancellingSubscription(true);
      const { data, error } = await supabase.functions.invoke("paddle-cancel-subscription", {});
      if (error) throw error;
      toast.success("Subscription cancellation requested. Access continues until end of current period.");
      await loadPaymentIntents();
      await loadEntitlement();
      window.location.reload();
    } catch (err: any) {
      console.error("Cancel subscription failed:", err);
      toast.error(err.message || "Failed to cancel subscription.");
    } finally {
      setCancellingSubscription(false);
    }
  }, [loadPaymentIntents, loadEntitlement]);

  const handleScheduleDowngrade = useCallback(async (targetPlanId: string) => {
    try {
      setSchedulingDowngrade(true);
      const { data, error } = await supabase.functions.invoke("schedule-plan-change", {
        body: { newPlanSlug: targetPlanId },
      });
      if (error) throw error;
      toast.success(`Downgrade to ${PLANS[targetPlanId]?.name || targetPlanId} scheduled for end of billing period.`);
      setDowngradeDialog(null);
      window.location.reload();
    } catch (err: any) {
      console.error("Schedule downgrade failed:", err);
      toast.error(err.message || "Failed to schedule downgrade.");
    } finally {
      setSchedulingDowngrade(false);
    }
  }, []);

  const handleCancelDowngrade = useCallback(async () => {
    try {
      setCancellingDowngrade(true);
      const { data, error } = await supabase.functions.invoke("cancel-downgrade", {});
      if (error) throw error;
      toast.success("Scheduled downgrade cancelled. Your current plan continues.");
      window.location.reload();
    } catch (err: any) {
      console.error("Cancel downgrade failed:", err);
      toast.error(err.message || "Failed to cancel downgrade.");
    } finally {
      setCancellingDowngrade(false);
    }
  }, []);

  const isAccessExpired = entitlement ? new Date(entitlement.access_until) < new Date() : true;
  const isSubscriptionEnded = subscription?.status === "canceled" && isAccessExpired;
  const isCanceledButActive = subscription?.cancel_at_period_end && !isAccessExpired && !subscription?.scheduled_plan;
  const hasScheduledDowngrade = !!subscription?.scheduled_plan && !subscription?.cancel_at_period_end;
  const canCancelSubscription = subscription?.provider_subscription_id && subscription?.status === "active" && !subscription?.cancel_at_period_end;

  const checkDowngrade = (targetPlanId: string) => {
    const currentIdx = PLAN_ORDER_IDX[subscription?.plan_id || "starter"] ?? 0;
    const targetIdx = PLAN_ORDER_IDX[targetPlanId] ?? 0;
    if (targetIdx >= currentIdx) return null;

    const targetPlan = PLANS[targetPlanId];
    if (!targetPlan) return null;
    const targetLimits: Record<string, number> = {
      clients: targetPlan.limits.clients,
      events: targetPlan.limits.events,
    };
    const usageMap: Record<string, number> = {
      clients: planLimits.clients.used,
      events: planLimits.activeEvents.used,
    };

    const issues: { resource: string; current: number; limit: number }[] = [];
    for (const [key, limit] of Object.entries(targetLimits)) {
      if (limit !== Infinity && usageMap[key] > limit) {
        issues.push({ resource: key, current: usageMap[key], limit });
      }
    }
    return { planId: targetPlanId, blocked: issues.length > 0, issues };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // No subscription — show plan cards
  if (!subscription) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">No active subscription found. Choose a plan below to get started.</p>
        </div>

        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>Sandbox Testing Mode</AlertTitle>
          <AlertDescription>
            Use test card <code className="bg-muted px-1 rounded text-xs">4242 4242 4242 4242</code> with any future expiry and CVC.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            return (
              <Card key={planId} className={plan.highlight ? "border-primary shadow-lg relative" : ""}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground"><Crown className="h-3 w-3 mr-1" /> Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="font-display">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-3xl font-bold mt-2">
                    ${plan.monthlyPrice}
                    <span className="text-sm text-muted-foreground font-normal">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f.text} className={`flex items-center gap-2 ${f.highlight ? "text-primary font-medium" : ""}`}>
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f.text}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">{VOICE_MINUTES_NOTE}</p>
                  <PaddleCheckoutButton
                    priceId={plan.paddlePriceIdMonthly}
                    planId={planId}
                    type="subscription"
                    onSuccess={handlePaddleSuccess}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const usageMetrics = [
    { label: "Clients", used: usage.clients_count, limit: currentPlan?.max_clients ?? 3 },
    { label: "Active Events", used: usage.active_events_count, limit: currentPlan?.max_active_events ?? 20 },
    { label: "Attendees", used: usage.attendees_count, limit: currentPlan?.max_attendees ?? 500 },
    { label: "Emails Sent", used: usage.emails_sent_count, limit: currentPlan?.max_emails ?? 2000 },
    { label: "Storage (GB)", used: Math.round((usage.storage_used_mb / 1024) * 10) / 10, limit: currentPlan?.max_storage_gb ?? 5 },
  ];

  const warnings = usageMetrics.filter((m) => usagePercent(m.used, m.limit) >= 80);

  const periodEndDate = new Date(subscription.current_period_end).toLocaleDateString();
  const periodStartDate = new Date(subscription.current_period_start).toLocaleDateString();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, track usage, and pay securely with card.</p>
      </div>

      {isSubscriptionEnded && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Subscription Ended</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your subscription has ended. Resubscribe to continue creating.</span>
          </AlertDescription>
        </Alert>
      )}

      {isAccessExpired && entitlement && !isSubscriptionEnded && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Access Expired</AlertTitle>
          <AlertDescription>
            Your access expired on {new Date(entitlement.access_until).toLocaleDateString()}. Renew below to continue using premium features.
          </AlertDescription>
        </Alert>
      )}

      {isCanceledButActive && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Subscription Cancelled</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your subscription is cancelled — access continues until {periodEndDate}. Resubscribe anytime.</span>
          </AlertDescription>
        </Alert>
      )}

      {hasScheduledDowngrade && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Downgrade Scheduled</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your plan will downgrade to {PLANS[subscription.scheduled_plan!]?.name || subscription.scheduled_plan} on {periodEndDate}. You'll keep {currentPlan?.name} access until then.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 shrink-0"
              onClick={handleCancelDowngrade}
              disabled={cancellingDowngrade}
            >
              {cancellingDowngrade ? "Cancelling..." : "Cancel Downgrade"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Usage Alert</AlertTitle>
          <AlertDescription>
            {warnings.map((w) => (
              <div key={w.label}>
                You've used {usagePercent(w.used, w.limit)}% of your {w.label.toLowerCase()} limit ({w.used}/{w.limit}).
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan + access status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-display">{currentPlan?.name}</span>
              {isSubscriptionEnded ? (
                <Badge variant="destructive">Subscription Ended</Badge>
              ) : isCanceledButActive ? (
                <Badge variant="destructive">Cancellation Scheduled</Badge>
              ) : hasScheduledDowngrade ? (
                <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Downgrade Scheduled</Badge>
              ) : (
                <Badge variant="secondary">{currentPlan?.support_tier} support</Badge>
              )}
            </div>

            {!isSubscriptionEnded && (
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Current period: {periodStartDate} – {periodEndDate}</p>
                {hasScheduledDowngrade && (
                  <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                    Downgrades to {PLANS[subscription.scheduled_plan!]?.name} on {periodEndDate}
                  </p>
                )}
                {isCanceledButActive && (
                  <p className="text-destructive font-medium">Cancels {periodEndDate}</p>
                )}
                {!isCanceledButActive && !hasScheduledDowngrade && (
                  <p>Next billing: {periodEndDate}</p>
                )}
              </div>
            )}

            <p className="text-3xl font-bold gradient-titan-text">
              {formatCents(currentPlan?.monthly_price_cents ?? 0)}
              <span className="text-sm text-muted-foreground font-normal">/mo</span>
            </p>

            {canCancelSubscription && !hasScheduledDowngrade && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Your access continues until: <strong>{periodEndDate}</strong></li>
                          <li>After that date your account becomes view-only</li>
                          <li>You can resubscribe anytime</li>
                          <li>No data will be deleted</li>
                        </ul>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      disabled={cancellingSubscription}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancellingSubscription ? "Cancelling..." : "Yes, Cancel"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {hasScheduledDowngrade && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleCancelDowngrade}
                disabled={cancellingDowngrade}
              >
                {cancellingDowngrade ? "Cancelling..." : "Cancel Downgrade"}
              </Button>
            )}

            {(isCanceledButActive || isSubscriptionEnded) && (
              <div className="mt-2">
                <PaddleCheckoutButton
                  priceId={PLANS[subscription.plan_id]?.paddlePriceIdMonthly || ""}
                  planId={subscription.plan_id}
                  type="subscription"
                  onSuccess={handlePaddleSuccess}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Access Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isSubscriptionEnded ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Ended</Badge>
                  <span className="text-sm text-muted-foreground">No Active Plan</span>
                </div>
                <p className="text-sm text-muted-foreground">Your account is in view-only mode. Resubscribe to continue creating.</p>
              </>
            ) : subscription && subscription.status === "active" ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="default">Active</Badge>
                  <span className="text-sm text-muted-foreground">{currentPlan?.name} Plan</span>
                </div>
                <p className="text-sm">
                  Current period ends: <strong>{periodEndDate}</strong>
                </p>
              </>
            ) : isCanceledButActive ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Cancelling</Badge>
                  <span className="text-sm text-muted-foreground">{currentPlan?.name} Plan</span>
                </div>
                <p className="text-sm">
                  Access until: <strong>{periodEndDate}</strong>
                </p>
              </>
            ) : entitlement && !isAccessExpired ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="default">Active</Badge>
                  <span className="text-sm text-muted-foreground capitalize">{entitlement.source.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm">
                  Active until: <strong>{new Date(entitlement.access_until).toLocaleDateString()}</strong>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No active plan — upgrade below.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <UsageMeters />

      {import.meta.env.VITE_PADDLE_ENV === "sandbox" && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">Sandbox Testing Mode</AlertTitle>
          <AlertDescription className="text-amber-700/80 dark:text-amber-300/80">
            Paddle is in sandbox mode. Use test card <strong>4242 4242 4242 4242</strong>,
            any future expiry, any CVC. Real cards will not be charged.
          </AlertDescription>
        </Alert>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Available Plans</CardTitle>
          <CardDescription>Choose a plan · {VOICE_MINUTES_NOTE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = planId === subscription?.plan_id;

              return (
                <div
                  key={planId}
                  className={`relative rounded-lg border p-4 space-y-3 ${
                    plan.highlight
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 shadow-md gap-1">
                        <Crown className="h-3 w-3" /> Most Popular
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                    {isCurrent && (
                      <Badge><CheckCircle className="h-3 w-3 mr-1" />Current</Badge>
                    )}
                  </div>

                  <p className="text-2xl font-bold">
                    ${plan.monthlyPrice}
                    <span className="text-sm text-muted-foreground font-normal">/mo</span>
                  </p>

                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f.text} className={`flex items-center gap-2 ${f.highlight ? "text-primary font-medium" : ""}`}>
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f.text}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : !plan.paddlePriceIdMonthly ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Plan not configured</p>
                  ) : (() => {
                    const isDowngrade = (PLAN_ORDER_IDX[planId] ?? 0) < (PLAN_ORDER_IDX[subscription?.plan_id || "starter"] ?? 0);
                    if (isDowngrade) {
                      return (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => {
                            const result = checkDowngrade(planId);
                            if (result) setDowngradeDialog(result);
                          }}
                        >
                          Downgrade to {plan.name}
                        </Button>
                      );
                    }
                    return (
                      <PaddleCheckoutButton
                        priceId={plan.paddlePriceIdMonthly}
                        planId={planId}
                        type="subscription"
                        onSuccess={handlePaddleSuccess}
                      />
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Payment History
              </CardTitle>
              <CardDescription>Your payment transactions</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => { loadPaymentIntents(); loadEntitlement(); }}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPayments ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : paymentIntents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments yet. Select a plan above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentIntents.map((pi: any) => {
                    const statusInfo = STATUS_LABELS[pi.status] || { label: pi.status, icon: null, variant: "outline" as const };
                    const isRetryable = pi.status === "expired" || pi.status === "failed" || pi.status === "cancelled";
                    return (
                      <TableRow key={pi.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(pi.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {pi.purchase_type === "monthly" ? "Monthly" : pi.purchase_type === "annual" ? "Annual" : "One-time"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium capitalize">{pi.plan_id}</TableCell>
                        <TableCell>{formatCents(pi.amount_usd_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="gap-1">
                            {statusInfo.icon}
                            {statusInfo.label}
                          </Badge>
                          {pi.paid_at && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              Paid {new Date(pi.paid_at).toLocaleDateString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{pi.internal_order_id}</TableCell>
                        <TableCell>
                          {isRetryable && (
                            <span className="text-xs text-muted-foreground">Use buttons above to retry</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Downgrade dialog */}
      <Dialog open={!!downgradeDialog} onOpenChange={(open) => !open && setDowngradeDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {downgradeDialog?.blocked ? "Cannot Downgrade Yet" : `Downgrade to ${PLANS[downgradeDialog?.planId || ""]?.name}?`}
            </DialogTitle>
            <DialogDescription>
              {downgradeDialog?.blocked
                ? "Your current usage exceeds the limits of this plan. Please reduce usage first."
                : undefined}
            </DialogDescription>
          </DialogHeader>

          {downgradeDialog?.blocked && downgradeDialog.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">To downgrade, you need to:</p>
              <ul className="space-y-1.5">
                {downgradeDialog.issues.map((issue) => (
                  <li key={issue.resource} className="flex items-center justify-between text-sm">
                    <span>
                      Reduce {RESOURCE_LABELS_DG[issue.resource]} from <strong>{issue.resource === "storage" ? issue.current.toFixed(1) : issue.current}</strong> to <strong>{issue.limit}</strong>
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                      <Link to={RESOURCE_LINKS[issue.resource]}>Manage →</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!downgradeDialog?.blocked && downgradeDialog?.planId && (
            <div className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1">
                <li>Takes effect: <strong>{periodEndDate}</strong></li>
                <li>New monthly price: <strong>${PLANS[downgradeDialog.planId]?.monthlyPrice}/mo</strong></li>
                <li>You keep {currentPlan?.name} access until <strong>{periodEndDate}</strong></li>
                <li>No data will be deleted</li>
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDowngradeDialog(null)}>Cancel</Button>
            {!downgradeDialog?.blocked && downgradeDialog?.planId && (
              <Button
                onClick={() => handleScheduleDowngrade(downgradeDialog.planId)}
                disabled={schedulingDowngrade}
              >
                {schedulingDowngrade ? "Scheduling..." : "Confirm Downgrade"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;
