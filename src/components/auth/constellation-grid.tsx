"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type DayPhase, getPhaseForHour } from "@/lib/day-phase-context";

// ── Node positions (3×3 grid, 280×280 SVG viewBox) ─────────────

const GRID_SIZE = 280;
const NODE_SPACING = 100; // distance between nodes
const GRID_OFFSET = 40; // padding from edge
const NODE_RADIUS = 32; // touch target radius (64px diameter)
const STAR_RADIUS = 12; // visible star radius

const NODE_POSITIONS = Array.from({ length: 9 }, (_, i) => ({
  x: GRID_OFFSET + (i % 3) * NODE_SPACING,
  y: GRID_OFFSET + Math.floor(i / 3) * NODE_SPACING,
}));

const NODE_LABELS = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

// ── Day phase theming ───────────────────────────────────────────

interface PhaseTheme {
  starColor: string;
  trailColor: string;
  haloColor: string;
  bgGradient: [string, string];
}

const PHASE_THEMES: Record<string, PhaseTheme> = {
  dawn: { starColor: "#fbbf24", trailColor: "rgba(251,191,36,0.8)", haloColor: "rgba(251,191,36,0.3)", bgGradient: ["#fef3c7", "#fff7ed"] },
  morning: { starColor: "#fbbf24", trailColor: "rgba(251,191,36,0.8)", haloColor: "rgba(251,191,36,0.3)", bgGradient: ["#fef3c7", "#fff7ed"] },
  midday: { starColor: "#f8fafc", trailColor: "rgba(248,250,252,0.8)", haloColor: "rgba(248,250,252,0.4)", bgGradient: ["#f8fafc", "#f1f5f9"] },
  afternoon: { starColor: "#f8fafc", trailColor: "rgba(248,250,252,0.8)", haloColor: "rgba(248,250,252,0.4)", bgGradient: ["#f8fafc", "#f1f5f9"] },
  evening: { starColor: "#93c5fd", trailColor: "rgba(147,197,253,0.8)", haloColor: "rgba(147,197,253,0.3)", bgGradient: ["#1e293b", "#0f172a"] },
  night: { starColor: "#93c5fd", trailColor: "rgba(147,197,253,0.8)", haloColor: "rgba(147,197,253,0.3)", bgGradient: ["#1e293b", "#0f172a"] },
};

function getTheme(phase: DayPhase): PhaseTheme {
  return PHASE_THEMES[phase] || PHASE_THEMES.midday;
}

// ── Twinkling particles ─────────────────────────────────────────

function TwinklingParticles({ phase }: { phase: DayPhase }) {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      cx: Math.random() * GRID_SIZE,
      cy: Math.random() * GRID_SIZE,
      r: 0.5 + Math.random() * 1.5,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    })),
  []);

  const theme = getTheme(phase);
  const isNightish = phase === "evening" || phase === "night";
  if (!isNightish) return null;

  return (
    <g className="constellation-particles">
      {particles.map((p) => (
        <circle
          key={p.id}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={theme.starColor}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            values="0;0.7;0"
            dur={`${p.duration}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
}

// ── Main component ──────────────────────────────────────────────

interface ConstellationGridProps {
  onSubmit: (pattern: number[]) => void;
  error?: boolean;
  disabled?: boolean;
}

export function ConstellationGrid({ onSubmit, error, disabled }: ConstellationGridProps) {
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPointer, setCurrentPointer] = useState<{ x: number; y: number } | null>(null);
  const [showError, setShowError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedNodesRef = useRef<number[]>([]);
  const isDrawingRef = useRef(false);

  // Keyboard navigation state
  const [focusedNode, setFocusedNode] = useState<number | null>(null);
  // Hover state for pulse effect
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Detect day phase from browser local time
  const phase = useMemo(() => getPhaseForHour(new Date().getHours()), []);
  const theme = getTheme(phase);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Handle error flash from parent
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        setSelectedNodes([]);
        selectedNodesRef.current = [];
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = GRID_SIZE / rect.width;
    const scaleY = GRID_SIZE / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const getNodeAtPoint = useCallback((x: number, y: number): number | null => {
    for (let i = 0; i < NODE_POSITIONS.length; i++) {
      const node = NODE_POSITIONS[i];
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) {
        return i;
      }
    }
    return null;
  }, []);

  const activateNode = useCallback((nodeIndex: number) => {
    const current = selectedNodesRef.current;
    // No consecutive duplicates
    if (current.length > 0 && current[current.length - 1] === nodeIndex) return;
    // Max 9 nodes
    if (current.length >= 9) return;

    const next = [...current, nodeIndex];
    selectedNodesRef.current = next;
    setSelectedNodes(next);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);

    const pt = getSVGPoint(e.clientX, e.clientY);
    if (!pt) return;

    setIsDrawing(true);
    isDrawingRef.current = true;
    setSelectedNodes([]);
    selectedNodesRef.current = [];
    setShowError(false);

    const node = getNodeAtPoint(pt.x, pt.y);
    if (node !== null) {
      activateNode(node);
    }
    setCurrentPointer(pt);
  }, [disabled, getSVGPoint, getNodeAtPoint, activateNode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const pt = getSVGPoint(e.clientX, e.clientY);
    if (!pt) return;

    setCurrentPointer(pt);

    const node = getNodeAtPoint(pt.x, pt.y);
    if (node !== null) {
      activateNode(node);
    }
  }, [getSVGPoint, getNodeAtPoint, activateNode]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    setIsDrawing(false);
    isDrawingRef.current = false;
    setCurrentPointer(null);

    const pattern = selectedNodesRef.current;
    if (pattern.length >= 4) {
      onSubmit(pattern);
    } else if (pattern.length > 0) {
      // Too short — show brief error
      setShowError(true);
      setTimeout(() => {
        setShowError(false);
        setSelectedNodes([]);
        selectedNodesRef.current = [];
      }, 400);
    }
  }, [onSubmit]);

  // Keyboard fallback
  const handleKeyDown = useCallback((e: React.KeyboardEvent, nodeIndex: number) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      activateNode(nodeIndex);
      // If we have 4+ nodes and user presses Enter, submit
      if (e.key === "Enter" && selectedNodesRef.current.length >= 4) {
        onSubmit(selectedNodesRef.current);
      }
    } else if (e.key === "Escape") {
      setSelectedNodes([]);
      selectedNodesRef.current = [];
    }
  }, [disabled, activateNode, onSubmit]);

  // Build trail lines
  const trailLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < selectedNodes.length; i++) {
      const from = NODE_POSITIONS[selectedNodes[i - 1]];
      const to = NODE_POSITIONS[selectedNodes[i]];
      lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
    return lines;
  }, [selectedNodes]);

  // Active trailing line to current pointer
  const activeTrailLine = useMemo(() => {
    if (!isDrawing || !currentPointer || selectedNodes.length === 0) return null;
    const lastNode = NODE_POSITIONS[selectedNodes[selectedNodes.length - 1]];
    return { x1: lastNode.x, y1: lastNode.y, x2: currentPointer.x, y2: currentPointer.y };
  }, [isDrawing, currentPointer, selectedNodes]);

  const trailColor = showError ? "#ef4444" : theme.trailColor;
  const isNightish = phase === "evening" || phase === "night";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Aria-live region for screen reader announcements */}
      <div aria-live="polite" className="sr-only" role="status">
        {selectedNodes.length > 0 && `Node ${selectedNodes[selectedNodes.length - 1]} connected. ${selectedNodes.length} nodes selected.`}
      </div>

      <div
        role="application"
        aria-label="Draw a pattern across the stars to log in"
        className="relative"
      >
        <motion.svg
          ref={svgRef}
          viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
          width={280}
          height={280}
          className="touch-none select-none"
          style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          animate={showError ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* SVG Filters */}
          <defs>
            {/* Glow trail filter: feGaussianBlur sigma 3 + feComposite for soft glow */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feComposite in="blur" in2="SourceGraphic" operator="over" result="glowBase" />
              <feComposite in="SourceGraphic" in2="glowBase" operator="over" />
            </filter>
            <filter id="starGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Hover pulse filter for node glow on hover */}
            <filter id="hoverPulse" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="hoverBlur" />
              <feComposite in="SourceGraphic" in2="hoverBlur" operator="over" />
            </filter>
            <radialGradient id="nightBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={theme.bgGradient[1]} />
              <stop offset="100%" stopColor={theme.bgGradient[0]} />
            </radialGradient>
          </defs>

          {/* Background for night phases */}
          {isNightish && (
            <rect x="0" y="0" width={GRID_SIZE} height={GRID_SIZE} fill="url(#nightBg)" rx="16" />
          )}

          {/* Twinkling particles (night only, respects reduced motion) */}
          {!prefersReducedMotion && <TwinklingParticles phase={phase} />}

          {/* Trail lines */}
          {trailLines.map((line, i) => (
            <line
              key={`trail-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={trailColor}
              strokeWidth={4}
              strokeLinecap="round"
              filter="url(#glow)"
            />
          ))}

          {/* Active trailing line to pointer */}
          {activeTrailLine && (
            <line
              x1={activeTrailLine.x1}
              y1={activeTrailLine.y1}
              x2={activeTrailLine.x2}
              y2={activeTrailLine.y2}
              stroke={trailColor}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.5}
              strokeDasharray="4 4"
            />
          )}

          {/* Star nodes */}
          {NODE_POSITIONS.map((pos, i) => {
            const isActive = selectedNodes.includes(i);
            const isFocused = focusedNode === i;
            const isHovered = hoveredNode === i;
            return (
              <g
                key={i}
                role="button"
                aria-label={`Star node ${NODE_LABELS[i]}`}
                tabIndex={disabled ? -1 : 0}
                onFocus={() => setFocusedNode(i)}
                onBlur={() => setFocusedNode(null)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onPointerEnter={() => setHoveredNode(i)}
                onPointerLeave={() => setHoveredNode(null)}
                style={{ outline: "none" }}
              >
                {/* Touch target (invisible) */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_RADIUS}
                  fill="transparent"
                />

                {/* Hover pulse glow ring */}
                {isHovered && !isActive && !prefersReducedMotion && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={18}
                    fill={theme.haloColor}
                    opacity={0.4}
                    filter="url(#hoverPulse)"
                  >
                    <animate
                      attributeName="r"
                      values="14;20;14"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.2;0.5;0.2"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Halo glow */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? 18 : 14}
                  fill={isActive ? theme.haloColor : "transparent"}
                  opacity={isActive ? 0.6 : 0}
                  filter="url(#starGlow)"
                >
                  {isActive && !prefersReducedMotion && (
                    <animate
                      attributeName="r"
                      values="16;20;16"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>

                {/* Star body */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? STAR_RADIUS + 2 : (isHovered ? STAR_RADIUS + 1 : STAR_RADIUS)}
                  fill={isActive ? theme.starColor : (isHovered ? theme.starColor : (isNightish ? "#475569" : "#cbd5e1"))}
                  stroke={isFocused ? theme.starColor : "none"}
                  strokeWidth={isFocused ? 2 : 0}
                  strokeDasharray={isFocused ? "4 2" : "none"}
                  opacity={isActive ? 1 : (isHovered ? 0.8 : 0.6)}
                  filter={isActive ? "url(#starGlow)" : (isHovered ? "url(#hoverPulse)" : undefined)}
                />

                {/* Inner bright spot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? 4 : 3}
                  fill={isActive ? "#ffffff" : (isNightish ? "#64748b" : "#e2e8f0")}
                  opacity={isActive ? 0.9 : (isHovered ? 0.6 : 0.4)}
                />
              </g>
            );
          })}
        </motion.svg>
      </div>

      {/* Node count indicator */}
      <AnimatePresence>
        {selectedNodes.length > 0 && selectedNodes.length < 4 && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xs ${isNightish ? "text-slate-400" : "text-slate-500"}`}
          >
            {4 - selectedNodes.length} more node{4 - selectedNodes.length !== 1 ? "s" : ""} needed
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
