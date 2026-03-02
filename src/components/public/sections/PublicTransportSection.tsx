import type { PublicEventData, PublicTransportRoute } from "@/lib/publicSite/types";
import { Bus, Clock, MapPin, ExternalLink, Route, Info } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicTransportSection: React.FC<Props> = ({ data, className = "" }) => {
  const { transport } = data;
  if (!transport.enabled || transport.routes.length === 0) return null;

  const hasDays = transport.routes.some((r) => r.dayNumber && r.dayNumber > 0);

  return (
    <MotionReveal id="transport" className={`max-w-4xl mx-auto px-6 py-16 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-2 flex items-center gap-3">
        <Bus className="h-7 w-7 text-primary" />
        Transportation
      </h2>

      {transport.meetupTime && (
        <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Meetup time: {transport.meetupTime}
        </p>
      )}

      {transport.generalInstructions && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-8 flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{transport.generalInstructions}</p>
        </div>
      )}

      <div className="space-y-6">
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
  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Route className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-lg">{route.name}</h3>
      {showDay && route.dayNumber && (
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
          Day {route.dayNumber}
        </span>
      )}
      {route.departureTime && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Departs {route.departureTime.slice(0, 5)}
        </span>
      )}
      {route.vehicleType && (
        <span className="text-xs text-muted-foreground capitalize">{route.vehicleType}</span>
      )}
    </div>

    {route.notes && <p className="text-sm text-muted-foreground">{route.notes}</p>}

    {route.stops.length > 0 && (
      <div className="relative pl-6 space-y-3">
        {/* Timeline line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

        {route.stops.map((stop, j) => (
          <div key={stop.id} className="relative flex items-start gap-3">
            {/* Timeline dot */}
            <div className={`absolute left-[-15px] top-1.5 w-3 h-3 rounded-full border-2 ${
              stop.stopType === "dropoff" 
                ? "border-destructive bg-destructive/20" 
                : "border-primary bg-primary/20"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{stop.name}</span>
                {stop.pickupTime && (
                  <span className="text-xs text-muted-foreground">{stop.pickupTime}</span>
                )}
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                  stop.stopType === "dropoff"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}>
                  {stop.stopType === "dropoff" ? "Drop-off" : "Pickup"}
                </span>
              </div>
              {stop.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" /> {stop.address}
                </p>
              )}
              {stop.mapUrl && (
                <a href={stop.mapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <ExternalLink className="h-3 w-3" /> View on Map
                </a>
              )}
              {stop.notes && <p className="text-xs text-muted-foreground mt-0.5">{stop.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
