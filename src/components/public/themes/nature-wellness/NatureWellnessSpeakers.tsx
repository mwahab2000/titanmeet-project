import type { PublicEventData } from "@/lib/publicSite/types";
import maleAvatar from "@/assets/avatar-male.png";
import femaleAvatar from "@/assets/avatar-female.png";

interface Props { data: PublicEventData; }

export const NatureWellnessSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;

  return (
    <section id="speakers" className="py-20 sm:py-28" style={{ background: "#E8F0E4" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <h2 className="text-center mb-14" style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1C2B1A" }}>
          Our Speakers
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {data.speakers.map((speaker, i) => {
            const fallback = speaker.gender === "female" ? femaleAvatar : maleAvatar;
            return (
              <div key={speaker.id} className="flex flex-col items-center text-center" style={{ marginTop: i % 2 !== 0 ? 32 : 0 }}>
                {/* Photo with leaf ring */}
                <div className="relative mb-5">
                  <div className="w-28 h-28 rounded-full overflow-hidden" style={{ border: "3px solid #C8D8C0" }}>
                    <img src={speaker.photoUrl || fallback} alt={speaker.name} className="w-full h-full object-cover" />
                  </div>
                  {/* Leaf decorations */}
                  <svg className="absolute -top-2 -right-1" width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 0C6 4 2 6 0 9C4 7 7 6 9 4C11 6 14 7 18 9C16 6 12 4 9 0Z" fill="#8BB07A" opacity="0.6" />
                  </svg>
                  <svg className="absolute -bottom-1 -left-2" width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M9 0C6 4 2 6 0 9C4 7 7 6 9 4C11 6 14 7 18 9C16 6 12 4 9 0Z" fill="#8BB07A" opacity="0.4" />
                  </svg>
                </div>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, color: "#1C2B1A", fontSize: "1rem" }}>
                  {speaker.name}
                </h3>
                {speaker.title && (
                  <p className="mt-0.5" style={{ color: "#C1784F", fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", fontWeight: 400 }}>
                    {speaker.title}
                  </p>
                )}
                {speaker.bio && (
                  <p className="mt-2" style={{ color: "rgba(28,43,26,0.55)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", lineHeight: 1.6, maxWidth: 240 }}>
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
