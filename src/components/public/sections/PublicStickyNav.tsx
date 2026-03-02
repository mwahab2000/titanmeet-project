import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props {
  data: PublicEventData;
  className?: string;
}

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

  // Show after scrolling past hero
  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);

      // Find active section
      const sections = sectionLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
      let current = "";
      for (const section of sections) {
        if (section && section.getBoundingClientRect().top <= 120) {
          current = section.id;
        }
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

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 animate-fade-in ${className}`}>
      <div className="backdrop-blur-xl bg-background/80 border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex items-center h-12 gap-1 overflow-x-auto scrollbar-none">
          <span className="font-display font-semibold text-sm mr-4 shrink-0 hidden sm:block">{data.event.title}</span>
          {availableLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-full transition-colors shrink-0 ${
                active === link.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};
