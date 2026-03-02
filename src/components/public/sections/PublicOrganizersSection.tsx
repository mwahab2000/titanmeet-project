import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicOrganizersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.organizers.length === 0) return null;
  return (
    <MotionReveal id="organizers" className={`max-w-5xl mx-auto px-6 py-16 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-8">Organizers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.organizers.map((o, i) => (
          <MotionRevealItem key={o.id} index={i} className="rounded-xl border border-border bg-card p-5 space-y-2 hover-scale">
            {o.photoUrl && (
              <img src={o.photoUrl} alt={o.name} className="w-14 h-14 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
            )}
            <h3 className="font-semibold">{o.name}</h3>
            {o.role && <p className="text-sm text-muted-foreground">{o.role}</p>}
            {o.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{o.email}</p>}
            {o.mobile && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{o.mobile}</p>}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
