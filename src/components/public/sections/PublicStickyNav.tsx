import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface Props { data: PublicEventData; className?: string; }

const sectionLinks = [
  { id: "about", label: "About" },
  { id: "agenda", label: "Agenda" },
  { id: "speakers", label: "Speakers" },
  { id: "venue", label: "Venue" },
  { id: "gallery", label: "Gallery" },
  { id: "organizers", label: "Organizers" },
  { id: "dress-code", label: "Dress Code" },
  { id: "transport", label: "Transport" },
];

export const PublicStickyNav: React.FC<Props> = ({ data, className = "" }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
      const sections = sectionLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
      let current = "";
      for (const section of sections) {
        if (section && section.getBoundingClientRect().top <= 120) current = section.id;
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
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 animate-fade-in ${className}`}>
      <div className="backdrop-blur-xl bg-background/85 border-b border-border/40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-12 sm:h-14 gap-1">
          <span className="font-display font-bold text-sm mr-4 sm:mr-6 shrink-0 hidden sm:block tracking-tight truncate max-w-[200px]">{data.event.title}</span>
          <div className="flex-1 h-px bg-border/30 mr-3 hidden sm:block" />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none">
            {availableLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-lg transition-all duration-200 shrink-0 font-medium ${
                  active === link.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile: show event title + hamburger */}
          <div className="md:hidden flex items-center justify-between w-full">
            <span className="font-display font-bold text-sm truncate max-w-[70%]">{data.event.title}</span>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button className="p-2.5 -mr-1 rounded-lg hover:bg-muted/60 text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12">
                <nav className="flex flex-col gap-1">
                  {availableLinks.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => scrollTo(link.id)}
                      className={`text-left text-base px-4 py-3.5 rounded-lg transition-colors font-medium min-h-[48px] ${
                        active === link.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
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
