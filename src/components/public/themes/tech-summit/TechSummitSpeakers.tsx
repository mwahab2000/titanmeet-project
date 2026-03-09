import type { PublicEventData } from "@/lib/publicSite/types";
import maleAvatar from "@/assets/avatar-male.png";
import femaleAvatar from "@/assets/avatar-female.png";

interface Props { data: PublicEventData; }

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export const TechSummitSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;

  return (
    <section id="speakers" className="py-20 sm:py-28" style={{ background: "#111827" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl mb-14 text-center" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#E2E8F0" }}>
          <span style={{ color: "#00D4FF" }}>// </span>Speakers
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12">
          {data.speakers.map((speaker) => {
            const fallback = speaker.gender === "female" ? femaleAvatar : maleAvatar;
            return (
              <div key={speaker.id} className="flex flex-col items-center text-center group">
                {/* Hexagonal photo */}
                <div
                  className="w-32 h-36 mb-5 transition-shadow duration-300 group-hover:shadow-[0_0_30px_rgba(0,212,255,0.25)]"
                  style={{ clipPath: HEX_CLIP, background: "rgba(0,212,255,0.1)" }}
                >
                  <img
                    src={speaker.photoUrl || fallback}
                    alt={speaker.name}
                    className="w-full h-full object-cover"
                    style={{ clipPath: HEX_CLIP }}
                  />
                </div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: "#FFFFFF", fontSize: "1rem" }}>
                  {speaker.name}
                </h3>
                {speaker.title && (
                  <p className="mt-1" style={{ color: "#00D4FF", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", fontWeight: 400 }}>
                    {speaker.title}
                  </p>
                )}
                {speaker.bio && (
                  <p className="mt-2" style={{ color: "rgba(226,232,240,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", lineHeight: 1.6, maxWidth: 260 }}>
                    {speaker.bio}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
