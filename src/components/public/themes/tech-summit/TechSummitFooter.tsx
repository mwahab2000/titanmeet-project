import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone, Share2, Linkedin, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { data: PublicEventData; }

export const TechSummitFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  const { toast } = useToast();
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const sectionLinks = [
    { id: "about", label: "About", show: !!data.event.description },
    { id: "agenda", label: "Sessions", show: data.agenda.length > 0 },
    { id: "speakers", label: "Speakers", show: data.speakers.length > 0 },
    { id: "venue", label: "Venue", show: !!(data.venue.name || data.venue.address) },
  ].filter((l) => l.show);

  const iconBtn = "inline-flex items-center justify-center w-8 h-8 transition-colors duration-200";

  return (
    <footer style={{ background: "#080E1A", borderTop: "1px solid rgba(0,212,255,0.2)" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {/* Event info */}
          <div className="space-y-3">
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: "#E2E8F0", fontSize: "1rem" }}>{data.event.title}</h3>
            <p style={{ color: "rgba(226,232,240,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>Hosted by {data.client.name}</p>
            {contactOrg && (
              <div className="space-y-1.5 pt-2">
                {contactOrg.email && <p className="flex items-center gap-2" style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.75rem" }}><Mail className="h-3 w-3" style={{ color: "#00D4FF" }} />{contactOrg.email}</p>}
                {contactOrg.mobile && <p className="flex items-center gap-2" style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.75rem" }}><Phone className="h-3 w-3" style={{ color: "#00D4FF" }} />{contactOrg.mobile}</p>}
              </div>
            )}
          </div>

          {/* Nav links */}
          {sectionLinks.length > 0 && (
            <div className="space-y-3">
              <h4 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "rgba(226,232,240,0.4)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Navigate</h4>
              {sectionLinks.map((link) => (
                <a key={link.id} href={`#${link.id}`} className="block transition-colors duration-200 hover:text-[#00D4FF]" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", color: "rgba(226,232,240,0.6)" }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="space-y-3">
            <h4 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "rgba(226,232,240,0.4)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Share</h4>
            <div className="flex gap-2">
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(data.event.title + " " + pageUrl)}`, "_blank")} className={iconBtn} style={{ border: "1px solid rgba(0,212,255,0.15)", color: "rgba(226,232,240,0.5)" }} aria-label="WhatsApp"><Share2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`, "_blank")} className={iconBtn} style={{ border: "1px solid rgba(0,212,255,0.15)", color: "rgba(226,232,240,0.5)" }} aria-label="LinkedIn"><Linkedin className="h-3.5 w-3.5" /></button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); }} className={iconBtn} style={{ border: "1px solid rgba(0,212,255,0.15)", color: "rgba(226,232,240,0.5)" }} aria-label="Copy link"><Link2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(0,212,255,0.08)" }}>
          <p style={{ color: "rgba(226,232,240,0.2)", fontFamily: "'Inter', sans-serif", fontSize: "0.65rem" }}>© {new Date().getFullYear()} {data.client.name}</p>
          <p style={{ color: "rgba(226,232,240,0.2)", fontFamily: "'Inter', sans-serif", fontSize: "0.6rem" }}>Powered by TitanMeet</p>
        </div>
      </div>
    </footer>
  );
};
