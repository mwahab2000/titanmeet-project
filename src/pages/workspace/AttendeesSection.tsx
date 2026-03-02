import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Upload, Mail, Bell, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

// ── Email templates (kept from original) ──

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

// ── Component ──

const AttendeesSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<Attendee[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
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
    // Validate before persisting
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
    if (err) return; // Don't save invalid values
    await supabase.from("attendees").update({ [field]: value || null } as any).eq("id", id);
  };

  const handleChange = (rowIndex: number, field: Field, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });

    // Validate and set/clear error
    const errKey = `${items[rowIndex].id}-${field}`;
    const err = validateField(field, value);
    setErrors(prev => {
      const next = { ...prev };
      if (err) next[errKey] = err; else delete next[errKey];
      return next;
    });

    const item = items[rowIndex];
    if (!item) return;
    const rowId = item.id;
    const timerKey = `${rowId}-${field}`;
    if (timersRef.current[timerKey]) clearTimeout(timersRef.current[timerKey]);

    timersRef.current[timerKey] = setTimeout(async () => {
      const liveRowIndex = itemsRef.current.findIndex((r) => r.id === rowId);
      if (liveRowIndex < 0) return;
      const current = itemsRef.current[liveRowIndex];
      if (!current) return;

      if (current._isNew || current.id.startsWith("temp-")) {
        // Guard: only one INSERT in-flight per temp row id
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
    const totalRows = items.length;
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

  const remove = async (id: string, rowIndex: number) => {
    if (id.startsWith("temp-")) {
      setItems(prev => prev.filter((_, i) => i !== rowIndex));
      return;
    }
    await supabase.from("attendees").delete().eq("id", id);
    setItems(prev => {
      const next = prev.filter((_, i) => i !== rowIndex);
      const last = next[next.length - 1];
      if (!last?._isNew && !last?.id.startsWith("temp-")) next.push(createEmptyRow());
      return next;
    });
  };

  const handleCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").slice(1).filter(l => l.trim());
    const rows = lines.map(l => {
      const [name, email, mobile] = l.split(",").map(s => s.trim());
      return { event_id: event!.id, name: name || "", email: email || "", mobile: mobile || null };
    });
    if (rows.length) {
      const { error } = await supabase.from("attendees").insert(rows as any);
      if (error) toast.error(error.message);
      else { toast.success(`${rows.length} attendees imported`); load(); }
    }
  };

  // ── Email helpers (unchanged) ──

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

  if (!event) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display flex items-center gap-2">
          <Users2 className="h-5 w-5" /> Attendees
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {items.filter(a => !a._isNew && !a.id.startsWith("temp-")).length} attendee(s)
          </span>
          {!isArchived && (
            <>
              <Button size="sm" variant="default" className="gap-1 text-xs" disabled={bulkSending} onClick={sendAllInvitations}>
                <Mail className="h-3.5 w-3.5" /> {bulkSending ? "Sending…" : "Send All Invitations"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => document.getElementById("csv-upload")?.click()}>
                <Upload className="h-3.5 w-3.5" /> CSV
              </Button>
              <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
              {items.map((a, rowIndex) => {
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
                          {a.confirmed ? "Confirmed" : a.invitation_sent ? "Email Sent" : "Pending"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isArchived && !isTemp && !a.confirmed && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Send Invitation" disabled={sendingId === a.id} onClick={() => sendInvitation(a)}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Send Reminder" disabled={sendingId === a.id} onClick={() => sendReminder(a)}>
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {!isArchived && !isRowEmpty(a) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(a.id, rowIndex)}>
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
  );
};

export default AttendeesSection;
