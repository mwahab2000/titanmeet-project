import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { SurveyEditor } from "@/components/surveys/SurveyEditor";
import { type Survey, listSurveys, createSurvey, deleteSurvey, duplicateSurvey, listQuestions } from "@/lib/survey-api";
import { listInvites, generateInvites, sendSurveyLinks, type SurveyInvite, type SendChannel } from "@/lib/survey-invite-api";
import { exportSurveyToExcel } from "@/lib/survey-export";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Copy, Trash2, Send, Link2, Users, BarChart3, Mail, CheckCircle2, Clock, Eye, Loader2, MessageSquare, Download, Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { callAi, type SurveyAnalysisResult } from "@/lib/ai-api";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

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
  const [stats, setStats] = useState<{ questions: any[]; answers: any[]; responses: any[] }>({ questions: [], answers: [], responses: [] });
  const [selectedChannels, setSelectedChannels] = useState<SendChannel[]>(["email"]);
  const [exporting, setExporting] = useState(false);

  const loadSurveys = useCallback(async () => {
    if (!event) return;
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
      const { data: responses } = await supabase
        .from("survey_responses" as any)
        .select("id, respondent_id")
        .eq("survey_id", surveyId);
      const responseIds = (responses || []).map((r: any) => r.id);

      let allAnswers: any[] = [];
      if (responseIds.length > 0) {
        const { data: answersData } = await supabase
          .from("survey_answers" as any)
          .select("question_id, value_text, value_number, value_json, response_id")
          .in("response_id", responseIds);
        allAnswers = (answersData || []) as any[];
      }

      setStats({ questions: qs, answers: allAnswers, responses: (responses || []) as any[] });
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
    if (!selectedSurvey || selectedChannels.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    setSending(true);
    try {
      const result = await sendSurveyLinks(selectedSurvey.id, event.id, selectedChannels);
      const parts: string[] = [];
      if (result.sent_email > 0) parts.push(`${result.sent_email} email(s)`);
      if (result.sent_whatsapp > 0) parts.push(`${result.sent_whatsapp} WhatsApp`);
      if (result.failed_email > 0) parts.push(`${result.failed_email} email failed`);
      if (result.failed_whatsapp > 0) parts.push(`${result.failed_whatsapp} WhatsApp failed`);
      if (result.skipped_no_phone > 0) parts.push(`${result.skipped_no_phone} skipped (no phone)`);
      if (result.skipped_no_email > 0) parts.push(`${result.skipped_no_email} skipped (no email)`);
      toast.success(`Sent: ${parts.join(", ") || "0"}`);
      loadInvites(selectedSurvey.id);
    } catch { toast.error("Failed to send"); }
    setSending(false);
  };

  const handleResend = async (inviteId: string) => {
    if (!selectedSurvey || selectedChannels.length === 0) return;
    try {
      await sendSurveyLinks(selectedSurvey.id, event.id, selectedChannels, [inviteId]);
      toast.success("Resent");
      loadInvites(selectedSurvey.id);
    } catch { toast.error("Failed to resend"); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    toast.success("Link copied");
  };

  const handleExport = async () => {
    if (!selectedSurvey) return;
    setExporting(true);
    try {
      await exportSurveyToExcel(
        selectedSurvey.title,
        selectedSurvey.id,
        invites,
        stats.questions,
        stats.answers,
        stats.responses,
      );
      toast.success("Excel exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    }
    setExporting(false);
  };

  const toggleChannel = (ch: SendChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  if (!event || !user) return null;

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
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatsCard icon={Users} label="Total Invites" value={statusCounts.total} />
            <StatsCard icon={Mail} label="Sent" value={statusCounts.sent} />
            <StatsCard icon={Eye} label="Opened" value={statusCounts.opened} />
            <StatsCard icon={CheckCircle2} label="Submitted" value={statusCounts.submitted} />
          </div>

          <Tabs defaultValue="send">
            <TabsList>
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="results">Results & Statistics</TabsTrigger>
              {statusCounts.submitted > 0 && <TabsTrigger value="ai-analysis" className="gap-1"><Sparkles className="h-3 w-3" /> AI Analysis</TabsTrigger>}
            </TabsList>

            {/* ── Send Tab ── */}
            <TabsContent value="send" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Delivery Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedChannels.includes("email")}
                        onCheckedChange={() => toggleChannel("email")}
                      />
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedChannels.includes("whatsapp")}
                        onCheckedChange={() => toggleChannel("whatsapp")}
                      />
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </label>
                  </div>

                  {selectedChannels.includes("whatsapp") && (
                    <p className="text-xs text-muted-foreground">
                      WhatsApp requires attendees to have a phone number with country code (e.g., +966...).
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1" onClick={handleSendAll} disabled={sending || selectedChannels.length === 0}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send to All Unsent
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tracking Tab ── */}
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
                <div className="border border-border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center gap-1 justify-center"><Mail className="h-3.5 w-3.5" /> Email</div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center gap-1 justify-center"><MessageSquare className="h-3.5 w-3.5" /> WA</div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvites.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            {invites.length === 0 ? 'Click "Generate Invites" to create invite links for attendees.' : "No matching invites."}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredInvites.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.attendee_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inv.attendee_email}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inv.attendee_mobile || "—"}</TableCell>
                          <TableCell className="text-center">
                            {inv.sent_via_email ? (
                              <span className="text-xs text-green-600" title={inv.email_sent_at ? format(new Date(inv.email_sent_at), "MMM d HH:mm") : ""}>
                                ✓ {inv.email_sent_at ? format(new Date(inv.email_sent_at), "MMM d") : ""}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.sent_via_whatsapp ? (
                              <span className="text-xs text-green-600" title={inv.whatsapp_sent_at ? format(new Date(inv.whatsapp_sent_at), "MMM d HH:mm") : ""}>
                                ✓ {inv.whatsapp_sent_at ? format(new Date(inv.whatsapp_sent_at), "MMM d") : ""}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
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
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResend(inv.id)} title="Resend via selected channels">
                                  <Send className="h-3.5 w-3.5" />
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

            {/* ── AI Analysis Tab ── */}
            <TabsContent value="ai-analysis">
              <AiSurveyAnalysis questions={stats.questions} answers={stats.answers} responses={stats.responses} />
            </TabsContent>
            {/* ── Results Tab ── */}
            <TabsContent value="results" className="space-y-6">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export to Excel
                </Button>
              </div>
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

/* ── AI Survey Analysis Component ── */
const SENTIMENT_COLORS = ["#22c55e", "#94a3b8", "#ef4444"];

function AiSurveyAnalysis({ questions, answers, responses }: { questions: any[]; answers: any[]; responses: any[] }) {
  const [analysis, setAnalysis] = useState<SurveyAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await callAi<SurveyAnalysisResult>({
        action: "survey_analysis",
        prompt: "Analyze these survey responses",
        context: {
          totalResponses: responses.length,
          questions: questions.map(q => ({ text: q.question_text, type: q.type })),
          sampleAnswers: answers.slice(0, 50).map(a => ({
            questionId: a.question_id,
            text: a.value_text,
            number: a.value_number,
          })),
        },
      });
      setAnalysis(result);
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  if (!analysis && !loading) {
    return (
      <div className="py-8 text-center space-y-3">
        <Sparkles className="h-8 w-8 mx-auto text-purple-400" />
        <p className="text-sm text-muted-foreground">Get AI-powered insights from your survey responses.</p>
        <Button onClick={analyze} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
          <Sparkles className="h-4 w-4" /> Analyze Responses
        </Button>
        {error && <p className="text-sm text-destructive">Analysis failed. <button onClick={analyze} className="underline">Retry</button></p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-8 text-center space-y-3">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-purple-500" />
        <p className="text-sm text-muted-foreground">Analyzing responses...</p>
      </div>
    );
  }

  if (!analysis) return null;

  const sentimentData = [
    { name: "Positive", value: analysis.sentiment.positive },
    { name: "Neutral", value: analysis.sentiment.neutral },
    { name: "Negative", value: analysis.sentiment.negative },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{analysis.summary}</p>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Sentiment Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                    {sentimentData.map((_, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Key Themes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Key Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.keyThemes.map((theme, i) => (
                <Badge key={i} variant="secondary">{theme}</Badge>
              ))}
            </div>
            {analysis.npsScore !== null && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">NPS Score</p>
                <p className="text-2xl font-bold font-display">{analysis.npsScore}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.topInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={analyze} disabled={loading} className="gap-1">
        <Sparkles className="h-3 w-3" /> Regenerate Analysis
      </Button>
    </div>
  );
}

export default SurveySection;
