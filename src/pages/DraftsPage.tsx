import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ArrowUpRight, Zap, FolderOpen, Pencil, Eye, Rocket, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishStatus, getCompletionLabel } from "@/lib/publishChecks";
import { format } from "date-fns";

type FilterMode = "all" | "incomplete" | "ready";

const DraftsPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [eventsRes, clientsRes] = await Promise.all([
        supabase.from("events").select("*").eq("status", "draft").order("updated_at", { ascending: false }),
        supabase.from("clients").select("id, name"),
      ]);
      setDrafts(eventsRes.data || []);
      const map: Record<string, string> = {};
      (clientsRes.data || []).forEach((c: any) => { map[c.id] = c.name; });
      setClients(map);
      setLoading(false);
    };
    load();
  }, [user]);

  const enrichedDrafts = drafts.map(d => {
    const status = getPublishStatus(d);
    const label = getCompletionLabel(status.pct);
    return { ...d, publishStatus: status, completionLabel: label };
  });

  const filtered = enrichedDrafts.filter(d => {
    const matchesSearch = !search || d.title?.toLowerCase().includes(search.toLowerCase());
    if (filter === "incomplete") return matchesSearch && !d.publishStatus.allPass;
    if (filter === "ready") return matchesSearch && d.publishStatus.allPass;
    return matchesSearch;
  });

  const incompleteCount = enrichedDrafts.filter(d => !d.publishStatus.allPass).length;
  const readyCount = enrichedDrafts.filter(d => d.publishStatus.allPass).length;

  const filterButtons: { key: FilterMode; label: string; count: number }[] = [
    { key: "all", label: "All Drafts", count: enrichedDrafts.length },
    { key: "incomplete", label: "Incomplete", count: incompleteCount },
    { key: "ready", label: "Ready to Publish", count: readyCount },
  ];

  const labelVariant = (label: string): "default" | "secondary" | "outline" => {
    if (label === "Ready to Publish") return "default";
    if (label === "In Progress") return "secondary";
    return "outline";
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Draft Events</h1>
          <p className="text-muted-foreground">Resume incomplete setups or publish when ready</p>
        </div>
        <Button className="gap-2" asChild>
          <Link to="/dashboard/events/quick-setup"><Zap className="h-4 w-4" /> New Quick Setup</Link>
        </Button>
      </div>

      {/* Search & filter */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drafts by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label} <span className="ml-1 opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">
              {search || filter !== "all" ? "No matching drafts" : "No draft events"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {search || filter !== "all"
                ? "Try adjusting your search or filters"
                : "All your events are either published or completed"}
            </p>
            {!search && filter !== "all" && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{filtered.length} draft{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((draft) => {
              const { publishStatus, completionLabel } = draft;
              return (
                <Card key={draft.id} className="border-border/50 hover:border-primary/30 transition-all">
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base font-semibold truncate">{draft.title || "Untitled Event"}</h3>
                        {draft.client_id && clients[draft.client_id] && (
                          <p className="text-xs text-muted-foreground truncate">{clients[draft.client_id]}</p>
                        )}
                      </div>
                      <Badge variant={labelVariant(completionLabel)} className="shrink-0 text-[10px]">
                        {completionLabel}
                      </Badge>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {draft.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(draft.event_date + "T00:00:00"), "MMM d, yyyy")}
                        </span>
                      )}
                      <span>Updated {format(new Date(draft.updated_at), "MMM d")}</span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{publishStatus.passed} of {publishStatus.total} checks</span>
                        <span className={`font-medium ${publishStatus.allPass ? "text-primary" : "text-muted-foreground"}`}>
                          {publishStatus.pct}%
                        </span>
                      </div>
                      <Progress value={publishStatus.pct} className="h-1.5" />
                    </div>

                    {/* Missing items */}
                    {publishStatus.missing.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {publishStatus.missing.map((m: any) => (
                          <span key={m.key} className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                            {m.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" className="gap-1.5 flex-1" asChild>
                        <Link to={`/dashboard/events/quick-setup?event=${draft.id}`}>
                          <Zap className="h-3.5 w-3.5" /> Resume Setup
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" asChild>
                        <Link to={`/dashboard/events/${draft.id}/hero`}>
                          <Pencil className="h-3.5 w-3.5" /> Workspace
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="px-2" asChild>
                        <Link to={`/dashboard/events/${draft.id}/preview`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default DraftsPage;
