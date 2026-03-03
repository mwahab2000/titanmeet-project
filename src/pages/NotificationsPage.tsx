import { useNavigate } from "react-router-dom";
import { CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { format } from "date-fns";

const TYPE_ICONS: Record<string, string> = {
  support_reply: "💬",
  support_status_changed: "🔔",
  payment_confirmed: "✅",
  payment_failed: "❌",
  payment_expired: "⏰",
  subscription_upgraded: "🚀",
  usage_warning: "⚠️",
  event_published: "🎉",
  invitation_sent: "📧",
  invitation_failed: "📧",
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1">
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition-colors hover:bg-accent/30 ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
              onClick={() => handleClick(n)}
            >
              <CardContent className="flex items-start gap-3 py-3 px-4">
                <span className="text-lg mt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    {!n.read && <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {n.link && <ExternalLink className="h-4 w-4 mt-1 shrink-0 text-muted-foreground/40" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
