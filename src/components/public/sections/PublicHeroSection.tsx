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
  const formattedDate = hero.date ? format(new Date(hero.date), "MMMM d, yyyy") : null;

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
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>
      )}
      <div className={`relative z-10 max-w-5xl mx-auto px-6 py-24 md:py-32 ${bgImage ? "text-white" : ""}`}>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight"
        >
          {hero.title}
        </motion.h1>
        {hero.description && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-4 text-lg md:text-xl opacity-90 max-w-2xl"
          >
            {hero.description}
          </motion.p>
        )}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-wrap gap-4 mt-6 text-sm md:text-base"
        >
          {formattedDate && (
            <span className="flex items-center gap-2 opacity-80">
              <Calendar className="h-4 w-4" /> {formattedDate}
            </span>
          )}
          {hero.venueName && (
            <span className="flex items-center gap-2 opacity-80">
              <MapPin className="h-4 w-4" /> {hero.venueName}
            </span>
          )}
        </motion.div>
      </div>
    </section>
  );
};
