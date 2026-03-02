import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";

const VenueSection = () => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [uploading, setUploading] = useState(false);
  if (!event) return null;

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const urls = [...event.venue_images];
    for (const file of Array.from(files)) {
      const path = `events/${event.id}/venue/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-assets").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    autosave({ venue_images: urls as any });
    setUploading(false);
  };

  const removeImage = (i: number) => autosave({ venue_images: event.venue_images.filter((_, j) => j !== i) as any });

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Venue</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Venue Name</Label><Input value={event.venue_name || ""} onChange={e => autosave({ venue_name: e.target.value })} disabled={isArchived} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={event.venue_address || ""} onChange={e => autosave({ venue_address: e.target.value })} disabled={isArchived} /></div>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={event.venue_notes || ""} onChange={e => autosave({ venue_notes: e.target.value })} disabled={isArchived} rows={3} /></div>
        <div className="space-y-2"><Label>Map Link</Label><Input value={event.venue_map_link || ""} onChange={e => autosave({ venue_map_link: e.target.value })} disabled={isArchived} placeholder="https://maps.google.com/..." /></div>
        <div className="space-y-2">
          <Label>Venue Images</Label>
          <div className="flex flex-wrap gap-3">
            {event.venue_images.map((url, i) => (
              <div key={i} className="relative group h-24 w-32 rounded-lg overflow-hidden border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                {!isArchived && <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
          </div>
          {!isArchived && (
            <Button variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => document.getElementById("venue-upload")?.click()}>
              <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Images"}
            </Button>
          )}
          <input id="venue-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
        </div>
      </CardContent>
    </Card>
  );
};

export default VenueSection;
