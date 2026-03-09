import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone, Share2, Linkedin, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { data: PublicEventData; }

export const FestivalFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  const { toast } = useToast();
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";

  const iconColors = ["#7C3AED", "#DB2777", "#FDE047"];

  return (
    <footer style={{ background: "#0A0A0A" }}>
      {/* Gradient line */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #7C3AED 0%, #DB2777 50%, #FDE047 100%)" }} />

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="mb-8" style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#FFFFFF", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
          {data.event.title}
        </h2>

        {contactOrg && (
          <div className="space-y-2 mb-8">
            <p style={{ fontFamily: font, fontSize: "0.85rem", fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>
              {contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}
            </p>
            {contactOrg.email && <p className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}><Mail className="h-3.5 w-3.5" />{contactOrg.email}</p>}
            {contactOrg.mobile && <p className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}><Phone className="h-3.5 w-3.5" />{contactOrg.mobile}</p>}
          </div>
        )}

        {/* Share */}
        <div className="flex gap-2 mb-10">
          {[
            { icon: Share2, action: () => window.open(`https://wa.me/?text=${encodeURIComponent(data.event.title + " " + pageUrl)}`, "_blank"), label: "WhatsApp" },
            { icon: Linkedin, action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`, "_blank"), label: "LinkedIn" },
            { icon: Link2, action: () => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); }, label: "Copy" },
          ].map((btn, i) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="inline-flex items-center justify-center w-10 h-10 transition-all duration-200 hover:scale-110"
              style={{ background: iconColors[i], color: i === 2 ? "#0A0A0A" : "#FFFFFF", borderRadius: 0 }}
              aria-label={btn.label}
            >
              <btn.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="pt-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ color: "rgba(255,255,255,0.15)", fontFamily: font, fontSize: "0.65rem" }}>© {new Date().getFullYear()} {data.client.name}</p>
          <p style={{ color: "rgba(255,255,255,0.15)", fontFamily: font, fontSize: "0.6rem" }}>Powered by TitanMeet</p>
        </div>
      </div>
    </footer>
  );
};
