import { useState, useEffect, useCallback, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { QuestionCard } from "./QuestionCard";
import { QuestionPreview } from "./QuestionPreview";
import {
  type Survey, type SurveyQuestion,
  listQuestions, upsertQuestion, deleteQuestion, reorderQuestions,
  updateSurvey, defaultSettings,
} from "@/lib/survey-api";

interface Props {
  survey: Survey;
  eventId: string;
  disabled?: boolean;
  onBack: () => void;
}

export function SurveyEditor({ survey, eventId, disabled, onBack }: Props) {
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description || "");
  const [status, setStatus] = useState(survey.status);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [preview, setPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const qs = await listQuestions(survey.id);
    setQuestions(qs);
  }, [survey.id]);

  useEffect(() => { load(); }, [load]);

  // Autosave title/description
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await updateSurvey(survey.id, { title, description: description || null });
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, description, survey.id]);

  const togglePublish = async () => {
    const newStatus = status === "published" ? "draft" : "published";
    if (newStatus === "published") {
      const optionTypes = ["single_choice", "multi_choice"];
      for (const q of questions) {
        if (optionTypes.includes(q.type) && (!q.settings?.options || q.settings.options.length < 2)) {
          toast.error(`Question "${q.question_text || 'Untitled'}" needs at least 2 options`);
          return;
        }
      }
    }
    await updateSurvey(survey.id, { status: newStatus });
    setStatus(newStatus);
    toast.success(newStatus === "published" ? "Survey published" : "Survey unpublished");
  };

  const addQuestion = async () => {
    const newQ = await upsertQuestion({
      survey_id: survey.id,
      event_id: eventId,
      question_text: "",
      type: "short_text",
      required: false,
      order_index: questions.length,
      settings: defaultSettings("short_text"),
    });
    if (newQ) setQuestions(prev => [...prev, newQ]);
  };

  const handleUpdate = useCallback(async (id: string, patch: Partial<SurveyQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
    await upsertQuestion({ id, survey_id: survey.id, event_id: eventId, ...patch });
  }, [survey.id, eventId]);

  const handleDelete = async (id: string) => {
    await deleteQuestion(id);
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({ ...q, order_index: i }));
    setQuestions(reordered);
    await reorderQuestions(survey.id, reordered.map(q => q.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="font-display text-lg font-semibold flex-1">Edit Survey</h2>
        <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setPreview(!preview)}>
          {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {preview ? "Edit" : "Preview"}
        </Button>
        {!disabled && (
          <Button size="sm" variant={status === "published" ? "outline" : "default"} onClick={togglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </Button>
        )}
      </div>

      {!preview ? (
        <>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div><Label className="text-xs">Title</Label><Input value={title} disabled={disabled} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label className="text-xs">Description</Label><Textarea value={description} disabled={disabled} onChange={e => setDescription(e.target.value)} rows={2} /></div>
            </CardContent>
          </Card>

          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {questions.map(q => (
                  <QuestionCard key={q.id} question={q} onUpdate={handleUpdate} onDelete={handleDelete} disabled={disabled} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {!disabled && (
            <Button variant="outline" className="gap-1 w-full" onClick={addQuestion}>
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          )}
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle className="font-display">{title}</CardTitle>{description && <p className="text-sm text-muted-foreground">{description}</p>}</CardHeader>
          <CardContent className="space-y-6">
            {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
            {questions.map(q => <QuestionPreview key={q.id} question={q} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
