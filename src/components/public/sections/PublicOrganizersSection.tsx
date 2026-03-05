import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicOrganizersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.organizers.length === 0) return null;
  return (
    <MotionReveal id="organizers" className={`max-w-5xl mx-auto px-6 py-20 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold font-display mb-10 tracking-tight">Organizers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.organizers.map((o, i) => (
          <MotionRevealItem
            key={o.id}
            index={i}
            className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:shadow-md hover:border-primary/20 transition-all duration-300"
          >
            {o.photoUrl && (
              <img
                src={o.photoUrl}
                alt={o.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-border"
                onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
              />
            )}
            <h3 className="font-semibold text-lg">{o.name}</h3>
            {o.role && <p className="text-sm text-primary font-medium">{o.role}</p>}
            {o.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{o.email}</p>}
            {o.mobile && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{o.mobile}</p>}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
