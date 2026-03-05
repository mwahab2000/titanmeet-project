import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  pending_admin: { label: "Awaiting You", variant: "outline" },
  pending_support: { label: "Awaiting Support", variant: "secondary" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "destructive" },
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing", payment: "Payment", event_setup: "Event Setup",
  invitations_rsvp: "Invitations / RSVP", public_page: "Public Page Issue",
  technical_bug: "Technical Bug", other: "Other",
};

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Message {
  id: string;
  user_id: string;
  author_role: string;
  message: string;
  created_at: string;
}

const SupportTicketDetail = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    if (!ticketId) return;
    const { data: t } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    setTicket(t as Ticket | null);

    const { data: msgs } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((msgs as Message[]) || []);
  };

  useEffect(() => {
    load();
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReply = async () => {
    if (!user || !ticket || !reply.trim()) return;
    setSending(true);

    const authorRole = isAdmin ? "admin" : "user";
    await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      user_id: user.id,
      author_role: authorRole,
      message: reply.trim(),
    } as any);

    // Update ticket status
    const newStatus = isAdmin ? "pending_admin" : "pending_support";
    await supabase
      .from("support_tickets")
      .update({ status: newStatus } as any)
      .eq("id", ticket.id);

    setReply("");
    setSending(false);
    load();
    toast.success("Reply sent");
  };

  const handleResolve = async () => {
    if (!ticket) return;
    if (isAdmin) {
      // Use server-side RPC for admin actions
      const { error } = await supabase.rpc("admin_update_ticket_status", {
        _ticket_id: ticket.id,
        _new_status: "resolved",
        _resolved_at: new Date().toISOString(),
      });
      if (error) { toast.error("Failed: " + error.message); return; }
    } else {
      await supabase
        .from("support_tickets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() } as any)
        .eq("id", ticket.id);
    }
    toast.success("Ticket resolved");
    load();
  };

  const handleReopen = async () => {
    if (!ticket) return;
    if (isAdmin) {
      const { error } = await supabase.rpc("admin_update_ticket_status", {
        _ticket_id: ticket.id,
        _new_status: "open",
      });
      if (error) { toast.error("Failed: " + error.message); return; }
    } else {
      await supabase
        .from("support_tickets")
        .update({ status: "open", resolved_at: null } as any)
        .eq("id", ticket.id);
    }
    toast.success("Ticket reopened");
    load();
  };

  if (!ticket) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  const statusInfo = STATUS_BADGE[ticket.status] || STATUS_BADGE.open;
  const isResolved = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{ticket.subject}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
            <span>·</span>
            <span>Created {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {!isResolved && (
            <Button variant="outline" size="sm" onClick={handleResolve} className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
            </Button>
          )}
          {isResolved && (
            <Button variant="outline" size="sm" onClick={handleReopen} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {messages.map(msg => {
          const isMe = msg.user_id === user?.id;
          const roleLabel = msg.author_role === "admin" ? "Support" : msg.author_role === "support" ? "Support" : "You";
          return (
            <Card key={msg.id} className={isMe ? "border-primary/20" : "border-muted"}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    {roleLabel}
                    {msg.author_role === "admin" && (
                      <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Staff</Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
              </CardContent>
            </Card>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply Box */}
      {!isResolved && (
        <div className="flex gap-3 items-end">
          <Textarea
            placeholder="Type your reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            maxLength={5000}
            className="flex-1"
          />
          <Button onClick={handleReply} disabled={sending || !reply.trim()} size="icon" className="h-10 w-10">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SupportTicketDetail;
