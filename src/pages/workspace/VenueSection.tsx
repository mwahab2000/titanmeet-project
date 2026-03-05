import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Plus, Trash2 } from "lucide-react";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import { Separator } from "@/components/ui/separator";
import { differenceInDays, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

interface Room {
  id?: string;
  event_id: string;
  name: string;
  days: number[];
  capacity: number | null;
  notes: string | null;
}

const VenueSection = () => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [uploading, setUploading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [savingRooms, setSavingRooms] = useState(false);

  const eventDays = event?.start_date && event?.end_date
    ? Math.max(1, differenceInDays(parseISO(event.end_date), parseISO(event.start_date)) + 1)
    : 1;

  const loadRooms = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("event_rooms" as any).select("*").eq("event_id", event.id).order("name");
    setRooms(((data as any[]) || []).map((r: any) => ({
      id: r.id,
      event_id: r.event_id,
      name: r.name,
      days: Array.isArray(r.days) ? r.days : [],
      capacity: r.capacity,
      notes: r.notes,
    })));
  }, [event?.id]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  if (!event) return null;

  const venuePaths: string[] = Array.isArray(event.venue_images) ? (event.venue_images as string[]) : [];
  const venueUrls = useSignedUrls("event-assets", venuePaths);

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const newPaths = [...venuePaths];
    for (const file of Array.from(files)) {
      const path = `events/${event.id}/venue/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-assets").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      newPaths.push(path);
    }
    autosave({ venue_images: newPaths as any });
    setUploading(false);
  };

  const removeImage = (i: number) => autosave({ venue_images: venuePaths.filter((_, j) => j !== i) as any });

  // Rooms CRUD
  const addRoom = () => {
    setRooms([...rooms, { event_id: event.id, name: "", days: [], capacity: null, notes: null }]);
  };

  const updateRoom = (index: number, updates: Partial<Room>) => {
    setRooms((prev) => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const toggleRoomDay = (index: number, day: number) => {
    const room = rooms[index];
    const days = room.days.includes(day) ? room.days.filter((d) => d !== day) : [...room.days, day].sort();
    updateRoom(index, { days });
  };

  const removeRoom = async (index: number) => {
    const room = rooms[index];
    if (room.id) {
      await supabase.from("event_rooms" as any).delete().eq("id", room.id);
    }
    setRooms((prev) => prev.filter((_, i) => i !== index));
    toast.success("Room removed");
  };

  const saveRooms = async () => {
    setSavingRooms(true);
    try {
      for (const room of rooms) {
        if (!room.name.trim()) { toast.error("Room name is required"); setSavingRooms(false); return; }
        const payload = { event_id: event.id, name: room.name, days: room.days, capacity: room.capacity, notes: room.notes };
        if (room.id) {
          await supabase.from("event_rooms" as any).update(payload as any).eq("id", room.id);
        } else {
          await supabase.from("event_rooms" as any).insert(payload as any);
        }
      }
      toast.success("Rooms saved");
      await loadRooms();
    } catch {
      toast.error("Failed to save rooms");
    }
    setSavingRooms(false);
  };

  const dayNumbers = Array.from({ length: Math.max(eventDays, 3) }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="font-display">Venue</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Venue Name</Label><Input value={event.venue_name || ""} onChange={(e) => autosave({ venue_name: e.target.value })} disabled={isArchived} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={event.venue_address || ""} onChange={(e) => autosave({ venue_address: e.target.value })} disabled={isArchived} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={event.venue_notes || ""} onChange={(e) => autosave({ venue_notes: e.target.value })} disabled={isArchived} rows={3} /></div>
          <div className="space-y-2"><Label>Map Link</Label><Input value={event.venue_map_link || ""} onChange={(e) => autosave({ venue_map_link: e.target.value })} disabled={isArchived} placeholder="https://maps.google.com/..." /></div>
          <div className="space-y-2">
            <Label>Venue Images</Label>
            <div className="flex flex-wrap gap-3">
              {venuePaths.map((_, i) => (
                <div key={i} className="relative group h-24 w-32 rounded-lg overflow-hidden border border-border">
                  <img src={venueUrls[i] || ""} alt="" className="h-full w-full object-cover" />
                  {!isArchived && <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
            </div>
            {!isArchived && (
              <Button variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => document.getElementById("venue-upload")?.click()}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Images"}
              </Button>
            )}
            <input id="venue-upload" type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </div>
        </CardContent>
      </Card>

      {/* Rooms */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Rooms</CardTitle>
          <div className="flex gap-2">
            {!isArchived && <Button variant="outline" size="sm" onClick={addRoom}><Plus className="h-4 w-4 mr-1" /> Add Room</Button>}
            {!isArchived && rooms.length > 0 && <Button size="sm" onClick={saveRooms} disabled={savingRooms}>{savingRooms ? "Saving..." : "Save Rooms"}</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms added yet. Add rooms to assign them to agenda items.</p>}
          {rooms.map((room, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Room Name *</Label>
                    <Input value={room.name} onChange={(e) => updateRoom(idx, { name: e.target.value })} placeholder="e.g. Main Hall" disabled={isArchived} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Capacity</Label>
                    <Input type="number" value={room.capacity ?? ""} onChange={(e) => updateRoom(idx, { capacity: e.target.value ? Number(e.target.value) : null })} placeholder="Optional" disabled={isArchived} />
                  </div>
                </div>
                {!isArchived && (
                  <Button variant="ghost" size="icon" onClick={() => removeRoom(idx)} className="shrink-0 mt-4">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Available Days</Label>
                <div className="flex flex-wrap gap-3">
                  {dayNumbers.map((day) => (
                    <label key={day} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={room.days.includes(day)} onCheckedChange={() => toggleRoomDay(idx, day)} disabled={isArchived} />
                      Day {day}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Leave unchecked = available all days</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={room.notes || ""} onChange={(e) => updateRoom(idx, { notes: e.target.value || null })} placeholder="Optional notes" disabled={isArchived} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default VenueSection;
