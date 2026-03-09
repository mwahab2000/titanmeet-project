import type { PublicEventData } from "@/lib/publicSite/types";
import maleAvatar from "@/assets/avatar-male.png";
import femaleAvatar from "@/assets/avatar-female.png";

interface Props { data: PublicEventData; }

const ROTATIONS = [2, -1.5, 1, -2.5, 1.8];

export const FestivalSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;
  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";

  return (
    <section id="speakers" className="py-20 sm:py-28" style={{ background: "#FDE047" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10">
        <h2 className="mb-14 text-center" style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "#0A0A0A", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
          The Lineup
        </h2>

        <style>{`
          .fest-polaroid { transition: all 0.3s ease; }
          .fest-polaroid:hover { transform: rotate(0deg) scale(1.05) !important; box-shadow: 0 20px 40px rgba(124,58,237,0.25) !important; }
        `}</style>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {data.speakers.map((speaker, i) => {
            const fallback = speaker.gender === "female" ? femaleAvatar : maleAvatar;
            const rot = ROTATIONS[i % ROTATIONS.length];
            return (
              <div
                key={speaker.id}
                className="fest-polaroid p-3 pb-4"
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #0A0A0A",
                  transform: `rotate(${rot}deg)`,
                  boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ aspectRatio: "4/5", overflow: "hidden" }}>
                  <img src={speaker.photoUrl || fallback} alt={speaker.name} className="w-full h-full object-cover" />
                </div>
                <div className="mt-3 text-center">
                  <h3 style={{ fontFamily: font, fontWeight: 800, fontSize: "0.95rem", color: "#0A0A0A" }}>
                    {speaker.name}
                  </h3>
                  {speaker.title && (
                    <p style={{ fontFamily: font, fontSize: "0.75rem", fontWeight: 400, color: "rgba(0,0,0,0.5)", marginTop: 2 }}>
                      {speaker.title}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
