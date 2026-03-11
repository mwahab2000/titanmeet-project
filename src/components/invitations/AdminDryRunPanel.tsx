import { useState } from "react";
import { sendEventInvitations, type SendChannel, type EventInvite } from "@/lib/event-invite-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  FlaskConical, Send, Loader2, Mail, MessageSquare, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventId: string;
  invites: EventInvite[];
  isArchived: boolean;
}

interface DryRunResult {
  correlationId?: string;
  dry_run?: boolean;
  total: number;
  email_not_configured: boolean;
  whatsapp_not_configured: boolean;
  email_auth_failed: boolean;
  smtp_connection_failed: boolean;
  results?: Array<{
    attendee_id: string;
    name: string;
    email: string | null;
    mobile: string | null;
    email_status: string;
    whatsapp_status: string;
    email_error: string | null;
    whatsapp_error: string | null;
    invite_id: string | null;
  }>;
}

const statusIcon = (status: string) => {
  if (status.includes("would_send")) return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  if (status.includes("would_skip") || status === "not_requested") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  if (status.includes("would_fail") || status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "sent") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  return <span className="h-3.5 w-3.5" />;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    would_send: "Ready",
    would_skip: "Would skip",
    would_fail: "Would fail",
    not_requested: "N/A",
    sent: "Sent ✓",
    failed: "Failed",
    skipped_not_configured: "Not configured",
    skipped_no_email: "No email",
    skipped_no_phone: "No phone",
    invalid_phone: "Invalid phone",
  };
  return map[status] || status;
};

export default function AdminDryRunPanel({ eventId, invites, isArchived }: Props) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>("");
  const [channels, setChannels] = useState<SendChannel[]>(["email"]);
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);

  const toggleChannel = (ch: SendChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const selectedInvite = invites.find((i) => i.attendee_id === selectedAttendeeId);

  const handleDryRun = async () => {
    if (!selectedAttendeeId || channels.length === 0) {
      toast.error("Select an attendee and at least one channel");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await sendEventInvitations(eventId, channels, [selectedAttendeeId], { dry_run: true });
      setResult(res as DryRunResult);
      toast.success("Dry run complete — see results below");
    } catch {
      toast.error("Dry run failed");
    }
    setRunning(false);
  };

  const handleTestSend = async () => {
    if (!selectedAttendeeId || channels.length === 0) {
      toast.error("Select an attendee and at least one channel");
      return;
    }
    setSending(true);
    try {
      const res = await sendEventInvitations(eventId, channels, [selectedAttendeeId]);
      setResult(res as DryRunResult);
      const parts: string[] = [];
      if (res.sent_email > 0) parts.push(`${res.sent_email} email`);
      if (res.sent_whatsapp > 0) parts.push(`${res.sent_whatsapp} WhatsApp`);
      if (res.failed_email > 0) parts.push(`${res.failed_email} email failed`);
      if (res.failed_whatsapp > 0) parts.push(`${res.failed_whatsapp} WA failed`);
      toast.success(`Test send: ${parts.join(", ") || "nothing sent"}`);
    } catch {
      toast.error("Test send failed");
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Admin Debug Mode
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Validate delivery configuration without sending, or test-send to a single attendee.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Attendee selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target Attendee</label>
            <Select value={selectedAttendeeId} onValueChange={setSelectedAttendeeId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select an attendee…" />
              </SelectTrigger>
              <SelectContent>
                {invites.map((inv) => (
                  <SelectItem key={inv.attendee_id} value={inv.attendee_id}>
                    {inv.attendee_name} — {inv.attendee_email || "no email"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel toggles */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={channels.includes("email")}
                onCheckedChange={() => toggleChannel("email")}
              />
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={channels.includes("whatsapp")}
                onCheckedChange={() => toggleChannel("whatsapp")}
              />
              <MessageSquare className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium">WhatsApp</span>
            </label>
          </div>

          {/* Selected attendee info */}
          {selectedInvite && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-0.5">
              <p><strong>Name:</strong> {selectedInvite.attendee_name}</p>
              <p><strong>Email:</strong> {selectedInvite.attendee_email || "—"}</p>
              <p><strong>Phone:</strong> {selectedInvite.attendee_mobile || "—"}</p>
              <p><strong>Invite status:</strong> {selectedInvite.status}</p>
              <p><strong>Token:</strong> {selectedInvite.token?.slice(0, 12)}…</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleDryRun}
              disabled={running || !selectedAttendeeId || channels.length === 0}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Dry Run (Validate)
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleTestSend}
              disabled={sending || !selectedAttendeeId || channels.length === 0 || isArchived}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Test Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results panel */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {result.dry_run ? (
                <Badge variant="outline" className="text-[10px]">DRY RUN</Badge>
              ) : (
                <Badge variant="default" className="text-[10px]">LIVE</Badge>
              )}
              Debug Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Config flags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <ConfigFlag label="Email config" ok={!result.email_not_configured} />
              <ConfigFlag label="WhatsApp config" ok={!result.whatsapp_not_configured} />
              <ConfigFlag label="SMTP auth" ok={!result.email_auth_failed} />
              <ConfigFlag label="SMTP connection" ok={!result.smtp_connection_failed} />
            </div>

            {result.correlationId && (
              <p className="text-[10px] text-muted-foreground font-mono">
                correlationId: {result.correlationId}
              </p>
            )}

            {/* Per-attendee results */}
            {result.results && result.results.length > 0 && (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attendee</TableHead>
                      <TableHead className="text-center">Email</TableHead>
                      <TableHead className="text-center">WhatsApp</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((r) => (
                      <TableRow key={r.attendee_id}>
                        <TableCell className="text-sm font-medium">{r.name}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {statusIcon(r.email_status)}
                            <span className="text-xs">{statusLabel(r.email_status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {statusIcon(r.whatsapp_status)}
                            <span className="text-xs">{statusLabel(r.whatsapp_status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {r.email_error || r.whatsapp_error || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
      {ok ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <XCircle className="h-3 w-3 text-destructive" />
      )}
      <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    </div>
  );
}
