import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useBilling } from "@/hooks/useBilling";
import { calculateOverages, formatCents, usagePercent } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import PayPalSubscriptionButton from "@/components/billing/PayPalSubscriptionButton";
import PayPalOneTimeButton from "@/components/billing/PayPalOneTimeButton";

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

const BillingPage = () => {
  const { user } = useAuth();
  const { plans, subscription, currentPlan, usage, loading } = useBilling();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentIntents, setPaymentIntents] = useState<any[]>([]);
  const [entitlement, setEntitlement] = useState<{ access_until: string; source: string } | null>(null);
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [purchaseType, setPurchaseType] = useState<"one_time" | "monthly">("one_time");

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

  // Handle redirect from PayPal
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment submitted! Your access will be updated shortly.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => { loadPaymentIntents(); loadEntitlement(); }, 2000);
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment was cancelled. You can try again anytime.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, loadPaymentIntents, loadEntitlement]);

  // Poll for active payments
  useEffect(() => {
    const hasActive = paymentIntents.some((pi) => pi.status === "pending" || pi.status === "awaiting_payment");
    if (!hasActive) return;
    const interval = setInterval(() => { loadPaymentIntents(); loadEntitlement(); }, 15000);
    return () => clearInterval(interval);
  }, [paymentIntents, loadPaymentIntents, loadEntitlement]);

  const handleOneTimePayment = async (planId: string) => {
    if (!user) return;
    setCreatingPayment(planId);
    try {
      const { data, error } = await supabase.functions.invoke("paypal-create-order", {
        body: { plan_id: planId },
      });
      if (error) throw error;
      if (data?.order_id) {
        // Load PayPal JS SDK and open checkout
        toast.info("PayPal order created. Opening checkout...");
        // For now, we'll use server-side capture flow
        // The PayPal JS SDK buttons approach is handled in the PayPal button component
        // Store orderId for capture
        const captureRes = await handlePayPalApprove(data.order_id);
        if (!captureRes) {
          toast.info("Order created. Complete payment via PayPal checkout.");
        }
      }
      await loadPaymentIntents();
    } catch (err: any) {
      console.error("Payment creation failed:", err);
      toast.error(err.message || "Failed to create payment. Please try again.");
    } finally {
      setCreatingPayment(null);
    }
  };

  const handlePayPalApprove = async (orderId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if (data?.status === "paid" || data?.status === "already_captured") {
        toast.success("Payment confirmed! Your access has been updated.");
        await loadEntitlement();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Capture failed:", err);
      return false;
    }
  };

  const handleSubscription = async (planId: string) => {
    if (!user) return;
    setCreatingPayment(planId);
    try {
      const { data, error } = await supabase.functions.invoke("paypal-create-subscription", {
        body: { plan_id: planId },
      });
      if (error) throw error;
      if (data?.approval_url) {
        window.open(data.approval_url, "_blank");
        toast.success(`Subscription checkout opened for ${data.plan_name}. Complete in the new tab.`);
      } else {
        toast.info("Subscription created but no checkout URL. Check payment history.");
      }
      await loadPaymentIntents();
    } catch (err: any) {
      console.error("Subscription creation failed:", err);
      toast.error(err.message || "Failed to create subscription.");
    } finally {
      setCreatingPayment(null);
    }
  };

  const isAccessExpired = entitlement ? new Date(entitlement.access_until) < new Date() : true;
  const isCanceledButActive = subscription?.cancel_at_period_end && !isAccessExpired;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentPlan || !subscription) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-2">Billing</h1>
        <p className="text-muted-foreground">No subscription found. Contact support.</p>
      </div>
    );
  }

  const overages = calculateOverages(usage, currentPlan, currentPlan);
  const totalOverageCents = overages.reduce((sum, o) => sum + o.amount_cents, 0);

  const usageMetrics = [
    { label: "Clients", used: usage.clients_count, limit: currentPlan.max_clients },
    { label: "Active Events", used: usage.active_events_count, limit: currentPlan.max_active_events },
    { label: "Attendees", used: usage.attendees_count, limit: currentPlan.max_attendees },
    { label: "Emails Sent", used: usage.emails_sent_count, limit: currentPlan.max_emails },
    { label: "Storage (GB)", used: Math.round((usage.storage_used_mb / 1024) * 10) / 10, limit: currentPlan.max_storage_gb },
  ];

  const warnings = usageMetrics.filter((m) => usagePercent(m.used, m.limit) >= 80);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, track usage, and pay with PayPal.</p>
      </div>

      {/* Access expired banner */}
      {isAccessExpired && entitlement && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Access Expired</AlertTitle>
          <AlertDescription>
            Your access expired on {new Date(entitlement.access_until).toLocaleDateString()}. Renew below to continue using premium features.
          </AlertDescription>
        </Alert>
      )}

      {/* Canceled but still active */}
      {isCanceledButActive && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Subscription Canceling</AlertTitle>
          <AlertDescription>
            Your subscription is canceled but access continues until {new Date(subscription.current_period_end).toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage warnings */}
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
              <span className="text-2xl font-bold font-display">{currentPlan.name}</span>
              <Badge variant="secondary">{currentPlan.support_tier} support</Badge>
            </div>
            <p className="text-3xl font-bold gradient-titan-text">
              {formatCents(currentPlan.monthly_price_cents)}
              <span className="text-sm text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Access Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entitlement ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={isAccessExpired ? "destructive" : "default"}>
                    {isAccessExpired ? "Expired" : "Active"}
                  </Badge>
                  <span className="text-sm text-muted-foreground capitalize">{entitlement.source.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm">
                  {isAccessExpired ? "Expired" : "Active until"}: <strong>{new Date(entitlement.access_until).toLocaleDateString()}</strong>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No active entitlement. Purchase a plan below.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage meters */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Current Usage</CardTitle>
          <CardDescription>Usage tracked against your {currentPlan.name} plan limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {usageMetrics.map((m) => {
            const pct = usagePercent(m.used, m.limit);
            return (
              <div key={m.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">{m.used} / {m.limit}{m.label.includes("GB") ? " GB" : ""}</span>
                </div>
                <Progress value={pct} className="h-2" />
                {pct >= 100 && <p className="text-xs text-destructive font-medium">Over limit — overages apply</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Overages */}
      {overages.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="font-display text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Overage Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overages.map((o) => (
                <div key={o.label} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{o.label}</span>
                    <span className="text-muted-foreground ml-2">({o.excess} excess, {o.unit})</span>
                  </div>
                  <span className="font-semibold">{formatCents(o.amount_cents)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm font-bold pt-1">
                <span>Total Overages</span>
                <span>{formatCents(totalOverageCents)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans + PayPal Checkout */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Available Plans — Pay with PayPal</CardTitle>
          <CardDescription>Choose one-time (30 days) or monthly subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Purchase type toggle */}
          <Tabs value={purchaseType} onValueChange={(v) => setPurchaseType(v as any)}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="one_time">One-Time (30 days)</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Subscription</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-4 space-y-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                    {isCurrent && <Badge><CheckCircle className="h-3 w-3 mr-1" />Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCents(plan.monthly_price_cents)}
                    <span className="text-sm text-muted-foreground font-normal">
                      {purchaseType === "one_time" ? " / 30 days" : " /mo"}
                    </span>
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{plan.max_clients} clients</li>
                    <li>{plan.max_active_events} active events/mo</li>
                    <li>{plan.max_attendees.toLocaleString()} attendees/mo</li>
                    <li>{plan.max_emails.toLocaleString()} emails/mo</li>
                    <li>{plan.max_storage_gb} GB storage</li>
                    <li className="capitalize">{plan.support_tier} support</li>
                  </ul>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => purchaseType === "one_time"
                      ? handleOneTimePayment(plan.id)
                      : handleSubscription(plan.id)
                    }
                    disabled={!!creatingPayment}
                  >
                    {creatingPayment === plan.id ? (
                      <><RefreshCw className="h-3 w-3 animate-spin" /> Processing...</>
                    ) : (
                      <>
                        <CreditCard className="h-3 w-3" />
                        {purchaseType === "one_time" ? "Pay with PayPal" : "Subscribe with PayPal"}
                      </>
                    )}
                  </Button>
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
              <CardDescription>Your PayPal payment transactions</CardDescription>
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
                            {pi.purchase_type === "monthly" ? "Monthly" : "One-time"}
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => pi.purchase_type === "monthly"
                                ? handleSubscription(pi.plan_id)
                                : handleOneTimePayment(pi.plan_id)
                              }
                              disabled={!!creatingPayment}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
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
    </div>
  );
};

export default BillingPage;
