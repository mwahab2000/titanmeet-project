// Billing utilities — overage calculation & usage helpers

export interface PlanLimits {
  max_clients: number;
  max_active_events: number;
  max_attendees: number;
  max_emails: number;
  max_storage_gb: number;
}

export interface OverageRates {
  overage_client_cents: number;
  overage_event_cents: number;
  overage_attendees_per_100_cents: number;
  overage_emails_per_1000_cents: number;
  overage_storage_per_5gb_cents: number;
}

export interface UsageData {
  clients_count: number;
  active_events_count: number;
  attendees_count: number;
  emails_sent_count: number;
  storage_used_mb: number;
}

export interface OverageLineItem {
  label: string;
  included: number;
  used: number;
  excess: number;
  unit: string;
  amount_cents: number;
}

export function calculateOverages(
  usage: UsageData,
  limits: PlanLimits,
  rates: OverageRates
): OverageLineItem[] {
  const items: OverageLineItem[] = [];

  const clientExcess = Math.max(0, usage.clients_count - limits.max_clients);
  if (clientExcess > 0) {
    items.push({
      label: "Extra clients",
      included: limits.max_clients,
      used: usage.clients_count,
      excess: clientExcess,
      unit: "client",
      amount_cents: clientExcess * rates.overage_client_cents,
    });
  }

  const eventExcess = Math.max(0, usage.active_events_count - limits.max_active_events);
  if (eventExcess > 0) {
    items.push({
      label: "Extra active events",
      included: limits.max_active_events,
      used: usage.active_events_count,
      excess: eventExcess,
      unit: "event",
      amount_cents: eventExcess * rates.overage_event_cents,
    });
  }

  const attendeeExcess = Math.max(0, usage.attendees_count - limits.max_attendees);
  if (attendeeExcess > 0) {
    const blocks = Math.ceil(attendeeExcess / 100);
    items.push({
      label: "Extra attendees",
      included: limits.max_attendees,
      used: usage.attendees_count,
      excess: attendeeExcess,
      unit: "per 100",
      amount_cents: blocks * rates.overage_attendees_per_100_cents,
    });
  }

  const emailExcess = Math.max(0, usage.emails_sent_count - limits.max_emails);
  if (emailExcess > 0) {
    const blocks = Math.ceil(emailExcess / 1000);
    items.push({
      label: "Extra emails",
      included: limits.max_emails,
      used: usage.emails_sent_count,
      excess: emailExcess,
      unit: "per 1,000",
      amount_cents: blocks * rates.overage_emails_per_1000_cents,
    });
  }

  const storageUsedGb = usage.storage_used_mb / 1024;
  const storageExcess = Math.max(0, storageUsedGb - limits.max_storage_gb);
  if (storageExcess > 0) {
    const blocks = Math.ceil(storageExcess / 5);
    items.push({
      label: "Extra storage",
      included: limits.max_storage_gb,
      used: Math.round(storageUsedGb * 10) / 10,
      excess: Math.round(storageExcess * 10) / 10,
      unit: "per 5 GB",
      amount_cents: blocks * rates.overage_storage_per_5gb_cents,
    });
  }

  return items;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
