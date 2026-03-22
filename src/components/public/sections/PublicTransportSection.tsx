import type { PublicEventData, PublicTransportRoute } from "@/lib/publicSite/types";
import { Bus, Clock, MapPin, ExternalLink, Route, Info } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicTransportSection: React.FC<Props> = ({ data, className = "" }) => {
  const { transport } = data;
  if (!transport.enabled || transport.routes.length === 0) return null;

  const hasDays = transport.routes.some((r) => r.dayNumber && r.dayNumber > 0);

  return (
    <MotionReveal id="transport" className={`max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bus className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tracking-tight">Transportation</h2>
        </div>
        <div className="flex-1 h-px bg-border hidden sm:block" />
      </div>

      {transport.meetupTime && (
        <p className="text-sm text-muted-foreground mb-4 sm:mb-6 flex items-center gap-2 sm:ml-[52px]">
          <Clock className="h-4 w-4 shrink-0" /> Meetup time: {transport.meetupTime}
        </p>
      )}

      {transport.generalInstructions && (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5 mb-6 sm:mb-8 flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">{transport.generalInstructions}</p>
        </div>
      )}

      <div className="space-y-4 sm:space-y-5">
        {transport.routes.map((route, i) => (
          <MotionRevealItem key={route.id} index={i}>
            <RouteCard route={route} showDay={hasDays} />
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};

const RouteCard: React.FC<{ route: PublicTransportRoute; showDay: boolean }> = ({ route, showDay }) => (
  <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5 hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Route className="h-5 w-5 text-primary shrink-0" />
      <h3 className="font-bold text-base sm:text-lg font-display">{route.name}</h3>
      {showDay && route.dayNumber && (
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary bg-primary/8 border border-primary/15 px-3 py-1 rounded-full">
          Day {route.dayNumber}
        </span>
      )}
      {route.departureTime && (
        <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2.5 py-1 rounded-lg">
          <Clock className="h-3 w-3" /> {route.departureTime.slice(0, 5)}
        </span>
      )}
      {route.vehicleType && (
        <span className="text-xs text-muted-foreground capitalize bg-muted px-2.5 py-1 rounded-lg">{route.vehicleType}</span>
      )}
    </div>

    {route.notes && <p className="text-sm text-muted-foreground leading-relaxed">{route.notes}</p>}

    {route.stops.length > 0 && (
      <div className="relative pl-5 sm:pl-6 space-y-3 sm:space-y-4">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
        {route.stops.map((stop) => (
          <div key={stop.id} className="relative flex items-start gap-2 sm:gap-3">
            <div className={`absolute left-[-13px] sm:left-[-15px] top-1.5 w-3 h-3 rounded-full border-2 ${stop.stopType === "dropoff" ? "border-destructive bg-destructive/20" : "border-primary bg-primary/20"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-medium text-sm">{stop.name}</span>
                {stop.pickupTime && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{stop.pickupTime}</span>}
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${stop.stopType === "dropoff" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {stop.stopType === "dropoff" ? "Drop-off" : "Pickup"}
                </span>
              </div>
              {stop.address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" /> <span>{stop.address}</span>
                </p>
              )}
              {stop.mapUrl && (
                <a href={stop.mapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 min-h-[32px]">
                  <ExternalLink className="h-3 w-3" /> View on Map
                </a>
              )}
              {stop.notes && <p className="text-xs text-muted-foreground mt-1">{stop.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
