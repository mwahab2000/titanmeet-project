import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";
import { PublicLightbox } from "./PublicLightbox";

interface Props {
  data: PublicEventData;
  className?: string;
}

export const PublicGallerySection: React.FC<Props> = ({ data, className = "" }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!data.gallery || data.gallery.length === 0) return null;

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  return (
    <>
      <MotionReveal as="section" id="gallery" className={`py-16 sm:py-20 ${className}`}>
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8 text-center">Gallery</h2>

          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {data.gallery.map((url, i) => (
              <MotionRevealItem key={i} index={i}>
                <button
                  onClick={() => openLightbox(i)}
                  className="w-full rounded-lg overflow-hidden block group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img
                    src={url}
                    alt={`Gallery image ${i + 1}`}
                    className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              </MotionRevealItem>
            ))}
          </div>
        </div>
      </MotionReveal>

      <PublicLightbox
        images={data.gallery}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};
