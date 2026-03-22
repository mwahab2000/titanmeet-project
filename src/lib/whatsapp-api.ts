/**
 * WhatsApp API layer for TitanMeet.
 * Covers check-in, scheduled messages, and WhatsApp metrics queries.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Check-in ──

export async function sendCheckinWhatsApp(
  eventId: string,
  attendeeIds?: string[],
): Promise<{
  correlationId: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  results?: any[];
}> {
  const baseUrl = window.location.origin;
  const { data, error } = await supabase.functions.invoke("send-checkin-whatsapp", {
    body: { event_id: eventId, attendee_ids: attendeeIds, base_url: baseUrl },
  });
  if (error) throw error;
  return data as any;
}

// ── Confirm check-in (frontend-side call) ──

export async function confirmCheckin(token: string): Promise<{ success: boolean; already_checked_in: boolean }> {
  const { data, error } = await supabase.functions.invoke("confirm-rsvp", {
    body: { token, action: "checkin" },
  });
  if (error) throw error;
  return data as any;
}

// ── Scheduled Messages ──

export interface ScheduledMessage {
  id: string;
  event_id: string;
  attendee_id: string | null;
  channel: string;
  message_type: string;
  scheduled_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
  status: string;
  payload: any;
  error: string | null;
  created_at: string;
  attendee_name?: string;
}

export async function listScheduledMessages(eventId: string): Promise<ScheduledMessage[]> {
  const { data, error } = await supabase
    .from("scheduled_messages" as any)
    .select("*, attendees(name)")
    .eq("event_id", eventId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map((d: any) => ({
    ...d,
    attendee_name: d.attendees?.name,
  }));
}

export async function createScheduledMessage(params: {
  event_id: string;
  attendee_id?: string;
  channel: string;
  message_type: string;
  scheduled_at: string;
  payload?: any;
  created_by: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("scheduled_messages" as any)
    .insert({
      event_id: params.event_id,
      attendee_id: params.attendee_id || null,
      channel: params.channel,
      message_type: params.message_type,
      scheduled_at: params.scheduled_at,
      payload: params.payload || {},
      created_by: params.created_by,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id;
}

export async function cancelScheduledMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("scheduled_messages" as any)
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as any)
    .eq("id", messageId);
  if (error) throw error;
}

export async function scheduleEventReminders(params: {
  event_id: string;
  channel: string;
  scheduled_at: string;
  created_by: string;
}): Promise<number> {
  // Get all attendees who haven't confirmed
  const { data: attendees, error: attErr } = await supabase
    .from("attendees")
    .select("id")
    .eq("event_id", params.event_id)
    .eq("confirmed", false);
  if (attErr) throw attErr;
  if (!attendees || attendees.length === 0) return 0;

  const rows = attendees.map((a) => ({
    event_id: params.event_id,
    attendee_id: a.id,
    channel: params.channel,
    message_type: "reminder",
    scheduled_at: params.scheduled_at,
    payload: { base_url: window.location.origin },
    created_by: params.created_by,
  }));

  const { error } = await supabase.from("scheduled_messages" as any).insert(rows as any);
  if (error) throw error;
  return rows.length;
}

export async function scheduleEventCheckin(params: {
  event_id: string;
  channel: string;
  scheduled_at: string;
  created_by: string;
}): Promise<number> {
  // Get all confirmed attendees who haven't checked in
  const { data: attendees, error: attErr } = await supabase
    .from("attendees")
    .select("id")
    .eq("event_id", params.event_id)
    .eq("confirmed", true);
  if (attErr) throw attErr;
  if (!attendees || attendees.length === 0) return 0;

  const rows = attendees.map((a) => ({
    event_id: params.event_id,
    attendee_id: a.id,
    channel: params.channel,
    message_type: "checkin",
    scheduled_at: params.scheduled_at,
    payload: { base_url: window.location.origin },
    created_by: params.created_by,
  }));

  const { error } = await supabase.from("scheduled_messages" as any).insert(rows as any);
  if (error) throw error;
  return rows.length;
}

// ── WhatsApp Metrics ──

export interface WhatsAppMetrics {
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  replied: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export async function getWhatsAppMetrics(eventId: string): Promise<WhatsAppMetrics> {
  const [logsRes, inboundRes] = await Promise.all([
    supabase
      .from("message_logs")
      .select("status")
      .eq("event_id", eventId)
      .eq("channel", "whatsapp"),
    supabase
      .from("inbound_messages" as any)
      .select("id")
      .eq("event_id", eventId),
  ]);

  const logs = logsRes.data || [];
  const inbound = (inboundRes.data || []) as any[];

  const totalSent = logs.length;
  const delivered = logs.filter((l) => ["delivered", "read", "sent"].includes(l.status)).length;
  const read = logs.filter((l) => l.status === "read").length;
  const failed = logs.filter((l) => ["failed", "undelivered"].includes(l.status)).length;
  const replied = inbound.length;

  return {
    totalSent,
    delivered,
    read,
    failed,
    replied,
    deliveryRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
    readRate: totalSent > 0 ? Math.round((read / totalSent) * 100) : 0,
    replyRate: totalSent > 0 ? Math.round((replied / totalSent) * 100) : 0,
  };
}
