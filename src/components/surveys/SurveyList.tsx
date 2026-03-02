import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type Survey, listSurveys, createSurvey, deleteSurvey, duplicateSurvey } from "@/lib/survey-api";

interface Props {
  eventId: string;
  userId: string;
  disabled?: boolean;
  onEdit: (survey: Survey) => void;
}

export function SurveyList({ eventId, userId, disabled, onEdit }: Props) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSurveys(await listSurveys(eventId));
    } catch { toast.error("Failed to load surveys"); }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const s = await createSurvey(eventId, userId);
      onEdit(s);
    } catch { toast.error("Failed to create survey"); }
  };

  const handleDelete = async (id: string) => {
    await deleteSurvey(id);
    load();
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateSurvey(id, eventId, userId);
      load();
      toast.success("Survey duplicated");
    } catch { toast.error("Failed to duplicate"); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Surveys</h2>
        {!disabled && (
          <Button size="sm" className="gap-1" onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Create Survey
          </Button>
        )}
      </div>
      {surveys.length === 0 && <p className="text-sm text-muted-foreground">No surveys yet. Create your first survey.</p>}
      {surveys.map(s => (
        <Card key={s.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.title}</p>
              {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
            </div>
            <Badge variant={s.status === "published" ? "default" : "secondary"}>{s.status}</Badge>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
              {!disabled && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(s.id)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
