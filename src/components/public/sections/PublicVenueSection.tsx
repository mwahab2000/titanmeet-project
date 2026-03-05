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
    <MotionReveal id="venue" className={`max-w-4xl mx-auto px-6 py-20 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold font-display mb-10 tracking-tight">Venue</h2>
      <div className="grid md:grid-cols-2 gap-10">
        <div className="space-y-4">
          {venue.name && (
            <h3 className="text-xl font-semibold flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-primary" />{venue.name}
            </h3>
          )}
          {venue.address && <p className="text-muted-foreground leading-relaxed">{venue.address}</p>}
          {venue.notes && <p className="text-sm text-muted-foreground leading-relaxed">{venue.notes}</p>}
          {venue.mapLink && (
            <a
              href={venue.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline font-medium mt-2"
            >
              <ExternalLink className="h-4 w-4" /> View on Map
            </a>
          )}
        </div>
        {venue.images.length > 0 && (
          <div className="space-y-3">
            <div
              className="relative group cursor-pointer rounded-2xl overflow-hidden"
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
            >
              <img
                src={venue.images[0]}
                alt={venue.name ?? "Venue"}
                className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Maximize2 className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
            {venue.images.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {venue.images.slice(1, 4).map((img, i) => (
                  <div
                    key={i}
                    className="relative group cursor-pointer rounded-xl overflow-hidden"
                    onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true); }}
                  >
                    <img
                      src={img}
                      alt={`Venue ${i + 2}`}
                      className="w-full h-24 object-cover transition-transform duration-400 group-hover:scale-110"
                      onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <PublicLightbox images={venue.images} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </MotionReveal>
  );
};
