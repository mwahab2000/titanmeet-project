import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicFooterSection: React.FC<Props> = ({ data, className = "" }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  return (
    <MotionReveal as="footer" className={`border-t border-border bg-card ${className}`}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold font-display text-lg mb-2">{data.event.title}</h3>
            <p className="text-sm text-muted-foreground">Hosted by {data.client.name}</p>
            {data.hero.venueName && <p className="text-sm text-muted-foreground mt-1">{data.hero.venueName}</p>}
          </div>
          {contactOrg && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Contact</h4>
              <p className="text-sm text-muted-foreground">{contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}</p>
              {contactOrg.email && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{contactOrg.email}</p>}
              {contactOrg.mobile && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{contactOrg.mobile}</p>}
            </div>
          )}
        </div>
        <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground text-center">
          Powered by TitanMeet
        </div>
      </div>
    </MotionReveal>
  );
};
