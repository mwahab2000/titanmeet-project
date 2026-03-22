import type { PublicEventData } from "@/lib/publicSite/types";
import { Linkedin } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";
import avatarMale from "@/assets/avatar-male.png";
import avatarFemale from "@/assets/avatar-female.png";

interface Props { data: PublicEventData; className?: string; }

function getDefaultAvatar(gender: string) {
  return gender === "female" ? avatarFemale : avatarMale;
}

export const PublicSpeakersSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.speakers.length === 0) return null;
  return (
    <MotionReveal id="speakers" className={`max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4 mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tracking-tight">Speakers</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {data.speakers.map((s, i) => (
          <MotionRevealItem
            key={s.id}
            index={i}
            className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-elevated)] hover:border-primary/15 transition-all duration-300"
          >
            <div className="p-5 sm:p-7 flex flex-col items-center text-center space-y-3 sm:space-y-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ring-2 ring-border group-hover:ring-primary/20 transition-all duration-300 rotate-3 group-hover:rotate-0">
                  <img
                    src={s.photoUrl || getDefaultAvatar(s.gender)}
                    alt={s.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = getDefaultAvatar(s.gender); }}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="space-y-1">
                <h3 className="font-bold text-base sm:text-lg font-display leading-tight">{s.name}</h3>
                {s.title && <p className="text-sm text-primary font-medium">{s.title}</p>}
              </div>

              {/* Bio */}
              {s.bio && (
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{s.bio}</p>
              )}

              {/* LinkedIn */}
              {s.linkedinUrl && (
                <a
                  href={s.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary font-medium transition-colors min-h-[44px]"
                >
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              )}
            </div>
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};
