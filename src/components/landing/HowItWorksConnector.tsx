import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";

interface ConnectorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  iconRefs: React.RefObject<(HTMLElement | null)[]>;
  isInView: boolean;
}

export const HowItWorksConnector: React.FC<ConnectorProps> = ({
  containerRef,
  iconRefs,
  isInView,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathData, setPathData] = useState("");
  const [nodes, setNodes] = useState<{ x: number; y: number }[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [cols, setCols] = useState(3);
  const [pathLength, setPathLength] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const icons = iconRefs.current;
    if (!container || !icons) return;

    const rect = container.getBoundingClientRect();
    setDims({ w: rect.width, h: rect.height });

    const centers: { x: number; y: number }[] = [];
    for (const el of icons) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      centers.push({
        x: r.left + r.width / 2 - rect.left,
        y: r.top + r.height / 2 - rect.top,
      });
    }
    if (centers.length < 2) return;
    setNodes(centers);

    // Detect column count from positions
    const uniqueXs = new Set(centers.map((c) => Math.round(c.x / 20)));
    const detectedCols = uniqueXs.size;
    setCols(detectedCols);

    let d = "";
    if (detectedCols >= 3) {
      // With reversed row 2, visual positions match DOM ref order:
      // centers[0]=step1(left), [1]=step2(mid), [2]=step3(right)
      // centers[3]=step4(right), [4]=step5(mid), [5]=step6(left)
      // Snake: 1→2→3 → drop down → 4→5→6 (which visually goes right→left)

      d = `M ${centers[0].x} ${centers[0].y}`;

      // Segment A: 1→2→3 (left to right)
      for (let i = 1; i <= 2; i++) {
        const prev = centers[i - 1];
        const curr = centers[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
      }

      // Segment B: drop from step 3 → step 4 (both on right side)
      const downStart = centers[2];
      const downEnd = centers[3];
      const midY = (downStart.y + downEnd.y) / 2;
      d += ` C ${downStart.x + 40} ${midY}, ${downEnd.x + 40} ${midY}, ${downEnd.x} ${downEnd.y}`;

      // Segment C: 4→5→6 (visually right to left)
      for (let i = 4; i <= 5; i++) {
        const prev = centers[i - 1];
        const curr = centers[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
      }
    } else {
      // Vertical / 2-col: simple smooth vertical path through all centers in order
      d = `M ${centers[0].x} ${centers[0].y}`;
      for (let i = 1; i < centers.length; i++) {
        const prev = centers[i - 1];
        const curr = centers[i];
        const midY = (prev.y + curr.y) / 2;
        d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
      }
    }

    setPathData(d);
  }, [containerRef, iconRefs]);

  useEffect(() => {
    // Initial + debounced resize
    const timer = setTimeout(measure, 100);
    const handleResize = () => {
      requestAnimationFrame(measure);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [measure]);

  // Measure path length once path renders
  useEffect(() => {
    if (pathRef.current && pathData) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [pathData]);

  if (!pathData || dims.w === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={dims.w}
      height={dims.h}
      style={{ zIndex: 0 }}
    >
      <defs>
        <linearGradient id="snake-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--titan-green))" stopOpacity="0.35" />
          <stop offset="50%" stopColor="hsl(210, 80%, 55%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--titan-green))" stopOpacity="0.35" />
        </linearGradient>
        <filter id="snake-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Animated snake path */}
      {pathLength > 0 && (
        <motion.path
          ref={pathRef as any}
          d={pathData}
          fill="none"
          stroke="url(#snake-gradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          filter="url(#snake-glow)"
          initial={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }}
          animate={
            isInView
              ? { strokeDashoffset: 0 }
              : { strokeDashoffset: pathLength }
          }
          transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
        />
      )}

      {/* Pre-render invisible path for measurement */}
      {pathLength === 0 && (
        <path
          ref={pathRef}
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth={0}
        />
      )}

      {/* Node dots at each step */}
      {nodes.map((node, i) => (
        <motion.circle
          key={i}
          cx={node.x}
          cy={node.y}
          r={4}
          fill="hsl(var(--titan-green))"
          fillOpacity={0}
          initial={{ fillOpacity: 0, scale: 0 }}
          animate={
            isInView
              ? { fillOpacity: 0.4, scale: 1 }
              : {}
          }
          transition={{ delay: 0.5 + 2 * ((i + 1) / nodes.length), duration: 0.3 }}
        />
      ))}
    </svg>
  );
};
