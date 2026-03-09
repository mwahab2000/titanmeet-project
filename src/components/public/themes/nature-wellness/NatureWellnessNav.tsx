import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const sectionLinks = [
  { id: "about", label: "About" },
  { id: "agenda", label: "Programme" },
  { id: "speakers", label: "Speakers" },
  { id: "venue", label: "Venue" },
  { id: "gallery", label: "Gallery" },
  { id: "organizers", label: "Hosts" },
  { id: "dress-code", label: "Dress Code" },
  { id: "transport", label: "Transport" },
];

interface Props { data: PublicEventData; }

export const NatureWellnessNav: React.FC<Props> = ({ data }) => {
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

  const scrollTo = (id: string) => { setSheetOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150); };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 animate-fade-in">
      <div style={{ background: "rgba(250,247,242,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid #C8D8C0" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14">
          <span className="mr-auto shrink-0" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: "0.95rem", color: "#1C2B1A" }}>
            {data.event.title}
          </span>

          <div className="hidden md:flex items-center gap-5">
            {available.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition-colors duration-200" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", fontWeight: 500, color: active === link.id ? "#2D6A4F" : "rgba(28,43,26,0.5)" }}>
                {link.label}
              </a>
            ))}
            <button
              onClick={() => { const t = document.getElementById("invitations") || document.getElementById("about"); t?.scrollIntoView({ behavior: "smooth" }); }}
              className="ml-2 px-5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200"
              style={{ background: "#C1784F", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif" }}
            >
              Register
            </button>
          </div>

          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button className="p-2" style={{ color: "#2D6A4F" }}><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12" style={{ background: "#FAF7F2", borderLeft: "1px solid #C8D8C0" }}>
                <nav className="flex flex-col gap-1">
                  {available.map((link) => (
                    <button key={link.id} onClick={() => scrollTo(link.id)} className="text-left px-4 py-3 rounded-xl transition-colors" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 500, color: active === link.id ? "#2D6A4F" : "rgba(28,43,26,0.5)" }}>
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
