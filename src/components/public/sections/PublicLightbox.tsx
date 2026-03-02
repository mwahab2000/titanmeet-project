import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export const PublicLightbox: React.FC<Props> = ({ images, initialIndex = 0, open, onClose }) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  const prev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, prev, next]);

  if (!open || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10">
        <X className="h-8 w-8" />
      </button>

      <div className="relative w-full max-w-5xl mx-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[index]}
          alt={`Image ${index + 1}`}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />

        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors">
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
