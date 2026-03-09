import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { format } from "date-fns";
import { ArrowDown } from "lucide-react";

interface Props { data: PublicEventData; }

const SLIDE_INTERVAL = 6000;

export const MidnightGalaHero: React.FC<Props> = ({ data }) => {
  const { hero } = data;
  const images = hero.images;
  const hasImages = images.length > 0;
  const formattedDate = hero.date ? format(new Date(hero.date), "EEEE, MMMM d, yyyy") : null;

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

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden flex items-end" style={{ background: "#0D0D14" }}>
      {/* Background */}
      {hasImages ? (
        <>
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]"
              style={{ opacity: i === activeIdx ? 1 : 0 }}
            />
          ))}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.7) 0%, rgba(13,13,20,0.3) 40%, rgba(13,13,20,0.95) 100%)" }}
          />
        </>
      ) : (
        /* Gold particle field via CSS */
        <div className="absolute inset-0 overflow-hidden">
          <style>{`
            @keyframes mg-float {
              0% { transform: translateY(0) translateX(0); opacity: 0; }
              10% { opacity: 0.5; }
              90% { opacity: 0.3; }
              100% { transform: translateY(-100vh) translateX(40px); opacity: 0; }
            }
            .mg-particle {
              position: absolute;
              border-radius: 50%;
              background: radial-gradient(circle, #C9A84C, transparent);
              animation: mg-float linear infinite;
            }
          `}</style>
          {Array.from({ length: 30 }).map((_, i) => {
            const size = 2 + Math.random() * 4;
            const left = Math.random() * 100;
            const delay = Math.random() * 12;
            const duration = 10 + Math.random() * 15;
            const opacity = 0.15 + Math.random() * 0.35;
            return (
              <div
                key={i}
                className="mg-particle"
                style={{
                  width: size,
                  height: size,
                  left: `${left}%`,
                  bottom: "-10px",
                  opacity,
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Content — left-aligned */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pb-28 pt-40 w-full">
        <div className="max-w-2xl space-y-6">
          {/* Client name */}
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: "#C9A84C", fontFamily: "'Lato', sans-serif" }}
          >
            {data.client.name}
          </p>

          {/* Gold rule */}
          <div style={{ width: 60, height: 1, background: "#C9A84C" }} />

          {/* Title */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl leading-[1.05]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, color: "#FFFFFF" }}
          >
            {hero.title}
          </h1>

          {/* Description */}
          {hero.description && (
            <p style={{ color: "rgba(232,228,220,0.7)", fontFamily: "'Lato', sans-serif", fontWeight: 300, fontSize: "1.1rem", lineHeight: 1.7, maxWidth: 520 }}>
              {hero.description}
            </p>
          )}

          {/* Date & Venue */}
          <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ color: "#C9A84C", fontFamily: "'Lato', sans-serif", fontSize: "0.85rem", fontWeight: 400 }}>
            {formattedDate && <span>{formattedDate}</span>}
            {hero.venueName && <span>{hero.venueName}</span>}
          </div>

          {/* CTA */}
          <div className="pt-2">
            <button
              onClick={() => {
                const t = document.getElementById("invitations") || document.getElementById("about");
                t?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] transition-all duration-300"
              style={{
                border: "1px solid #C9A84C",
                color: "#C9A84C",
                background: "transparent",
                fontFamily: "'Lato', sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#C9A84C"; e.currentTarget.style.color = "#0D0D14"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#C9A84C"; }}
            >
              Request Invitation
            </button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 animate-bounce" style={{ color: "rgba(201,168,76,0.4)" }}>
        <span className="text-[10px] uppercase tracking-[0.25em]" style={{ fontFamily: "'Lato', sans-serif" }}>Scroll</span>
        <ArrowDown className="h-4 w-4" />
      </div>
    </section>
  );
};
