import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Mic, Upload, Linkedin, User, UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSignedUrl } from "@/hooks/useSignedUrls";

const AVATAR_MALE = "https://api.dicebear.com/7.x/personas/svg?seed=male-default&backgroundColor=b6e3f4";
const AVATAR_FEMALE = "https://api.dicebear.com/7.x/personas/svg?seed=female-default&backgroundColor=ffdfbf";

interface Speaker {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
}

const SpeakersSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("speakers" as any).select("*").eq("event_id", event.id).order("name");
    setSpeakers((data as any as Speaker[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const addSpeaker = async () => {
    if (!event) return;
    const { error } = await supabase.from("speakers" as any).insert({ event_id: event.id, name: "New Speaker" } as any);
    if (error) toast.error(error.message);
    else load();
  };

  const updateSpeaker = async (id: string, updates: Partial<Speaker>) => {
    await supabase.from("speakers" as any).update(updates as any).eq("id", id);
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSpeaker = async (id: string) => {
    await supabase.from("speakers" as any).delete().eq("id", id);
    load();
  };

  const uploadPhoto = async (speakerId: string, file: File) => {
    if (!event) return;
    setUploading(speakerId);
    const ext = file.name.split(".").pop();
    const path = `speakers/${event.id}/${speakerId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("event-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(null);
      return;
    }

    // Store the path, not a full URL
    await updateSpeaker(speakerId, { photo_url: path });
    setUploading(null);
    toast.success("Photo uploaded");
  };

  if (!event) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display flex items-center gap-2">
          <Mic className="h-5 w-5" /> Speakers
        </CardTitle>
        {!isArchived && (
          <Button size="sm" variant="outline" className="gap-1" onClick={addSpeaker}>
            <Plus className="h-4 w-4" /> Add Speaker
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {speakers.length === 0 && <p className="text-sm text-muted-foreground">No speakers yet.</p>}
        {speakers.map((speaker) => (
          <SpeakerCard
            key={speaker.id}
            speaker={speaker}
            isArchived={isArchived}
            uploading={uploading === speaker.id}
            onUpdate={updateSpeaker}
            onDelete={deleteSpeaker}
            onUpload={uploadPhoto}
          />
        ))}
      </CardContent>
    </Card>
  );
};

interface SpeakerCardProps {
  speaker: Speaker;
  isArchived: boolean;
  uploading: boolean;
  onUpdate: (id: string, updates: Partial<Speaker>) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string, file: File) => void;
}

const SpeakerCard = ({ speaker, isArchived, uploading, onUpdate, onDelete, onUpload }: SpeakerCardProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const photoUrl = useSignedUrl("event-assets", speaker.photo_url);

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border p-4 bg-background">
      {/* Photo / Avatar */}
      <div className="flex flex-col items-center gap-2">
        <Avatar className="h-16 w-16">
          <AvatarImage src={photoUrl || undefined} alt={speaker.name} />
          <AvatarFallback className="text-lg">{speaker.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {!isArchived && (
          <div className="flex flex-col items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onUpload(speaker.id, file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 w-full"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
            <Select
              value={
                speaker.photo_url === AVATAR_MALE ? "male" :
                speaker.photo_url === AVATAR_FEMALE ? "female" : "none"
              }
              onValueChange={v => {
                if (v === "male") onUpdate(speaker.id, { photo_url: AVATAR_MALE });
                else if (v === "female") onUpdate(speaker.id, { photo_url: AVATAR_FEMALE });
                else onUpdate(speaker.id, { photo_url: null });
              }}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Avatar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No avatar</SelectItem>
                <SelectItem value="male">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> Male</span>
                </SelectItem>
                <SelectItem value="female">
                  <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> Female</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 space-y-2">
        <Input
          value={speaker.name}
          onChange={e => onUpdate(speaker.id, { name: e.target.value })}
          placeholder="Speaker Name"
          disabled={isArchived}
          className="font-medium"
        />
        <Input
          value={speaker.title || ""}
          onChange={e => onUpdate(speaker.id, { title: e.target.value })}
          placeholder="Title / Role"
          disabled={isArchived}
        />
        <div className="flex items-center gap-2">
          <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={speaker.linkedin_url || ""}
            onChange={e => onUpdate(speaker.id, { linkedin_url: e.target.value })}
            placeholder="LinkedIn profile URL"
            disabled={isArchived}
          />
        </div>
        <Textarea
          value={speaker.bio || ""}
          onChange={e => onUpdate(speaker.id, { bio: e.target.value })}
          placeholder="Bio"
          rows={2}
          disabled={isArchived}
        />
      </div>

      {!isArchived && (
        <Button variant="ghost" size="icon" onClick={() => onDelete(speaker.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
};

export default SpeakersSection;
