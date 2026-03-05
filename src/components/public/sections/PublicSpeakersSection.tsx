import type { PublicEventData } from "@/lib/publicSite/types";
import { Linkedin } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const fallback = "/placeholder.svg";

export const PublicSpeakersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.speakers.length === 0) return null;
  return (
    <MotionReveal id="speakers" className={`max-w-5xl mx-auto px-6 py-20 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold font-display mb-10 tracking-tight">Speakers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.speakers.map((s, i) => (
          <MotionRevealItem
            key={s.id}
            index={i}
            className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
          >
            <div className="relative mx-auto w-28 h-28">
              <img
                src={s.photoUrl || fallback}
                alt={s.name}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-primary/10 group-hover:ring-primary/25 transition-all duration-300"
                onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{s.name}</h3>
              {s.title && <p className="text-sm text-primary font-medium mt-1">{s.title}</p>}
            </div>
            {s.bio && <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{s.bio}</p>}
            {s.linkedinUrl && (
              <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline font-medium">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
            )}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
