import { useEffect, useState, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  channel: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
  recipient_info: string | null;
}

export function CommsLogView() {
  const { event } = useEventWorkspace();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    const { data } = await supabase
      .from("communications_log")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(l => (
            <TableRow key={l.id}>
              <TableCell className="text-xs">{format(new Date(l.created_at), "PPp")}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{l.channel}</Badge></TableCell>
              <TableCell className="text-xs">{l.recipient_info || "—"}</TableCell>
              <TableCell className="text-sm">{l.subject || "—"}</TableCell>
              <TableCell>
                <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                  {l.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No communications yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
