import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Upload, Mail, Bell, Users2, Download, FileDown, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHint } from "@/components/ui/section-hint";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitGate } from "@/components/billing/PlanLimitGate";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

// ── Core attendee (identity + contact only from attendees table) ──
interface Attendee {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  _isNew?: boolean;
}

// ── Invite state derived from event_invites (single source of truth) ──
interface InviteState {
  invite_id: string;
  status: string;
  sent_via_email: boolean;
  sent_via_whatsapp: boolean;
  email_sent_at: string | null;
  whatsapp_sent_at: string | null;
  last_sent_at: string | null;
}

// ── Combined row for display ──
interface AttendeeRow extends Attendee {
  invite?: InviteState;
}

const FIELDS = ["name", "email", "mobile"] as const;
type Field = (typeof FIELDS)[number];

const DEBOUNCE_MS = 1500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9\s\-().]*$/;

function validateField(field: Field, value: string): string | null {
  if (field === "email" && value && !EMAIL_RE.test(value)) return "Invalid email format";
  if (field === "mobile" && value && !MOBILE_RE.test(value)) return "Numbers, +, -, () only";
  return null;
}

type StatusFilter = "all" | "confirmed" | "pending" | "invited" | "not_invited";
type InviteChannel = "email" | "whatsapp" | "both";

// ── Derived helpers ──
function isInviteSent(invite?: InviteState): boolean {
  return !!invite && (invite.sent_via_email || invite.sent_via_whatsapp);
}

function getLastSentTime(invite?: InviteState): string | null {
  return invite?.last_sent_at ?? null;
}

function getInviteChannelLabel(invite?: InviteState): string | null {
  if (!invite) return null;
  if (invite.sent_via_email && invite.sent_via_whatsapp) return "both";
  if (invite.sent_via_whatsapp) return "whatsapp";
  if (invite.sent_via_email) return "email";
  return null;
}

// ── CSV Helpers ──

const CSV_TEMPLATE = "name,email,mobile\n";

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendees-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportAttendeesCsv(rows: AttendeeRow[], eventTitle: string) {
  const header = "name,email,mobile,invite_status,confirmed\n";
  const csvRows = rows
    .filter(a => !a._isNew && !a.id.startsWith("temp-"))
    .map(a => {
      const escapeCsv = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      const invStatus = a.confirmed ? "Confirmed" : isInviteSent(a.invite) ? "Invited" : "Pending";
      return `${escapeCsv(a.name)},${escapeCsv(a.email)},${escapeCsv(a.mobile || "")},${invStatus},${a.confirmed ? "Yes" : "No"}`;
    })
    .join("\n");
  const blob = new Blob([header + csvRows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `attendees-${eventTitle?.replace(/\s+/g, "-").toLowerCase() || "export"}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

interface CsvImportResult {
  valid: Array<{ name: string; email: string; mobile: string | null }>;
  duplicates: string[];
  invalid: Array<{ line: number; reason: string; raw: string }>;
}

function parseCsvFile(text: string, existingEmails: Set<string>): CsvImportResult {
  const lines = text.split(/\r?\n/);
  const result: CsvImportResult = { valid: [], duplicates: [], invalid: [] };
  const seenEmails = new Set<string>();

  const firstLine = lines[0]?.toLowerCase().trim();
  const startIdx = (firstLine?.includes("name") && firstLine?.includes("email")) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const parts = raw.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
    const [name, email, mobile] = parts;
    const lineNum = i + 1;

    if (!name) { result.invalid.push({ line: lineNum, reason: "Missing name", raw }); continue; }
    if (!email || !EMAIL_RE.test(email)) { result.invalid.push({ line: lineNum, reason: email ? "Invalid email format" : "Missing email", raw }); continue; }
    const emailLower = email.toLowerCase();
    if (existingEmails.has(emailLower)) { result.duplicates.push(email); continue; }
    if (seenEmails.has(emailLower)) { result.duplicates.push(email); continue; }
    seenEmails.add(emailLower);
    result.valid.push({ name, email, mobile: mobile || null });
  }

  return result;
}

// ── Send response type (matches edge function) ──
interface AttendeeResultFromApi {
  attendee_id: string;
  email_status: string;
  whatsapp_status: string;
  email_error?: string | null;
  whatsapp_error?: string | null;
}

interface SendResponse {
  correlationId?: string;
  channels?: string[];
  sent_email?: number;
  sent_whatsapp?: number;
  failed_email?: number;
  failed_whatsapp?: number;
  skipped_no_email?: number;
  skipped_no_phone?: number;
  skipped_email_not_configured?: number;
  email_not_configured?: boolean;
  whatsapp_not_configured?: boolean;
  email_auth_failed?: boolean;
  smtp_connection_failed?: boolean;
  total?: number;
  error?: string;
  results?: AttendeeResultFromApi[];
  // Legacy compat
  attendee_results?: AttendeeResultFromApi[];
  reason?: string;
}

/** Return IDs of attendees who had at least one channel successfully sent */
function getSuccessfullySentIds(res: SendResponse): Set<string> {
  const ids = new Set<string>();
  const results = res.results || res.attendee_results || [];
  for (const r of results) {
    if (r.email_status === "sent" || r.whatsapp_status === "sent") {
      ids.add(r.attendee_id);
    }
  }
  return ids;
}

// ── Channel icon helper ──
const ChannelIcon = React.forwardRef<HTMLSpanElement, { channel: InviteChannel }>(({ channel, ...props }, ref) => {
  if (channel === "whatsapp") return <span ref={ref} {...props}><MessageSquare className="h-3.5 w-3.5" /></span>;
  if (channel === "both") return (
    <span ref={ref} {...props} className="flex items-center gap-0.5">
      <Mail className="h-3 w-3" />
      <MessageSquare className="h-3 w-3" />
    </span>
  );
  return <span ref={ref} {...props}><Mail className="h-3.5 w-3.5" /></span>;
});
ChannelIcon.displayName = "ChannelIcon";

// ── Component ──

const AttendeesSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const planLimits = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const [items, setItems] = useState<AttendeeRow[]>([]);
  const [inviteMap, setInviteMap] = useState<Map<string, InviteState>>(new Map());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkReminding, setBulkReminding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [importSummary, setImportSummary] = useState<CsvImportResult | null>(null);
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("email");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemsRef = useRef<AttendeeRow[]>([]);
  const persistingRef = useRef<Set<string>>(new Set());

  // ── Load attendees + event_invites and merge ──
  const load = useCallback(async () => {
    if (!event) return;

    // Parallel fetch: attendees + their invites
    const [attRes, invRes] = await Promise.all([
      supabase
        .from("attendees")
        .select("id, name, email, mobile, confirmed, confirmed_at")
        .eq("event_id", event.id),
      supabase
        .from("event_invites" as any)
        .select("id, attendee_id, status, sent_via_email, sent_via_whatsapp, email_sent_at, whatsapp_sent_at, last_sent_at")
        .eq("event_id", event.id),
    ]);

    const attendees = (attRes.data as any[] || []) as Attendee[];
    const invites = (invRes.data as any[] || []);

    // Build invite lookup by attendee_id
    const iMap = new Map<string, InviteState>();
    for (const inv of invites) {
      iMap.set(inv.attendee_id, {
        invite_id: inv.id,
        status: inv.status,
        sent_via_email: inv.sent_via_email,
        sent_via_whatsapp: inv.sent_via_whatsapp,
        email_sent_at: inv.email_sent_at,
        whatsapp_sent_at: inv.whatsapp_sent_at,
        last_sent_at: inv.last_sent_at,
      });
    }
    setInviteMap(iMap);

    // Merge into display rows
    const rows: AttendeeRow[] = attendees.map(a => ({
      ...a,
      invite: iMap.get(a.id),
    }));

    if (!isArchived) rows.push(createEmptyRow());
    setItems(rows);
  }, [event?.id, isArchived]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    load();
    return () => { Object.values(timersRef.current).forEach(clearTimeout); };
  }, [load]);

  function createEmptyRow(): AttendeeRow {
    return {
      id: `temp-${Date.now()}-${Math.random()}`,
      name: "", email: "", mobile: null,
      confirmed: false, confirmed_at: null,
      _isNew: true,
    };
  }

  const isRowEmpty = (a: AttendeeRow) => !a.name && !a.email && !a.mobile;

  const persistRow = async (attendee: AttendeeRow) => {
    if (!event) return null;
    const emailErr = validateField("email", attendee.email);
    if (emailErr && attendee.email) { toast.error("Fix email format before saving"); return null; }

    if (!planLimits.canCreate("attendees")) {
      openUpgradeModal("attendees");
      return null;
    } else if (planLimits.attendees.percent >= 80) {
      toast.warning(`You've used ${planLimits.attendees.percent}% of your monthly attendee limit.`);
    }

    const { data, error } = await supabase
      .from("attendees")
      .insert({ event_id: event.id, name: attendee.name || "", email: attendee.email || "", mobile: attendee.mobile } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    return data as unknown as Attendee;
  };

  const saveField = async (id: string, field: Field, value: string) => {
    const err = validateField(field, value);
    if (err) return;
    await supabase.from("attendees").update({ [field]: value || null } as any).eq("id", id);
  };

  const handleChange = (rowIndex: number, field: Field, value: string) => {
    const realItems = getFilteredItems();
    const item = realItems[rowIndex];
    if (!item) return;
    const realIndex = items.findIndex(i => i.id === item.id);
    if (realIndex < 0) return;

    setItems(prev => {
      const updated = [...prev];
      updated[realIndex] = { ...updated[realIndex], [field]: value };
      return updated;
    });

    const errKey = `${item.id}-${field}`;
    const err = validateField(field, value);
    setErrors(prev => {
      const next = { ...prev };
      if (err) next[errKey] = err; else delete next[errKey];
      return next;
    });

    const rowId = item.id;
    const timerKey = `${rowId}-${field}`;
    if (timersRef.current[timerKey]) clearTimeout(timersRef.current[timerKey]);

    timersRef.current[timerKey] = setTimeout(async () => {
      const liveRowIndex = itemsRef.current.findIndex((r) => r.id === rowId);
      if (liveRowIndex < 0) return;
      const current = itemsRef.current[liveRowIndex];
      if (!current) return;

      if (current._isNew || current.id.startsWith("temp-")) {
        if (persistingRef.current.has(rowId)) return;
        const updatedItem = { ...current, [field]: value };
        if (isRowEmpty(updatedItem)) return;
        persistingRef.current.add(rowId);
        try {
          const saved = await persistRow(updatedItem);
          if (saved) {
            setItems(prev => {
              const next = prev.map((o) => (o.id === rowId ? { ...saved } as AttendeeRow : o));
              const last = next[next.length - 1];
              if (!last?._isNew && !last?.id.startsWith("temp-")) next.push(createEmptyRow());
              return next;
            });
          }
        } finally {
          persistingRef.current.delete(rowId);
        }
      } else {
        saveField(current.id, field, value);
      }
    }, DEBOUNCE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const filtered = getFilteredItems();
    const totalRows = filtered.length;
    const totalCols = FIELDS.length;
    if (e.key === "Tab") {
      e.preventDefault();
      const next = e.shiftKey
        ? { row: colIndex === 0 ? Math.max(0, rowIndex - 1) : rowIndex, col: colIndex === 0 ? totalCols - 1 : colIndex - 1 }
        : { row: colIndex === totalCols - 1 ? Math.min(totalRows - 1, rowIndex + 1) : rowIndex, col: colIndex === totalCols - 1 ? 0 : colIndex + 1 };
      focusCell(next.row, next.col);
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < totalRows - 1) focusCell(rowIndex + 1, colIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, colIndex);
    }
  };

  const focusCell = (row: number, col: number) => {
    cellRefs.current[`${row}-${col}`]?.focus();
  };

  const remove = async (id: string) => {
    if (id.startsWith("temp-")) {
      setItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    await supabase.from("attendees").delete().eq("id", id);
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      const last = next[next.length - 1];
      if (!last?._isNew && !last?.id.startsWith("temp-")) next.push(createEmptyRow());
      return next;
    });
  };

  // ── CSV Import ──
  const handleCSV = async (file: File) => {
    if (!event) return;
    const text = await file.text();
    const existingEmails = new Set(
      items.filter(a => !a._isNew && !a.id.startsWith("temp-")).map(a => a.email.toLowerCase())
    );
    const result = parseCsvFile(text, existingEmails);
    setImportSummary(result);

    if (result.valid.length === 0) { toast.error("No valid rows to import."); return; }

    const rows = result.valid.map(r => ({ event_id: event.id, name: r.name, email: r.email, mobile: r.mobile }));
    const { error } = await supabase.from("attendees").insert(rows as any);
    if (error) { toast.error(error.message); } else {
      toast.success(`${result.valid.length} attendees imported${result.duplicates.length ? `, ${result.duplicates.length} duplicates skipped` : ""}${result.invalid.length ? `, ${result.invalid.length} invalid rows skipped` : ""}`);
      load();
    }
  };

  // ── Send helpers ──
  const getChannels = (): string[] => {
    if (inviteChannel === "both") return ["email", "whatsapp"];
    return [inviteChannel];
  };

  const buildSummaryMessage = (res: SendResponse): string => {
    const lines: string[] = [];
    if (res.reason === "no_attendees_found") lines.push(`⚠ No attendees found`);
    if (res.skipped_no_email) lines.push(`Skipped (no email): ${res.skipped_no_email}`);
    if (res.skipped_no_phone) lines.push(`Skipped (no phone): ${res.skipped_no_phone}`);
    if (res.skipped_email_not_configured) lines.push(`Skipped (email not configured): ${res.skipped_email_not_configured}`);
    if (res.failed_email) lines.push(`Failed email: ${res.failed_email}`);
    if (res.failed_whatsapp) lines.push(`Failed WhatsApp: ${res.failed_whatsapp}`);
    if (res.email_not_configured) lines.push("⚠ Email not configured — set GMAIL_USER & GMAIL_APP_PASSWORD in Supabase secrets");
    if (res.email_auth_failed) lines.push("⚠ SMTP auth failed — use a Google Workspace App Password with 2-Step Verification");
    if (res.smtp_connection_failed) lines.push("⚠ SMTP connection failed — check network and secrets");
    if (res.whatsapp_not_configured) lines.push("⚠ WhatsApp not configured — set Twilio secrets");
    if (res.error) lines.push(`Error: ${res.error}`);
    if (res.correlationId) lines.push(`Correlation: ${res.correlationId}`);
    return lines.join(" | ");
  };

  const handleSendResponse = (res: SendResponse, successLabel: string): boolean => {
    console.log("[Send Summary]", JSON.stringify(res, null, 2));
    const totalSent = (res.sent_email || 0) + (res.sent_whatsapp || 0);
    if (totalSent === 0) {
      const msg = buildSummaryMessage(res);
      toast.error(`No invitations sent. ${msg}`, { duration: 10000 });
      return false;
    }
    const details: string[] = [];
    if (res.sent_email) details.push(`${res.sent_email} email`);
    if (res.sent_whatsapp) details.push(`${res.sent_whatsapp} WhatsApp`);
    if (res.failed_email || res.failed_whatsapp) details.push(`${(res.failed_email || 0) + (res.failed_whatsapp || 0)} failed`);
    if (res.skipped_no_email || res.skipped_no_phone) details.push(`${(res.skipped_no_email || 0) + (res.skipped_no_phone || 0)} skipped`);
    toast.success(`${successLabel}: ${details.join(", ")}`);
    return true;
  };

  /** After a successful send, reload invite state from event_invites for specific attendee IDs */
  const refreshInviteState = async (attendeeIds: string[]) => {
    if (!event || attendeeIds.length === 0) return;
    const { data } = await supabase
      .from("event_invites" as any)
      .select("id, attendee_id, status, sent_via_email, sent_via_whatsapp, email_sent_at, whatsapp_sent_at, last_sent_at")
      .eq("event_id", event.id)
      .in("attendee_id", attendeeIds);

    if (!data) return;

    const newMap = new Map(inviteMap);
    for (const inv of data as any[]) {
      const state: InviteState = {
        invite_id: inv.id,
        status: inv.status,
        sent_via_email: inv.sent_via_email,
        sent_via_whatsapp: inv.sent_via_whatsapp,
        email_sent_at: inv.email_sent_at,
        whatsapp_sent_at: inv.whatsapp_sent_at,
        last_sent_at: inv.last_sent_at,
      };
      newMap.set(inv.attendee_id, state);
    }
    setInviteMap(newMap);

    // Update items with fresh invite state
    setItems(prev => prev.map(a => {
      const freshInvite = newMap.get(a.id);
      if (freshInvite) return { ...a, invite: freshInvite };
      return a;
    }));
  };

  const sendInvitation = async (attendee: AttendeeRow) => {
    if (!event) return;
    setSendingId(attendee.id);
    try {
      const payload = {
        event_id: event.id,
        attendee_ids: [attendee.id],
        channels: getChannels(),
        base_url: window.location.origin,
      };
      const { data, error } = await supabase.functions.invoke("send-event-invitations", { body: payload });
      if (error) throw error;
      const res = (data || {}) as SendResponse;
      handleSendResponse(res, `Invitation to ${attendee.name || attendee.email}`);
      const sentIds = getSuccessfullySentIds(res);
      if (sentIds.size > 0) {
        await refreshInviteState(Array.from(sentIds));
      }
    } catch (e: any) { toast.error(e.message || "Failed to send invitation"); }
    finally { setSendingId(null); }
  };

  const sendReminder = async (attendee: AttendeeRow) => {
    if (!event) return;
    // 24h cooldown based on event_invites.last_sent_at
    const lastSent = getLastSentTime(attendee.invite);
    if (lastSent) {
      const hoursSince = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        toast.error(`Reminder already sent. You can send another in ${hoursLeft} hour(s).`);
        return;
      }
    }
    setSendingId(attendee.id);
    try {
      // Use invite's channel info, fall back to current selection
      const channelLabel = getInviteChannelLabel(attendee.invite) || inviteChannel;
      const channels = channelLabel === "both"
        ? ["email", "whatsapp"]
        : [channelLabel];
      const { data, error } = await supabase.functions.invoke("send-event-invitations", {
        body: {
          event_id: event.id,
          attendee_ids: [attendee.id],
          channels,
          base_url: window.location.origin,
          is_reminder: true,
        },
      });
      if (error) throw error;
      const res = (data || {}) as SendResponse;
      handleSendResponse(res, `Reminder to ${attendee.name || attendee.email}`);
      const sentIds = getSuccessfullySentIds(res);
      if (sentIds.size > 0) {
        await refreshInviteState(Array.from(sentIds));
      }
    } catch (e: any) { toast.error(e.message || "Failed to send reminder"); }
    finally { setSendingId(null); }
  };

  const sendAllInvitations = async () => {
    if (!event) return;
    const channels = getChannels();
    const targets = items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
      if (isInviteSent(a.invite)) return false; // already sent
      const hasEmail = !!a.email;
      const hasMobile = !!a.mobile;
      if (channels.includes("email") && channels.includes("whatsapp")) return hasEmail || hasMobile;
      if (channels.includes("whatsapp")) return hasMobile;
      return hasEmail;
    });
    if (targets.length === 0) { toast.info("No eligible attendees to invite via the selected channel(s)"); return; }
    setBulkSending(true);
    try {
      const payload = {
        event_id: event.id,
        attendee_ids: targets.map(a => a.id),
        channels,
        base_url: window.location.origin,
      };
      const { data, error } = await supabase.functions.invoke("send-event-invitations", { body: payload });
      if (error) throw error;
      const res = (data || {}) as SendResponse;
      handleSendResponse(res, "Invitations");
      const sentIds = getSuccessfullySentIds(res);
      if (sentIds.size > 0) {
        await refreshInviteState(Array.from(sentIds));
      }
    } catch (e: any) { toast.error(e.message || "Failed to send invitations"); }
    setBulkSending(false);
  };

  const sendAllReminders = async () => {
    if (!event) return;
    const now = Date.now();
    const eligible = items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
      if (!isInviteSent(a.invite)) return false; // not yet invited
      const lastSent = getLastSentTime(a.invite);
      if (!lastSent) return true;
      return (now - new Date(lastSent).getTime()) / (1000 * 60 * 60) >= 24;
    });
    if (eligible.length === 0) { toast.info("No eligible attendees for reminders (24h cooldown)"); return; }
    setBulkReminding(true);
    const allSentIds: string[] = [];
    for (const attendee of eligible) {
      try {
        const channelLabel = getInviteChannelLabel(attendee.invite) || inviteChannel;
        const channels = channelLabel === "both"
          ? ["email", "whatsapp"]
          : [channelLabel];
        const { data } = await supabase.functions.invoke("send-event-invitations", {
          body: {
            event_id: event.id,
            attendee_ids: [attendee.id],
            channels,
            base_url: window.location.origin,
            is_reminder: true,
          },
        });
        const res = data as SendResponse;
        const sentIds = getSuccessfullySentIds(res);
        if (sentIds.has(attendee.id)) allSentIds.push(attendee.id);
      } catch { /* continue */ }
    }
    if (allSentIds.length > 0) {
      await refreshInviteState(allSentIds);
    }
    toast.success(`${allSentIds.length}/${eligible.length} reminder(s) sent`);
    setBulkReminding(false);
  };

  // ── Reminder eligibility (derived from event_invites) ──
  const getReminderTooltip = (a: AttendeeRow): { title: string; disabled: boolean } => {
    if (!isInviteSent(a.invite)) return { title: "Send invitation first", disabled: true };
    if (a.confirmed) return { title: "Already confirmed", disabled: true };
    const lastSent = getLastSentTime(a.invite);
    if (lastSent) {
      const hours = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60);
      if (hours < 24) {
        const left = Math.ceil(24 - hours);
        return { title: `Reminder sent — available in ${left}h`, disabled: true };
      }
    }
    return { title: "Send reminder", disabled: false };
  };

  // ── Eligible reminder count ──
  const eligibleReminderCount = items.filter(a => {
    if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
    if (!isInviteSent(a.invite)) return false;
    const lastSent = getLastSentTime(a.invite);
    if (!lastSent) return true;
    return (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60) >= 24;
  }).length;

  // ── Filtering (derived from event_invites) ──
  const getFilteredItems = useCallback(() => {
    return items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-")) return true;
      switch (statusFilter) {
        case "confirmed": return a.confirmed;
        case "pending": return !a.confirmed;
        case "invited": return isInviteSent(a.invite);
        case "not_invited": return !isInviteSent(a.invite) && !a.confirmed;
        default: return true;
      }
    });
  }, [items, statusFilter]);

  // ── Stats (derived from event_invites) ──
  const realItems = items.filter(a => !a._isNew && !a.id.startsWith("temp-"));
  const stats = {
    total: realItems.length,
    confirmed: realItems.filter(a => a.confirmed).length,
    invited: realItems.filter(a => isInviteSent(a.invite) && !a.confirmed).length,
    pending: realItems.filter(a => !isInviteSent(a.invite) && !a.confirmed).length,
  };

  if (!event) return null;

  const filteredItems = getFilteredItems();

  return (
    <div className="space-y-4">
      {realItems.length === 0 && (
        <SectionHint
          sectionKey="attendees"
          title="Attendees"
          description="Add guests individually or import a CSV file. Attendees are required to send invitations and communications."
        />
      )}
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <div className="text-lg font-bold">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <div className="text-lg font-bold text-primary">{stats.confirmed}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Confirmed</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <div className="text-lg font-bold">{stats.invited}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Invited</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <div className="text-lg font-bold">{stats.pending}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Not Invited</div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display flex items-center gap-2">
            <Users2 className="h-5 w-5" /> Attendees
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="not_invited">Not Invited</SelectItem>
              </SelectContent>
            </Select>
            {!isArchived && (
              <>
                {/* Channel selector */}
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Via:</Label>
                  <ToggleGroup
                    type="single"
                    value={inviteChannel}
                    onValueChange={(v) => v && setInviteChannel(v as InviteChannel)}
                    className="h-8"
                  >
                    <ToggleGroupItem value="email" className="text-xs h-7 px-2 gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </ToggleGroupItem>
                    <ToggleGroupItem value="whatsapp" className="text-xs h-7 px-2 gap-1">
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </ToggleGroupItem>
                    <ToggleGroupItem value="both" className="text-xs h-7 px-2 gap-1">
                      Both
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Button size="sm" variant="default" className="gap-1 text-xs" disabled={bulkSending} onClick={sendAllInvitations}>
                  <ChannelIcon channel={inviteChannel} /> {bulkSending ? "Sending…" : "Send All Invitations"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={bulkReminding || eligibleReminderCount === 0} onClick={sendAllReminders}>
                  <Bell className="h-3.5 w-3.5" /> {bulkReminding ? "Sending…" : `Remind (${eligibleReminderCount})`}
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={downloadCsvTemplate}>
                  <FileDown className="h-3.5 w-3.5" /> Template
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => document.getElementById("csv-upload")?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Import CSV
                </Button>
                <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={e => { e.target.files?.[0] && handleCSV(e.target.files[0]); e.target.value = ""; }} />
              </>
            )}
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportAttendeesCsv(items, event.title)} disabled={realItems.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Import summary */}
          {importSummary && (importSummary.duplicates.length > 0 || importSummary.invalid.length > 0) && (
            <div className="mx-4 my-2 rounded-md border border-border bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Import Summary</span>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => setImportSummary(null)}>Dismiss</Button>
              </div>
              {importSummary.valid.length > 0 && <p className="text-primary">✓ {importSummary.valid.length} imported</p>}
              {importSummary.duplicates.length > 0 && <p className="text-muted-foreground">↳ {importSummary.duplicates.length} duplicate(s) skipped: {importSummary.duplicates.slice(0, 3).join(", ")}{importSummary.duplicates.length > 3 ? "…" : ""}</p>}
              {importSummary.invalid.length > 0 && (
                <div>
                  <p className="text-destructive">✗ {importSummary.invalid.length} invalid row(s):</p>
                  {importSummary.invalid.slice(0, 5).map((inv, i) => (
                    <p key={i} className="text-muted-foreground ml-2">Line {inv.line}: {inv.reason}</p>
                  ))}
                  {importSummary.invalid.length > 5 && <p className="text-muted-foreground ml-2">…and {importSummary.invalid.length - 5} more</p>}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[30px] text-center text-xs font-semibold">#</TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Email</TableHead>
                  <TableHead className="text-xs font-semibold">Mobile</TableHead>
                  <TableHead className="text-xs font-semibold w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((a, rowIndex) => {
                  const isTemp = a._isNew || a.id.startsWith("temp-");
                  const sent = isInviteSent(a.invite);
                  const reminderInfo = !isTemp ? getReminderTooltip(a) : { title: "", disabled: true };
                  return (
                    <TableRow key={a.id} className={cn("group transition-colors", isTemp && "bg-muted/20")}>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono tabular-nums p-1">
                        {isTemp ? "+" : rowIndex + 1}
                      </TableCell>
                      {FIELDS.map((field, colIndex) => {
                        const errKey = `${a.id}-${field}`;
                        const error = errors[errKey];
                        return (
                          <TableCell key={field} className="p-0">
                            <div className="relative">
                              <input
                                ref={el => { cellRefs.current[`${rowIndex}-${colIndex}`] = el; }}
                                className={cn(
                                  "w-full bg-transparent px-3 py-2 text-sm outline-none border-0",
                                  "focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 focus:ring-inset",
                                  "transition-colors",
                                  isArchived && "pointer-events-none opacity-60",
                                  field === "name" && "font-medium",
                                  error && "text-destructive bg-destructive/5"
                                )}
                                value={(a as any)[field] || ""}
                                onChange={e => handleChange(rowIndex, field, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                                disabled={isArchived}
                                placeholder={isTemp ? `Add ${field}…` : ""}
                                type={field === "email" ? "email" : "text"}
                                inputMode={field === "mobile" ? "tel" : undefined}
                              />
                              {error && (
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-destructive bg-background px-1 rounded">
                                  {error}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="p-1 text-center">
                        {!isTemp && (
                          <Badge
                            variant={a.confirmed ? "default" : sent ? "outline" : "secondary"}
                            className={cn("text-[10px]", a.confirmed && "bg-primary hover:bg-primary/90")}
                          >
                            {a.confirmed ? "Confirmed" : sent ? "Invited" : "Pending"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isArchived && !isTemp && !a.confirmed && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={sent ? "Resend Invitation" : "Send Invitation"} disabled={sendingId === a.id} onClick={() => sendInvitation(a)}>
                                <ChannelIcon channel={inviteChannel} />
                              </Button>
                              {sent && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={reminderInfo.title} disabled={sendingId === a.id || reminderInfo.disabled} onClick={() => sendReminder(a)}>
                                  <Bell className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                          {!isArchived && !isRowEmpty(a) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(a.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {!isArchived && (
            <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
              Tab / Enter to navigate • Changes auto-save after {DEBOUNCE_MS / 1000}s • Email must be valid format • Mobile accepts numbers only
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendeesSection;
