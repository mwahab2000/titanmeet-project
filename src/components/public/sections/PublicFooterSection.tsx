import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicFooterSection: React.FC<Props> = ({ data, className = "" }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  return (
    <MotionReveal as="footer" className={`border-t border-border bg-card ${className}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-xl mb-3">{data.event.title}</h3>
            <p className="text-sm text-muted-foreground">Hosted by {data.client.name}</p>
            {data.hero.venueName && <p className="text-sm text-muted-foreground">{data.hero.venueName}</p>}
          </div>
          {contactOrg && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Contact</h4>
              <p className="text-sm">{contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}</p>
              {contactOrg.email && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{contactOrg.email}</p>}
              {contactOrg.mobile && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{contactOrg.mobile}</p>}
            </div>
          )}
        </div>
        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          Powered by TitanMeet
        </div>
      </div>
    </MotionReveal>
  );
};
