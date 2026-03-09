import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Calendar, Users, TrendingUp, Clock, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { callAi, type DashboardInsight } from "@/lib/ai-api";

const ICON_MAP: Record<string, React.ElementType> = {
  calendar: Calendar,
  users: Users,
  "trending-up": TrendingUp,
  clock: Clock,
  "alert-triangle": AlertTriangle,
  check: Check,
  sparkles: Sparkles,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  warning: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
  tip: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
};

interface Props {
  stats: { events: number; attendees: number; upcoming: number };
  recentEvents: any[];
}

const AIInsightsCard = ({ stats, recentEvents }: Props) => {
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await callAi<DashboardInsight[]>({
        action: "dashboard_insights",
        prompt: "Analyze these metrics and provide insights.",
        context: {
          totalEvents: stats.events,
          totalAttendees: stats.attendees,
          upcomingEvents: stats.upcoming,
          recentEvents: recentEvents.map((e) => ({
            title: e.title,
            status: e.status,
            date: e.start_date,
          })),
        },
      });
      setInsights(Array.isArray(result) ? result : []);
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (stats.events > 0) fetchInsights();
    else setLoading(false);
  }, [stats.events]);

  if (stats.events === 0 && !loading) return null;

  return (
    <Card className="border-purple-200 dark:border-purple-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Insights
          </CardTitle>
          {!loading && (
            <button
              onClick={fetchInsights}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </>
        )}
        {error && (
          <p className="text-sm text-muted-foreground">
            Could not load AI insights.{" "}
            <button onClick={fetchInsights} className="underline hover:text-foreground">
              Retry
            </button>
          </p>
        )}
        {!loading &&
          !error &&
          insights.map((insight, i) => {
            const Icon = ICON_MAP[insight.icon] || Sparkles;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{insight.message}</span>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
};

export default AIInsightsCard;
