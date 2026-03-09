import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHint } from "@/components/ui/section-hint";

interface Attendee { id: string; name: string; email: string; }
interface Group { id: string; name: string; capacity: number | null; }

const AssignGroupsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});  // attendee_id -> group_id
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!event) return;
    const [aRes, gRes, agRes] = await Promise.all([
      supabase.from("attendees").select("id, name, email").eq("event_id", event.id),
      supabase.from("groups").select("*").eq("event_id", event.id),
      supabase.from("attendee_groups").select("attendee_id, group_id"),
    ]);
    setAttendees((aRes.data as Attendee[]) || []);
    setGroups((gRes.data as Group[]) || []);
    const map: Record<string, string> = {};
    (agRes.data || []).forEach((ag: any) => { map[ag.attendee_id] = ag.group_id; });
    setAssignments(map);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const assign = async (attendeeId: string, groupId: string | null) => {
    // Remove old
    await supabase.from("attendee_groups").delete().eq("attendee_id", attendeeId);
    if (groupId) {
      await supabase.from("attendee_groups").insert({ attendee_id: attendeeId, group_id: groupId } as any);
    }
    setAssignments(prev => {
      const next = { ...prev };
      if (groupId) next[attendeeId] = groupId; else delete next[attendeeId];
      return next;
    });
  };

  const unassigned = attendees.filter(a => !assignments[a.id]);
  const grouped = (gId: string) => attendees.filter(a => assignments[a.id] === gId);

  if (!event) return null;

  return (
    <div className="space-y-4">
      {(attendees.length === 0 || groups.length === 0) && (
        <SectionHint
          sectionKey="assign-groups"
          title="Assign Groups"
          description="Assign your attendees to the groups you've created. Attendees can belong to one group at a time."
        />
      )}
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
      {/* Unassigned */}
      <Card
        onDragOver={e => e.preventDefault()}
        onDrop={() => { if (dragId) assign(dragId, null); setDragId(null); }}
      >
        <CardHeader><CardTitle className="font-display text-base">Unassigned ({unassigned.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 min-h-[100px]">
          {unassigned.map(a => (
            <div key={a.id} draggable={!isArchived} onDragStart={() => setDragId(a.id)}
              className="rounded-md border border-border px-3 py-2 text-sm cursor-grab bg-background hover:bg-muted/50">
              {a.name || a.email}
            </div>
          ))}
          {unassigned.length === 0 && <p className="text-xs text-muted-foreground">All assigned</p>}
        </CardContent>
      </Card>

      {/* Groups */}
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map(g => {
          const members = grouped(g.id);
          const over = g.capacity && members.length > g.capacity;
          return (
            <Card key={g.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) assign(dragId, g.id); setDragId(null); }}
              className={over ? "border-destructive" : ""}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{g.name} ({members.length}{g.capacity ? `/${g.capacity}` : ""})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 min-h-[60px]">
                {members.map(a => (
                  <div key={a.id} draggable={!isArchived} onDragStart={() => setDragId(a.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs cursor-grab bg-background hover:bg-muted/50">
                    {a.name || a.email}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Create groups first.</p>}
      </div>
    </div>
    </div>
  );
};

export default AssignGroupsSection;
