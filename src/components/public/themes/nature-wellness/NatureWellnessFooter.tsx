import type { PublicEventData } from "@/lib/publicSite/types";
import { Mail, Phone, Share2, Linkedin, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { data: PublicEventData; }

export const NatureWellnessFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  const { toast } = useToast();
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const iconBtn: React.CSSProperties = { border: "1px solid rgba(200,216,192,0.2)", color: "rgba(200,216,192,0.6)", width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", transition: "all 0.2s" };

  return (
    <footer style={{ background: "#1C2B1A" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="mb-5" style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: "1.5rem", color: "#FAF7F2" }}>
          {data.event.title}
        </h2>

        <div className="mb-8" style={{ width: 50, height: 2, background: "#C1784F", borderRadius: 999 }} />

        {contactOrg && (
          <div className="space-y-2 mb-8" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            <p style={{ color: "rgba(250,247,242,0.7)", fontSize: "0.85rem" }}>{contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}</p>
            {contactOrg.email && <p className="flex items-center gap-2" style={{ color: "rgba(250,247,242,0.5)", fontSize: "0.8rem" }}><Mail className="h-3.5 w-3.5" style={{ color: "#8BB07A" }} />{contactOrg.email}</p>}
            {contactOrg.mobile && <p className="flex items-center gap-2" style={{ color: "rgba(250,247,242,0.5)", fontSize: "0.8rem" }}><Phone className="h-3.5 w-3.5" style={{ color: "#8BB07A" }} />{contactOrg.mobile}</p>}
          </div>
        )}

        <div className="flex items-center gap-3 mb-10">
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(data.event.title + " " + pageUrl)}`, "_blank")} style={iconBtn}><Share2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`, "_blank")} style={iconBtn}><Linkedin className="h-3.5 w-3.5" /></button>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); }} style={iconBtn}><Link2 className="h-3.5 w-3.5" /></button>
        </div>

        <div className="pt-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(200,216,192,0.1)" }}>
          <p style={{ color: "rgba(139,176,122,0.4)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem" }}>Powered by TitanMeet</p>
          <p style={{ color: "rgba(139,176,122,0.3)", fontSize: "0.6rem" }}>© {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
};
