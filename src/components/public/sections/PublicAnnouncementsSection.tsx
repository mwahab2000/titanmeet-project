import type { PublicEventData } from "@/lib/publicSite/types";
import { Megaphone } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicAnnouncementsSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.announcements.length === 0) return null;
  return (
    <MotionReveal className={`max-w-4xl mx-auto px-6 py-8 ${className}`} variant="scale">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        {data.announcements.map((a) => (
          <div key={a.id} className="flex items-start gap-3 text-sm">
            <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p>{a.text}</p>
          </div>
        ))}
      </div>
    </MotionReveal>
  );
};
