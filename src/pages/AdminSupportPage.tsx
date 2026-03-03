import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  pending_admin: { label: "Awaiting Customer", variant: "outline" },
  pending_support: { label: "Awaiting Support", variant: "secondary" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "destructive" },
};

const PRIORITY_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "destructive" },
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing", payment: "Payment", event_setup: "Event Setup",
  invitations_rsvp: "Invitations / RSVP", public_page: "Public Page",
  technical_bug: "Bug", other: "Other",
};

interface AdminTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const AdminSupportPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadTickets = async () => {
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (filterStatus !== "all") query = query.eq("status", filterStatus as any);
    if (filterPriority !== "all") query = query.eq("priority", filterPriority as any);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load tickets");
    } else {
      setTickets((data as AdminTicket[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [filterStatus, filterPriority]);

  const filteredTickets = tickets.filter(t =>
    !searchQuery || t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCount = tickets.filter(t => t.status === "open" || t.status === "pending_support").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Support Management</h1>
          </div>
          <p className="text-muted-foreground">
            {openCount} ticket{openCount !== 1 ? "s" : ""} need attention
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="pending_admin">Awaiting Customer</SelectItem>
            <SelectItem value="pending_support">Awaiting Support</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No tickets found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map(ticket => {
            const statusInfo = STATUS_BADGE[ticket.status] || STATUS_BADGE.open;
            const priorityInfo = PRIORITY_BADGE[ticket.priority] || PRIORITY_BADGE.medium;
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(`/dashboard/support/${ticket.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      <span>·</span>
                      <span>User: {ticket.user_id.slice(0, 8)}…</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(ticket.updated_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSupportPage;
