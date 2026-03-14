import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { format } from "date-fns";
import { HeroAttendeeMarquee } from "../../sections/HeroAttendeeMarquee";

interface Props { data: PublicEventData; }

const SLIDE_INTERVAL = 6000;

export const TechSummitHero: React.FC<Props> = ({ data }) => {
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
    const iv = setInterval(goNext, SLIDE_INTERVAL);
    return () => clearInterval(iv);
  }, [goNext, images.length]);

  // Split title to highlight last word in cyan gradient
  const words = hero.title.split(" ");
  const mainWords = words.slice(0, -1).join(" ");
  const highlightWord = words[words.length - 1];

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden flex items-center justify-center" style={{ background: "#0E1420" }}>
      {hasImages ? (
        <>
          {images.map((src, i) => (
            <img key={src} src={src} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms]" style={{ opacity: i === activeIdx ? 1 : 0 }} />
          ))}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,20,32,0.85) 0%, rgba(14,20,32,0.5) 40%, rgba(14,20,32,0.95) 100%)" }} />
        </>
      ) : (
        <div className="absolute inset-0">
          <style>{`
            @keyframes ts-grid-drift {
              0% { background-position: 0 0; }
              100% { background-position: 24px 24px; }
            }
          `}</style>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(0,212,255,0.15) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              animation: "ts-grid-drift 8s linear infinite",
            }}
          />
        </div>
      )}

      <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 text-center py-32 space-y-8">
        {/* Terminal eyebrow */}
        <div className="inline-flex items-center gap-1">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: "#00D4FF" }}>
            $ event --year=2026 --type=summit
          </span>
          <style>{`@keyframes ts-blink { 0%,50% { opacity:1; } 51%,100% { opacity:0; } }`}</style>
          <span style={{ display: "inline-block", width: 8, height: 18, background: "#00D4FF", animation: "ts-blink 1s step-end infinite", marginLeft: 2 }} />
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1.05, color: "#FFFFFF" }}>
          {mainWords}{" "}
          <span style={{ background: "linear-gradient(135deg, #00D4FF, #0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {highlightWord}
          </span>
        </h1>

        {hero.description && (
          <p style={{ color: "rgba(226,232,240,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "1.1rem", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
            {hero.description}
          </p>
        )}

        {/* Pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {formattedDate && (
            <span className="inline-flex items-center px-4 py-2 text-sm" style={{ border: "1px solid rgba(0,212,255,0.3)", color: "#00D4FF", fontFamily: "'Inter', sans-serif", fontWeight: 500, background: "rgba(0,212,255,0.05)" }}>
              {formattedDate}
            </span>
          )}
          {hero.venueName && (
            <span className="inline-flex items-center px-4 py-2 text-sm" style={{ border: "1px solid rgba(0,212,255,0.3)", color: "#00D4FF", fontFamily: "'Inter', sans-serif", fontWeight: 500, background: "rgba(0,212,255,0.05)" }}>
              {hero.venueName}
            </span>
          )}
        </div>

        {/* CTA */}
        <div>
          <button
            onClick={() => {
              const t = document.getElementById("invitations") || document.getElementById("about");
              t?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,212,255,0.3)]"
            style={{ background: "#00D4FF", color: "#0E1420", fontFamily: "'Inter', sans-serif", borderRadius: 0 }}
          >
            Register Now →
          </button>
        </div>

        {/* Attendee marquee bars */}
        <div className="mt-10 w-full max-w-5xl mx-auto">
          <HeroAttendeeMarquee data={data} variant="glass" />
        </div>
      </div>
  );
};
