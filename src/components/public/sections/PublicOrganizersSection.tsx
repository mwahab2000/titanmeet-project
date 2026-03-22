import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicOrganizersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.organizers.length === 0) return null;
  return (
    <MotionReveal id="organizers" className={`max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4 mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tracking-tight">Organizers</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {data.organizers.map((o, i) => (
          <MotionRevealItem
            key={o.id}
            index={i}
            className="group rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3 sm:space-y-4 hover:shadow-[var(--shadow-elevated)] hover:border-primary/15 transition-all duration-300"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {o.photoUrl ? (
                <img
                  src={o.photoUrl}
                  alt={o.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover ring-2 ring-border group-hover:ring-primary/20 transition-all"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold font-display text-lg shrink-0">
                  {o.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">{o.name}</h3>
                {o.role && <p className="text-sm text-primary font-medium truncate">{o.role}</p>}
              </div>
            </div>
            {(o.email || o.mobile) && (
              <div className="space-y-1.5 pl-0 sm:pl-[72px]">
                {o.email && (
                  <a href={`mailto:${o.email}`} className="text-xs text-muted-foreground flex items-center gap-2 min-h-[32px] hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="truncate">{o.email}</span>
                  </a>
                )}
                {o.mobile && (
                  <a href={`tel:${o.mobile}`} className="text-xs text-muted-foreground flex items-center gap-2 min-h-[32px] hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span>{o.mobile}</span>
                  </a>
                )}
              </div>
            )}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
