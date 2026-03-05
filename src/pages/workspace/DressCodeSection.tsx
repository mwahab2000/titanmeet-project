import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Upload, X, Shirt } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { useSignedUrl } from "@/hooks/useSignedUrls";

/** Small component to display a signed dress-code reference image */
const DressCodeRefImage = ({ path, alt }: { path: string; alt: string }) => {
  // If it's a local public path (default images), use directly
  if (path.startsWith("/images/")) {
    return <img src={path} alt={alt} className="w-full h-full object-cover rounded-lg border border-border" />;
  }
  const url = useSignedUrl("dress-code-images", path);
  return <img src={url || ""} alt={alt} className="w-full h-full object-cover rounded-lg border border-border" />;
};

const DRESS_TYPES = [
  { value: "formal", label: "Formal" },
  { value: "semi_formal", label: "Semi-Formal" },
  { value: "business_formal", label: "Business Formal" },
  { value: "business_casual", label: "Business Casual" },
  { value: "smart_casual", label: "Smart Casual" },
];

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  formal: "Floor-length gowns or dark suits with ties. Polished dress shoes required. This is the most elevated dress code — think black-tie-adjacent elegance.",
  semi_formal: "Cocktail dresses or suits without ties. Smart and polished, but slightly less formal. Midi dresses, dressy separates, and loafers are welcome.",
  business_formal: "Dark suits, ties, and closed-toe shoes. Conservative and professional. Stick to navy, charcoal, or black with minimal accessories.",
  business_casual: "Collared shirts, slacks or skirts. No jeans or sneakers. A polished yet comfortable look — blazers optional but encouraged.",
  smart_casual: "Neat, put-together look. Chinos, blouses, or smart jeans with blazers. Clean sneakers are acceptable. Express personal style while staying polished.",
};

const DEFAULT_IMAGES: Record<string, string> = {
  formal: "/images/dress-code/formal.png",
  semi_formal: "/images/dress-code/semi-formal.png",
  business_formal: "/images/dress-code/business-formal.png",
  business_casual: "/images/dress-code/business-casual.png",
  smart_casual: "/images/dress-code/smart-casual.png",
};

interface DressCode {
  id?: string;
  event_id: string;
  day_number: number;
  dress_type: string;
  custom_instructions: string;
  reference_images: string[];
}

const DressCodeSection = () => {
  const { event, refreshCounts } = useEventWorkspace();
  const [entries, setEntries] = useState<DressCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const eventDays = event?.start_date && event?.end_date
    ? Math.max(1, differenceInDays(parseISO(event.end_date), parseISO(event.start_date)) + 1)
    : 1;

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("dress_codes")
      .select("*")
      .eq("event_id", event.id)
      .order("day_number");
    if (error) {
      console.error("Load dress codes error:", error);
    }
    setEntries(
      (data ?? []).map((d) => ({
        ...d,
        custom_instructions: d.custom_instructions || "",
        reference_images: Array.isArray(d.reference_images) ? (d.reference_images as string[]) : [],
      }))
    );
    setLoading(false);
  }, [event]);

  useEffect(() => { load(); }, [load]);

  const addDay = () => {
    if (!event) return;
    const usedDays = entries.map((e) => e.day_number);
    const nextDay = Array.from({ length: 9 }, (_, i) => i + 1).find((d) => !usedDays.includes(d));
    if (!nextDay) { toast.error("All days already have dress codes"); return; }
    const defaultType = "business_casual";
    setEntries([...entries, {
      event_id: event.id,
      day_number: nextDay,
      dress_type: defaultType,
      custom_instructions: DEFAULT_DESCRIPTIONS[defaultType],
      reference_images: DEFAULT_IMAGES[defaultType] ? [DEFAULT_IMAGES[defaultType]] : [],
    }]);
  };

  const updateEntry = (index: number, updates: Partial<DressCode>) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  };

  const handleDressTypeChange = (index: number, newType: string) => {
    updateEntry(index, {
      dress_type: newType,
      custom_instructions: DEFAULT_DESCRIPTIONS[newType] || "",
      reference_images: DEFAULT_IMAGES[newType] ? [DEFAULT_IMAGES[newType]] : [],
    });
  };

  const removeEntry = async (index: number) => {
    const entry = entries[index];
    if (entry.id) {
      const { error } = await supabase.from("dress_codes").delete().eq("id", entry.id);
      if (error) { console.error("Delete dress code error:", error); toast.error(error.message); return; }
    }
    setEntries((prev) => prev.filter((_, i) => i !== index));
    refreshCounts();
    toast.success("Dress code removed");
  };

  const handleImageUpload = async (index: number, file: File) => {
    if (!event) return;
    const path = `${event.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("dress-code-images").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    updateEntry(index, { reference_images: [...entries[index].reference_images, path] });
  };

  const removeImage = (entryIndex: number, imgIndex: number) => {
    const imgs = [...entries[entryIndex].reference_images];
    imgs.splice(imgIndex, 1);
    updateEntry(entryIndex, { reference_images: imgs });
  };

  const saveAll = async () => {
    if (!event) return;
    setSaving(true);
    try {
      for (const entry of entries) {
        const payload: any = {
          event_id: event.id,
          day_number: entry.day_number,
          dress_type: entry.dress_type,
          custom_instructions: entry.custom_instructions || null,
          reference_images: entry.reference_images,
        };
        if (entry.id) {
          console.log("Updating dress code:", entry.id, payload);
          const { error } = await supabase.from("dress_codes").update(payload).eq("id", entry.id);
          if (error) { console.error("Update error:", error); toast.error("Save failed: " + error.message); setSaving(false); return; }
        } else {
          console.log("Inserting dress code:", payload);
          const { data, error } = await supabase.from("dress_codes").insert(payload).select();
          if (error) { console.error("Insert error:", error); toast.error("Save failed: " + error.message); setSaving(false); return; }
          console.log("Insert result:", data);
        }
      }
      toast.success("Dress codes saved");
      refreshCounts();
      await load();
    } catch (err) {
      console.error("Save dress code error:", err);
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <Shirt className="h-5 w-5 text-primary" /> Dress Code
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Set dress code guidelines per day of your event.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addDay}>
            <Plus className="h-4 w-4 mr-1" /> Add Day
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      {entries.length === 0 && (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <Shirt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No dress codes set yet. Click "Add Day" above to get started.</p>
        </div>
      )}

      {entries.map((entry, idx) => (
        <div key={idx} className="border border-border rounded-xl bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold font-display">
              {eventDays > 1 ? `Day ${entry.day_number}` : "Dress Code"}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => removeEntry(idx)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dress Code Type</Label>
              <Select value={entry.dress_type} onValueChange={(v) => handleDressTypeChange(idx, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DRESS_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={String(entry.day_number)} onValueChange={(v) => updateEntry(idx, { day_number: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: Math.max(eventDays, 9) }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the expected attire for this dress code..."
              value={entry.custom_instructions}
              onChange={(e) => updateEntry(idx, { custom_instructions: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Reference Images</Label>
            <div className="flex flex-wrap gap-3">
              {entry.reference_images.map((img, imgIdx) => (
                <div key={imgIdx} className="relative group w-24 h-24">
                  <DressCodeRefImage path={img} alt="Reference" />
                  <button
                    onClick={() => removeImage(idx, imgIdx)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(idx, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DressCodeSection;
