import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Shirt, Maximize2 } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";
import { PublicLightbox } from "./PublicLightbox";

interface Props { data: PublicEventData; className?: string; }

const DRESS_TYPE_LABELS: Record<string, string> = {
  formal: "Formal", semi_formal: "Semi-Formal", business_formal: "Business Formal",
  business_casual: "Business Casual", smart_casual: "Smart Casual",
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
    setLightboxImages(images); setLightboxIndex(index); setLightboxOpen(true);
  };

  return (
    <MotionReveal id="dress-code" className={`max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4 mb-8 sm:mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shirt className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tracking-tight">Dress Code</h2>
        </div>
        <div className="flex-1 h-px bg-border hidden sm:block" />
      </div>

      <div className={`grid gap-4 sm:gap-5 ${multiDay ? "sm:grid-cols-2" : ""}`}>
        {dressCode.map((dc, i) => (
          <MotionRevealItem key={i} index={i} className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-3 sm:space-y-4 hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
            {multiDay && (
              <span className="inline-flex text-xs font-bold uppercase tracking-[0.15em] text-primary bg-primary/8 border border-primary/15 px-3 py-1 rounded-full">
                Day {dc.dayNumber}
              </span>
            )}
            <h3 className="text-base sm:text-lg font-bold font-display">{DRESS_TYPE_LABELS[dc.dressType] ?? dc.dressType}</h3>
            {dc.customInstructions && <p className="text-sm text-muted-foreground leading-relaxed">{dc.customInstructions}</p>}
            {dc.referenceImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {dc.referenceImages.map((img, j) => (
                  <div key={j} className="relative group cursor-pointer rounded-xl overflow-hidden" onClick={() => openLightbox(dc.referenceImages, j)}>
                    <img src={img} alt={`Dress code ${j + 1}`} className="w-full h-20 sm:h-24 object-cover transition-transform duration-300 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
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
