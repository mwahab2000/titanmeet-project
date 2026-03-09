import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Menu, X } from "lucide-react";

const sectionLinks = [
  { id: "about", label: "About" },
  { id: "agenda", label: "What's On" },
  { id: "speakers", label: "Lineup" },
  { id: "venue", label: "Venue" },
  { id: "gallery", label: "Gallery" },
  { id: "organizers", label: "Team" },
  { id: "dress-code", label: "Dress Code" },
  { id: "transport", label: "Transport" },
];

interface Props { data: PublicEventData; }

export const FestivalNav: React.FC<Props> = ({ data }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
      const sections = sectionLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
      let current = "";
      for (const s of sections) { if (s && s.getBoundingClientRect().top <= 120) current = s.id; }
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible && !menuOpen) return null;

  const available = sectionLinks.filter((l) => {
    if (l.id === "about" && !data.event.description) return false;
    if (l.id === "agenda" && data.agenda.length === 0) return false;
    if (l.id === "speakers" && data.speakers.length === 0) return false;
    if (l.id === "venue" && !data.venue.name && !data.venue.address) return false;
    if (l.id === "gallery" && (!data.gallery || data.gallery.length === 0)) return false;
    if (l.id === "organizers" && data.organizers.length === 0) return false;
    if (l.id === "dress-code" && (!data.dressCode || data.dressCode.length === 0)) return false;
    if (l.id === "transport" && (!data.transport?.enabled || data.transport.routes.length === 0)) return false;
    return true;
  });

  if (available.length === 0) return null;

  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 animate-fade-in" style={{ background: visible ? "rgba(255,255,255,0.95)" : "transparent", backdropFilter: visible ? "blur(12px)" : "none", borderBottom: visible ? "2px solid #0A0A0A" : "none", transition: "all 0.3s" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14">
          <span className="mr-auto shrink-0" style={{ fontFamily: font, fontWeight: 900, fontSize: "0.85rem", color: visible ? "#0A0A0A" : "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {data.event.title}
          </span>

          <div className="hidden md:flex items-center gap-5">
            {available.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition-colors duration-200" style={{ fontFamily: font, fontSize: "0.75rem", fontWeight: 700, color: active === link.id ? "#7C3AED" : (visible ? "#0A0A0A" : "rgba(255,255,255,0.8)"), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {link.label}
              </a>
            ))}
            <button
              onClick={() => { const t = document.getElementById("invitations") || document.getElementById("about"); t?.scrollIntoView({ behavior: "smooth" }); }}
              className="ml-2 px-5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-all"
              style={{ background: "#7C3AED", color: "#FFFFFF", fontFamily: font, borderRadius: 0 }}
            >
              Tickets
            </button>
          </div>

          {/* Mobile */}
          <button className="md:hidden p-2" style={{ color: visible ? "#0A0A0A" : "#FFFFFF" }} onClick={() => setMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* Full-screen mobile overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)" }}>
          <button className="absolute top-4 right-4 p-2" style={{ color: "#FFFFFF" }} onClick={() => setMenuOpen(false)}>
            <X className="h-7 w-7" />
          </button>
          <nav className="flex flex-col items-center gap-6">
            {available.map((link) => (
              <button key={link.id} onClick={() => scrollTo(link.id)} style={{ fontFamily: font, fontWeight: 900, fontSize: "2rem", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                {link.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
};
