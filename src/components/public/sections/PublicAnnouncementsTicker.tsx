import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  link_label: string | null;
  is_pinned: boolean;
}

const ROTATION_MS = 5000;

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: "bg-blue-500/5", border: "border-blue-500/20", icon: "text-blue-500" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "text-amber-500" },
  urgent: { bg: "bg-red-500/5", border: "border-red-500/20", icon: "text-red-500" },
  success: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: "text-emerald-500" },
};

interface Props {
  eventId: string;
  className?: string;
}

export const PublicAnnouncementsTicker: React.FC<Props> = ({ eventId, className = "" }) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("event_announcements" as any)
        .select("id, title, message, type, link_url, link_label, is_pinned")
        .eq("event_id", eventId)
        .eq("target", "public")
        .order("is_pinned", { ascending: false })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      setItems((data as any as Announcement[]) || []);
    };
    load();
  }, [eventId]);

  const goTo = useCallback((dir: "next" | "prev") => {
    if (items.length <= 1 || animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setActiveIdx(prev => dir === "next"
        ? (prev + 1) % items.length
        : (prev - 1 + items.length) % items.length
      );
      setAnimating(false);
    }, 300);
  }, [items.length, animating]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const iv = setInterval(() => goTo("next"), ROTATION_MS);
    return () => clearInterval(iv);
  }, [items.length, paused, goTo]);

  if (items.length === 0) return null;

  const current = items[activeIdx % items.length];
  if (!current) return null;
  const style = typeStyles[current.type] || typeStyles.info;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`${style.bg} ${style.border} border-y`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Icon */}
          <div className={`shrink-0 ${style.icon}`}>
            <Megaphone className="h-4 w-4" />
          </div>

          {/* Content */}
          <div
            className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${
              animating
                ? direction === "next"
                  ? "opacity-0 -translate-y-2"
                  : "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{current.title}</span>
              {current.is_pinned && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Pinned
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{current.message}</p>
          </div>

          {/* Link */}
          {current.link_url && (
            <a
              href={current.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              {current.link_label || "Learn more"}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Navigation */}
          {items.length > 1 && (
            <div className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => goTo("prev")}
                className="p-1 rounded hover:bg-foreground/5 transition-colors"
                aria-label="Previous announcement"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums min-w-[28px] text-center">
                {activeIdx + 1}/{items.length}
              </span>
              <button
                onClick={() => goTo("next")}
                className="p-1 rounded hover:bg-foreground/5 transition-colors"
                aria-label="Next announcement"
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
