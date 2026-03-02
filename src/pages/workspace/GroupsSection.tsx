import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Group { id: string; name: string; capacity: number | null; }

const GroupsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("groups").select("*").eq("event_id", event.id);
    setItems((data as Group[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const add = async (name: string) => {
    if (!event || !name.trim()) return;
    const { error } = await supabase.from("groups").insert({ event_id: event.id, name: name.trim() } as any);
    if (error) toast.error(error.message);
    else { setNewName(""); load(); }
  };

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); add(newName); }
  };

  const update = async (id: string, field: string, value: any) => {
    await supabase.from("groups").update({ [field]: value } as any).eq("id", id);
  };

  const handleLocalChange = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const remove = async (id: string) => { await supabase.from("groups").delete().eq("id", id); load(); };

  if (!event) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">Groups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No groups yet.</p>}
        {items.map(g => (
          <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Input
              value={g.name}
              onChange={e => handleLocalChange(g.id, "name", e.target.value)}
              onBlur={e => update(g.id, "name", e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              disabled={isArchived}
              className="flex-1"
              placeholder="Group name"
            />
            <Input
              type="number"
              value={g.capacity ?? ""}
              onChange={e => handleLocalChange(g.id, "capacity", e.target.value ? parseInt(e.target.value) : null)}
              onBlur={e => update(g.id, "capacity", e.target.value ? parseInt(e.target.value) : null)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              disabled={isArchived}
              className="w-24"
              placeholder="Cap"
            />
            {!isArchived && <Button variant="ghost" size="icon" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>
        ))}
        {!isArchived && (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleNewKeyDown}
              placeholder="Type group name and press Enter…"
              className="flex-1"
            />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => add(newName)} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GroupsSection;
