import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { MapPin, ExternalLink } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";
const SLIDE_INTERVAL = 5000;

export const PublicVenueSection: React.FC<Props> = ({ data, className = "" }) => {
  const { venue } = data;
  const images = venue.images;
  const [activeIdx, setActiveIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveIdx(p => (p + 1) % images.length);
      setTransitioning(false);
    }, 600);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(goNext, SLIDE_INTERVAL);
    return () => clearInterval(iv);
  }, [goNext, images.length]);

  if (!venue.name && !venue.address && images.length === 0) return null;

  return (
    <MotionReveal id="venue" className={`max-w-5xl mx-auto px-6 sm:px-8 py-24 ${className}`}>
      <div className="flex items-center gap-4 mb-12">
        <h2 className="text-3xl md:text-4xl font-bold font-display tracking-tight">Venue</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Info side */}
          <div className="p-8 sm:p-10 flex flex-col justify-center space-y-5">
            {venue.name && (
              <h3 className="text-2xl font-bold font-display flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                {venue.name}
              </h3>
            )}
            {venue.address && <p className="text-muted-foreground leading-relaxed pl-[52px]">{venue.address}</p>}
            {venue.notes && <p className="text-sm text-muted-foreground leading-relaxed pl-[52px]">{venue.notes}</p>}
            {venue.mapLink && (
              <div className="pl-[52px]">
                <a
                  href={venue.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> Open in Maps
                </a>
              </div>
            )}
          </div>

          {/* Image slideshow side */}
          {images.length > 0 && (
            <div className="relative h-64 md:h-full min-h-[280px] overflow-hidden select-none">
              {images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={venue.name ?? "Venue"}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
                  style={{ opacity: i === activeIdx ? 1 : 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                />
              ))}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === activeIdx ? "bg-white scale-110" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MotionReveal>
  );
};
