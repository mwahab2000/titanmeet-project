import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { format } from "date-fns";

interface Props { data: PublicEventData; }

export const FestivalHero: React.FC<Props> = ({ data }) => {
  const { hero } = data;
  const images = hero.images;
  const hasImages = images.length > 0;
  const formattedDate = hero.date ? format(new Date(hero.date), "MMM d, yyyy") : null;

  const words = hero.title.split(" ");
  const accentWord = words[0];
  const rest = words.slice(1).join(" ");

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden flex items-center" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)" }}>
      {/* Floating blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full" style={{ background: "#A855F7", filter: "blur(100px)", opacity: 0.4 }} />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full" style={{ background: "#EC4899", filter: "blur(90px)", opacity: 0.35 }} />
        <div className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full" style={{ background: "#FACC15", filter: "blur(80px)", opacity: 0.25 }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-32 w-full">
        <div className="max-w-3xl">
          {/* Date pill */}
          {formattedDate && (
            <span className="inline-block mb-6 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontFamily: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif" }}>
              {formattedDate}
            </span>
          )}

          {/* Title — massive, overflow allowed */}
          <div style={{ overflow: "visible" }}>
            <h1 style={{
              fontFamily: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(3.5rem, 10vw, 7rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: "#FFFFFF",
            }}>
              <span style={{ color: "#FDE047", display: "inline-block", textDecoration: "underline", textDecorationThickness: "0.06em", textUnderlineOffset: "0.1em", textDecorationColor: "#FDE047" }}>
                {accentWord}
              </span>
              {" "}{rest}
            </h1>
          </div>

          {hero.description && (
            <p className="mt-6" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: "1.15rem", lineHeight: 1.6, maxWidth: 480 }}>
              {hero.description}
            </p>
          )}

          {hero.venueName && (
            <p className="mt-3" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: "0.9rem" }}>
              📍 {hero.venueName}
            </p>
          )}

          {/* CTA */}
          <div className="mt-8">
            <button
              onClick={() => { const t = document.getElementById("invitations") || document.getElementById("about"); t?.scrollIntoView({ behavior: "smooth" }); }}
              className="px-10 py-4 text-sm font-bold uppercase tracking-[0.1em] transition-all duration-200 hover:shadow-2xl hover:scale-105"
              style={{ background: "#FFFFFF", color: "#0A0A0A", fontFamily: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif", borderRadius: 0 }}
            >
              Get Tickets →
            </button>
          </div>
        </div>
      </div>

      {/* Hero image collage */}
      {hasImages && (
        <div className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
          {images.slice(0, 3).map((src, i) => {
            const rotations = [3, -2, 1.5];
            const offsets = [{ top: -40, right: 0 }, { top: 30, right: 60 }, { top: -10, right: 120 }];
            return (
              <img
                key={src}
                src={src}
                alt=""
                className="absolute shadow-2xl border-4 border-white"
                style={{
                  width: 220,
                  height: 280,
                  objectFit: "cover",
                  transform: `rotate(${rotations[i]}deg)`,
                  top: offsets[i].top,
                  right: offsets[i].right,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
