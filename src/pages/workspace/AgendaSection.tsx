import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  day_number: number;
  speaker_id: string | null;
}

interface Speaker {
  id: string;
  name: string;
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const DAY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

const AgendaSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("agenda_items").select("*").eq("event_id", event.id).order("order_index");
    setItems((data as any as AgendaItem[]) || []);
  }, [event?.id]);

  const loadSpeakers = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("speakers" as any).select("id, name").eq("event_id", event.id).order("name");
    setSpeakers((data as any as Speaker[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); loadSpeakers(); }, [load, loadSpeakers]);

  const addItem = async () => {
    if (!event) return;
    const { error } = await supabase.from("agenda_items").insert({ event_id: event.id, title: "New Item", order_index: items.length } as any);
    if (error) toast.error(error.message);
    else load();
  };

  const updateItem = async (id: string, updates: Partial<AgendaItem>) => {
    await supabase.from("agenda_items").update(updates as any).eq("id", id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  const deleteItem = async (id: string) => {
    await supabase.from("agenda_items").delete().eq("id", id);
    load();
  };

  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setItems(reordered);
    setDragIdx(null);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from("agenda_items").update({ order_index: i } as any).eq("id", reordered[i].id);
    }
  };

  if (!event) return null;

  // Group items by day_number
  const grouped = items.reduce<Record<number, AgendaItem[]>>((acc, item) => {
    const day = item.day_number || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  const renderItem = (item: AgendaItem, idx: number) => (
    <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border p-3 bg-background"
      draggable={!isArchived} onDragStart={() => setDragIdx(items.indexOf(item))} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(items.indexOf(item))}>
      <GripVertical className="h-5 w-5 mt-1 text-muted-foreground cursor-grab shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2 flex-wrap">
          {/* Day (move between days) */}
          <div className="w-28">
            <label className="text-xs text-muted-foreground mb-1 block">Day</label>
            <Select
              value={String(item.day_number || 1)}
              onValueChange={v => updateItem(item.id, { day_number: Number(v) })}
              disabled={isArchived}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map(d => (
                  <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Title */}
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <Input value={item.title} onChange={e => updateItem(item.id, { title: e.target.value })} placeholder="Title" disabled={isArchived} className="h-9 font-medium" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* From */}
          <div className="w-32">
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <Select value={item.start_time?.slice(0, 5) || ""} onValueChange={v => updateItem(item.id, { start_time: v })} disabled={isArchived}>
              <SelectTrigger className="h-9"><SelectValue placeholder="--:--" /></SelectTrigger>
              <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* To */}
          <div className="w-32">
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <Select value={item.end_time?.slice(0, 5) || ""} onValueChange={v => updateItem(item.id, { end_time: v })} disabled={isArchived}>
              <SelectTrigger className="h-9"><SelectValue placeholder="--:--" /></SelectTrigger>
              <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Speaker */}
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-muted-foreground mb-1 block">Speaker</label>
            <Select value={item.speaker_id || "none"} onValueChange={v => updateItem(item.id, { speaker_id: v === "none" ? null : v })} disabled={isArchived}>
              <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {speakers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
          <Textarea value={item.description || ""} onChange={e => updateItem(item.id, { description: e.target.value })} placeholder="Description (free text)" rows={2} disabled={isArchived} />
        </div>
      </div>
      {!isArchived && <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">Agenda</CardTitle>
        {!isArchived && <Button size="sm" variant="outline" className="gap-1" onClick={addItem}><Plus className="h-4 w-4" /> Add</Button>}
      </CardHeader>
      <CardContent className="space-y-6">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No agenda items yet.</p>}
        {sortedDays.map((day, dayIdx) => (
          <div key={day}>
            {dayIdx > 0 && <Separator className="mb-4" />}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full group mb-3">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                <h3 className="text-sm font-semibold text-foreground">Day {day}</h3>
                <span className="text-xs text-muted-foreground">({grouped[day].length} items)</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3">
                  {grouped[day].map((item, idx) => renderItem(item, idx))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AgendaSection;
