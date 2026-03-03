import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink, Globe, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const themes = [
  { id: "corporate", name: "Corporate Clean", desc: "Structured, business-focused", color: "bg-[hsl(210,20%,95%)]" },
  { id: "elegant", name: "Elegant Premium", desc: "Warm tones, refined serif", color: "bg-[hsl(30,20%,95%)]" },
  { id: "modern", name: "Modern Conference", desc: "Tech-forward, bold primary", color: "bg-[hsl(220,60%,95%)]" },
  { id: "bold", name: "Bold Immersive", desc: "Dark, dramatic gradients", color: "bg-[hsl(260,30%,15%)]" },
];

export const PUBLISH_CHECKS = [
  { key: "client", label: "Client selected", check: (e: any) => !!e.client_id },
  { key: "title", label: "Event title", check: (e: any) => !!e.title?.trim() },
  { key: "slug", label: "Event slug", check: (e: any) => !!e.slug?.trim() },
  { key: "date", label: "Event date", check: (e: any) => !!e.event_date },
  { key: "description", label: "Description", check: (e: any) => !!e.description?.trim() },
  { key: "hero", label: "Hero image", check: (e: any) => Array.isArray(e.hero_images) && e.hero_images.length > 0 },
  { key: "venue", label: "Venue or location", check: (e: any) => !!(e.venue_name?.trim() || e.venue?.trim() || e.location?.trim()) },
];

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

  const publicUrl = event.slug && clientSlug ? `/${clientSlug}/${event.slug}` : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold font-display">Public Website</h2>

      {/* Preview button - always available for owners */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/dashboard/events/${event.id}/preview`)}>
            <Eye className="h-4 w-4" /> Preview Public Page
          </Button>
          {event.status === "published" && publicUrl && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" /> View Live <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
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
    </div>
  );
};

export default WebsiteSection;
