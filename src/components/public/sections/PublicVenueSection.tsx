import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { MapPin, ExternalLink, Maximize2 } from "lucide-react";
import { MotionReveal } from "./MotionReveal";
import { PublicLightbox } from "./PublicLightbox";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicVenueSection: React.FC<Props> = ({ data, className = "" }) => {
  const { venue } = data;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!venue.name && !venue.address && venue.images.length === 0) return null;

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

          {/* Image side */}
          {venue.images.length > 0 && (
            <div className="relative">
              <div
                className="group cursor-pointer h-64 md:h-full min-h-[280px]"
                onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
              >
                <img
                  src={venue.images[0]}
                  alt={venue.name ?? "Venue"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 flex items-center justify-center">
                  <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-80 transition-opacity duration-300 drop-shadow-lg" />
                </div>
              </div>
              {venue.images.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  {venue.images.slice(1, 4).map((img, i) => (
                    <div
                      key={i}
                      className="w-14 h-14 rounded-lg overflow-hidden border-2 border-white/80 shadow-md cursor-pointer hover:scale-110 transition-transform"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i + 1); setLightboxOpen(true); }}
                    >
                      <img src={img} alt={`Venue ${i + 2}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <PublicLightbox images={venue.images} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </MotionReveal>
  );
};
