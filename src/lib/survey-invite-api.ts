import { supabase } from "@/integrations/supabase/client";

export interface SurveyInvite {
  id: string;
  survey_id: string;
  attendee_id: string;
  event_id: string;
  token: string;
  sent_at: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  status: string;
  created_at: string;
  attendee_name?: string;
  attendee_email?: string;
}

export async function listInvites(surveyId: string): Promise<SurveyInvite[]> {
  const { data, error } = await supabase
    .from("survey_invites" as any)
    .select("*, attendees(name, email)")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).map((d: any) => ({
    ...d,
    attendee_name: d.attendees?.name,
    attendee_email: d.attendees?.email,
  }));
}

export async function generateInvites(surveyId: string, eventId: string): Promise<number> {
  // Get all attendees for the event
  const { data: attendees, error: attErr } = await supabase
    .from("attendees")
    .select("id")
    .eq("event_id", eventId);
  if (attErr) throw attErr;

  // Get existing invites
  const { data: existing } = await supabase
    .from("survey_invites" as any)
    .select("attendee_id")
    .eq("survey_id", surveyId);
  const existingIds = new Set((existing || []).map((e: any) => e.attendee_id));

  // Create missing invites
  const newInvites = (attendees || [])
    .filter((a) => !existingIds.has(a.id))
    .map((a) => ({
      survey_id: surveyId,
      attendee_id: a.id,
      event_id: eventId,
    }));

  if (newInvites.length === 0) return 0;

  const { error } = await supabase.from("survey_invites" as any).insert(newInvites as any);
  if (error) throw error;
  return newInvites.length;
}

export async function sendSurveyLinks(
  surveyId: string,
  eventId: string,
  inviteIds?: string[]
): Promise<{ sent: number; total: number }> {
  const baseUrl = window.location.origin;
  const { data, error } = await supabase.functions.invoke("send-survey-links", {
    body: { survey_id: surveyId, event_id: eventId, invite_ids: inviteIds, base_url: baseUrl },
  });
  if (error) throw error;
  return data as { sent: number; total: number };
}

export async function getSurveyStats(surveyId: string) {
  const { data: invites } = await supabase
    .from("survey_invites" as any)
    .select("id, status, submitted_at")
    .eq("survey_id", surveyId);

  const submittedCount = (invites || []).filter((i: any) => i.status === "submitted").length;
  const totalCount = (invites || []).length;
  const sentCount = (invites || []).filter((i: any) => ["sent", "opened", "submitted"].includes(i.status)).length;

  return { submittedCount, totalCount, sentCount };
}
