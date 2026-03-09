import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink, Globe, Eye, Copy, Sparkles, Loader2, ArrowRight, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { buildPublicEventUrl, buildPublicEventUrlAbsolute } from "@/lib/subdomain";
import { toast } from "sonner";
import { callAi, type SeoResult } from "@/lib/ai-api";
import { SectionHint } from "@/components/ui/section-hint";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PUBLISH_CHECKS, getPublishStatus } from "@/lib/publishChecks";

export { PUBLISH_CHECKS };

const themes = [
  { id: "corporate", name: "Corporate Clean", desc: "Structured, business-focused", color: "bg-[hsl(210,20%,95%)]" },
  { id: "elegant", name: "Elegant Premium", desc: "Warm tones, refined serif", color: "bg-[hsl(30,20%,95%)]" },
  { id: "modern", name: "Modern Conference", desc: "Tech-forward, bold primary", color: "bg-[hsl(220,60%,95%)]" },
];

const CHECK_SECTION_MAP: Record<string, string | null> = {
  client: null,
  title: "info",
  slug: "info",
  date: "info",
  description: "info",
  hero: "hero",
  venue: "venue",
};

/* ── Circular Progress Ring ── */
const ProgressRing = ({ passed, total }: { passed: number; total: number }) => {
  const pct = Math.round((passed / total) * 100);
  const radius = 28;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 100 ? "hsl(var(--primary))" : pct >= 50 ? "hsl(45, 93%, 47%)" : "hsl(0, 84%, 60%)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="absolute text-sm font-bold">{passed}/{total}</span>
    </div>
  );
};

/* ── Publish Readiness Card ── */
const PublishReadinessCard = ({ event, navigate }: { event: any; navigate: (path: string) => void }) => {
  const { passed, total, pct, results, allPass } = getPublishStatus(event);
  const headline = allPass ? "Ready to Publish ✓" : "Almost Ready";

  const handleFix = (key: string) => {
    const section = CHECK_SECTION_MAP[key];
    if (section === null) {
      toast.info("The client is set when the event is created. Edit the event from the Events list to change it.");
      return;
    }
    navigate(`/dashboard/events/${event.id}/${section}`);
  };

  return (
    <Card className={allPass ? "border-primary/40 bg-primary/5" : "border-yellow-400/40 bg-yellow-50/50 dark:bg-yellow-950/10"}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-5">
          <ProgressRing passed={passed} total={total} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{headline}</h3>
            <p className="text-sm text-muted-foreground">
              {allPass ? "All publish checks passed. Your event is ready to go live." : `${passed} of ${total} checks passed. Complete the remaining items to publish.`}
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ClipboardCheck className="h-4 w-4" /> View Checklist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Readiness Checklist</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {results.map(r => (
                  <div key={r.key} className="flex items-center gap-3 text-sm">
                    {r.ok ? <Check className="h-4 w-4 text-primary shrink-0" /> : <X className="h-4 w-4 text-destructive shrink-0" />}
                    <span className={r.ok ? "flex-1" : "flex-1 text-muted-foreground"}>{r.label}</span>
                    {!r.ok && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => handleFix(r.key)}>
                        Fix this →
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                {allPass ? "All checks passed — this event can be published." : "Fix the items above before publishing."}
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

const WebsiteSection = () => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [clientSlug, setClientSlug] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!event?.client_id) return;
    supabase.from("clients").select("slug").eq("id", event.client_id).single().then(({ data }) => {
      if (data) setClientSlug(data.slug);
    });
  }, [event?.client_id]);

  if (!event) return null;

  const themeId = (event as any).theme_id ?? "corporate";

  const checks = PUBLISH_CHECKS.map(c => ({ label: c.label, ok: c.check(event) }));
  const allPass = checks.every((c) => c.ok);

  const publicUrl = event.slug && clientSlug ? buildPublicEventUrl(clientSlug, event.slug) : null;
  const publicUrlAbsolute = event.slug && clientSlug ? buildPublicEventUrlAbsolute(clientSlug, event.slug) : null;

  const copyPublicLink = () => {
    if (publicUrlAbsolute) {
      navigator.clipboard.writeText(publicUrlAbsolute);
      toast.success("Public link copied to clipboard");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {event.status !== "published" && (
        <SectionHint
          sectionKey="website"
          title="Website"
          description="Choose your event theme, run the publish checklist, and go live. Copy your public URL to share with attendees."
        />
      )}
      <h2 className="text-2xl font-bold font-display">Public Website</h2>

      {/* Preview button - always available for owners */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={() => navigate(`/dashboard/events/${event.id}/preview`)}>
              <Eye className="h-4 w-4" /> Preview Public Page
            </Button>
            {event.status === "published" && publicUrl && (
              <>
                <Button variant="outline" className="gap-2" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4" /> View Live <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button variant="outline" className="gap-2" onClick={copyPublicLink}>
                  <Copy className="h-4 w-4" /> Copy Link
                </Button>
              </>
            )}
          </div>
          {event.status === "published" && publicUrlAbsolute && (
            <p className="text-xs text-muted-foreground font-mono break-all">{publicUrlAbsolute}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Website Theme</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                disabled={isArchived}
                onClick={() => autosave({ theme_id: t.id } as any)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${themeId === t.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
              >
                <div className={`w-full h-16 rounded-lg mb-3 ${t.color}`} />
                <h4 className="font-semibold text-sm">{t.name}</h4>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Publish Readiness Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 text-sm">
              {c.ok ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-border mt-4">
            <p className="text-xs text-muted-foreground">
              {allPass ? "All checks passed — this event can be published." : "Fix the items above before publishing."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI SEO Optimizer */}
      <SeoOptimizerCard event={event} autosave={autosave} isArchived={isArchived} />
    </div>
  );
};

/* ── SEO Optimizer Sub-Component ── */
const SeoOptimizerCard = ({ event, autosave, isArchived }: { event: any; autosave: (u: any) => void; isArchived: boolean }) => {
  const [seo, setSeo] = useState<SeoResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const result = await callAi<SeoResult>({
        action: "seo_optimization",
        prompt: "Optimize SEO for this event",
        context: {
          currentTitle: event.title,
          description: event.description,
          slug: event.slug,
          venueName: event.venue_name,
        },
      });
      setSeo(result);
    } catch (err: any) {
      toast.error(err.message || "SEO optimization failed");
    }
    setLoading(false);
  };

  const applySuggestion = (field: string, value: string) => {
    if (field === "title") autosave({ title: value } as any);
    if (field === "description") autosave({ description: value } as any);
    if (field === "slug") autosave({ slug: value } as any);
    toast.success(`Applied ${field} suggestion`);
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          SEO & Discoverability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!seo && (
          <Button onClick={handleOptimize} disabled={loading || isArchived} variant="outline" className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyzing..." : "Optimize for Search"}
          </Button>
        )}

        {seo && (
          <div className="space-y-4">
            {/* Side-by-side comparisons */}
            {[
              { label: "Title", field: "title", current: event.title, suggested: seo.improvedTitle },
              { label: "Description", field: "description", current: event.description || "", suggested: seo.improvedDescription },
              { label: "Slug", field: "slug", current: event.slug || "", suggested: seo.suggestedSlug },
            ].map(({ label, field, current, suggested }) => (
              <div key={field} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start text-sm">
                  <div className="p-2 rounded bg-muted text-muted-foreground">{current || "(empty)"}</div>
                  <ArrowRight className="h-4 w-4 mt-2 text-purple-500" />
                  <div className="p-2 rounded bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                    {suggested}
                    {!isArchived && current !== suggested && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs mt-1 text-purple-600" onClick={() => applySuggestion(field, suggested)}>
                        Apply
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Meta Description */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Meta Description ({seo.metaDescription.length}/160)</p>
              <p className="text-sm p-2 rounded bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">{seo.metaDescription}</p>
            </div>

            {/* SEO Tips */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">SEO Tips</p>
              <ul className="space-y-1">
                {seo.seoTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <Button variant="outline" size="sm" onClick={handleOptimize} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebsiteSection;
