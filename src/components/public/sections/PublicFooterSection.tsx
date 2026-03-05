import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicFooterSection: React.FC<Props> = ({ data, className = "" }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  return (
    <MotionReveal as="footer" className={`border-t border-border bg-card ${className}`}>
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-3">
            <h3 className="font-bold font-display text-xl">{data.event.title}</h3>
            <p className="text-sm text-muted-foreground">Hosted by {data.client.name}</p>
            {data.hero.venueName && <p className="text-sm text-muted-foreground">{data.hero.venueName}</p>}
          </div>
          {contactOrg && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Contact</h4>
              <p className="text-sm font-medium">{contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}</p>
              {contactOrg.email && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{contactOrg.email}</p>}
              {contactOrg.mobile && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{contactOrg.mobile}</p>}
            </div>
          )}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground/60">Powered by TitanMeet</p>
          <p className="text-xs text-muted-foreground/40">© {new Date().getFullYear()}</p>
        </div>
      </div>
    </MotionReveal>
  );
};
