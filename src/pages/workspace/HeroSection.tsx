import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";

const HeroSection = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [uploading, setUploading] = useState(false);
  if (!event) return null;

  const handleTitleChange = (val: string) => autosave({ title: val });

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const newUrls = [...event.hero_images];
    for (const file of Array.from(files)) {
      const path = `events/${event.id}/hero/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-assets").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }
    autosave({ hero_images: newUrls as any });
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    const updated = event.hero_images.filter((_, i) => i !== idx);
    autosave({ hero_images: updated as any });
  };

  return (
    <Card ref={ref}>
      <CardHeader><CardTitle className="font-display">Hero Section</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Event Title *</Label>
          <Input value={event.title || ""} onChange={e => handleTitleChange(e.target.value)} disabled={isArchived} />
        </div>
        <div className="space-y-2">
          <Label>Hero Images</Label>
          <div className="flex flex-wrap gap-3">
            {event.hero_images.map((url, i) => (
              <div key={i} className="relative group h-24 w-32 rounded-lg overflow-hidden border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                {!isArchived && (
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isArchived && (
            <Button variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => document.getElementById("hero-upload")?.click()}>
              <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Images"}
            </Button>
          )}
          <input id="hero-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
        </div>
      </CardContent>
    </Card>
  );
});

HeroSection.displayName = "HeroSection";

export default HeroSection;
