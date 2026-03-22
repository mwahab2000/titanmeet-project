import { motion } from "framer-motion";

interface TypingIndicatorProps {
  /** Visible or not */
  visible?: boolean;
  className?: string;
}

const dotVariants = {
  initial: { y: 0 },
  animate: (i: number) => ({
    y: [0, -4, 0],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      repeatDelay: 0.6,
      delay: i * 0.15,
      ease: "easeInOut" as const,
    },
  }),
};

export const TypingIndicator = ({ visible = true, className = "" }: TypingIndicatorProps) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.25 }}
      className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[hsl(var(--landing-fg)/0.05)] border border-[hsl(var(--landing-border)/0.2)] ${className}`}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          custom={i}
          variants={dotVariants}
          initial="initial"
          animate="animate"
          className="block h-1.5 w-1.5 rounded-full bg-[hsl(var(--titan-green)/0.6)]"
        />
      ))}
    </motion.div>
  );
};
