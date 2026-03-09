import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone, Share2, Linkedin, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { data: PublicEventData; }

export const MidnightGalaFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  const { toast } = useToast();
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const iconBtnStyle: React.CSSProperties = {
    border: "1px solid rgba(201,168,76,0.2)",
    color: "rgba(201,168,76,0.6)",
    width: 36, height: 36,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s",
  };

  return (
    <footer style={{ background: "#000000" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20">
        {/* Title */}
        <h2
          className="text-3xl sm:text-4xl mb-6"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, color: "#E8E4DC" }}
        >
          {data.event.title}
        </h2>

        {/* Gold rule */}
        <div className="mb-8" style={{ width: 60, height: 1, background: "rgba(201,168,76,0.4)" }} />

        {/* Contact */}
        {contactOrg && (
          <div className="space-y-2 mb-10" style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}>
            <p style={{ color: "rgba(232,228,220,0.8)", fontSize: "0.9rem" }}>
              {contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}
            </p>
            {contactOrg.email && (
              <p className="flex items-center gap-2" style={{ color: "rgba(232,228,220,0.5)", fontSize: "0.8rem" }}>
                <Mail className="h-3.5 w-3.5" style={{ color: "#C9A84C" }} />{contactOrg.email}
              </p>
            )}
            {contactOrg.mobile && (
              <p className="flex items-center gap-2" style={{ color: "rgba(232,228,220,0.5)", fontSize: "0.8rem" }}>
                <Phone className="h-3.5 w-3.5" style={{ color: "#C9A84C" }} />{contactOrg.mobile}
              </p>
            )}
          </div>
        )}

        {/* Share */}
        <div className="flex items-center gap-4 mb-10">
          <span style={{ color: "rgba(201,168,76,0.5)", fontFamily: "'Lato', sans-serif", fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Share
          </span>
          <div className="flex gap-2">
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(data.event.title + " " + pageUrl)}`, "_blank")} style={iconBtnStyle} aria-label="Share on WhatsApp"><Share2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`, "_blank")} style={iconBtnStyle} aria-label="Share on LinkedIn"><Linkedin className="h-3.5 w-3.5" /></button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); }} style={iconBtnStyle} aria-label="Copy link"><Link2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {/* Divider + powered by */}
        <div style={{ borderTop: "1px solid rgba(201,168,76,0.1)" }} className="pt-6 flex items-center justify-between">
          <p style={{ color: "rgba(201,168,76,0.25)", fontFamily: "'Lato', sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
            Powered by TitanMeet
          </p>
          <p style={{ color: "rgba(201,168,76,0.15)", fontSize: "0.65rem" }}>
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
};
