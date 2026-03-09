import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PUBLISH_CHECKS } from "@/pages/workspace/WebsiteSection";
import { buildPublicEventUrlAbsolute } from "@/lib/subdomain";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, CalendarIcon, Check, X, Plus, Trash2,
  Upload, Eye, ExternalLink, Loader2, Zap, Building2, Image,
  MapPin, Users, ListChecks, ClipboardCheck, Rocket, Save, Sparkles
} from "lucide-react";
import { callAi, type EventBuilderResult } from "@/lib/ai-api";
import { Textarea as TextareaOrig } from "@/components/ui/textarea";

/* ── helpers ─────────────────────────────────────────────────── */
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type SaveStatus = "idle" | "saving" | "saved" | "error";

const STEPS = [
  { key: "basics", label: "Event Basics", icon: Building2 },
  { key: "hero", label: "Hero & Branding", icon: Image },
  { key: "venue", label: "Venue", icon: MapPin },
  { key: "people", label: "Organizers & Speakers", icon: Users },
  { key: "agenda", label: "Agenda", icon: ListChecks },
  { key: "review", label: "Review & Publish", icon: ClipboardCheck },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/* ── mini types ──────────────────────────────────────────────── */
interface MiniOrganizer { id?: string; name: string; email: string; role: string }
interface MiniSpeaker { id?: string; name: string; title: string }
interface MiniAgendaItem { id?: string; title: string; start_time: string; description: string }

/* ══════════════════════════════════════════════════════════════ */
const QuickEventWizard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* ── step ────────────────────────────────────────────────── */
  const [step, setStep] = useState(0);
  const stepKey = STEPS[step].key;

  /* ── save state ─────────────────────────────────────────── */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [eventId, setEventId] = useState<string | null>(searchParams.get("event") || null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<Record<string, any>>({});

  /* ── client data ────────────────────────────────────────── */
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  /* ── event fields ───────────────────────────────────────── */
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>();

  /* ── hero ────────────────────────────────────────────────── */
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ── venue ───────────────────────────────────────────────── */
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueNotes, setVenueNotes] = useState("");
  const [venueMapLink, setVenueMapLink] = useState("");

  /* ── organizers ──────────────────────────────────────────── */
  const [organizers, setOrganizers] = useState<MiniOrganizer[]>([{ name: "", email: "", role: "" }]);

  /* ── speakers ────────────────────────────────────────────── */
  const [speakers, setSpeakers] = useState<MiniSpeaker[]>([{ name: "", title: "" }]);

  /* ── agenda ──────────────────────────────────────────────── */
  const [agenda, setAgenda] = useState<MiniAgendaItem[]>([{ title: "", start_time: "", description: "" }]);

  /* ── AI builder ─────────────────────────────────────────── */
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const result = await callAi<EventBuilderResult>({ action: "event_builder", prompt: aiPrompt });
      if (result.title) { setTitle(result.title); setSlug(slugify(result.title)); }
      if (result.description) setDescription(result.description);
      if (result.suggestedTheme) { /* theme can be applied later */ }
      if (result.agenda?.length) {
        setAgenda(result.agenda.map(a => ({ title: a.title, start_time: a.time || "", description: `Speaker: ${a.speaker || "TBD"} · ${a.duration_minutes || 30}min` })));
      }
      setAiGenerated(true);
      toast.success("AI generated event details! Review and adjust as needed.");
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    }
    setAiGenerating(false);
  };

  /* ── publish ─────────────────────────────────────────────── */
  const [publishing, setPublishing] = useState(false);
  const [clientSlug, setClientSlug] = useState<string | null>(null);

  /* ── load clients ───────────────────────────────────────── */
  useEffect(() => {
    supabase.from("clients").select("id, name, slug").then(({ data }) => setClients(data || []));
  }, []);

  /* ── resume existing event ──────────────────────────────── */
  useEffect(() => {
    if (!eventId) return;
    const loadExisting = async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (!ev) return;
      setTitle(ev.title || "");
      setSlug(ev.slug || "");
      setDescription(ev.description || "");
      setClientId(ev.client_id || "");
      setEventDate(ev.event_date ? new Date(ev.event_date + "T00:00:00") : undefined);
      setVenueName(ev.venue_name || "");
      setVenueAddress(ev.venue_address || "");
      setVenueNotes(ev.venue_notes || "");
      setVenueMapLink(ev.venue_map_link || "");
      setHeroImages(Array.isArray(ev.hero_images) ? (ev.hero_images as string[]) : []);

      // load client slug
      if (ev.client_id) {
        const { data: cl } = await supabase.from("clients").select("slug").eq("id", ev.client_id).single();
        if (cl) setClientSlug(cl.slug);
      }

      // load related data
      const [orgRes, spkRes, agRes] = await Promise.all([
        supabase.from("organizers").select("id, name, email, role").eq("event_id", eventId),
        supabase.from("speakers" as any).select("id, name, title").eq("event_id", eventId),
        supabase.from("agenda_items").select("id, title, start_time, description").eq("event_id", eventId).order("order_index"),
      ]);
      if (orgRes.data?.length) setOrganizers(orgRes.data.map((o: any) => ({ id: o.id, name: o.name, email: o.email || "", role: o.role || "" })));
      if ((spkRes.data as any)?.length) setSpeakers((spkRes.data as any).map((s: any) => ({ id: s.id, name: s.name, title: s.title || "" })));
      if (agRes.data?.length) setAgenda(agRes.data.map((a: any) => ({ id: a.id, title: a.title, start_time: a.start_time?.slice(0, 5) || "", description: a.description || "" })));
    };
    loadExisting();
  }, [eventId]);

  // Track client slug when clientId changes
  useEffect(() => {
    const c = clients.find(c => c.id === clientId);
    if (c) setClientSlug(c.slug);
  }, [clientId, clients]);

  /* ── create/ensure event record ─────────────────────────── */
  const ensureEvent = useCallback(async (): Promise<string | null> => {
    if (eventId) return eventId;
    if (!user) return null;
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("events").insert({
      title: title || "Untitled Event",
      slug: slug || slugify(title || "untitled"),
      client_id: clientId || null,
      status: "draft",
      created_by: user.id,
      start_date: now,
      end_date: now,
      description: description || null,
      event_date: eventDate ? format(eventDate, "yyyy-MM-dd") : null,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      venue_notes: venueNotes || null,
      venue_map_link: venueMapLink || null,
      hero_images: heroImages,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return null; }
    const newId = data.id;
    setEventId(newId);
    // update URL without navigation
    window.history.replaceState(null, "", `/dashboard/events/quick-setup?event=${newId}`);
    return newId;
  }, [eventId, user, title, slug, clientId, description, eventDate, venueName, venueAddress, venueNotes, venueMapLink, heroImages]);

  /* ── auto-save event fields ────────────────────────────── */
  const autosaveEvent = useCallback(async (updates: Record<string, any>) => {
    if (!eventId) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("events").update(updates as any).eq("id", eventId);
    if (error) { setSaveStatus("error"); toast.error("Save failed"); }
    else { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); }
  }, [eventId]);

  const scheduleAutosave = useCallback((updates: Record<string, any>) => {
    pendingRef.current = { ...pendingRef.current, ...updates };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pending = { ...pendingRef.current };
      pendingRef.current = {};
      autosaveEvent(pending);
    }, 1200);
  }, [autosaveEvent]);

  /* ── field change helpers that autosave ─────────────────── */
  const changeTitle = (v: string) => { setTitle(v); setSlug(slugify(v)); if (eventId) scheduleAutosave({ title: v, slug: slugify(v) }); };
  const changeSlug = (v: string) => { const s = slugify(v); setSlug(s); if (eventId) scheduleAutosave({ slug: s }); };
  const changeDescription = (v: string) => { setDescription(v); if (eventId) scheduleAutosave({ description: v }); };
  const changeDateCb = (d: Date | undefined) => { setEventDate(d); if (eventId && d) scheduleAutosave({ event_date: format(d, "yyyy-MM-dd") }); };
  const changeVenueName = (v: string) => { setVenueName(v); if (eventId) scheduleAutosave({ venue_name: v }); };
  const changeVenueAddress = (v: string) => { setVenueAddress(v); if (eventId) scheduleAutosave({ venue_address: v }); };
  const changeVenueNotes = (v: string) => { setVenueNotes(v); if (eventId) scheduleAutosave({ venue_notes: v }); };
  const changeVenueMapLink = (v: string) => { setVenueMapLink(v); if (eventId) scheduleAutosave({ venue_map_link: v }); };

  /* ── create client inline ───────────────────────────────── */
  const createClientInline = async () => {
    if (!user || !newClientName.trim()) return;
    setCreatingClient(true);
    const newSlug = slugify(newClientName);
    const { data, error } = await supabase.from("clients").insert({ name: newClientName.trim(), slug: newSlug, created_by: user.id }).select("id, name, slug").single();
    setCreatingClient(false);
    if (error) { toast.error(error.message); return; }
    setClients(prev => [...prev, data]);
    setClientId(data.id);
    setClientSlug(data.slug);
    setNewClientName("");
    if (eventId) scheduleAutosave({ client_id: data.id });
    toast.success(`Client "${data.name}" created`);
  };

  /* ── hero upload ────────────────────────────────────────── */
  const handleHeroUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const eid = await ensureEvent();
    if (!eid) return;
    setUploading(true);
    const newPaths = [...heroImages];
    for (const file of Array.from(files)) {
      const path = `events/${eid}/hero/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-assets").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      newPaths.push(path);
    }
    setHeroImages(newPaths);
    await supabase.from("events").update({ hero_images: newPaths } as any).eq("id", eid);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
    setUploading(false);
  };

  const removeHeroImage = (idx: number) => {
    const updated = heroImages.filter((_, i) => i !== idx);
    setHeroImages(updated);
    if (eventId) scheduleAutosave({ hero_images: updated });
  };

  /* ── save related entities on step transition ───────────── */
  const saveOrganizers = async (eid: string) => {
    const valid = organizers.filter(o => o.name.trim());
    // Delete existing and re-insert for simplicity in wizard
    await supabase.from("organizers").delete().eq("event_id", eid);
    if (valid.length) {
      await supabase.from("organizers").insert(valid.map(o => ({
        event_id: eid, name: o.name.trim(), email: o.email || null, role: o.role || null,
      })) as any);
    }
  };

  const saveSpeakers = async (eid: string) => {
    const valid = speakers.filter(s => s.name.trim());
    await supabase.from("speakers" as any).delete().eq("event_id", eid);
    if (valid.length) {
      await supabase.from("speakers" as any).insert(valid.map(s => ({
        event_id: eid, name: s.name.trim(), title: s.title || null,
      })) as any);
    }
  };

  const saveAgenda = async (eid: string) => {
    const valid = agenda.filter(a => a.title.trim());
    await supabase.from("agenda_items").delete().eq("event_id", eid);
    if (valid.length) {
      await supabase.from("agenda_items").insert(valid.map((a, i) => ({
        event_id: eid, title: a.title.trim(), start_time: a.start_time || null,
        description: a.description || null, order_index: i,
      })) as any);
    }
  };

  /* ── step navigation ────────────────────────────────────── */
  const goNext = async () => {
    // On step 0 leaving, ensure event exists
    if (step === 0) {
      if (!title.trim()) { toast.error("Event title is required"); return; }
      const eid = await ensureEvent();
      if (!eid) return;
      // Save client assignment
      if (clientId) await supabase.from("events").update({ client_id: clientId } as any).eq("id", eid);
    }
    // Save people step
    if (stepKey === "people" && eventId) {
      setSaveStatus("saving");
      await Promise.all([saveOrganizers(eventId), saveSpeakers(eventId)]);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
    // Save agenda step
    if (stepKey === "agenda" && eventId) {
      setSaveStatus("saving");
      await saveAgenda(eventId);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
    // Flush pending autosave
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const pending = { ...pendingRef.current };
      pendingRef.current = {};
      if (Object.keys(pending).length && eventId) await autosaveEvent(pending);
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep(s => Math.max(s - 1, 0));

  /* ── publish checks ─────────────────────────────────────── */
  const eventSnapshot = {
    title, slug, description, client_id: clientId, event_date: eventDate ? format(eventDate, "yyyy-MM-dd") : null,
    hero_images: heroImages, venue_name: venueName, venue: null, location: null,
  };
  const checks = PUBLISH_CHECKS.map(c => ({ label: c.label, key: c.key, ok: c.check(eventSnapshot) }));
  const allPass = checks.every(c => c.ok);
  const completedCount = checks.filter(c => c.ok).length;
  const completionPct = Math.round((completedCount / checks.length) * 100);

  /* ── publish action ─────────────────────────────────────── */
  const handlePublish = async () => {
    if (!eventId || !allPass) { toast.error("Please complete all required items first"); return; }
    setPublishing(true);
    // Flush any pending saves
    if (timerRef.current) clearTimeout(timerRef.current);
    const pending = { ...pendingRef.current };
    pendingRef.current = {};
    if (Object.keys(pending).length) await autosaveEvent(pending);
    // Save people + agenda just in case
    await Promise.all([saveOrganizers(eventId), saveSpeakers(eventId), saveAgenda(eventId)]);
    // Publish
    const { error } = await supabase.from("events").update({ status: "published" } as any).eq("id", eventId);
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("🎉 Event published successfully!");
  };

  /* ── completion per step ────────────────────────────────── */
  const stepCompletion = (key: StepKey): "empty" | "partial" | "done" => {
    switch (key) {
      case "basics": return title && slug && eventDate && clientId ? "done" : title ? "partial" : "empty";
      case "hero": return heroImages.length > 0 ? "done" : "empty";
      case "venue": return venueName ? "done" : "empty";
      case "people": return organizers.some(o => o.name.trim()) || speakers.some(s => s.name.trim()) ? "done" : "empty";
      case "agenda": return agenda.some(a => a.title.trim()) ? "done" : "empty";
      case "review": return allPass ? "done" : "empty";
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* ──                   RENDER                             ── */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/events")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Quick Event Setup
            </h1>
            <p className="text-sm text-muted-foreground">
              {eventId ? "Editing draft — changes auto-save" : "Create an event in minutes"}
            </p>
          </div>
        </div>
        <SaveStatusBadge status={saveStatus} />
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const comp = stepCompletion(s.key);
          const isCurrent = i === step;
          return (
            <button
              key={s.key}
              onClick={() => { if (i <= step || eventId) setStep(i); }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                isCurrent ? "bg-primary text-primary-foreground" :
                comp === "done" ? "bg-accent text-accent-foreground" :
                "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {comp === "done" && !isCurrent ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* ── Step 1: Basics ───────────────────────────── */}
          {stepKey === "basics" && (
            <div className="space-y-5">
              {/* AI Builder */}
              <div className="space-y-2 p-4 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20">
                <label className="text-sm font-medium flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-4 w-4" /> Describe your event with AI
                </label>
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. 'Tech conference for 200 people in Cairo on Oct 15 with 3 keynote speakers and a gala dinner'"
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAiGenerate(); }}
                  />
                  <Button
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shrink-0"
                  >
                    {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiGenerating ? "Generating..." : "Generate with AI"}
                  </Button>
                </div>
                {aiGenerated && (
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <Check className="h-3 w-3" /> AI filled the form.
                    <button onClick={handleAiGenerate} className="underline hover:no-underline">Regenerate</button>
                  </div>
                )}
              </div>

              <h2 className="font-display text-lg font-semibold">Client & Event Basics</h2>

              {/* Client selection */}
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); if (eventId) scheduleAutosave({ client_id: v }); }}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 mt-1">
                  <Input placeholder="Or create new client..." value={newClientName} onChange={e => setNewClientName(e.target.value)} className="flex-1" />
                  <Button size="sm" variant="outline" disabled={!newClientName.trim() || creatingClient} onClick={createClientInline}>
                    {creatingClient ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event Title *</Label>
                  <Input value={title} onChange={e => changeTitle(e.target.value)} placeholder="e.g. Q2 Board Meeting" />
                </div>
                <div className="space-y-2">
                  <Label>Event Slug *</Label>
                  <Input value={slug} onChange={e => changeSlug(e.target.value)} placeholder="auto-generated" />
                  <p className="text-xs text-muted-foreground">Used in the public URL</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={eventDate} onSelect={changeDateCb} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Short Description *</Label>
                <Textarea rows={3} value={description} onChange={e => changeDescription(e.target.value)} placeholder="Brief event description..." />
              </div>
            </div>
          )}

          {/* ── Step 2: Hero ─────────────────────────────── */}
          {stepKey === "hero" && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Hero & Branding</h2>
              <p className="text-sm text-muted-foreground">Upload a hero image to represent your event. This will appear at the top of the public page.</p>

              <div className="flex flex-wrap gap-3">
                {heroImages.map((_, i) => (
                  <div key={i} className="relative group h-32 w-44 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 rounded px-1">Image {i + 1}</span>
                    <button onClick={() => removeHeroImage(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="gap-2" disabled={uploading} onClick={() => document.getElementById("wizard-hero-upload")?.click()}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Hero Image"}
              </Button>
              <input id="wizard-hero-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleHeroUpload(e.target.files)} />

              {heroImages.length === 0 && (
                <p className="text-xs text-destructive">⚠ At least one hero image is required to publish.</p>
              )}
            </div>
          )}

          {/* ── Step 3: Venue ────────────────────────────── */}
          {stepKey === "venue" && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Venue</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Venue Name *</Label>
                  <Input value={venueName} onChange={e => changeVenueName(e.target.value)} placeholder="e.g. Four Seasons Hotel" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={venueAddress} onChange={e => changeVenueAddress(e.target.value)} placeholder="Full address" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={venueNotes} onChange={e => changeVenueNotes(e.target.value)} rows={2} placeholder="Room, floor, parking info..." />
              </div>
              <div className="space-y-2">
                <Label>Map Link</Label>
                <Input value={venueMapLink} onChange={e => changeVenueMapLink(e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          )}

          {/* ── Step 4: Organizers & Speakers ────────────── */}
          {stepKey === "people" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold mb-3">Organizers</h2>
                <div className="space-y-3">
                  {organizers.map((o, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1 grid gap-2 sm:grid-cols-3">
                        <Input placeholder="Name" value={o.name} onChange={e => { const u = [...organizers]; u[i] = { ...u[i], name: e.target.value }; setOrganizers(u); }} />
                        <Input placeholder="Email" value={o.email} onChange={e => { const u = [...organizers]; u[i] = { ...u[i], email: e.target.value }; setOrganizers(u); }} />
                        <Input placeholder="Role" value={o.role} onChange={e => { const u = [...organizers]; u[i] = { ...u[i], role: e.target.value }; setOrganizers(u); }} />
                      </div>
                      {organizers.length > 1 && (
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setOrganizers(organizers.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {organizers.length < 5 && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setOrganizers([...organizers, { name: "", email: "", role: "" }])}>
                      <Plus className="h-3 w-3" /> Add Organizer
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h2 className="font-display text-lg font-semibold mb-3">Speakers</h2>
                <div className="space-y-3">
                  {speakers.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1 grid gap-2 sm:grid-cols-2">
                        <Input placeholder="Name" value={s.name} onChange={e => { const u = [...speakers]; u[i] = { ...u[i], name: e.target.value }; setSpeakers(u); }} />
                        <Input placeholder="Title / Role" value={s.title} onChange={e => { const u = [...speakers]; u[i] = { ...u[i], title: e.target.value }; setSpeakers(u); }} />
                      </div>
                      {speakers.length > 1 && (
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSpeakers(speakers.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {speakers.length < 5 && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setSpeakers([...speakers, { name: "", title: "" }])}>
                      <Plus className="h-3 w-3" /> Add Speaker
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Agenda ───────────────────────────── */}
          {stepKey === "agenda" && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Agenda</h2>
              <div className="space-y-3">
                {agenda.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input className="w-24 shrink-0" placeholder="09:00" value={a.start_time} onChange={e => { const u = [...agenda]; u[i] = { ...u[i], start_time: e.target.value }; setAgenda(u); }} />
                        <Input className="flex-1" placeholder="Session title" value={a.title} onChange={e => { const u = [...agenda]; u[i] = { ...u[i], title: e.target.value }; setAgenda(u); }} />
                      </div>
                      <Textarea rows={1} placeholder="Description (optional)" value={a.description} onChange={e => { const u = [...agenda]; u[i] = { ...u[i], description: e.target.value }; setAgenda(u); }} />
                    </div>
                    {agenda.length > 1 && (
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setAgenda(agenda.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {agenda.length < 15 && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setAgenda([...agenda, { title: "", start_time: "", description: "" }])}>
                    <Plus className="h-3 w-3" /> Add Agenda Item
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 6: Review ───────────────────────────── */}
          {stepKey === "review" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Review & Publish</h2>
                <span className="text-sm font-medium">{completionPct}% complete</span>
              </div>

              <Progress value={completionPct} className="h-2" />

              {/* Checklist */}
              <div className="space-y-2">
                {checks.map(c => (
                  <div key={c.key} className="flex items-center gap-3 text-sm">
                    {c.ok ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}
                    <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <div><strong>Title:</strong> {title || "—"}</div>
                <div><strong>Date:</strong> {eventDate ? format(eventDate, "PPP") : "—"}</div>
                <div><strong>Venue:</strong> {venueName || "—"}</div>
                <div><strong>Organizers:</strong> {organizers.filter(o => o.name.trim()).length}</div>
                <div><strong>Speakers:</strong> {speakers.filter(s => s.name.trim()).length}</div>
                <div><strong>Agenda Items:</strong> {agenda.filter(a => a.title.trim()).length}</div>
                <div><strong>Hero Images:</strong> {heroImages.length}</div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {eventId && (
                  <Button variant="outline" className="gap-2" onClick={() => navigate(`/dashboard/events/${eventId}/preview`)}>
                    <Eye className="h-4 w-4" /> Preview
                  </Button>
                )}
                {eventId && (
                  <Button variant="outline" className="gap-2" onClick={() => navigate(`/dashboard/events/${eventId}/hero`)}>
                    <ExternalLink className="h-4 w-4" /> Open Full Workspace
                  </Button>
                )}
                <Button
                  className="gradient-titan border-0 text-primary-foreground gap-2"
                  disabled={!allPass || publishing}
                  onClick={handlePublish}
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {publishing ? "Publishing..." : "Publish Event"}
                </Button>
              </div>

              {!allPass && (
                <p className="text-xs text-muted-foreground">Complete all checklist items above before publishing.</p>
              )}

              {clientSlug && slug && (
                <p className="text-xs text-muted-foreground">
                  Public URL: <span className="font-mono">{buildPublicEventUrlAbsolute(clientSlug, slug)}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2" onClick={goBack} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 && (
          <Button className="gradient-titan border-0 text-primary-foreground gap-2" onClick={goNext}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

/* ── Save status badge ────────────────────────────────────── */
const SaveStatusBadge = ({ status }: { status: SaveStatus }) => {
  if (status === "idle") return null;
  return (
    <span className={cn(
      "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
      status === "saving" && "bg-muted text-muted-foreground",
      status === "saved" && "bg-accent text-accent-foreground",
      status === "error" && "bg-destructive/10 text-destructive",
    )}>
      {status === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
      {status === "saved" && <><Save className="h-3 w-3" /> Saved</>}
      {status === "error" && <><X className="h-3 w-3" /> Save failed</>}
    </span>
  );
};

export default QuickEventWizard;
