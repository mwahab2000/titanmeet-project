import { supabase } from "@/integrations/supabase/client";

export interface Survey {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  event_id: string;
  question_text: string;
  type: string;
  required: boolean;
  order_index: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const QUESTION_TYPES = [
  { value: "yes_no", label: "Yes / No" },
  { value: "single_choice", label: "Single Choice" },
  { value: "multi_choice", label: "Multiple Choice" },
  { value: "rating_stars", label: "Rating Stars" },
  { value: "likert", label: "Likert Scale" },
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
] as const;

export type QuestionType = typeof QUESTION_TYPES[number]["value"];

export function defaultSettings(type: QuestionType): Record<string, any> {
  switch (type) {
    case "single_choice":
    case "multi_choice":
      return { options: [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }] };
    case "rating_stars":
      return { max: 5 };
    case "likert":
      return { min: 1, max: 5, labels: { "1": "Strongly disagree", "5": "Strongly agree" } };
    case "short_text":
    case "long_text":
      return { placeholder: "", maxLength: 0 };
    case "number":
      return { min: 0, max: 100, step: 1 };
    default:
      return {};
  }
}

export async function listSurveys(eventId: string) {
  const { data, error } = await supabase
    .from("surveys" as any)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Survey[];
}

export async function createSurvey(eventId: string, createdBy: string) {
  const { data, error } = await supabase
    .from("surveys" as any)
    .insert({ event_id: eventId, created_by: createdBy, title: "Untitled Survey" } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Survey;
}

export async function updateSurvey(surveyId: string, patch: Partial<Survey>) {
  const { error } = await supabase
    .from("surveys" as any)
    .update(patch as any)
    .eq("id", surveyId);
  if (error) throw error;
}

export async function deleteSurvey(surveyId: string) {
  const { error } = await supabase.from("surveys" as any).delete().eq("id", surveyId);
  if (error) throw error;
}

export async function duplicateSurvey(surveyId: string, eventId: string, createdBy: string) {
  const { data: original } = await supabase.from("surveys" as any).select("*").eq("id", surveyId).single();
  if (!original) throw new Error("Survey not found");
  const s = original as unknown as Survey;
  const newSurvey = await createSurvey(eventId, createdBy);
  await updateSurvey(newSurvey.id, { title: `${s.title} (Copy)`, description: s.description });
  const questions = await listQuestions(surveyId);
  for (const q of questions) {
    await upsertQuestion({
      survey_id: newSurvey.id,
      event_id: eventId,
      question_text: q.question_text,
      type: q.type,
      required: q.required,
      order_index: q.order_index,
      settings: q.settings,
    });
  }
  return newSurvey;
}

export async function listQuestions(surveyId: string) {
  const { data, error } = await supabase
    .from("survey_questions" as any)
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index");
  if (error) throw error;
  return (data || []) as unknown as SurveyQuestion[];
}

export async function upsertQuestion(question: Partial<SurveyQuestion> & { survey_id: string; event_id: string }) {
  if (question.id) {
    const { id, ...rest } = question;
    const { error } = await supabase.from("survey_questions" as any).update(rest as any).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("survey_questions" as any).insert(question as any).select().single();
    if (error) throw error;
    return data as unknown as SurveyQuestion;
  }
}

export async function deleteQuestion(questionId: string) {
  const { error } = await supabase.from("survey_questions" as any).delete().eq("id", questionId);
  if (error) throw error;
}

export async function reorderQuestions(surveyId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, i) =>
    supabase.from("survey_questions" as any).update({ order_index: i } as any).eq("id", id)
  );
  await Promise.all(updates);
}
