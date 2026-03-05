import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface Props {
  data: PublicEventData;
  className?: string;
  parallax?: boolean;
}

const fallbackImg = "/placeholder.svg";

export const PublicHeroSection: React.FC<Props> = ({ data, className = "", parallax = false }) => {
  const { hero } = data;
  const bgImage = hero.images.length > 0 ? hero.images[0] : null;
  const formattedDate = hero.date ? format(new Date(hero.date), "EEEE, MMMM d, yyyy") : null;

  return (
    <section className={`relative overflow-hidden ${className}`}>
      {bgImage && (
        <div className="absolute inset-0" style={parallax ? { transform: "translateZ(0)" } : undefined}>
          <img
            src={bgImage}
            alt=""
            className={`w-full h-full object-cover ${parallax ? "scale-110" : ""}`}
            style={parallax ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: -1,
            } : undefined}
            onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        </div>
      )}
      <div className={`relative z-10 max-w-5xl mx-auto px-6 py-28 md:py-36 lg:py-44 ${bgImage ? "text-white" : ""}`}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display leading-[1.1] tracking-tight">
            {hero.title}
          </h1>
          {hero.description && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg md:text-xl lg:text-2xl opacity-85 max-w-2xl leading-relaxed"
            >
              {hero.description}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap gap-5 text-sm md:text-base pt-2"
          >
            {formattedDate && (
              <span className="flex items-center gap-2.5 opacity-80 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Calendar className="h-4 w-4" /> {formattedDate}
              </span>
            )}
            {hero.venueName && (
              <span className="flex items-center gap-2.5 opacity-80 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <MapPin className="h-4 w-4" /> {hero.venueName}
              </span>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
