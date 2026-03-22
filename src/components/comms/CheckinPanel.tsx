import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { sendCheckinWhatsApp } from "@/lib/whatsapp-api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Send, Loader2, CheckCircle2, Users2 } from "lucide-react";

interface CheckinAttendee {
  id: string;
  name: string;
  mobile: string | null;
  confirmed: boolean;
  checked_in_at: string | null;
  checked_in_via: string | null;
}

export function CheckinPanel() {
  const { event } = useEventWorkspace();
  const [attendees, setAttendees] = useState<CheckinAttendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendees")
        .select("id, name, mobile, confirmed, checked_in_at, checked_in_via")
        .eq("event_id", event.id)
        .eq("confirmed", true)
        .order("name");
      if (error) throw error;
      setAttendees((data as any[]) || []);
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load attendees", err);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  const handleSendAll = async () => {
    if (!event) return;
    setSending(true);
    try {
      const unchecked = attendees.filter((a) => !a.checked_in_at && a.mobile);
      if (unchecked.length === 0) {
        toast.info("No unchecked attendees with phone numbers");
        return;
      }
      const result = await sendCheckinWhatsApp(event.id, unchecked.map((a) => a.id));
      toast.success(`Check-in messages: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);
      load();
    } catch (err: any) {
      toast.error("Failed to send check-in: " + (err.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  if (!event) return null;

  const checkedIn = attendees.filter((a) => a.checked_in_at);
  const notCheckedIn = attendees.filter((a) => !a.checked_in_at);

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Check-in
        </h2>
        {!loaded && (
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Attendees"}
          </Button>
        )}
      </div>

      {loaded && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 text-center">
              <p className="text-xl font-bold">{attendees.length}</p>
              <p className="text-[10px] text-muted-foreground">Confirmed</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-bold text-emerald-500">{checkedIn.length}</p>
              <p className="text-[10px] text-muted-foreground">Checked In</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-bold text-muted-foreground">{notCheckedIn.length}</p>
              <p className="text-[10px] text-muted-foreground">Awaiting</p>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSendAll}
              disabled={sending || notCheckedIn.length === 0}
              className="gap-1 flex-1"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Check-in via WhatsApp ({notCheckedIn.filter((a) => a.mobile).length})
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>

          {/* Attendee list */}
          <div className="space-y-1">
            {attendees.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm"
              >
                {a.checked_in_at ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Users2 className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 truncate">{a.name}</span>
                {a.checked_in_at && (
                  <Badge variant="default" className="text-[10px] h-5 bg-emerald-500">
                    {a.checked_in_via === "whatsapp_reply" ? "WA Reply" : "Checked In"}
                  </Badge>
                )}
                {!a.checked_in_at && !a.mobile && (
                  <Badge variant="outline" className="text-[10px] h-5">No phone</Badge>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!loaded && !loading && (
        <div className="text-center text-muted-foreground py-8">
          <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Event day check-in via WhatsApp</p>
          <p className="text-xs mt-1">Load attendees to see confirmed guests and send check-in messages.</p>
        </div>
      )}
    </div>
  );
}
