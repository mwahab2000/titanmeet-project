import { motion, useReducedMotion } from "framer-motion";

/**
 * SVG wavy road that runs horizontally across the How It Works section.
 * Desktop: horizontal snake. Mobile: hidden (vertical timeline used instead).
 */
export const HowItWorksRoad: React.FC<{ isInView: boolean }> = ({ isInView }) => {
  // Road dimensions – designed for a 1200px-wide container, viewBox scales it
  const W = 1200;
  const H = 200;
  const midY = H / 2;
  const amp = 70; // wave amplitude
  const roadW = 54; // road thickness

  // Build a sine-ish wave with 3 full periods (6 half-periods = 6 steps)
  // x positions for steps at each peak/valley
  const stepCount = 6;
  const pad = 100;
  const span = W - pad * 2;
  const segW = span / stepCount;

  // Build road center path using cubic beziers for smooth S-curves
  let centerPath = `M ${pad} ${midY}`;
  for (let i = 0; i < stepCount; i++) {
    const x0 = pad + i * segW;
    const x1 = pad + (i + 1) * segW;
    const cpx0 = x0 + segW * 0.5;
    const cpx1 = x1 - segW * 0.5;
    const direction = i % 2 === 0 ? -1 : 1; // 0,2,4 go up; 1,3,5 go down
    const peakY = midY + direction * amp;
    const nextDir = (i + 1) % 2 === 0 ? -1 : 1;
    const nextY = i < stepCount - 1 ? midY + nextDir * amp : midY;
    // For the last segment, end at midY
    if (i === stepCount - 1) {
      centerPath += ` C ${cpx0} ${peakY}, ${cpx1} ${peakY}, ${x1} ${midY}`;
    } else {
      centerPath += ` C ${cpx0} ${peakY}, ${cpx1} ${peakY}, ${x1} ${midY}`;
    }
  }

  // Actually, let me redo this properly. We want peaks at step positions.
  // Step positions: evenly spaced. Steps 1,3,5 are peaks (up), steps 2,4,6 are valleys (down).
  // The road passes through each step's x-position at the peak/valley y.

  const stepXs = Array.from({ length: 6 }, (_, i) => pad + segW * 0.5 + i * segW);
  const stepYs = stepXs.map((_, i) => (i % 2 === 0 ? midY - amp : midY + amp));

  // Build path: start from left edge, curve through each step point, end at right edge
  let roadPath = `M ${pad - 20} ${midY}`;
  // Curve to first step
  roadPath += ` Q ${stepXs[0] - segW * 0.3} ${stepYs[0]}, ${stepXs[0]} ${stepYs[0]}`;
  // Between steps
  for (let i = 0; i < 5; i++) {
    const mx = (stepXs[i] + stepXs[i + 1]) / 2;
    roadPath += ` Q ${(stepXs[i] + mx) / 2} ${stepYs[i]}, ${mx} ${midY}`;
    roadPath += ` Q ${(mx + stepXs[i + 1]) / 2} ${stepYs[i + 1]}, ${stepXs[i + 1]} ${stepYs[i + 1]}`;
  }
  // End
  roadPath += ` Q ${stepXs[5] + segW * 0.3} ${stepYs[5]}, ${W - pad + 20} ${midY}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ zIndex: 0 }}
    >
      <defs>
        {/* Road edge glow */}
        <linearGradient id="road-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(145, 63%, 42%)" stopOpacity="0.15" />
          <stop offset="50%" stopColor="hsl(210, 70%, 50%)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(145, 63%, 42%)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="road-dash-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(145, 63%, 50%)" stopOpacity="0.3" />
          <stop offset="50%" stopColor="hsl(210, 70%, 60%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(145, 63%, 50%)" stopOpacity="0.3" />
        </linearGradient>
        <filter id="road-glow-filter">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Road body – outer glow */}
      <path
        d={roadPath}
        fill="none"
        stroke="url(#road-glow)"
        strokeWidth={roadW + 12}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#road-glow-filter)"
        opacity={0.5}
      />

      {/* Road body – dark fill */}
      <path
        d={roadPath}
        fill="none"
        stroke="hsl(220, 30%, 10%)"
        strokeWidth={roadW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Road border – subtle lighter outline */}
      <path
        d={roadPath}
        fill="none"
        stroke="hsl(215, 25%, 18%)"
        strokeWidth={roadW + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
        style={{ mixBlendMode: "screen" }}
      />

      {/* Re-draw road body on top of border */}
      <path
        d={roadPath}
        fill="none"
        stroke="hsl(220, 30%, 10%)"
        strokeWidth={roadW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center dashed line – animated */}
      <motion.path
        d={roadPath}
        fill="none"
        stroke="url(#road-dash-grad)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="12 10"
        initial={{ strokeDashoffset: 300 }}
        animate={isInView ? { strokeDashoffset: 0 } : { strokeDashoffset: 300 }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
      />
    </svg>
  );
};
