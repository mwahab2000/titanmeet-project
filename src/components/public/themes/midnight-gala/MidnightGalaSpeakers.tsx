import type { PublicEventData } from "@/lib/publicSite/types";
import maleAvatar from "@/assets/avatar-male.png";
import femaleAvatar from "@/assets/avatar-female.png";

interface Props { data: PublicEventData; }

export const MidnightGalaSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;

  return (
    <section id="speakers" className="py-20 sm:py-28" style={{ background: "#111118" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10">
        {/* Heading with gold rules */}
        <div className="flex items-center justify-center gap-5 mb-16">
          <div className="flex-1 max-w-[80px] h-px" style={{ background: "rgba(201,168,76,0.4)" }} />
          <h2
            className="text-4xl sm:text-5xl text-center"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, color: "#E8E4DC" }}
          >
            Distinguished Speakers
          </h2>
          <div className="flex-1 max-w-[80px] h-px" style={{ background: "rgba(201,168,76,0.4)" }} />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {data.speakers.map((speaker) => {
            const fallback = speaker.gender === "female" ? femaleAvatar : maleAvatar;
            return (
              <div
                key={speaker.id}
                className="group relative overflow-hidden transition-all duration-300"
                style={{ aspectRatio: "3/4", border: "1px solid transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#C9A84C"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"; }}
              >
                <img
                  src={speaker.photoUrl || fallback}
                  alt={speaker.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(0deg, rgba(13,13,20,0.95) 0%, transparent 60%)" }}
                />
                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-5 space-y-1">
                  <h3
                    className="text-lg leading-tight"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, color: "#FFFFFF" }}
                  >
                    {speaker.name}
                  </h3>
                  {speaker.title && (
                    <p style={{ color: "#C9A84C", fontFamily: "'Lato', sans-serif", fontSize: "0.75rem", fontWeight: 400 }}>
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
