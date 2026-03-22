import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

const ROTATION_MS = 5000;

interface Props { data: PublicEventData; className?: string; }

export const PublicAnnouncementsSection: React.FC<Props> = ({ data, className = "" }) => {
  const items = data.announcements;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((dir: "next" | "prev") => {
    if (items.length <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setIdx(p => dir === "next" ? (p + 1) % items.length : (p - 1 + items.length) % items.length);
      setAnimating(false);
    }, 300);
  }, [items.length, animating]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const iv = setInterval(() => goTo("next"), ROTATION_MS);
    return () => clearInterval(iv);
  }, [items.length, paused, goTo]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];
  if (!current) return null;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="bg-primary/5 border-y border-primary/15">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          <div className="shrink-0 text-primary">
            <Megaphone className="h-4 w-4" />
          </div>

          <div
            className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${
              animating ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
            }`}
          >
            <p className="text-sm text-foreground line-clamp-2 sm:line-clamp-1">{current.text}</p>
          </div>

          {items.length > 1 && (
            <div className="shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => goTo("prev")}
                className="p-2 rounded hover:bg-foreground/5 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Previous announcement"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums min-w-[28px] text-center">
                {idx + 1}/{items.length}
              </span>
              <button
                onClick={() => goTo("next")}
                className="p-2 rounded hover:bg-foreground/5 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Next announcement"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
