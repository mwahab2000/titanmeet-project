import { supabase } from "@/integrations/supabase/client";

export interface EventInvite {
  id: string;
  event_id: string;
  attendee_id: string;
  token: string;
  status: string;
  sent_via_whatsapp: boolean;
  sent_via_email: boolean;
  whatsapp_sent_at: string | null;
  email_sent_at: string | null;
  last_sent_at: string | null;
  opened_at: string | null;
  rsvp_at: string | null;
  created_at: string;
  attendee_name?: string;
  attendee_email?: string;
  attendee_mobile?: string;
  attendee_confirmed?: boolean;
}

export type SendChannel = "email" | "whatsapp";

export async function listEventInvites(eventId: string): Promise<EventInvite[]> {
  const { data, error } = await supabase
    .from("event_invites" as any)
    .select("*, attendees(name, email, mobile, confirmed)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).map((d: any) => ({
    ...d,
    attendee_name: d.attendees?.name,
    attendee_email: d.attendees?.email,
    attendee_mobile: d.attendees?.mobile,
    attendee_confirmed: d.attendees?.confirmed,
  }));
}

export async function generateEventInvites(eventId: string): Promise<number> {
  const { data: attendees, error: attErr } = await supabase
    .from("attendees")
    .select("id")
    .eq("event_id", eventId);
  if (attErr) throw attErr;

  const { data: existing } = await supabase
    .from("event_invites" as any)
    .select("attendee_id")
    .eq("event_id", eventId);
  const existingIds = new Set((existing || []).map((e: any) => e.attendee_id));

  const toInsert = (attendees || [])
    .filter((a) => !existingIds.has(a.id))
    .map((a) => ({
      event_id: eventId,
      attendee_id: a.id,
    }));

  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from("event_invites" as any).insert(toInsert as any);
  if (error) throw error;
  return toInsert.length;
}

export async function sendEventInvitations(
  eventId: string,
  channels: SendChannel[] = ["email"],
  attendeeIds?: string[],
  options?: { dry_run?: boolean; is_reminder?: boolean },
): Promise<{
  correlationId?: string;
  dry_run?: boolean;
  sent_email: number;
  sent_whatsapp: number;
  failed_email: number;
  failed_whatsapp: number;
  skipped_no_phone: number;
  skipped_no_email: number;
  skipped_email_not_configured: number;
  email_not_configured: boolean;
  whatsapp_not_configured: boolean;
  email_auth_failed: boolean;
  smtp_connection_failed: boolean;
  total: number;
  results?: any[];
}> {
  const baseUrl = window.location.origin;
  const { data, error } = await supabase.functions.invoke("send-event-invitations", {
    body: {
      event_id: eventId,
      attendee_ids: attendeeIds,
      base_url: baseUrl,
      channels,
      dry_run: options?.dry_run ?? false,
      is_reminder: options?.is_reminder ?? false,
    },
  });
  if (error) throw error;
  return data as any;
}
