import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, ArrowUpRight, Bitcoin, Clock, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useBilling } from "@/hooks/useBilling";
import { calculateOverages, formatCents, usagePercent } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Awaiting Payment", variant: "outline" },
  processing: { label: "Payment Detected", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  expired: { label: "Expired", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  underpaid: { label: "Underpaid", variant: "secondary" },
};

const BillingPage = () => {
  const { user } = useAuth();
  const { plans, subscription, currentPlan, usage, loading } = useBilling();
  const [searchParams] = useSearchParams();
  const [paymentIntents, setPaymentIntents] = useState<any[]>([]);
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);

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

  useEffect(() => {
    loadPaymentIntents();
  }, [loadPaymentIntents]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment submitted! Your subscription will activate once confirmed.");
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment cancelled.");
    }
  }, [searchParams]);

  const handleCryptoPayment = async (planId: string) => {
    if (!user) return;
    setCreatingPayment(planId);
    try {
      const { data, error } = await supabase.functions.invoke("create-triplea-payment", {
        body: { plan_id: planId },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.open(data.checkout_url, "_blank");
        toast.success("Checkout opened in a new tab. Complete your crypto payment there.");
      } else {
        toast.info("Payment created. Check your payment history for details.");
      }
      await loadPaymentIntents();
    } catch (err: any) {
      console.error("Payment creation failed:", err);
      toast.error(err.message || "Failed to create payment. Please try again.");
    } finally {
      setCreatingPayment(null);
    }
  };

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
  const estimatedBillCents = currentPlan.monthly_price_cents + totalOverageCents;

  const usageMetrics = [
    { label: "Clients", used: usage.clients_count, limit: currentPlan.max_clients },
    { label: "Active Events", used: usage.active_events_count, limit: currentPlan.max_active_events },
    { label: "Attendees", used: usage.attendees_count, limit: currentPlan.max_attendees },
    { label: "Emails Sent", used: usage.emails_sent_count, limit: currentPlan.max_emails },
    { label: "Storage (GB)", used: Math.round((usage.storage_used_mb / 1024) * 10) / 10, limit: currentPlan.max_storage_gb },
  ];

  const warnings = usageMetrics.filter((m) => usagePercent(m.used, m.limit) >= 80);

  // Check for any pending payments for a plan
  const hasPendingPayment = (planId: string) =>
    paymentIntents.some((pi) => pi.plan_id === planId && (pi.status === "pending" || pi.status === "processing"));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, track usage, and pay with crypto.</p>
      </div>

      {/* Upgrade warnings */}
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
            {currentPlan.id !== "enterprise" && (
              <span className="font-medium">Consider upgrading your plan.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan + estimated bill */}
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
            <p className="text-3xl font-bold gradient-titan-text">{formatCents(currentPlan.monthly_price_cents)}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
            <p className="text-xs text-muted-foreground">
              Period: {new Date(subscription.current_period_start).toLocaleDateString()} — {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Estimated Bill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold font-display">{formatCents(estimatedBillCents)}</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Base plan</span><span>{formatCents(currentPlan.monthly_price_cents)}</span></div>
              {totalOverageCents > 0 && (
                <div className="flex justify-between text-yellow-600 dark:text-yellow-400">
                  <span>Overages</span><span>+{formatCents(totalOverageCents)}</span>
                </div>
              )}
            </div>
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
                {pct >= 100 && (
                  <p className="text-xs text-destructive font-medium">Over limit — overages apply</p>
                )}
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

      {/* Plan comparison / upgrade with crypto */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Available Plans</CardTitle>
          <CardDescription>Compare plans and pay with cryptocurrency via Triple-A</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              const pending = hasPendingPayment(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-4 space-y-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                    {isCurrent && <Badge><CheckCircle className="h-3 w-3 mr-1" />Current</Badge>}
                    {pending && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                  </div>
                  <p className="text-2xl font-bold">{formatCents(plan.monthly_price_cents)}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{plan.max_clients} clients</li>
                    <li>{plan.max_active_events} active events/mo</li>
                    <li>{plan.max_attendees.toLocaleString()} attendees/mo</li>
                    <li>{plan.max_emails.toLocaleString()} emails/mo</li>
                    <li>{plan.max_storage_gb} GB storage</li>
                    <li className="capitalize">{plan.support_tier} support</li>
                  </ul>
                  {!isCurrent && !pending && (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => handleCryptoPayment(plan.id)}
                      disabled={creatingPayment === plan.id}
                    >
                      {creatingPayment === plan.id ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" /> Creating...</>
                      ) : (
                        <><Bitcoin className="h-3 w-3" /> {plan.display_order > currentPlan.display_order ? "Upgrade" : "Switch"} with Crypto</>
                      )}
                    </Button>
                  )}
                  {pending && (
                    <p className="text-xs text-center text-muted-foreground">Payment pending confirmation</p>
                  )}
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
                <Bitcoin className="h-5 w-5 text-primary" /> Payment History
              </CardTitle>
              <CardDescription>Your crypto payment transactions</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={loadPaymentIntents}>
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
            <p className="text-center text-muted-foreground py-8">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentIntents.map((pi: any) => {
                    const statusInfo = STATUS_LABELS[pi.status] || { label: pi.status, variant: "outline" as const };
                    const isRetryable = pi.status === "expired" || pi.status === "failed" || pi.status === "cancelled";
                    return (
                      <TableRow key={pi.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(pi.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium capitalize">{pi.plan_id}</TableCell>
                        <TableCell>{formatCents(pi.amount_usd_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{pi.internal_order_id}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {pi.checkout_url && pi.status === "pending" && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={pi.checkout_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" /> Pay
                                </a>
                              </Button>
                            )}
                            {isRetryable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCryptoPayment(pi.plan_id)}
                                disabled={creatingPayment === pi.plan_id}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                          </div>
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
