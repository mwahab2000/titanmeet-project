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

export const MidnightGalaNav: React.FC<Props> = ({ data }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
      const sections = sectionLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
      let current = "";
      for (const s of sections) {
        if (s && s.getBoundingClientRect().top <= 120) current = s.id;
      }
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const availableLinks = sectionLinks.filter((link) => {
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

  if (availableLinks.length === 0) return null;

  const scrollTo = (id: string) => {
    setSheetOpen(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150);
  };

  const linkStyle = (id: string) => ({
    color: active === id ? "#C9A84C" : "rgba(232,228,220,0.6)",
    fontFamily: "'Lato', sans-serif",
    fontSize: "0.7rem",
    fontWeight: 400,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
  });

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 animate-fade-in">
      <div style={{ background: "rgba(13,13,20,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(201,168,76,0.12)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14">
          <span
            className="font-semibold text-sm mr-auto shrink-0"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#E8E4DC", fontStyle: "italic" }}
          >
            {data.event.title}
          </span>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {availableLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition-colors duration-200 hover:!text-[#C9A84C]" style={linkStyle(link.id)}>
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                const t = document.getElementById("invitations") || document.getElementById("about");
                t?.scrollIntoView({ behavior: "smooth" });
              }}
              className="ml-2 px-5 py-1.5 text-xs uppercase tracking-[0.12em] transition-all duration-300"
              style={{ border: "1px solid #C9A84C", color: "#C9A84C", background: "transparent", fontFamily: "'Lato', sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#C9A84C"; e.currentTarget.style.color = "#0D0D14"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#C9A84C"; }}
            >
              Register
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button className="p-2" style={{ color: "#C9A84C" }} aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12" style={{ background: "#0D0D14", borderLeft: "1px solid rgba(201,168,76,0.15)" }}>
                <nav className="flex flex-col gap-1">
                  {availableLinks.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => scrollTo(link.id)}
                      className="text-left px-4 py-3 transition-colors"
                      style={linkStyle(link.id)}
                    >
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
