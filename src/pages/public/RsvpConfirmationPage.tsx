import { useLocation } from "react-router-dom";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";

type RsvpState = "confirmed" | "already-confirmed" | "invalid";

function getState(pathname: string): RsvpState {
  if (pathname.includes("already-confirmed")) return "already-confirmed";
  if (pathname.includes("invalid")) return "invalid";
  return "confirmed";
}

const config: Record<RsvpState, { icon: typeof CheckCircle2; iconColor: string; heading: string; getSubtext: (name: string, event: string) => string }> = {
  confirmed: {
    icon: CheckCircle2,
    iconColor: "text-primary",
    heading: "You're Confirmed! 🎉",
    getSubtext: (name, event) =>
      name && event
        ? `Hi ${name}, your attendance for ${event} has been confirmed.`
        : "Your attendance has been confirmed. Thank you for responding!",
  },
  "already-confirmed": {
    icon: Info,
    iconColor: "text-blue-500",
    heading: "Already Confirmed",
    getSubtext: () => "You've already confirmed your attendance. We look forward to seeing you!",
  },
  invalid: {
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    heading: "Invalid or Expired Link",
    getSubtext: () => "This invitation link is no longer valid. Please contact the event organizer.",
  },
};

const RsvpConfirmationPage = () => {
  const location = useLocation();
  const state = getState(location.pathname);
  const params = new URLSearchParams(location.search);
  const name = params.get("name") || "";
  const event = params.get("event") || "";

  const { icon: Icon, iconColor, heading, getSubtext } = config[state];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg space-y-6">
        <img src="/images/TitanMeetLogo.png" alt="TitanMeet" className="h-10 mx-auto" />
        <Icon className={`h-16 w-16 mx-auto ${iconColor}`} />
        <h1 className="font-display text-2xl font-bold text-foreground">{heading}</h1>
        <p className="text-muted-foreground leading-relaxed">{getSubtext(name, event)}</p>
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">Powered by TitanMeet</p>
      </div>
    </div>
  );
};

export default RsvpConfirmationPage;
