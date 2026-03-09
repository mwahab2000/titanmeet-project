import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const sectionLinks = [
  { id: "about", label: "About" },
  { id: "agenda", label: "Sessions" },
  { id: "speakers", label: "Speakers" },
  { id: "venue", label: "Venue" },
  { id: "gallery", label: "Gallery" },
  { id: "organizers", label: "Team" },
  { id: "dress-code", label: "Dress Code" },
  { id: "transport", label: "Transport" },
];

interface Props { data: PublicEventData; }

export const TechSummitNav: React.FC<Props> = ({ data }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

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

  if (!visible) return null;

  const available = sectionLinks.filter((link) => {
    if (link.id === "about" && !data.event.description) return false;
    if (link.id === "agenda" && data.agenda.length === 0) return false;
    if (link.id === "speakers" && data.speakers.length === 0) return false;
    if (link.id === "venue" && !data.venue.name && !data.venue.address) return false;
    if (link.id === "gallery" && (!data.gallery || data.gallery.length === 0)) return false;
    if (link.id === "organizers" && data.organizers.length === 0) return false;
    if (link.id === "dress-code" && (!data.dressCode || data.dressCode.length === 0)) return false;
    if (link.id === "transport" && (!data.transport?.enabled || data.transport.routes.length === 0)) return false;
    return true;
  });

  if (available.length === 0) return null;

  const scrollTo = (id: string) => { setSheetOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150); };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 animate-fade-in">
      <div style={{ background: "rgba(14,20,32,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14">
          <div className="flex items-center gap-2 mr-auto shrink-0">
            <div style={{ width: 8, height: 8, background: "#00D4FF" }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#E2E8F0" }}>{data.event.title}</span>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-5">
            {available.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="transition-colors duration-200"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 500, color: active === link.id ? "#00D4FF" : "rgba(226,232,240,0.6)" }}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => { const t = document.getElementById("invitations") || document.getElementById("about"); t?.scrollIntoView({ behavior: "smooth" }); }}
              className="ml-2 px-4 py-1.5 text-xs font-semibold transition-all duration-200"
              style={{ border: "1px solid #00D4FF", color: "#00D4FF", background: "transparent", fontFamily: "'Inter', sans-serif", borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#00D4FF"; e.currentTarget.style.color = "#0E1420"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#00D4FF"; }}
            >
              Register
            </button>
          </div>

          {/* Mobile */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button className="p-2" style={{ color: "#00D4FF" }}><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12" style={{ background: "#0E1420", borderLeft: "1px solid rgba(0,212,255,0.15)" }}>
                <nav className="flex flex-col gap-1">
                  {available.map((link) => (
                    <button key={link.id} onClick={() => scrollTo(link.id)} className="text-left px-4 py-3 transition-colors" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", fontWeight: 500, color: active === link.id ? "#00D4FF" : "rgba(226,232,240,0.6)" }}>
                      {link.label}
                    </button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
