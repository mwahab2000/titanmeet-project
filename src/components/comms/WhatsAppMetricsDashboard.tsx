import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import {
  getWhatsAppMetrics,
  type WhatsAppMetrics,
} from "@/lib/whatsapp-api";
import {
  Send, CheckCircle2, Eye, MessageSquare, AlertTriangle,
  RefreshCw, TrendingUp, Inbox,
} from "lucide-react";

function MetricBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WhatsAppMetricsDashboard() {
  const { event } = useEventWorkspace();
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    try {
      const m = await getWhatsAppMetrics(event.id);
      setMetrics(m);
    } catch (err) {
      console.error("Failed to load WhatsApp metrics", err);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp Delivery Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalSent === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp Delivery Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No WhatsApp messages sent yet for this event.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp Delivery Funnel
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={load}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{metrics.totalSent}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-500">{metrics.delivered}</p>
            <p className="text-[10px] text-muted-foreground">Delivered</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-500">{metrics.read}</p>
            <p className="text-[10px] text-muted-foreground">Read</p>
          </div>
          <div>
            <p className="text-lg font-bold text-primary">{metrics.replied}</p>
            <p className="text-[10px] text-muted-foreground">Replied</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <MetricBar label="Delivery Rate" value={metrics.delivered} total={metrics.totalSent} color="bg-blue-500" />
          <MetricBar label="Read Rate" value={metrics.read} total={metrics.totalSent} color="bg-emerald-500" />
          <MetricBar label="Reply Rate" value={metrics.replied} total={metrics.totalSent} color="bg-primary" />
        </div>

        {metrics.failed > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{metrics.failed} message{metrics.failed !== 1 ? "s" : ""} failed delivery</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
