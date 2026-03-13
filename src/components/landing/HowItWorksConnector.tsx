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
      // Desktop snake: 1→2→3 then curve down, then 4←5←6 (but items are in DOM order 4,5,6 left-to-right)
      // Row 1: indices 0,1,2 (left to right)
      // Row 2: indices 3,4,5 (left to right in DOM, but snake goes right-to-left: 3←4←5 visually means 5→4→3)
      const row1 = centers.slice(0, 3);
      const row2 = centers.slice(3, 6);

      d = `M ${row1[0].x} ${row1[0].y}`;

      // Row 1: smooth curves through 1→2→3
      for (let i = 1; i < row1.length; i++) {
        const prev = row1[i - 1];
        const curr = row1[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
      }

      // Curve down from step 3 (row1[2]) to step 6 (row2[2]) — rightmost of row 2
      const downStart = row1[2];
      const downEnd = row2[2];
      const midY = (downStart.y + downEnd.y) / 2;
      d += ` C ${downStart.x + 40} ${midY}, ${downEnd.x + 40} ${midY}, ${downEnd.x} ${downEnd.y}`;

      // Row 2: right-to-left: 6→5→4
      for (let i = row2.length - 2; i >= 0; i--) {
        const prev = row2[i + 1];
        const curr = row2[i];
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
