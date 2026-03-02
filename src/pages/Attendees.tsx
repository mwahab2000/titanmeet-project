import { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const Attendees = () => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("event_attendees")
        .select("*, events(title)")
        .order("registered_at", { ascending: false });
      setAttendees(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Attendees</h1>
        <p className="text-muted-foreground">View and manage event registrations</p>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search attendees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : attendees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">No attendees yet</p>
              <p className="text-sm text-muted-foreground">Attendees will appear here once they register</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{(a.events as any)?.title || "Unknown"}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.status === 'confirmed' ? 'bg-accent text-accent-foreground' :
                        a.status === 'checked_in' ? 'bg-primary/10 text-primary' :
                        a.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell>{a.ticket_number || "—"}</TableCell>
                    <TableCell>{format(new Date(a.registered_at), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Attendees;
