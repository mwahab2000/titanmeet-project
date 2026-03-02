import type { PublicEventData } from "@/lib/publicSite/types";
import { Linkedin } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicSpeakersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.speakers.length === 0) return null;
  return (
    <MotionReveal id="speakers" className={`max-w-5xl mx-auto px-6 py-16 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-8">Speakers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.speakers.map((s, i) => (
          <MotionRevealItem key={s.id} index={i} className="rounded-xl border border-border bg-card p-5 text-center space-y-3 hover-scale">
            <img
              src={s.photoUrl || fallback}
              alt={s.name}
              className="w-24 h-24 rounded-full object-cover mx-auto"
              onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
            />
            <h3 className="font-semibold text-lg">{s.name}</h3>
            {s.title && <p className="text-sm text-muted-foreground">{s.title}</p>}
            {s.bio && <p className="text-sm text-muted-foreground line-clamp-3">{s.bio}</p>}
            {s.linkedinUrl && (
              <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-sm hover:underline">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
            )}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
