import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Check, X, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { callAi, type AgendaItemAI } from "@/lib/ai-api";
import { SectionHint } from "@/components/ui/section-hint";

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  day_number: number;
  speaker_id: string | null;
  room_id: string | null;
}

interface Speaker {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  days: number[];
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const DAY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Inline-editable cell */
const EditableCell = ({
  value,
  onChange,
  disabled,
  placeholder = "",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  if (disabled || !editing) {
    return (
      <div
        className={`px-2 py-1.5 min-h-[32px] cursor-text truncate text-sm ${!value ? "text-muted-foreground" : ""} ${className}`}
        onClick={() => !disabled && setEditing(true)}
        title={value || placeholder}
      >
        {value || placeholder}
      </div>
    );
  }

  return (
    <Input
      ref={inputRef}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { onChange(draft); setEditing(false); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="h-8 text-sm px-2"
      placeholder={placeholder}
    />
  );
};

const AgendaSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiEventType, setAiEventType] = useState("Conference");
  const [aiDuration, setAiDuration] = useState("8");
  const [aiSpeakers, setAiSpeakers] = useState("3");
  const [aiRequirements, setAiRequirements] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleAiGenerate = async () => {
    if (!event) return;
    setAiGenerating(true);
    try {
      const result = await callAi<AgendaItemAI[]>({
        action: "agenda_generation",
        prompt: `Generate an agenda for a ${aiEventType} event`,
        context: {
          eventType: aiEventType,
          totalDurationHours: Number(aiDuration),
          numberOfSpeakers: Number(aiSpeakers),
          specialRequirements: aiRequirements,
          eventTitle: event.title,
          eventDate: event.event_date,
        },
      });
      if (Array.isArray(result) && result.length > 0) {
        for (let i = 0; i < result.length; i++) {
          const item = result[i];
          await supabase.from("agenda_items").insert({
            event_id: event.id,
            title: `✨ ${item.title}`,
            start_time: item.time || null,
            description: item.description || null,
            order_index: items.length + i,
            day_number: 1,
          } as any);
        }
        load();
        toast.success(`${result.length} agenda items generated!`);
        setAiModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    }
    setAiGenerating(false);
  };

  const load = useCallback(async () => {
    if (!event) return;
    const [{ data: agendaData }, { data: speakerData }, { data: roomData }] = await Promise.all([
      supabase.from("agenda_items").select("*").eq("event_id", event.id).order("day_number").order("start_time").order("order_index"),
      supabase.from("speakers" as any).select("id, name").eq("event_id", event.id).order("name"),
      supabase.from("event_rooms" as any).select("id, name, days").eq("event_id", event.id).order("name"),
    ]);
    setItems((agendaData as any as AgendaItem[]) || []);
    setSpeakers((speakerData as any as Speaker[]) || []);
    setRooms(((roomData as any[]) || []).map((r: any) => ({ id: r.id, name: r.name, days: Array.isArray(r.days) ? r.days : [] })));
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    if (!event) return;
    const { error } = await supabase.from("agenda_items").insert({ event_id: event.id, title: "New Item", order_index: items.length, day_number: 1 } as any);
    if (error) toast.error(error.message);
    else load();
  };

  const duplicateItem = async (item: AgendaItem) => {
    if (!event) return;
    const { id, ...rest } = item;
    const { error } = await supabase.from("agenda_items").insert({ ...rest, event_id: event.id, title: `${item.title} (copy)`, order_index: items.length } as any);
    if (error) toast.error(error.message);
    else load();
  };

  const updateItem = async (id: string, updates: Partial<AgendaItem>) => {
    // Validate start < end
    const item = items.find((i) => i.id === id);
    if (item) {
      const start = updates.start_time ?? item.start_time;
      const end = updates.end_time ?? item.end_time;
      if (start && end && start >= end) {
        toast.error("Start time must be before end time");
        return;
      }
    }
    await supabase.from("agenda_items").update(updates as any).eq("id", id);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  const deleteItem = async (id: string) => {
    await supabase.from("agenda_items").delete().eq("id", id);
    setDeleteConfirm(null);
    load();
  };

  if (!event) return null;

  const roomsForDay = (day: number) => rooms.filter((r) => r.days.length === 0 || r.days.includes(day));

  return (
    <>
    {items.length === 0 && (
      <SectionHint
        sectionKey="agenda"
        title="Agenda"
        description="Build your event schedule here. Attendees can see the full agenda on the public page. Add sessions with times and descriptions."
      />
    )}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">Agenda</CardTitle>
        <div className="flex gap-2">
          {!isArchived && items.length < 2 && (
            <Button size="sm" variant="outline" className="gap-1 text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800" onClick={() => setAiModalOpen(true)}>
              <Sparkles className="h-4 w-4" /> Generate with AI
            </Button>
          )}
          {!isArchived && (
            <Button size="sm" variant="outline" className="gap-1" onClick={addItem}>
              <Plus className="h-4 w-4" /> Add Row
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 && <p className="text-sm text-muted-foreground">No agenda items yet.</p>}
        {items.length > 0 && (
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              {/* Header */}
              <div className="grid grid-cols-[60px_90px_90px_1fr_140px_140px_1fr_80px] gap-px bg-muted/50 border border-border rounded-t-lg sticky top-0 z-10">
                {["Day", "Start", "End", "Title", "Speaker", "Room", "Description", "Actions"].map((h) => (
                  <div key={h} className="px-2 py-2 text-xs font-semibold text-muted-foreground bg-muted/80 first:rounded-tl-lg last:rounded-tr-lg">
                    {h}
                  </div>
                ))}
              </div>
              {/* Rows */}
              <div className="border border-t-0 border-border rounded-b-lg divide-y divide-border">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[60px_90px_90px_1fr_140px_140px_1fr_80px] gap-px hover:bg-muted/30 transition-colors"
                  >
                    {/* Day */}
                    <div className="px-1 py-0.5">
                      <Select value={String(item.day_number || 1)} onValueChange={(v) => updateItem(item.id, { day_number: Number(v), room_id: null })} disabled={isArchived}>
                        <SelectTrigger className="h-8 text-sm border-0 shadow-none"><SelectValue /></SelectTrigger>
                        <SelectContent>{DAY_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {/* Start */}
                    <div className="px-1 py-0.5">
                      <Select value={item.start_time?.slice(0, 5) || ""} onValueChange={(v) => updateItem(item.id, { start_time: v })} disabled={isArchived}>
                        <SelectTrigger className="h-8 text-sm border-0 shadow-none"><SelectValue placeholder="--:--" /></SelectTrigger>
                        <SelectContent>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {/* End */}
                    <div className="px-1 py-0.5">
                      <Select value={item.end_time?.slice(0, 5) || ""} onValueChange={(v) => updateItem(item.id, { end_time: v })} disabled={isArchived}>
                        <SelectTrigger className="h-8 text-sm border-0 shadow-none"><SelectValue placeholder="--:--" /></SelectTrigger>
                        <SelectContent>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {/* Title */}
                    <div className="border-l border-border">
                      <EditableCell value={item.title} onChange={(v) => { if (!v.trim()) { toast.error("Title is required"); return; } updateItem(item.id, { title: v }); }} disabled={isArchived} placeholder="Title (required)" />
                    </div>
                    {/* Speaker */}
                    <div className="px-1 py-0.5 border-l border-border">
                      <Select value={item.speaker_id || "none"} onValueChange={(v) => updateItem(item.id, { speaker_id: v === "none" ? null : v })} disabled={isArchived}>
                        <SelectTrigger className="h-8 text-sm border-0 shadow-none"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {speakers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Room */}
                    <div className="px-1 py-0.5 border-l border-border">
                      <Select value={item.room_id || "none"} onValueChange={(v) => updateItem(item.id, { room_id: v === "none" ? null : v })} disabled={isArchived}>
                        <SelectTrigger className="h-8 text-sm border-0 shadow-none"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {roomsForDay(item.day_number || 1).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Description */}
                    <div className="border-l border-border">
                      <EditableCell value={item.description || ""} onChange={(v) => updateItem(item.id, { description: v || null })} disabled={isArchived} placeholder="Notes..." />
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 px-1 border-l border-border">
                      {deleteConfirm === item.id ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(item.id)} title="Confirm delete">
                            <Check className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)} title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {!isArchived && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateItem(item)} title="Duplicate">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isArchived && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(item.id)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>

    {/* AI Agenda Modal */}
    <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> Generate Agenda with AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm">Event Type</Label>
            <Select value={aiEventType} onValueChange={setAiEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Conference", "Workshop", "Gala", "Seminar", "Networking"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Duration (hours)</Label>
              <Input type="number" value={aiDuration} onChange={e => setAiDuration(e.target.value)} min="1" max="24" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Number of Speakers</Label>
              <Input type="number" value={aiSpeakers} onChange={e => setAiSpeakers(e.target.value)} min="0" max="20" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Special Requirements</Label>
            <Input value={aiRequirements} onChange={e => setAiRequirements(e.target.value)} placeholder="e.g. Include a panel discussion" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAiModalOpen(false)}>Cancel</Button>
          <Button onClick={handleAiGenerate} disabled={aiGenerating} className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
            {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiGenerating ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AgendaSection;
