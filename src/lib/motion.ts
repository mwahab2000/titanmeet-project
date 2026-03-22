import type { Variants, Transition } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Reusable Framer Motion variants for TitanMeet                      */
/* ------------------------------------------------------------------ */

/** Fade-in with optional upward slide */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** Stagger children — use on a parent container */
export const staggerContainer = (staggerDelay = 0.1): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: staggerDelay },
  },
});

/** Scale-in for cards / images */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** Blur-fade reveal — great for hero images */
export const blurFadeIn: Variants = {
  hidden: { opacity: 0, filter: "blur(12px)", scale: 0.97 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

/** Slide from left / right */
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

/** Reduced-motion-safe wrapper: returns instant transitions */
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

/** Spring transition preset */
export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24,
};
