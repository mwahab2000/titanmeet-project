import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
      delay: i * 0.1,
    },
  }),
};

const scaleUpVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "footer";
  id?: string;
  style?: React.CSSProperties;
  variant?: "slide" | "scale";
  once?: boolean;
  amount?: number;
}

export const MotionReveal: React.FC<RevealProps> = ({
  children,
  className,
  as = "section",
  id,
  style,
  variant = "slide",
  once = true,
  amount = 0.15,
}) => {
  const Component = motion[as];
  const variants = variant === "scale" ? scaleUpVariants : sectionVariants;

  return (
    <Component
      id={id}
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
    >
      {children}
    </Component>
  );
};

interface RevealItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
  as?: "div" | "a" | "span";
}

export const MotionRevealItem: React.FC<RevealItemProps> = ({
  children,
  className,
  index = 0,
  as = "div",
}) => {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={itemVariants}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {children}
    </Component>
  );
};
