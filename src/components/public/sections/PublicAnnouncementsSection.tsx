import type { PublicEventData } from "@/lib/publicSite/types";
import { Megaphone } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicAnnouncementsSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.announcements.length === 0) return null;
  return (
    <MotionReveal className={`max-w-5xl mx-auto px-6 sm:px-8 py-8 ${className}`} variant="scale">
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-6 sm:p-8 space-y-4 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Announcements</span>
        </div>
        {data.announcements.map((a) => (
          <div key={a.id} className="flex items-start gap-3 text-sm leading-relaxed pl-[42px]">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
            <p>{a.text}</p>
          </div>
        ))}
      </div>
    </MotionReveal>
  );
};
