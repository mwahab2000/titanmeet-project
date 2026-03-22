import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone, Share2, Linkedin, Link2 } from "lucide-react";
import { MotionReveal } from "./MotionReveal";
import { useToast } from "@/hooks/use-toast";

interface Props { data: PublicEventData; className?: string; }

export const PublicFooterSection: React.FC<Props> = ({ data, className = "" }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  const { toast } = useToast();
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(data.event.title + " " + pageUrl)}`, "_blank");
  };
  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`, "_blank");
  };
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "The event link has been copied to your clipboard." });
  };

  return (
    <MotionReveal as="footer" className={`border-t border-border bg-card ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <div className="grid sm:grid-cols-2 gap-8 sm:gap-12">
          <div className="space-y-3">
            <h3 className="font-bold font-display text-lg sm:text-xl">{data.event.title}</h3>
            <p className="text-sm text-muted-foreground">Hosted by {data.client.name}</p>
            {data.hero.venueName && <p className="text-sm text-muted-foreground">{data.hero.venueName}</p>}
          </div>
          {contactOrg && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Contact</h4>
              <p className="text-sm font-medium">{contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}</p>
              {contactOrg.email && (
                <a href={`mailto:${contactOrg.email}`} className="text-sm text-muted-foreground flex items-center gap-2 min-h-[36px] hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" />{contactOrg.email}
                </a>
              )}
              {contactOrg.mobile && (
                <a href={`tel:${contactOrg.mobile}`} className="text-sm text-muted-foreground flex items-center gap-2 min-h-[36px] hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0" />{contactOrg.mobile}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Share row */}
        <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-border">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Share this event</span>
            <div className="flex gap-2">
              {[
                { onClick: shareWhatsApp, label: "Share on WhatsApp", Icon: Share2 },
                { onClick: shareLinkedIn, label: "Share on LinkedIn", Icon: Linkedin },
                { onClick: copyLink, label: "Copy link", Icon: Link2 },
              ].map(({ onClick, label, Icon }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="inline-flex items-center justify-center h-11 w-11 sm:h-9 sm:w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 transition-colors"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground/60">Powered by TitanMeet</p>
          <p className="text-xs text-muted-foreground/40">© {new Date().getFullYear()}</p>
        </div>
      </div>
    </MotionReveal>
  );
};
