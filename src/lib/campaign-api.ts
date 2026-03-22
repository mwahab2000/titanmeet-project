/**
 * Campaign API — unified communication campaign model
 * Used by both Communication Center UI and AI Builder
 */
import { supabase } from "@/integrations/supabase/client";

export type CampaignType = "invitation" | "attendance_confirmation" | "reminder" | "check_in" | "follow_up";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "failed";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "opened" | "failed" | "replied";
export type Channel = "email" | "whatsapp";

export interface Campaign {
  id: string;
  event_id: string;
  created_by: string;
  campaign_type: CampaignType;
  channels: Channel[];
  status: CampaignStatus;
  audience_filter: Record<string, unknown>;
  audience_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  message_template: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  attendee_id: string;
  channel: Channel;
  delivery_status: DeliveryStatus;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  created_at: string;
  attendee_name?: string;
  attendee_email?: string;
  attendee_mobile?: string;
}

export interface CampaignWithStats extends Campaign {
  stats: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
    replied: number;
  };
}

export interface ConfirmationStats {
  invited: number;
  confirmed: number;
  declined: number;
  pending: number;
  confirmationRate: number;
  byChannel: {
    email: { sent: number; delivered: number; opened: number; failed: number };
    whatsapp: { sent: number; delivered: number; opened: number; failed: number };
  };
}

// ── List campaigns for an event ──
export async function listCampaigns(eventId: string): Promise<CampaignWithStats[]> {
  const { data: campaigns, error } = await supabase
    .from("communication_campaigns" as any)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!campaigns?.length) return [];

  const campaignIds = (campaigns as any[]).map((c: any) => c.id);

  const { data: recipients } = await supabase
    .from("campaign_recipients" as any)
    .select("campaign_id, delivery_status")
    .in("campaign_id", campaignIds);

  const statsMap = new Map<string, CampaignWithStats["stats"]>();
  for (const r of (recipients || []) as any[]) {
    if (!statsMap.has(r.campaign_id)) {
      statsMap.set(r.campaign_id, { total: 0, queued: 0, sent: 0, delivered: 0, opened: 0, failed: 0, replied: 0 });
    }
    const s = statsMap.get(r.campaign_id)!;
    s.total++;
    if (r.delivery_status in s) {
      (s as any)[r.delivery_status]++;
    }
  }

  return (campaigns as any[]).map((c: any) => ({
    ...c,
    stats: statsMap.get(c.id) || { total: 0, queued: 0, sent: 0, delivered: 0, opened: 0, failed: 0, replied: 0 },
  }));
}

// ── Get campaign details with recipients ──
export async function getCampaignDetails(campaignId: string): Promise<{
  campaign: Campaign;
  recipients: CampaignRecipient[];
}> {
  const [campRes, recipRes] = await Promise.all([
    supabase.from("communication_campaigns" as any).select("*").eq("id", campaignId).single(),
    supabase
      .from("campaign_recipients" as any)
      .select("*, attendees(name, email, mobile)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
  ]);

  if (campRes.error) throw campRes.error;

  const recipients = ((recipRes.data || []) as any[]).map((r: any) => ({
    ...r,
    attendee_name: r.attendees?.name,
    attendee_email: r.attendees?.email,
    attendee_mobile: r.attendees?.mobile,
  }));

  return { campaign: campRes.data as any, recipients };
}

// ── Get confirmation stats for an event ──
export async function getConfirmationStats(eventId: string): Promise<ConfirmationStats> {
  const [attendeesRes, invitesRes, logsRes] = await Promise.all([
    supabase.from("attendees").select("id, confirmed, confirmed_at").eq("event_id", eventId),
    supabase.from("event_invites" as any).select("id, status, sent_via_email, sent_via_whatsapp").eq("event_id", eventId),
    supabase.from("message_logs").select("channel, status").eq("event_id", eventId),
  ]);

  const attendees = attendeesRes.data || [];
  const invites = (invitesRes.data || []) as any[];
  const logs = logsRes.data || [];

  const confirmed = attendees.filter(a => a.confirmed).length;
  const invited = invites.length;
  const pending = invited - confirmed;

  const emailLogs = logs.filter(l => l.channel === "email");
  const waLogs = logs.filter(l => l.channel === "whatsapp");

  return {
    invited,
    confirmed,
    declined: 0,
    pending,
    confirmationRate: invited > 0 ? Math.round((confirmed / invited) * 100) : 0,
    byChannel: {
      email: {
        sent: emailLogs.length,
        delivered: emailLogs.filter(l => ["sent", "delivered", "read"].includes(l.status)).length,
        opened: emailLogs.filter(l => l.status === "read").length,
        failed: emailLogs.filter(l => l.status === "failed").length,
      },
      whatsapp: {
        sent: waLogs.length,
        delivered: waLogs.filter(l => ["delivered", "read", "sent"].includes(l.status)).length,
        opened: waLogs.filter(l => l.status === "read").length,
        failed: waLogs.filter(l => ["failed", "undelivered"].includes(l.status)).length,
      },
    },
  };
}

// ── Create a campaign (draft) ──
export async function createCampaign(params: {
  event_id: string;
  campaign_type: CampaignType;
  channels: Channel[];
  audience_filter?: Record<string, unknown>;
  message_template?: Record<string, unknown>;
  scheduled_at?: string;
}): Promise<Campaign> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  // Count audience
  let audienceQuery = supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", params.event_id);
  const segment = params.audience_filter?.segment as string;
  if (segment === "pending") audienceQuery = audienceQuery.eq("confirmed", false);
  if (segment === "confirmed") audienceQuery = audienceQuery.eq("confirmed", true);
  const { count } = await audienceQuery;

  const { data, error } = await supabase
    .from("communication_campaigns" as any)
    .insert({
      event_id: params.event_id,
      created_by: user.user.id,
      campaign_type: params.campaign_type,
      channels: params.channels,
      status: params.scheduled_at ? "scheduled" : "draft",
      audience_filter: params.audience_filter || {},
      audience_count: count || 0,
      scheduled_at: params.scheduled_at || null,
      message_template: params.message_template || {},
    } as any)
    .select("*")
    .single();

  if (error) throw error;
  return data as any;
}

// ── Send a campaign (triggers actual delivery via existing edge functions) ──
export async function sendCampaign(
  campaignId: string,
  eventId: string,
): Promise<{
  sent_email: number;
  sent_whatsapp: number;
  failed_email: number;
  failed_whatsapp: number;
  total: number;
}> {
  // Get campaign details
  const { data: campaign, error: campErr } = await supabase
    .from("communication_campaigns" as any)
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campErr || !campaign) throw campErr || new Error("Campaign not found");
  const camp = campaign as any;

  // Update campaign status to sending
  await supabase
    .from("communication_campaigns" as any)
    .update({ status: "sending", started_at: new Date().toISOString() } as any)
    .eq("id", campaignId);

  // Get audience
  let attendeeQuery = supabase.from("attendees").select("id").eq("event_id", eventId);
  const segment = camp.audience_filter?.segment as string;
  if (segment === "pending") attendeeQuery = attendeeQuery.eq("confirmed", false);
  if (segment === "confirmed") attendeeQuery = attendeeQuery.eq("confirmed", true);
  const { data: attendees } = await attendeeQuery;
  const attendeeIds = (attendees || []).map(a => a.id);

  // Map campaign type to existing edge function behavior
  const channels = camp.channels as Channel[];
  const isReminder = camp.campaign_type === "reminder";

  // Use existing send-event-invitations edge function for delivery
  const { data: result, error: sendErr } = await supabase.functions.invoke("send-event-invitations", {
    body: {
      event_id: eventId,
      attendee_ids: attendeeIds.length > 0 ? attendeeIds : undefined,
      base_url: window.location.origin,
      channels,
      is_reminder: isReminder,
    },
  });

  if (sendErr) {
    await supabase
      .from("communication_campaigns" as any)
      .update({ status: "failed", metadata: { error: sendErr.message } } as any)
      .eq("id", campaignId);
    throw sendErr;
  }

  // Create recipient records from results
  const recipients: any[] = [];
  if (result?.results) {
    for (const r of result.results) {
      for (const ch of channels) {
        const statusKey = ch === "email" ? "email_status" : "whatsapp_status";
        const status = r[statusKey];
        if (status && status !== "skipped") {
          recipients.push({
            campaign_id: campaignId,
            attendee_id: r.attendee_id,
            channel: ch,
            delivery_status: status === "sent" ? "sent" : "failed",
            error: ch === "email" ? r.email_error : r.whatsapp_error,
            sent_at: status === "sent" ? new Date().toISOString() : null,
          });
        }
      }
    }
  }

  if (recipients.length > 0) {
    await supabase.from("campaign_recipients" as any).insert(recipients as any);
  }

  // Mark campaign complete
  await supabase
    .from("communication_campaigns" as any)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      audience_count: attendeeIds.length,
    } as any)
    .eq("id", campaignId);

  return {
    sent_email: result?.sent_email || 0,
    sent_whatsapp: result?.sent_whatsapp || 0,
    failed_email: result?.failed_email || 0,
    failed_whatsapp: result?.failed_whatsapp || 0,
    total: attendeeIds.length,
  };
}

// ── Get communication performance for an event ──
export async function getCommunicationPerformance(eventId: string) {
  const [logsRes, inboundRes] = await Promise.all([
    supabase.from("message_logs").select("channel, status").eq("event_id", eventId),
    supabase.from("inbound_messages" as any).select("id, channel").eq("event_id", eventId),
  ]);

  const logs = logsRes.data || [];
  const inbound = (inboundRes.data || []) as any[];

  const byChannel = (ch: string) => {
    const chLogs = logs.filter(l => l.channel === ch);
    return {
      sent: chLogs.length,
      delivered: chLogs.filter(l => ["sent", "delivered", "read"].includes(l.status)).length,
      opened: chLogs.filter(l => l.status === "read").length,
      failed: chLogs.filter(l => ["failed", "undelivered"].includes(l.status)).length,
      replied: inbound.filter((m: any) => m.channel === ch).length,
    };
  };

  const email = byChannel("email");
  const whatsapp = byChannel("whatsapp");

  return {
    total: { sent: logs.length, delivered: email.delivered + whatsapp.delivered, opened: email.opened + whatsapp.opened, failed: email.failed + whatsapp.failed, replied: inbound.length },
    email,
    whatsapp,
  };
}
