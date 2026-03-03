import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  pending_admin: { label: "Awaiting You", variant: "outline" },
  pending_support: { label: "Awaiting Support", variant: "secondary" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "destructive" },
};

const PRIORITY_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "destructive" },
};

const CATEGORIES = [
  { value: "billing", label: "Billing" },
  { value: "payment", label: "Payment" },
  { value: "event_setup", label: "Event Setup" },
  { value: "invitations_rsvp", label: "Invitations / RSVP" },
  { value: "public_page", label: "Public Page Issue" },
  { value: "technical_bug", label: "Technical Bug" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const SupportPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as any);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load tickets");
    } else {
      setTickets((data as Ticket[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [user, filterStatus]);

  const handleCreate = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setCreating(true);
    const { data: ticket, error: ticketErr } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        category,
        priority,
        status: "open",
      } as any)
      .select("id")
      .single();

    if (ticketErr || !ticket) {
      toast.error("Failed to create ticket");
      setCreating(false);
      return;
    }

    await supabase.from("support_ticket_messages").insert({
      ticket_id: (ticket as any).id,
      user_id: user.id,
      author_role: "user",
      message: message.trim(),
    } as any);

    toast.success("Ticket created successfully");
    setCreateOpen(false);
    setSubject("");
    setCategory("other");
    setPriority("medium");
    setMessage("");
    setCreating(false);
    loadTickets();
  };

  const filteredTickets = tickets.filter(t =>
    !searchQuery || t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
          <p className="text-muted-foreground">Create and manage your support tickets</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Brief summary of your issue"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  maxLength={5000}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Creating..." : "Submit Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
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
            <SelectItem value="pending_admin">Awaiting Me</SelectItem>
            <SelectItem value="pending_support">Awaiting Support</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No tickets found. Create one to get started.</p>
          </CardContent>
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
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">{ticket.subject}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(ticket.created_at), "MMM d, yyyy")}</span>
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

export default SupportPage;
