import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pin, ExternalLink, Megaphone, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface EventAnnouncement {
  id: string;
  event_id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  priority: number;
  is_pinned: boolean;
  start_at: string | null;
  end_at: string | null;
  link_url: string | null;
  link_label: string | null;
  created_at: string;
}

const TYPES = [
  { value: "info", label: "Info", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "warning", label: "Warning", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "urgent", label: "Urgent", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  { value: "success", label: "Success", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
];

const TARGETS = [
  { value: "public", label: "Public" },
  { value: "attendees_only", label: "Attendees Only" },
  { value: "staff_only", label: "Staff Only" },
];

const typeColor = (t: string) => TYPES.find(x => x.value === t)?.color ?? "";

const EventAnnouncementsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<EventAnnouncement[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [editItem, setEditItem] = useState<Partial<EventAnnouncement> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase
      .from("event_announcements" as any)
      .select("*")
      .eq("event_id", event.id)
      .order("is_pinned", { ascending: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as any as EventAnnouncement[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditItem({ title: "", message: "", type: "info", target: "public", priority: 0, is_pinned: false, start_at: null, end_at: null, link_url: null, link_label: null });
    setDialogOpen(true);
  };

  const openEdit = (item: EventAnnouncement) => {
    setEditItem({ ...item });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!event || !editItem) return;
    if (!editItem.title?.trim() || !editItem.message?.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (editItem.start_at && editItem.end_at && new Date(editItem.end_at) <= new Date(editItem.start_at)) {
      toast.error("End date must be after start date");
      return;
    }

    const payload = {
      event_id: event.id,
      title: editItem.title,
      message: editItem.message,
      type: editItem.type || "info",
      target: editItem.target || "public",
      priority: editItem.priority || 0,
      is_pinned: editItem.is_pinned || false,
      start_at: editItem.start_at || null,
      end_at: editItem.end_at || null,
      link_url: editItem.link_url || null,
      link_label: editItem.link_label || null,
    };

    if (editItem.id) {
      const { error } = await supabase.from("event_announcements" as any).update(payload as any).eq("id", editItem.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement updated");
    } else {
      const { error } = await supabase.from("event_announcements" as any).insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement created");
    }
    setDialogOpen(false);
    setEditItem(null);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("event_announcements" as any).delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const togglePin = async (item: EventAnnouncement) => {
    await supabase.from("event_announcements" as any).update({ is_pinned: !item.is_pinned } as any).eq("id", item.id);
    load();
  };

  const filtered = items.filter(i => {
    if (filter === "pinned") return i.is_pinned;
    if (filter === "public") return i.target === "public";
    if (filter === "attendees_only") return i.target === "attendees_only";
    if (TYPES.some(t => t.value === filter)) return i.type === filter;
    return true;
  });

  if (!event) return null;

  return (
    <div className="space-y-4">
      {/* Live preview ticker */}
      {items.length > 0 && <TickerPreview items={items.filter(i => i.target === "public")} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Event Announcements
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pinned">Pinned</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="attendees_only">Attendees</SelectItem>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {!isArchived && (
              <Button size="sm" variant="outline" className="gap-1" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
          {filtered.map(item => (
            <div key={item.id} className="rounded-lg border border-border p-3 flex items-start gap-3 group hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  {item.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                  <Badge variant="outline" className={`text-[10px] ${typeColor(item.type)}`}>{item.type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{item.target}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                {(item.start_at || item.end_at) && (
                  <p className="text-[10px] text-muted-foreground">
                    {item.start_at && `From ${new Date(item.start_at).toLocaleDateString()}`}
                    {item.end_at && ` to ${new Date(item.end_at).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              {!isArchived && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(item)}>
                    <Pin className={`h-3.5 w-3.5 ${item.is_pinned ? "text-primary" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Edit" : "New"} Announcement</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Title *</Label>
                <Input value={editItem.title || ""} onChange={e => setEditItem(p => ({ ...p!, title: e.target.value }))} placeholder="Announcement title" />
              </div>
              <div className="space-y-1">
                <Label>Message *</Label>
                <Textarea value={editItem.message || ""} onChange={e => setEditItem(p => ({ ...p!, message: e.target.value }))} placeholder="Announcement message" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={editItem.type || "info"} onValueChange={v => setEditItem(p => ({ ...p!, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Target</Label>
                  <Select value={editItem.target || "public"} onValueChange={v => setEditItem(p => ({ ...p!, target: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Input type="number" value={editItem.priority ?? 0} onChange={e => setEditItem(p => ({ ...p!, priority: Number(e.target.value) }))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={editItem.is_pinned || false} onCheckedChange={v => setEditItem(p => ({ ...p!, is_pinned: v }))} />
                  <Label>Pinned</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={editItem.start_at?.slice(0, 16) || ""} onChange={e => setEditItem(p => ({ ...p!, start_at: e.target.value || null }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="datetime-local" value={editItem.end_at?.slice(0, 16) || ""} onChange={e => setEditItem(p => ({ ...p!, end_at: e.target.value || null }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Link URL</Label>
                  <Input value={editItem.link_url || ""} onChange={e => setEditItem(p => ({ ...p!, link_url: e.target.value || null }))} placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <Label>Link Label</Label>
                  <Input value={editItem.link_label || ""} onChange={e => setEditItem(p => ({ ...p!, link_label: e.target.value || null }))} placeholder="Learn more" />
                </div>
              </div>
              <Button onClick={save} className="w-full">{editItem.id ? "Update" : "Create"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* Mini rotating preview */
const TickerPreview: React.FC<{ items: EventAnnouncement[] }> = ({ items }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const iv = setInterval(() => setIdx(p => (p + 1) % items.length), 4000);
    return () => clearInterval(iv);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];
  if (!current) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-center space-y-0.5">
      <p className="text-xs font-semibold text-primary">{current.title}</p>
      <p className="text-xs text-muted-foreground">{current.message}</p>
    </div>
  );
};

export default EventAnnouncementsSection;
