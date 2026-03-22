import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Calendar, MapPin, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HeroAttendeeMarquee } from "./HeroAttendeeMarquee";

const AnimatedShaderBackground = lazy(() => import("@/components/ui/animated-shader-background"));

interface Props {
  data: PublicEventData;
  className?: string;
  parallax?: boolean;
}

const SLIDE_INTERVAL = 5000;
const fallbackImg = "/placeholder.svg";

function generateIcsContent(hero: PublicEventData["hero"], event: PublicEventData["event"]) {
  const d = new Date(hero.date!);
  const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = fmt(d);
  const end = fmt(new Date(d.getTime() + 86400000));
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TitanMeet//EN", "BEGIN:VEVENT",
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${hero.title}`, `DESCRIPTION:${event.description || ""}`,
    `LOCATION:${hero.venueName || ""}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(hero: PublicEventData["hero"], event: PublicEventData["event"]) {
  const blob = new Blob([generateIcsContent(hero, event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const CalendarPill: React.FC<{ label: string; onClick: () => void; hasImages: boolean }> = ({ label, onClick, hasImages }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors min-h-[36px] ${
      hasImages
        ? "border-white/15 bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 active:bg-white/25"
        : "border-border bg-card text-muted-foreground hover:bg-muted active:bg-muted/80"
    }`}
  >
    <Calendar className="h-3 w-3" />
    {label}
  </button>
);

function preloadImages(srcs: string[]): Promise<void> {
  if (!srcs.length) return Promise.resolve();
  return new Promise((resolve) => {
    let loaded = 0;
    const total = srcs.length;
    const done = () => { loaded++; if (loaded >= total) resolve(); };
    srcs.forEach((src) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
    setTimeout(resolve, 8000);
  });
}

export const PublicHeroSection: React.FC<Props> = ({ data, className = "", parallax = false }) => {
  const { hero } = data;
  const images = hero.images.length > 0 ? hero.images : [];
  const hasImages = images.length > 0;
  const formattedDate = hero.date ? format(new Date(hero.date), "EEEE, MMMM d, yyyy") : null;

  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    if (!images.length) { setImagesReady(true); return; }
    setImagesReady(false);
    preloadImages(images).then(() => setImagesReady(true));
  }, [images.join("|")]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setTransitioning(true);
    setPrevIdx(activeIdx);
    setActiveIdx((prev) => (prev + 1) % images.length);
  }, [activeIdx, images.length]);

  useEffect(() => {
    if (images.length <= 1 || !imagesReady) return;
    const iv = setInterval(goNext, SLIDE_INTERVAL);
    return () => clearInterval(iv);
  }, [goNext, images.length, imagesReady]);

  useEffect(() => {
    if (!transitioning) return;
    const t = setTimeout(() => setTransitioning(false), 1200);
    return () => clearTimeout(t);
  }, [transitioning]);

  return (
    <section className={`relative w-full overflow-hidden min-h-[100svh] ${className}`}>
      {/* Full-bleed slideshow background */}
      {hasImages ? (
        <div className="absolute inset-0">
          {!imagesReady && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted animate-pulse" />
          )}
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="eager"
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out ${
                imagesReady ? "" : "opacity-0"
              }`}
              style={{ opacity: imagesReady ? (i === activeIdx ? 1 : 0) : 0, transitionDuration: '1200ms' }}
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <AnimatedShaderBackground />
          </Suspense>
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center text-center min-h-[100svh] px-4 sm:px-8 py-16 sm:py-24 ${
          hasImages ? "text-white" : ""
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 sm:space-y-6 max-w-4xl w-full"
        >
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span
              className={`inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] px-3 sm:px-4 py-1.5 rounded-full border ${
                hasImages
                  ? "border-white/20 bg-white/10 backdrop-blur-md text-white/90"
                  : "border-primary/20 bg-primary/5 text-primary"
              }`}
            >
              {data.client.name}
            </span>
          </motion.div>

          {/* Title — responsive sizing */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold font-display leading-[1.08] tracking-tight">
            {hero.title}
          </h1>

          {/* Description */}
          {hero.description && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed ${
                hasImages ? "text-white/80" : "text-muted-foreground"
              }`}
            >
              {hero.description}
            </motion.p>
          )}

          {/* Date & Location pills — stack on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-3 pt-1"
          >
            {formattedDate && (
              <span
                className={`inline-flex items-center justify-center gap-2 text-sm font-medium px-4 sm:px-5 py-2.5 rounded-xl border min-h-[44px] ${
                  hasImages
                    ? "border-white/15 bg-white/10 backdrop-blur-md text-white/90"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <Calendar className="h-4 w-4 opacity-70 shrink-0" /> {formattedDate}
              </span>
            )}
            {hero.venueName && (
              <span
                className={`inline-flex items-center justify-center gap-2 text-sm font-medium px-4 sm:px-5 py-2.5 rounded-xl border min-h-[44px] ${
                  hasImages
                    ? "border-white/15 bg-white/10 backdrop-blur-md text-white/90"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <MapPin className="h-4 w-4 opacity-70 shrink-0" /> {hero.venueName}
              </span>
            )}
          </motion.div>

          {/* CTA Button — full width on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="pt-2"
          >
            <Button
              size="lg"
              onClick={() => {
                const target = document.getElementById("invitations") || document.getElementById("about");
                target?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`w-full sm:w-auto text-base px-8 py-6 rounded-xl font-semibold gap-2 min-h-[52px] ${
                hasImages
                  ? "bg-white text-black hover:bg-white/90 active:bg-white/80"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Register Now
              <ArrowDown className="h-4 w-4" />
            </Button>
          </motion.div>

          {/* Add to Calendar — wrap on mobile */}
          {hero.date && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="flex flex-wrap items-center justify-center gap-2 pt-1"
            >
              <span className={`text-xs font-medium ${hasImages ? "text-white/50" : "text-muted-foreground"}`}>Add to calendar:</span>
              <CalendarPill
                label="Google"
                onClick={() => {
                  const d = new Date(hero.date!);
                  const start = format(d, "yyyyMMdd");
                  const end = format(new Date(d.getTime() + 86400000), "yyyyMMdd");
                  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(hero.title)}&dates=${start}/${end}&details=${encodeURIComponent(data.event.description || "")}&location=${encodeURIComponent(hero.venueName || "")}`;
                  window.open(url, "_blank");
                }}
                hasImages={hasImages}
              />
              <CalendarPill
                label="Apple"
                onClick={() => downloadIcs(hero, data.event)}
                hasImages={hasImages}
              />
              <CalendarPill
                label="Outlook"
                onClick={() => downloadIcs(hero, data.event)}
                hasImages={hasImages}
              />
            </motion.div>
          )}
        </motion.div>

        {/* Attendee marquee bars */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="w-full max-w-5xl mt-8 sm:mt-10"
        >
          <HeroAttendeeMarquee data={data} variant={hasImages ? "glass" : "light"} />
        </motion.div>

        {/* Slide indicators */}
        {images.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex gap-2"
          >
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrevIdx(activeIdx);
                  setActiveIdx(i);
                  setTransitioning(true);
                }}
                className={`h-2 sm:h-1.5 rounded-full transition-all duration-500 min-w-[8px] ${
                  i === activeIdx
                    ? "w-8 bg-white/90"
                    : "w-2 sm:w-1.5 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </motion.div>
        )}

        {/* Scroll indicator — desktop only */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2"
        >
          <span
            className={`text-[10px] uppercase tracking-[0.25em] font-medium ${
              hasImages ? "text-white/40" : "text-muted-foreground/40"
            }`}
          >
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <ArrowDown className={`h-4 w-4 ${hasImages ? "text-white/30" : "text-muted-foreground/30"}`} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
