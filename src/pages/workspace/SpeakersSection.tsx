import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Check, X, Mic, Upload, ExternalLink } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useSignedUrl } from "@/hooks/useSignedUrls";
import { SectionHint } from "@/components/ui/section-hint";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import avatarMale from "@/assets/avatar-male.png";
import avatarFemale from "@/assets/avatar-female.png";

interface Speaker {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  day_number: number;
  gender: string;
  event_id: string;
}

interface DraftRow {
  day_number: number;
  name: string;
  title: string;
  gender: string;
  linkedin_url: string;
}

const EMPTY_DRAFT: DraftRow = { day_number: 1, name: "", title: "", gender: "male", linkedin_url: "" };

const DAY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const LINKEDIN_REGEX = /^https:\/\/(www\.)?linkedin\.com\//;

function getDefaultAvatar(gender: string) {
  return gender === "female" ? avatarFemale : avatarMale;
}

/* ── Inline-editable text cell ── */
const EditableCell = ({
  value,
  onChange,
  disabled,
  placeholder = "",
  className = "",
  error = false,
  validate,
  onEnter,
  onTabNext,
  onTabPrev,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
  validate?: (v: string) => boolean;
  onEnter?: () => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  if (disabled || !editing) {
    return (
      <div
        className={`px-2 py-1.5 min-h-[32px] cursor-text truncate text-sm ${!value ? "text-muted-foreground" : ""} ${error ? "ring-2 ring-destructive/60 rounded" : ""} ${className}`}
        onClick={() => !disabled && setEditing(true)}
        title={value || placeholder}
      >
        {value || placeholder}
      </div>
    );
  }

  const commit = (v: string) => {
    if (validate && v && !validate(v)) {
      toast.error("Invalid value");
      return;
    }
    onChange(v);
    setEditing(false);
  };

  return (
    <Input
      ref={inputRef}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(draft);
          onEnter?.();
        }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
        if (e.key === "Tab") {
          e.preventDefault();
          commit(draft);
          if (e.shiftKey) onTabPrev?.(); else onTabNext?.();
        }
      }}
      className={`h-8 text-sm px-2 ${error ? "border-destructive" : ""}`}
      placeholder={placeholder}
    />
  );
};

/* ── Image cell (upload + view) ── */
const ImageCell = ({
  speaker,
  disabled,
  onUpload,
  onRemove,
}: {
  speaker: Speaker;
  disabled: boolean;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const signedUrl = useSignedUrl("event-assets", speaker.photo_url);
  const hasImage = !!speaker.photo_url;

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(speaker.id, file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3 w-3" />
        {hasImage ? "Replace" : "Upload"}
      </Button>
      {hasImage && signedUrl && (
        <>
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            View <ExternalLink className="h-3 w-3" />
          </a>
          {!disabled && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onRemove(speaker.id)} title="Remove image">
              <X className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

/* ── Avatar preview ── */
const AvatarPreview = ({ speaker }: { speaker: Speaker }) => {
  const signedUrl = useSignedUrl("event-assets", speaker.photo_url);
  const src = speaker.photo_url && signedUrl ? signedUrl : getDefaultAvatar(speaker.gender);

  return (
    <img
      src={src}
      alt={speaker.name || "Speaker"}
      className="h-8 w-8 rounded-full object-cover border border-border"
    />
  );
};

/* ── Draft row inline editor cell ── */
const DraftCell = ({
  value,
  onChange,
  placeholder,
  onEnter,
  onTabNext,
  onTabPrev,
  error = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
  error?: boolean;
}) => (
  <Input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`h-8 text-sm px-2 ${error ? "border-destructive" : ""}`}
    onKeyDown={(e) => {
      if (e.key === "Enter") { e.preventDefault(); onEnter?.(); }
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) onTabPrev?.(); else onTabNext?.();
      }
    }}
  />
);

/* ── Main component ── */
const SpeakersSection = () => {
  const { event, isArchived, refreshCounts } = useEventWorkspace();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [draft, setDraft] = useState<DraftRow>({ ...EMPTY_DRAFT });

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase
      .from("speakers" as any)
      .select("*")
      .eq("event_id", event.id)
      .order("day_number")
      .order("name");
    setSpeakers((data as any as Speaker[]) || []);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  /* ── CRUD ── */
  const updateField = async (id: string, field: string, value: any) => {
    await supabase.from("speakers" as any).update({ [field]: value } as any).eq("id", id);
    setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const duplicateRow = async (speaker: Speaker) => {
    if (!event) return;
    const { error } = await supabase
      .from("speakers" as any)
      .insert({
        event_id: event.id,
        name: speaker.name + " (copy)",
        title: speaker.title,
        bio: speaker.bio,
        linkedin_url: speaker.linkedin_url,
        day_number: speaker.day_number,
        gender: speaker.gender,
      } as any);
    if (error) toast.error(error.message);
    else { load(); refreshCounts(); }
  };

  const deleteRow = async (id: string) => {
    await supabase.from("speakers" as any).delete().eq("id", id);
    setDeleteConfirm(null);
    load();
    refreshCounts();
  };

  const uploadPhoto = async (speakerId: string, file: File) => {
    if (!event) return;
    const ext = file.name.split(".").pop();
    const path = `speakers/${event.id}/${speakerId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("event-assets")
      .upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); return; }
    await updateField(speakerId, "photo_url", path);
    toast.success("Photo uploaded");
  };

  const removePhoto = async (speakerId: string) => {
    await updateField(speakerId, "photo_url", null);
    toast.success("Photo removed");
  };

  /* ── Draft row: create speaker on Enter ── */
  const commitDraft = async () => {
    if (!event || !draft.name.trim() || !draft.title.trim()) {
      toast.error("Name and Title are required");
      return;
    }
    const { error } = await supabase.from("speakers" as any).insert({
      event_id: event.id,
      name: draft.name.trim(),
      title: draft.title.trim(),
      day_number: draft.day_number,
      gender: draft.gender,
      linkedin_url: draft.linkedin_url.trim() || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    setDraft({ ...EMPTY_DRAFT });
    load();
    refreshCounts();
    toast.success("Speaker added");
  };

  /* ── Bulk paste ── */
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!event) return;
    const text = e.clipboardData.getData("text/plain");
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;
    e.preventDefault();
    const rows = lines.map((line) => {
      const cols = line.split("\t");
      return {
        event_id: event.id,
        day_number: parseInt(cols[0]) || 1,
        name: cols[1]?.trim() || "",
        title: cols[2]?.trim() || "",
        gender: (cols[3]?.trim().toLowerCase() === "female") ? "female" : "male",
        linkedin_url: cols[4]?.trim() || null,
      };
    }).filter((r) => r.name);
    if (!rows.length) return;
    const { error } = await supabase.from("speakers" as any).insert(rows as any);
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} speakers pasted`); load(); refreshCounts(); }
  }, [event?.id, load, refreshCounts]);

  if (!event) return null;

  const filtered = filterDay === "all"
    ? speakers
    : speakers.filter((s) => s.day_number === parseInt(filterDay));

  const validate = (s: Speaker) => ({
    name: !s.name?.trim(),
    title: !s.title?.trim(),
    linkedin: !!(s.linkedin_url && !LINKEDIN_REGEX.test(s.linkedin_url)),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="font-display flex items-center gap-2">
          <Mic className="h-5 w-5" /> Speakers
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterDay} onValueChange={setFilterDay}>
            <SelectTrigger className="h-9 w-[120px] text-xs">
              <SelectValue placeholder="Filter Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="w-full" onPaste={handlePaste}>
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[80px]">Day</TableHead>
                  <TableHead className="w-[170px]">Name *</TableHead>
                  <TableHead className="w-[170px]">Title *</TableHead>
                  <TableHead className="w-[100px]">Gender</TableHead>
                  <TableHead className="w-[180px]">LinkedIn</TableHead>
                  <TableHead className="w-[150px]">Image</TableHead>
                  <TableHead className="w-[50px]">Preview</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ── Existing rows ── */}
                {filtered.map((speaker) => {
                  const errs = validate(speaker);
                  return (
                    <TableRow key={speaker.id} className="group hover:bg-muted/20">
                      {/* Day */}
                      <TableCell className="p-1">
                        <Select
                          value={String(speaker.day_number ?? 1)}
                          onValueChange={(v) => updateField(speaker.id, "day_number", parseInt(v))}
                          disabled={isArchived}
                        >
                          <SelectTrigger className="h-8 text-xs border-0 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAY_OPTIONS.map((d) => (
                              <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Name */}
                      <TableCell className="p-1">
                        <EditableCell
                          value={speaker.name}
                          onChange={(v) => updateField(speaker.id, "name", v)}
                          disabled={isArchived}
                          placeholder="Speaker name"
                          error={errs.name}
                        />
                      </TableCell>

                      {/* Title */}
                      <TableCell className="p-1">
                        <EditableCell
                          value={speaker.title || ""}
                          onChange={(v) => updateField(speaker.id, "title", v)}
                          disabled={isArchived}
                          placeholder="Title / Role"
                          error={errs.title}
                        />
                      </TableCell>

                      {/* Gender */}
                      <TableCell className="p-1">
                        <Select
                          value={speaker.gender || "male"}
                          onValueChange={(v) => updateField(speaker.id, "gender", v)}
                          disabled={isArchived}
                        >
                          <SelectTrigger className="h-8 text-xs border-0 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* LinkedIn */}
                      <TableCell className="p-1">
                        <div className="flex items-center gap-1">
                          <EditableCell
                            value={speaker.linkedin_url || ""}
                            onChange={(v) => updateField(speaker.id, "linkedin_url", v || null)}
                            disabled={isArchived}
                            placeholder="https://linkedin.com/..."
                            error={errs.linkedin}
                            validate={(v) => !v || LINKEDIN_REGEX.test(v)}
                            className="flex-1"
                          />
                          {speaker.linkedin_url && LINKEDIN_REGEX.test(speaker.linkedin_url) && (
                            <a href={speaker.linkedin_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* Image */}
                      <TableCell className="p-1">
                        <ImageCell speaker={speaker} disabled={isArchived} onUpload={uploadPhoto} onRemove={removePhoto} />
                      </TableCell>

                      {/* Preview Avatar */}
                      <TableCell className="p-1">
                        <AvatarPreview speaker={speaker} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="p-1 text-right">
                        {deleteConfirm === speaker.id ? (
                          <span className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteRow(speaker.id)}>
                              <Check className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </span>
                        ) : (
                          !isArchived && (
                            <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateRow(speaker)} title="Duplicate">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteConfirm(speaker.id)} title="Delete">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </span>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* ── Always-empty draft row ── */}
                {!isArchived && (
                  <TableRow className="bg-muted/10 border-t-2 border-dashed border-border">
                    {/* Day */}
                    <TableCell className="p-1">
                      <Select
                        value={String(draft.day_number)}
                        onValueChange={(v) => setDraft((d) => ({ ...d, day_number: parseInt(v) }))}
                      >
                        <SelectTrigger className="h-8 text-xs border-0 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map((d) => (
                            <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Name */}
                    <TableCell className="p-1">
                      <DraftCell
                        value={draft.name}
                        onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                        placeholder="New speaker name..."
                        onEnter={commitDraft}
                        error={false}
                      />
                    </TableCell>

                    {/* Title */}
                    <TableCell className="p-1">
                      <DraftCell
                        value={draft.title}
                        onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
                        placeholder="Title / Role..."
                        onEnter={commitDraft}
                        error={false}
                      />
                    </TableCell>

                    {/* Gender */}
                    <TableCell className="p-1">
                      <Select
                        value={draft.gender}
                        onValueChange={(v) => setDraft((d) => ({ ...d, gender: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs border-0 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* LinkedIn */}
                    <TableCell className="p-1">
                      <DraftCell
                        value={draft.linkedin_url}
                        onChange={(v) => setDraft((d) => ({ ...d, linkedin_url: v }))}
                        placeholder="https://linkedin.com/..."
                        onEnter={commitDraft}
                      />
                    </TableCell>

                    {/* Image — not available for draft */}
                    <TableCell className="p-1">
                      <span className="text-xs text-muted-foreground italic px-2">Save first</span>
                    </TableCell>

                    {/* Preview Avatar */}
                    <TableCell className="p-1">
                      <img
                        src={getDefaultAvatar(draft.gender)}
                        alt="Preview"
                        className="h-8 w-8 rounded-full object-cover border border-border"
                      />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="p-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={commitDraft}
                        disabled={!draft.name.trim() || !draft.title.trim()}
                      >
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {speakers.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">
            Start typing in the row above, or paste rows (Day, Name, Title, Gender, LinkedIn — tab-separated).
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SpeakersSection;
