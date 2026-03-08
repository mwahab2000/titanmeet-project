import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price_cents: number;
  max_clients: number;
  max_active_events: number;
  max_attendees: number;
  max_emails: number;
  max_storage_gb: number;
  support_tier: string;
  overage_client_cents: number;
  overage_event_cents: number;
  overage_attendees_per_100_cents: number;
  overage_emails_per_1000_cents: number;
  overage_storage_per_5gb_cents: number;
  display_order: number;
}

export interface AccountSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider: string;
  provider_subscription_id: string | null;
}

export interface UsageSnapshot {
  clients_count: number;
  active_events_count: number;
  attendees_count: number;
  emails_sent_count: number;
  storage_used_mb: number;
}

export function useBilling() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<AccountSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot>({
    clients_count: 0,
    active_events_count: 0,
    attendees_count: 0,
    emails_sent_count: 0,
    storage_used_mb: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // Fetch plans, subscription, and live usage counts in parallel
      const [plansRes, subRes, clientsRes, eventsRes, attendeesRes, emailsRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("is_active", true).order("display_order"),
        supabase.from("account_subscriptions").select("*").eq("user_id", user.id).single(),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["draft", "published", "ongoing"]),
        supabase.from("attendees").select("id", { count: "exact", head: true }),
        supabase.from("communications_log").select("id", { count: "exact", head: true }).eq("channel", "email"),
      ]);

      const allPlans = (plansRes.data || []) as SubscriptionPlan[];
      setPlans(allPlans);

      let sub = subRes.data as AccountSubscription | null;
      if (!sub) {
        // Auto-create starter subscription for existing users
        const { data: newSub } = await supabase
          .from("account_subscriptions")
          .insert({ user_id: user.id, plan_id: "starter" })
          .select()
          .single();
        sub = newSub as AccountSubscription | null;
      }
      setSubscription(sub);

      if (sub) {
        setCurrentPlan(allPlans.find((p) => p.id === sub!.plan_id) || null);
      }

      setUsage({
        clients_count: clientsRes.count || 0,
        active_events_count: eventsRes.count || 0,
        attendees_count: attendeesRes.count || 0,
        emails_sent_count: emailsRes.count || 0,
        storage_used_mb: 0, // Approximation — storage API not easily queryable from client
      });

      // Upsert monthly usage snapshot
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const periodStr = periodStart.toISOString().split("T")[0];

      await supabase.from("monthly_usage").upsert(
        {
          user_id: user.id,
          period_start: periodStr,
          clients_count: clientsRes.count || 0,
          active_events_count: eventsRes.count || 0,
          attendees_count: attendeesRes.count || 0,
          emails_sent_count: emailsRes.count || 0,
          storage_used_mb: 0,
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_start" }
      );

      setLoading(false);
    };

    load();
  }, [user]);

  return { plans, subscription, currentPlan, usage, loading };
}
