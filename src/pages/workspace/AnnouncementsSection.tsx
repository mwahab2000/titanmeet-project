import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SectionHint } from "@/components/ui/section-hint";

interface Announcement { id: string; text: string; start_date: string | null; end_date: string | null; order_index: number; }

const AnnouncementsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<Announcement[]>([]);
  const [preview, setPreview] = useState(0);

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("announcements").select("*").eq("event_id", event.id).order("order_index");
    setItems((data as Announcement[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  // Rotate preview
  useEffect(() => {
    if (items.length <= 1) return;
    const iv = setInterval(() => setPreview(p => (p + 1) % items.length), 3000);
    return () => clearInterval(iv);
  }, [items.length]);

  const add = async () => {
    if (!event) return;
    await supabase.from("announcements").insert({ event_id: event.id, text: "", order_index: items.length } as any);
    load();
  };

  const update = async (id: string, field: string, value: any) => {
    await supabase.from("announcements").update({ [field]: value } as any).eq("id", id);
    setItems(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const remove = async (id: string) => { await supabase.from("announcements").delete().eq("id", id); load(); };

  if (!event) return null;

  return (
    <div className="space-y-4">
      {/* Preview bar */}
      {items.length > 0 && (
        <div className="rounded-lg gradient-titan px-4 py-3 text-primary-foreground text-sm font-medium text-center transition-all">
          {items[preview]?.text || "..."}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Announcements</CardTitle>
          {!isArchived && <Button size="sm" variant="outline" className="gap-1" onClick={add}><Plus className="h-4 w-4" /> Add</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
          {items.map(a => (
            <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
              <Textarea value={a.text} onChange={e => update(a.id, "text", e.target.value)} disabled={isArchived} placeholder="Announcement text" rows={2} />
              <div className="flex gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="date" value={a.start_date || ""} onChange={e => update(a.id, "start_date", e.target.value || null)} disabled={isArchived} className="w-36" /></div>
                <div className="space-y-1"><Label className="text-xs">End</Label><Input type="date" value={a.end_date || ""} onChange={e => update(a.id, "end_date", e.target.value || null)} disabled={isArchived} className="w-36" /></div>
                {!isArchived && <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementsSection;
