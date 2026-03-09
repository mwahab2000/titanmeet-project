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

        {/* Share row */}
        <div className="mt-10 pt-8 border-t border-border">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Share this event</span>
            <div className="flex gap-2">
              <button
                onClick={shareWhatsApp}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Share on WhatsApp"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={shareLinkedIn}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Share on LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </button>
              <button
                onClick={copyLink}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Copy link"
              >
                <Link2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground/60">Powered by TitanMeet</p>
          <p className="text-xs text-muted-foreground/40">© {new Date().getFullYear()}</p>
        </div>
      </div>
    </MotionReveal>
  );
};
