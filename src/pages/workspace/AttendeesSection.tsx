import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Upload, Mail, Bell, Users2, Download, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHint } from "@/components/ui/section-hint";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitGate } from "@/components/billing/PlanLimitGate";

interface Attendee {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  confirmed: boolean;
  invitation_sent: boolean;
  _isNew?: boolean;
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

// ── Email templates ──

const buildInvitationHtml = (eventTitle: string, rsvpUrl: string) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,hsl(145,63%,42%),hsl(210,70%,50%));padding:32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-family:'Space Grotesk',Arial,sans-serif;font-size:28px;">TitanMeet</h1>
</td></tr>
<tr><td style="padding:40px 32px;">
<h2 style="margin:0 0 16px;color:hsl(210,40%,10%);font-family:'Space Grotesk',Arial,sans-serif;font-size:22px;">You're Invited!</h2>
<p style="margin:0 0 24px;color:hsl(210,10%,45%);font-size:16px;line-height:1.6;">You have been invited to attend <strong style="color:hsl(210,40%,10%);">${eventTitle}</strong>. Please confirm your attendance by clicking the button below.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="background:hsl(145,63%,42%);border-radius:8px;">
<a href="${rsvpUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">Confirm Attendance</a>
</td></tr></table>
<p style="margin:24px 0 0;color:hsl(210,10%,45%);font-size:13px;">If the button doesn't work, copy this link:<br><a href="${rsvpUrl}" style="color:hsl(210,70%,50%);">${rsvpUrl}</a></p>
</td></tr>
<tr><td style="padding:24px 32px;background:hsl(210,20%,98%);text-align:center;">
<p style="margin:0;color:hsl(210,10%,45%);font-size:12px;">Powered by TitanMeet</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

const buildReminderHtml = (eventTitle: string, rsvpUrl: string) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,hsl(145,63%,42%),hsl(210,70%,50%));padding:32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-family:'Space Grotesk',Arial,sans-serif;font-size:28px;">TitanMeet</h1>
</td></tr>
<tr><td style="padding:40px 32px;">
<h2 style="margin:0 0 16px;color:hsl(210,40%,10%);font-family:'Space Grotesk',Arial,sans-serif;font-size:22px;">Reminder: Please Confirm</h2>
<p style="margin:0 0 24px;color:hsl(210,10%,45%);font-size:16px;line-height:1.6;">This is a friendly reminder to confirm your attendance for <strong style="color:hsl(210,40%,10%);">${eventTitle}</strong>. We'd love to have you there!</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="background:hsl(145,63%,42%);border-radius:8px;">
<a href="${rsvpUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">Confirm Attendance</a>
</td></tr></table>
<p style="margin:24px 0 0;color:hsl(210,10%,45%);font-size:13px;">If the button doesn't work, copy this link:<br><a href="${rsvpUrl}" style="color:hsl(210,70%,50%);">${rsvpUrl}</a></p>
</td></tr>
<tr><td style="padding:24px 32px;background:hsl(210,20%,98%);text-align:center;">
<p style="margin:0;color:hsl(210,10%,45%);font-size:12px;">Powered by TitanMeet</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

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

function exportAttendeesCsv(attendees: Attendee[], eventTitle: string) {
  const header = "name,email,mobile,invitation_sent,confirmed\n";
  const rows = attendees
    .filter(a => !a._isNew && !a.id.startsWith("temp-"))
    .map(a => {
      const escapeCsv = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      return `${escapeCsv(a.name)},${escapeCsv(a.email)},${escapeCsv(a.mobile || "")},${a.invitation_sent ? "Yes" : "No"},${a.confirmed ? "Yes" : "No"}`;
    })
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendees-${eventTitle?.replace(/\s+/g, "-").toLowerCase() || "export"}.csv`;
  a.click();
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

  // Detect header
  const firstLine = lines[0]?.toLowerCase().trim();
  const startIdx = (firstLine?.includes("name") && firstLine?.includes("email")) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const parts = raw.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
    const [name, email, mobile] = parts;
    const lineNum = i + 1;

    if (!name) {
      result.invalid.push({ line: lineNum, reason: "Missing name", raw });
      continue;
    }
    if (!email || !EMAIL_RE.test(email)) {
      result.invalid.push({ line: lineNum, reason: email ? "Invalid email format" : "Missing email", raw });
      continue;
    }
    const emailLower = email.toLowerCase();
    if (existingEmails.has(emailLower)) {
      result.duplicates.push(email);
      continue;
    }
    if (seenEmails.has(emailLower)) {
      result.duplicates.push(email);
      continue;
    }
    seenEmails.add(emailLower);
    result.valid.push({ name, email, mobile: mobile || null });
  }

  return result;
}

// ── Component ──

const AttendeesSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const planLimits = usePlanLimits();
  const [items, setItems] = useState<Attendee[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [importSummary, setImportSummary] = useState<CsvImportResult | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemsRef = useRef<Attendee[]>([]);
  const persistingRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("attendees").select("*").eq("event_id", event.id);
    const rows = (data as Attendee[]) || [];
    if (!isArchived) rows.push(createEmptyRow());
    setItems(rows);
  }, [event?.id, isArchived]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    load();
    return () => { Object.values(timersRef.current).forEach(clearTimeout); };
  }, [load]);

  function createEmptyRow(): Attendee {
    return { id: `temp-${Date.now()}-${Math.random()}`, name: "", email: "", mobile: null, confirmed: false, invitation_sent: false, _isNew: true };
  }

  const isRowEmpty = (a: Attendee) => !a.name && !a.email && !a.mobile;

  const persistRow = async (attendee: Attendee) => {
    if (!event) return null;
    const emailErr = validateField("email", attendee.email);
    if (emailErr && attendee.email) { toast.error("Fix email format before saving"); return null; }

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
    // rowIndex is relative to filtered list — map back to real items
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
              const next = prev.map((o) => (o.id === rowId ? { ...saved } : o));
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

  // ── CSV Import (hardened) ──
  const handleCSV = async (file: File) => {
    if (!event) return;
    const text = await file.text();
    const existingEmails = new Set(
      items.filter(a => !a._isNew && !a.id.startsWith("temp-")).map(a => a.email.toLowerCase())
    );
    const result = parseCsvFile(text, existingEmails);
    setImportSummary(result);

    if (result.valid.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    const rows = result.valid.map(r => ({ event_id: event.id, name: r.name, email: r.email, mobile: r.mobile }));
    const { error } = await supabase.from("attendees").insert(rows as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${result.valid.length} attendees imported${result.duplicates.length ? `, ${result.duplicates.length} duplicates skipped` : ""}${result.invalid.length ? `, ${result.invalid.length} invalid rows skipped` : ""}`);
      load();
    }
  };

  // ── Email helpers ──

  const sendRealEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); return false; }
    const res = await supabase.functions.invoke("send-email", { body: { to, subject, html } });
    if (res.error) { console.error("send-email error:", res.error); return false; }
    return true;
  };

  const sendInvitation = async (attendee: Attendee) => {
    if (!event || !attendee.email) { toast.error("Attendee needs an email"); return; }
    setSendingId(attendee.id);
    try {
      const { data: token, error: tokenErr } = await supabase
        .from("rsvp_tokens").insert({ event_id: event.id, attendee_id: attendee.id } as any).select("token").single();
      if (tokenErr) throw tokenErr;
      const rsvpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-rsvp?token=${token.token}`;
      const subject = `Invitation: ${event.title}`;
      const html = buildInvitationHtml(event.title, rsvpUrl);
      const sent = await sendRealEmail(attendee.email, subject, html);
      await supabase.from("communications_log").insert({ event_id: event.id, attendee_id: attendee.id, channel: "email", subject, message: `RSVP link: ${rsvpUrl}`, status: sent ? "sent" : "failed" } as any);
      if (sent) {
        await supabase.from("attendees").update({ invitation_sent: true } as any).eq("id", attendee.id);
        setItems(prev => prev.map(a => a.id === attendee.id ? { ...a, invitation_sent: true } : a));
        toast.success(`Invitation sent to ${attendee.name || attendee.email}`);
      } else toast.error("Email delivery failed — logged for retry");
    } catch (e: any) { toast.error(e.message || "Failed to send invitation"); }
    finally { setSendingId(null); }
  };

  const sendReminder = async (attendee: Attendee) => {
    if (!event || !attendee.email) { toast.error("Attendee needs an email"); return; }
    setSendingId(attendee.id);
    try {
      const { data: existing } = await supabase.from("rsvp_tokens").select("token").eq("event_id", event.id).eq("attendee_id", attendee.id).order("id", { ascending: false }).limit(1);
      let tokenVal: string;
      if (existing && existing.length > 0) { tokenVal = existing[0].token; }
      else {
        const { data: newToken, error } = await supabase.from("rsvp_tokens").insert({ event_id: event.id, attendee_id: attendee.id } as any).select("token").single();
        if (error) throw error;
        tokenVal = newToken.token;
      }
      const rsvpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-rsvp?token=${tokenVal}`;
      const subject = `Reminder: ${event.title}`;
      const html = buildReminderHtml(event.title, rsvpUrl);
      const sent = await sendRealEmail(attendee.email, subject, html);
      await supabase.from("communications_log").insert({ event_id: event.id, attendee_id: attendee.id, channel: "email", subject, message: `RSVP reminder link: ${rsvpUrl}`, status: sent ? "sent" : "failed" } as any);
      if (sent) toast.success(`Reminder sent to ${attendee.name || attendee.email}`);
      else toast.error("Email delivery failed — logged for retry");
    } catch (e: any) { toast.error(e.message || "Failed to send reminder"); }
    finally { setSendingId(null); }
  };

  const sendAllInvitations = async () => {
    if (!event) return;
    const targets = items.filter(a => !a._isNew && !a.id.startsWith("temp-") && !a.confirmed && !a.invitation_sent && a.email);
    if (targets.length === 0) { toast.info("No unconfirmed attendees to invite"); return; }
    setBulkSending(true);
    let sentCount = 0;
    for (const attendee of targets) {
      try {
        const { data: token, error: tokenErr } = await supabase
          .from("rsvp_tokens").insert({ event_id: event.id, attendee_id: attendee.id } as any).select("token").single();
        if (tokenErr) { console.error(tokenErr); continue; }
        const rsvpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-rsvp?token=${token.token}`;
        const subject = `Invitation: ${event.title}`;
        const html = buildInvitationHtml(event.title, rsvpUrl);
        const sent = await sendRealEmail(attendee.email, subject, html);
        await supabase.from("communications_log").insert({ event_id: event.id, attendee_id: attendee.id, channel: "email", subject, message: `RSVP link: ${rsvpUrl}`, status: sent ? "sent" : "failed" } as any);
        if (sent) {
          await supabase.from("attendees").update({ invitation_sent: true } as any).eq("id", attendee.id);
          setItems(prev => prev.map(a => a.id === attendee.id ? { ...a, invitation_sent: true } : a));
          sentCount++;
        }
      } catch (e: any) { console.error(`Failed for ${attendee.email}:`, e); }
    }
    toast.success(`${sentCount}/${targets.length} invitations sent`);
    setBulkSending(false);
  };

  // ── Filtering ──
  const getFilteredItems = useCallback(() => {
    return items.filter(a => {
      if (a._isNew || a.id.startsWith("temp-")) return true; // always show empty row
      switch (statusFilter) {
        case "confirmed": return a.confirmed;
        case "pending": return !a.confirmed;
        case "invited": return a.invitation_sent;
        case "not_invited": return !a.invitation_sent && !a.confirmed;
        default: return true;
      }
    });
  }, [items, statusFilter]);

  // ── Stats ──
  const realItems = items.filter(a => !a._isNew && !a.id.startsWith("temp-"));
  const stats = {
    total: realItems.length,
    confirmed: realItems.filter(a => a.confirmed).length,
    invited: realItems.filter(a => a.invitation_sent && !a.confirmed).length,
    pending: realItems.filter(a => !a.invitation_sent && !a.confirmed).length,
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
                <Button size="sm" variant="default" className="gap-1 text-xs" disabled={bulkSending} onClick={sendAllInvitations}>
                  <Mail className="h-3.5 w-3.5" /> {bulkSending ? "Sending…" : "Send All Invitations"}
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
                            variant={a.confirmed ? "default" : a.invitation_sent ? "outline" : "secondary"} 
                            className={cn("text-[10px]", a.confirmed && "bg-primary hover:bg-primary/90")}
                          >
                            {a.confirmed ? "Confirmed" : a.invitation_sent ? "Invited" : "Pending"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isArchived && !isTemp && !a.confirmed && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={a.invitation_sent ? "Resend Invitation" : "Send Invitation"} disabled={sendingId === a.id} onClick={() => sendInvitation(a)}>
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                              {a.invitation_sent && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Send Reminder" disabled={sendingId === a.id} onClick={() => sendReminder(a)}>
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
