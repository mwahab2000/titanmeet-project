import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Shirt, Maximize2 } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";
import { PublicLightbox } from "./PublicLightbox";

interface Props { data: PublicEventData; className?: string; }

const DRESS_TYPE_LABELS: Record<string, string> = {
  formal: "Formal",
  semi_formal: "Semi-Formal",
  business_formal: "Business Formal",
  business_casual: "Business Casual",
  smart_casual: "Smart Casual",
};

const fallback = "/placeholder.svg";

export const PublicDressCodeSection: React.FC<Props> = ({ data, className = "" }) => {
  const { dressCode } = data;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  if (!dressCode || dressCode.length === 0) return null;

  const multiDay = dressCode.length > 1;

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <MotionReveal id="dress-code" className={`max-w-4xl mx-auto px-6 py-16 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-8 flex items-center gap-3">
        <Shirt className="h-7 w-7 text-primary" />
        Dress Code
      </h2>

      <div className={`grid gap-6 ${multiDay ? "md:grid-cols-2" : ""}`}>
        {dressCode.map((dc, i) => (
          <MotionRevealItem key={i} index={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
            {multiDay && (
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                Day {dc.dayNumber}
              </span>
            )}

            <div>
              <h3 className="text-lg font-semibold">{DRESS_TYPE_LABELS[dc.dressType] ?? dc.dressType}</h3>
            </div>

            {dc.customInstructions && (
              <p className="text-sm text-muted-foreground leading-relaxed">{dc.customInstructions}</p>
            )}

            {dc.referenceImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {dc.referenceImages.map((img, j) => (
                  <div
                    key={j}
                    className="relative group cursor-pointer rounded-lg overflow-hidden"
                    onClick={() => openLightbox(dc.referenceImages, j)}
                  >
                    <img
                      src={img}
                      alt={`Dress code reference ${j + 1}`}
                      className="w-full h-24 object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </MotionRevealItem>
        ))}
      </div>

      <PublicLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </MotionReveal>
  );
};
