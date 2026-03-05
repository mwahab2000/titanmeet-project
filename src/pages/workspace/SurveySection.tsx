import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { SurveyEditor } from "@/components/surveys/SurveyEditor";
import { type Survey, listSurveys, createSurvey, deleteSurvey, duplicateSurvey, listQuestions } from "@/lib/survey-api";
import { listInvites, generateInvites, sendSurveyLinks, type SurveyInvite } from "@/lib/survey-invite-api";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, Pencil, Copy, Trash2, Send, Link2, Users, BarChart3, Mail, CheckCircle2, Clock, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SurveySection = () => {
  const { event, isArchived } = useEventWorkspace();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Survey | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [invites, setInvites] = useState<SurveyInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<{ questions: any[]; answers: any[] }>({ questions: [], answers: [] });

  if (!event || !user) return null;

  const loadSurveys = useCallback(async () => {
    try { setSurveys(await listSurveys(event.id)); } catch { toast.error("Failed to load surveys"); }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  const loadInvites = useCallback(async (surveyId: string) => {
    setInvitesLoading(true);
    try {
      const data = await listInvites(surveyId);
      setInvites(data);
    } catch { toast.error("Failed to load invites"); }
    setInvitesLoading(false);
  }, []);

  const loadStats = useCallback(async (surveyId: string) => {
    try {
      const qs = await listQuestions(surveyId);
      // Get responses+answers via survey_responses
      const { data: responses } = await supabase
        .from("survey_responses" as any)
        .select("id")
        .eq("survey_id", surveyId);
      const responseIds = (responses || []).map((r: any) => r.id);

      let allAnswers: any[] = [];
      if (responseIds.length > 0) {
        const { data: answersData } = await supabase
          .from("survey_answers" as any)
          .select("question_id, value_text, value_number, value_json")
          .in("response_id", responseIds);
        allAnswers = (answersData || []) as any[];
      }

      setStats({ questions: qs, answers: allAnswers });
    } catch { /* silent */ }
  }, []);

  const selectSurvey = (s: Survey) => {
    setSelectedSurvey(s);
    loadInvites(s.id);
    loadStats(s.id);
  };

  const handleCreate = async () => {
    try {
      const s = await createSurvey(event.id, user.id);
      setEditing(s);
    } catch { toast.error("Failed to create"); }
  };

  const handleDelete = async (id: string) => {
    await deleteSurvey(id);
    if (selectedSurvey?.id === id) setSelectedSurvey(null);
    loadSurveys();
  };

  const handleGenerate = async () => {
    if (!selectedSurvey) return;
    setGenerating(true);
    try {
      const count = await generateInvites(selectedSurvey.id, event.id);
      toast.success(`${count} new invite(s) generated`);
      loadInvites(selectedSurvey.id);
    } catch { toast.error("Failed to generate invites"); }
    setGenerating(false);
  };

  const handleSendAll = async () => {
    if (!selectedSurvey) return;
    setSending(true);
    try {
      const result = await sendSurveyLinks(selectedSurvey.id, event.id);
      toast.success(`${result.sent} email(s) sent`);
      loadInvites(selectedSurvey.id);
    } catch { toast.error("Failed to send"); }
    setSending(false);
  };

  const handleResend = async (inviteId: string) => {
    if (!selectedSurvey) return;
    try {
      await sendSurveyLinks(selectedSurvey.id, event.id, [inviteId]);
      toast.success("Email resent");
      loadInvites(selectedSurvey.id);
    } catch { toast.error("Failed to resend"); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    toast.success("Link copied");
  };

  if (editing) {
    return (
      <SurveyEditor
        survey={editing}
        eventId={event.id}
        disabled={isArchived}
        onBack={() => { setEditing(null); loadSurveys(); }}
      />
    );
  }

  const filteredInvites = invites.filter((inv) => {
    if (filter === "submitted") return inv.status === "submitted";
    if (filter === "pending") return inv.status !== "submitted";
    return true;
  }).filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.attendee_name?.toLowerCase().includes(q) || inv.attendee_email?.toLowerCase().includes(q);
  });

  const statusCounts = {
    total: invites.length,
    sent: invites.filter((i) => ["sent", "opened", "submitted"].includes(i.status)).length,
    opened: invites.filter((i) => ["opened", "submitted"].includes(i.status)).length,
    submitted: invites.filter((i) => i.status === "submitted").length,
  };

  return (
    <div className="space-y-6">
      {/* Survey list + actions */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Surveys</h2>
        {!isArchived && (
          <Button size="sm" className="gap-1" onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Create Survey
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && surveys.length === 0 && (
        <p className="text-sm text-muted-foreground">No surveys yet. Create your first survey.</p>
      )}

      <div className="grid gap-3">
        {surveys.map((s) => (
          <Card
            key={s.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedSurvey?.id === s.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => selectSurvey(s)}
          >
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.title}</p>
                {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
              </div>
              <Badge variant={s.status === "published" ? "default" : "secondary"}>{s.status}</Badge>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!isArchived && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected survey detail */}
      {selectedSurvey && (
        <div className="space-y-6 border-t border-border pt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">{selectedSurvey.title}</h3>
              <p className="text-xs text-muted-foreground">
                Created {format(new Date(selectedSurvey.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Generate Invites
              </Button>
              <Button size="sm" className="gap-1" onClick={handleSendAll} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send All Unsent
              </Button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatsCard icon={Users} label="Total Invites" value={statusCounts.total} />
            <StatsCard icon={Mail} label="Sent" value={statusCounts.sent} />
            <StatsCard icon={Eye} label="Opened" value={statusCounts.opened} />
            <StatsCard icon={CheckCircle2} label="Submitted" value={statusCounts.submitted} />
          </div>

          <Tabs defaultValue="tracking">
            <TabsList>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="results">Results & Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Search attendee…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
                <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
                <Button variant={filter === "submitted" ? "default" : "outline"} size="sm" onClick={() => setFilter("submitted")}>Submitted</Button>
                <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>Pending</Button>
              </div>

              {invitesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvites.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {invites.length === 0 ? 'Click "Generate Invites" to create invite links for attendees.' : "No matching invites."}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredInvites.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.attendee_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inv.attendee_email}</TableCell>
                          <TableCell>
                            <StatusBadge status={inv.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.submitted_at ? format(new Date(inv.submitted_at), "MMM d, HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(inv.token)} title="Copy link">
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                              {inv.status !== "submitted" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResend(inv.id)} title="Resend email">
                                  <Mail className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <SurveyResults questions={stats.questions} answers={stats.answers} totalResponses={statusCounts.submitted} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

function StatsCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <p className="text-2xl font-bold font-display">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    created: { variant: "outline", label: "Created" },
    sent: { variant: "secondary", label: "Sent" },
    opened: { variant: "secondary", label: "Opened" },
    submitted: { variant: "default", label: "Submitted" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function SurveyResults({ questions, answers, totalResponses }: { questions: any[]; answers: any[]; totalResponses: number }) {
  if (totalResponses === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{totalResponses} response(s) received</p>
      {questions.map((q) => {
        const qAnswers = answers.filter((a: any) => a.question_id === q.id);
        return (
          <Card key={q.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{q.question_text || "Untitled"}</CardTitle>
              <p className="text-xs text-muted-foreground">{q.type} · {qAnswers.length} answer(s)</p>
            </CardHeader>
            <CardContent>
              <QuestionStats question={q} answers={qAnswers} total={totalResponses} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function QuestionStats({ question, answers, total }: { question: any; answers: any[]; total: number }) {
  const type = question.type;

  // Choice questions: bar chart
  if (["single_choice", "multi_choice", "yes_no"].includes(type)) {
    const options = type === "yes_no"
      ? [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]
      : (question.settings?.options || []);

    const counts: Record<string, number> = {};
    options.forEach((o: any) => { counts[o.value] = 0; });

    answers.forEach((a: any) => {
      if (a.value_text && counts[a.value_text] !== undefined) counts[a.value_text]++;
      if (a.value_json && Array.isArray(a.value_json)) {
        (a.value_json as string[]).forEach((v) => {
          if (counts[v] !== undefined) counts[v]++;
        });
      }
    });

    const maxCount = Math.max(...Object.values(counts), 1);

    return (
      <div className="space-y-2">
        {options.map((o: any) => {
          const count = counts[o.value] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={o.value} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{o.label}</span>
                <span className="text-muted-foreground">{count} ({pct}%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Rating/likert: average + distribution
  if (["rating_stars", "likert", "number"].includes(type)) {
    const nums = answers.map((a: any) => a.value_number).filter((n: any) => n !== null && n !== undefined) as number[];
    if (nums.length === 0) return <p className="text-sm text-muted-foreground">No numeric answers</p>;
    const avg = nums.reduce((s, n) => s + n, 0) / nums.length;

    const distribution: Record<number, number> = {};
    nums.forEach((n) => { distribution[n] = (distribution[n] || 0) + 1; });
    const keys = Object.keys(distribution).map(Number).sort((a, b) => a - b);
    const maxCount = Math.max(...Object.values(distribution), 1);

    return (
      <div className="space-y-3">
        <p className="text-lg font-bold">Average: {avg.toFixed(1)}</p>
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right">{k}</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(distribution[k] / maxCount) * 100}%` }} />
              </div>
              <span className="text-muted-foreground w-8">{distribution[k]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Text answers
  if (["short_text", "long_text"].includes(type)) {
    const texts = answers.map((a: any) => a.value_text).filter(Boolean);
    return (
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {texts.length === 0 && <p className="text-sm text-muted-foreground">No text answers</p>}
        {texts.map((t: string, i: number) => (
          <div key={i} className="text-sm p-2 bg-muted rounded-lg">{t}</div>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">{answers.length} answer(s)</p>;
}

export default SurveySection;
