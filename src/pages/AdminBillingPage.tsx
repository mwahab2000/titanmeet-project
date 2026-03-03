import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/billing";
import { Shield } from "lucide-react";

interface AdminAccount {
  user_id: string;
  plan_id: string;
  plan_name: string;
  plan_price_cents: number;
  status: string;
  started_at: string;
  full_name: string | null;
  email: string | null;
  clients_count: number;
  events_count: number;
  attendees_count: number;
  emails_count: number;
}

const AdminBillingPage = () => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMRR, setTotalMRR] = useState(0);

  useEffect(() => {
    const load = async () => {
      // Fetch all subscriptions (admin RLS policy allows this)
      const { data: subs } = await supabase.from("account_subscriptions").select("*");
      const { data: plans } = await supabase.from("subscription_plans").select("*");
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
      const { data: usageRows } = await supabase.from("monthly_usage").select("*");

      if (!subs || !plans) {
        setLoading(false);
        return;
      }

      const planMap = new Map(plans.map((p: any) => [p.id, p]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const usageMap = new Map((usageRows || []).map((u: any) => [u.user_id, u]));

      let mrr = 0;
      const mapped: AdminAccount[] = subs.map((sub: any) => {
        const plan = planMap.get(sub.plan_id) as any;
        const profile = profileMap.get(sub.user_id) as any;
        const usage = usageMap.get(sub.user_id) as any;
        mrr += plan?.monthly_price_cents || 0;

        return {
          user_id: sub.user_id,
          plan_id: sub.plan_id,
          plan_name: plan?.name || sub.plan_id,
          plan_price_cents: plan?.monthly_price_cents || 0,
          status: sub.status,
          started_at: sub.started_at,
          full_name: profile?.full_name || null,
          email: null,
          clients_count: usage?.clients_count || 0,
          events_count: usage?.active_events_count || 0,
          attendees_count: usage?.attendees_count || 0,
          emails_count: usage?.emails_sent_count || 0,
        };
      });

      setTotalMRR(mrr);
      setAccounts(mapped);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const planCounts = accounts.reduce((acc, a) => {
    acc[a.plan_name] = (acc[a.plan_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> Admin Billing Overview
        </h1>
        <p className="text-muted-foreground">Internal view of all accounts, plans, and usage.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Monthly Recurring Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display gradient-titan-text">{formatCents(totalMRR)}</p>
          </CardContent>
        </Card>
        {Object.entries(planCounts).map(([name, count]) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{name} Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accounts table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">All Accounts</CardTitle>
          <CardDescription>Account-level billing and usage snapshot</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.user_id}>
                    <TableCell className="font-medium">{a.full_name || a.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{a.plan_name}</Badge></TableCell>
                    <TableCell>{formatCents(a.plan_price_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>{a.clients_count}</TableCell>
                    <TableCell>{a.events_count}</TableCell>
                    <TableCell>{a.attendees_count}</TableCell>
                    <TableCell>{a.emails_count}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(a.started_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No accounts found. Admin role required to view all accounts.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBillingPage;
