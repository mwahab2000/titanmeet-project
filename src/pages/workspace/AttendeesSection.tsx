import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Trash2, Upload, Mail, Bell, Users2, Download, FileDown,
  MessageSquare, AlertCircle, CheckCircle2, RotateCcw, X, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHint } from "@/components/ui/section-hint";
import { usePlanLimits } from "@/hooks/usePlanLimits";
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
  /** Transient: last send result per attendee */
  _lastResult?: AttendeeResultFromApi;
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

type StatusFilter = "all" | "confirmed" | "pending" | "invited" | "not_invited" | "failed";
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
}

/** Return IDs of attendees who had at least one channel successfully sent */
function getSuccessfullySentIds(res: SendResponse): Set<string> {
  const ids = new Set<string>();
  for (const r of res.results || []) {
    if (r.email_status === "sent" || r.whatsapp_status === "sent") {
      ids.add(r.attendee_id);
    }
  }
  return ids;
}

/** Return IDs of attendees with at least one failed channel */
function getFailedIds(res: SendResponse): Set<string> {
  const ids = new Set<string>();
  for (const r of res.results || []) {
    if (r.email_status === "failed" || r.whatsapp_status === "failed" ||
        r.email_status === "invalid_phone" || r.whatsapp_status === "invalid_phone") {
      ids.add(r.attendee_id);
    }
  }
  return ids;
}

/** Build a result map from the API response */
function buildResultMap(res: SendResponse): Map<string, AttendeeResultFromApi> {
  const results = res.results || res.attendee_results || [];
  return new Map(results.map(r => [r.attendee_id, r]));
}

// ── Send summary panel ──
interface SendSummary {
  total: number;
  sent_email: number;
  sent_whatsapp: number;
  failed_email: number;
  failed_whatsapp: number;
  skipped_no_email: number;
  skipped_no_phone: number;
  skipped_config: number;
  config_warnings: string[];
  failedIds: string[];
}

function buildSendSummary(res: SendResponse): SendSummary {
  const config_warnings: string[] = [];
  if (res.email_not_configured) config_warnings.push("Email not configured — set GMAIL_USER & GMAIL_APP_PASSWORD");
  if (res.email_auth_failed) config_warnings.push("SMTP auth failed — use a Google App Password with 2FA enabled");
  if (res.smtp_connection_failed) config_warnings.push("SMTP connection failed — check network & secrets");
  if (res.whatsapp_not_configured) config_warnings.push("WhatsApp not configured — set Twilio secrets");

  return {
    total: res.total || 0,
    sent_email: res.sent_email || 0,
    sent_whatsapp: res.sent_whatsapp || 0,
    failed_email: res.failed_email || 0,
    failed_whatsapp: res.failed_whatsapp || 0,
    skipped_no_email: res.skipped_no_email || 0,
    skipped_no_phone: res.skipped_no_phone || 0,
    skipped_config: res.skipped_email_not_configured || 0,
    config_warnings,
    failedIds: Array.from(getFailedIds(res)),
  };
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

// ── Failure reason helper ──
function getFailureReason(r?: AttendeeResultFromApi): string | null {
  if (!r) return null;
  const reasons: string[] = [];
  if (r.email_status === "failed" && r.email_error) reasons.push(`Email: ${r.email_error}`);
  if (r.whatsapp_status === "failed" && r.whatsapp_error) reasons.push(`WA: ${r.whatsapp_error}`);
  if (r.whatsapp_status === "invalid_phone" && r.whatsapp_error) reasons.push(`WA: ${r.whatsapp_error}`);
  if (r.email_status === "skipped_not_configured") reasons.push("Email not configured");
  if (r.whatsapp_status === "skipped_not_configured") reasons.push("WA not configured");
  return reasons.length > 0 ? reasons.join(" · ") : null;
}

function hasFailure(r?: AttendeeResultFromApi): boolean {
  if (!r) return false;
  return r.email_status === "failed" || r.whatsapp_status === "failed" ||
         r.whatsapp_status === "invalid_phone";
}

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
  const [retryingSending, setRetryingSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [importSummary, setImportSummary] = useState<CsvImportResult | null>(null);
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("email");
  const [sendSummary, setSendSummary] = useState<SendSummary | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemsRef = useRef<AttendeeRow[]>([]);
  const persistingRef = useRef<Set<string>>(new Set());

  // ── Load attendees + event_invites and merge ──
  const load = useCallback(async () => {
    if (!event) return;

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

  /** Process a send response: update per-attendee results, refresh invite state, show summary banner */
  const processSendResponse = async (res: SendResponse) => {
    console.log("[Send Summary]", JSON.stringify(res, null, 2));

    // Build per-attendee result map and attach to rows
    const resultMap = buildResultMap(res);
    setItems(prev => prev.map(a => {
      const r = resultMap.get(a.id);
      return r ? { ...a, _lastResult: r } : a;
    }));

    // Show summary banner
    setSendSummary(buildSendSummary(res));

    // Refresh invite state for successfully sent attendees
    const sentIds = getSuccessfullySentIds(res);
    if (sentIds.size > 0) {
      await refreshInviteState(Array.from(sentIds));
    }
  };

  /** After a successful send, reload invite state from event_invites */
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
      const { data, error } = await supabase.functions.invoke("send-event-invitations", {
        body: {
          event_id: event.id,
          attendee_ids: [attendee.id],
          channels: getChannels(),
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      await processSendResponse((data || {}) as SendResponse);
    } catch (e: any) { toast.error(e.message || "Failed to send invitation"); }
    finally { setSendingId(null); }
  };

  const sendReminder = async (attendee: AttendeeRow) => {
    if (!event) return;
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
      const channelLabel = getInviteChannelLabel(attendee.invite) || inviteChannel;
      const channels = channelLabel === "both" ? ["email", "whatsapp"] : [channelLabel];
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
      await processSendResponse((data || {}) as SendResponse);
    } catch (e: any) { toast.error(e.message || "Failed to send reminder"); }
    finally { setSendingId(null); }
  };

  const sendAllInvitations = async () => {
    if (!event) return;
    const channels = getChannels();
    const targets = items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
      if (isInviteSent(a.invite)) return false;
      const hasEmail = !!a.email;
      const hasMobile = !!a.mobile;
      if (channels.includes("email") && channels.includes("whatsapp")) return hasEmail || hasMobile;
      if (channels.includes("whatsapp")) return hasMobile;
      return hasEmail;
    });
    if (targets.length === 0) { toast.info("No eligible attendees to invite via the selected channel(s)"); return; }
    setBulkSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-invitations", {
        body: {
          event_id: event.id,
          attendee_ids: targets.map(a => a.id),
          channels,
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      await processSendResponse((data || {}) as SendResponse);
    } catch (e: any) { toast.error(e.message || "Failed to send invitations"); }
    setBulkSending(false);
  };

  /** Retry only attendees that failed in the last send */
  const retryFailed = async () => {
    if (!event || !sendSummary || sendSummary.failedIds.length === 0) return;
    setRetryingSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-invitations", {
        body: {
          event_id: event.id,
          attendee_ids: sendSummary.failedIds,
          channels: getChannels(),
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      await processSendResponse((data || {}) as SendResponse);
    } catch (e: any) { toast.error(e.message || "Failed to retry"); }
    setRetryingSending(false);
  };

  const sendAllReminders = async () => {
    if (!event) return;
    const now = Date.now();
    const eligible = items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
      if (!isInviteSent(a.invite)) return false;
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
        const channels = channelLabel === "both" ? ["email", "whatsapp"] : [channelLabel];
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

  // ── Reminder eligibility ──
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

  const eligibleReminderCount = items.filter(a => {
    if (a._isNew || a.id.startsWith("temp-") || a.confirmed) return false;
    if (!isInviteSent(a.invite)) return false;
    const lastSent = getLastSentTime(a.invite);
    if (!lastSent) return true;
    return (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60) >= 24;
  }).length;

  // ── Filtering ──
  const getFilteredItems = useCallback(() => {
    return items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-")) return true;
      switch (statusFilter) {
        case "confirmed": return a.confirmed;
        case "pending": return !a.confirmed;
        case "invited": return isInviteSent(a.invite);
        case "not_invited": return !isInviteSent(a.invite) && !a.confirmed;
        case "failed": return hasFailure(a._lastResult);
        default: return true;
      }
    });
  }, [items, statusFilter]);

  // ── Stats ──
  const realItems = items.filter(a => !a._isNew && !a.id.startsWith("temp-"));
  const failedCount = realItems.filter(a => hasFailure(a._lastResult)).length;
  const stats = {
    total: realItems.length,
    confirmed: realItems.filter(a => a.confirmed).length,
    invited: realItems.filter(a => isInviteSent(a.invite) && !a.confirmed).length,
    pending: realItems.filter(a => !isInviteSent(a.invite) && !a.confirmed).length,
  };

  if (!event) return null;

  const filteredItems = getFilteredItems();

  return (
    <TooltipProvider delayDuration={300}>
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
          {failedCount > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-center">
              <div className="text-lg font-bold text-destructive">{failedCount}</div>
              <div className="text-[10px] text-destructive/70 uppercase tracking-wider">Failed</div>
            </div>
          )}
        </div>

        {/* ── Send Summary Banner ── */}
        {sendSummary && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {sendSummary.failed_email + sendSummary.failed_whatsapp > 0
                  ? <AlertCircle className="h-4 w-4 text-destructive" />
                  : <CheckCircle2 className="h-4 w-4 text-primary" />
                }
                Send Results
              </h3>
              <div className="flex items-center gap-2">
                {sendSummary.failedIds.length > 0 && !isArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={retryingSending}
                    onClick={retryFailed}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {retryingSending ? "Retrying…" : `Retry ${sendSummary.failedIds.length} Failed`}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                  setSendSummary(null);
                  // Clear per-attendee results
                  setItems(prev => prev.map(a => ({ ...a, _lastResult: undefined })));
                }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <SummaryCell label="Targeted" value={sendSummary.total} />
              <SummaryCell label="Email Sent" value={sendSummary.sent_email} variant="success" />
              <SummaryCell label="WA Sent" value={sendSummary.sent_whatsapp} variant="success" />
              <SummaryCell label="Email Failed" value={sendSummary.failed_email} variant="error" />
              <SummaryCell label="WA Failed" value={sendSummary.failed_whatsapp} variant="error" />
              <SummaryCell label="No Email" value={sendSummary.skipped_no_email} variant="muted" />
              <SummaryCell label="No Phone" value={sendSummary.skipped_no_phone} variant="muted" />
            </div>

            {sendSummary.skipped_config > 0 && (
              <div className="text-xs text-muted-foreground">
                {sendSummary.skipped_config} skipped (channel not configured)
              </div>
            )}

            {/* Config warnings */}
            {sendSummary.config_warnings.length > 0 && (
              <div className="space-y-1">
                {sendSummary.config_warnings.map((w, i) => (
                  <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

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
                  {failedCount > 0 && <SelectItem value="failed">Failed ({failedCount})</SelectItem>}
                </SelectContent>
              </Select>
              {!isArchived && (
                <>
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
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((a, rowIndex) => {
                    const isTemp = a._isNew || a.id.startsWith("temp-");
                    const sent = isInviteSent(a.invite);
                    const reminderInfo = !isTemp ? getReminderTooltip(a) : { title: "", disabled: true };
                    const failureReason = getFailureReason(a._lastResult);
                    const isFailed = hasFailure(a._lastResult);
                    return (
                      <React.Fragment key={a.id}>
                        <TableRow className={cn(
                          "group transition-colors",
                          isTemp && "bg-muted/20",
                          isFailed && "bg-destructive/5"
                        )}>
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
                              <div className="flex items-center justify-center gap-1">
                                <Badge
                                  variant={a.confirmed ? "default" : sent ? "outline" : "secondary"}
                                  className={cn("text-[10px]", a.confirmed && "bg-primary hover:bg-primary/90")}
                                >
                                  {a.confirmed ? "Confirmed" : sent ? "Invited" : "Pending"}
                                </Badge>
                                {isFailed && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertCircle className="h-3.5 w-3.5 text-destructive cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[280px] text-xs">
                                      {failureReason}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="p-1">
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!isArchived && !isTemp && !a.confirmed && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={sendingId === a.id} onClick={() => sendInvitation(a)}>
                                        <Send className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {sent ? "Resend invitation" : "Send invitation"}
                                    </TooltipContent>
                                  </Tooltip>
                                  {sent && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={sendingId === a.id || reminderInfo.disabled} onClick={() => sendReminder(a)}>
                                          <Bell className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">{reminderInfo.title}</TooltipContent>
                                    </Tooltip>
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
                        {/* Inline failure detail row */}
                        {isFailed && failureReason && (
                          <TableRow className="bg-destructive/5 border-0">
                            <TableCell />
                            <TableCell colSpan={5} className="py-1 px-3">
                              <p className="text-[11px] text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {failureReason}
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
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
    </TooltipProvider>
  );
};

// ── Summary metric cell ──
function SummaryCell({ label, value, variant }: { label: string; value: number; variant?: "success" | "error" | "muted" }) {
  if (value === 0 && variant !== undefined) return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-center">
      <div className="text-sm font-semibold text-muted-foreground">0</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
  return (
    <div className={cn(
      "rounded-md border px-3 py-1.5 text-center",
      variant === "success" && value > 0 && "border-primary/30 bg-primary/5",
      variant === "error" && value > 0 && "border-destructive/30 bg-destructive/5",
      variant === "muted" && "border-border bg-muted/30",
      !variant && "border-border bg-card",
    )}>
      <div className={cn(
        "text-sm font-semibold",
        variant === "success" && value > 0 && "text-primary",
        variant === "error" && value > 0 && "text-destructive",
        variant === "muted" && "text-muted-foreground",
      )}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default AttendeesSection;
