import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { format } from "date-fns";
import { ArrowDown } from "lucide-react";
import { HeroAttendeeMarquee } from "../../sections/HeroAttendeeMarquee";

interface Props { data: PublicEventData; }

const LeafSprig = () => (
  <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
    <path d="M16 36V18" stroke="#C1784F" strokeWidth="1.5" />
    <path d="M16 18C12 14 6 12 2 14C6 10 12 8 16 12" fill="#C1784F" opacity="0.7" />
    <path d="M16 14C20 10 26 8 30 10C26 6 20 4 16 8" fill="#C1784F" opacity="0.5" />
    <path d="M16 8C13 4 10 1 8 0C10 3 12 6 16 6" fill="#C1784F" opacity="0.6" />
  </svg>
);

const WaveDivider = () => (
  <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ lineHeight: 0 }}>
    <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 sm:h-20">
      <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="#FAF7F2" />
    </svg>
  </div>
);

export const NatureWellnessHero: React.FC<Props> = ({ data }) => {
  const { hero } = data;
  const images = hero.images;
  const hasImages = images.length > 0;
  const formattedDate = hero.date ? format(new Date(hero.date), "MMMM d, yyyy") : null;
  const [activeIdx, setActiveIdx] = useState(0);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIdx((p) => (p + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(goNext, 6000);
    return () => clearInterval(iv);
  }, [goNext, images.length]);

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden flex items-center justify-center" style={{ background: "#FAF7F2" }}>
      {hasImages ? (
        <>
          {images.map((src, i) => (
            <img key={src} src={src} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]" style={{ opacity: i === activeIdx ? 1 : 0 }} />
          ))}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(28,43,26,0.4) 0%, rgba(28,43,26,0.6) 100%)" }} />
        </>
      ) : (
        <div className="absolute inset-0">
          <style>{`
            @keyframes nw-mesh { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
          `}</style>
          <div className="absolute inset-0" style={{
            background: "linear-gradient(-45deg, #E8F0E4, #FAF7F2, #D4E7CB, #F0EBE3, #C8D8C0)",
            backgroundSize: "400% 400%",
            animation: "nw-mesh 20s ease infinite",
          }} />
        </div>
      )}

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center py-32 space-y-6">
        <LeafSprig />

        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          lineHeight: 1.1,
          color: hasImages ? "#FFFFFF" : "#1C2B1A",
        }}>
          {hero.title}
        </h1>

        {hero.description && (
          <p style={{ color: hasImages ? "rgba(255,255,255,0.8)" : "rgba(28,43,26,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: "1.1rem", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            {hero.description}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {formattedDate && (
            <span className="inline-flex items-center px-4 py-2 text-sm rounded-full" style={{ border: "1px solid " + (hasImages ? "rgba(255,255,255,0.3)" : "rgba(45,106,79,0.3)"), color: hasImages ? "#FFFFFF" : "#2D6A4F", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: hasImages ? "rgba(255,255,255,0.1)" : "rgba(45,106,79,0.05)" }}>
              {formattedDate}
            </span>
          )}
          {hero.venueName && (
            <span className="inline-flex items-center px-4 py-2 text-sm rounded-full" style={{ border: "1px solid " + (hasImages ? "rgba(255,255,255,0.3)" : "rgba(45,106,79,0.3)"), color: hasImages ? "#FFFFFF" : "#2D6A4F", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: hasImages ? "rgba(255,255,255,0.1)" : "rgba(45,106,79,0.05)" }}>
              {hero.venueName}
            </span>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={() => { const t = document.getElementById("invitations") || document.getElementById("about"); t?.scrollIntoView({ behavior: "smooth" }); }}
            className="px-8 py-3.5 text-sm font-semibold rounded-full transition-all duration-300 hover:shadow-lg"
            style={{ background: "#2D6A4F", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif" }}
          >
            Join Us
          </button>
        </div>

        {/* Attendee marquee bars */}
        <div className="mt-8 w-full max-w-5xl mx-auto">
          <HeroAttendeeMarquee data={data} variant={hasImages ? "glass" : "light"} />
        </div>
      </div>

      <WaveDivider />

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 animate-bounce" style={{ color: hasImages ? "rgba(255,255,255,0.3)" : "rgba(28,43,26,0.3)" }}>
        <ArrowDown className="h-4 w-4" />
      </div>
    </section>
  );
};
