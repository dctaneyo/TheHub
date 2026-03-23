"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/socket-context";
import type { WarRoomLocation } from "./war-room-summary";

// ── Health color mapping ──
function healthColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function pulseSpeed(score: number): number {
  if (score >= 70) return 3;
  if (score >= 40) return 2;
  return 1.2;
}

function moodEmoji(score: number | null): string {
  if (score === null) return "—";
  if (score >= 4.5) return "🤩";
  if (score >= 3.5) return "🙂";
  if (score >= 2.5) return "😐";
  if (score >= 1.5) return "😕";
  return "😫";
}

// ── Types ──
type HealthFilter = "all" | "healthy" | "warning" | "critical";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WarRoomMapProps {
  locations: WarRoomLocation[];
  onLocationsUpdate: (updater: (prev: WarRoomLocation[]) => WarRoomLocation[]) => void;
}

const SVG_W = 1200;
const SVG_H = 800;
const NODE_R = 18;
const GRID_COLS = 5;

export function WarRoomMap({ locations, onLocationsUpdate }: WarRoomMapProps) {
  const router = useRouter();
  const { socket } = useSocket();
  const svgRef = useRef<SVGSVGElement>(null);

  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // ── Detect prefers-reduced-motion ──
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Pointer state for pan ──
  const panState = useRef<{ active: boolean; startX: number; startY: number; startVB: ViewBox } | null>(null);

  // ── Socket subscription for real-time health updates ──
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { locationId: string; healthScore: number; alertCount?: number }) => {
      setTransitioning((prev) => new Set(prev).add(data.locationId));
      onLocationsUpdate((prev) =>
        prev.map((l) =>
          l.id === data.locationId
            ? { ...l, healthScore: data.healthScore, alertCount: data.alertCount ?? l.alertCount }
            : l
        )
      );
      setTimeout(() => {
        setTransitioning((prev) => {
          const next = new Set(prev);
          next.delete(data.locationId);
          return next;
        });
      }, 500);
    };
    socket.on("health:changed", handler);
    return () => { socket.off("health:changed", handler); };
  }, [socket, onLocationsUpdate]);

  // ── Compute node positions ──
  const positioned = useMemo(() => {
    const withCoords = locations.filter((l) => l.latitude !== null && l.longitude !== null);
    const withoutCoords = locations.filter((l) => l.latitude === null || l.longitude === null);

    const nodes: { loc: WarRoomLocation; cx: number; cy: number }[] = [];

    if (withCoords.length > 0) {
      const lats = withCoords.map((l) => l.latitude!);
      const lngs = withCoords.map((l) => l.longitude!);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const padX = 100;
      const padY = 80;
      const rangeW = SVG_W - padX * 2;
      const rangeH = (withoutCoords.length > 0 ? SVG_H * 0.6 : SVG_H) - padY * 2;
      const latSpan = maxLat - minLat || 1;
      const lngSpan = maxLng - minLng || 1;

      for (const loc of withCoords) {
        const cx = padX + ((loc.longitude! - minLng) / lngSpan) * rangeW;
        // Invert latitude (higher lat = higher on map)
        const cy = padY + ((maxLat - loc.latitude!) / latSpan) * rangeH;
        nodes.push({ loc, cx, cy });
      }
    }

    // Auto-grid for locations without coordinates
    if (withoutCoords.length > 0) {
      const startY = withCoords.length > 0 ? SVG_H * 0.65 : 80;
      const availH = SVG_H - startY - 40;
      const rows = Math.ceil(withoutCoords.length / GRID_COLS);
      const rowH = Math.min(availH / rows, 80);
      const colW = (SVG_W - 160) / GRID_COLS;

      withoutCoords.forEach((loc, i) => {
        const row = Math.floor(i / GRID_COLS);
        const col = i % GRID_COLS;
        const cx = 80 + colW * col + colW / 2;
        const cy = startY + rowH * row + rowH / 2;
        nodes.push({ loc, cx, cy });
      });
    }

    return nodes;
  }, [locations]);

  // ── Filter nodes ──
  const filteredNodes = useMemo(() => {
    if (filter === "all") return positioned;
    return positioned.filter(({ loc }) => {
      if (filter === "healthy") return loc.healthScore >= 70;
      if (filter === "warning") return loc.healthScore >= 40 && loc.healthScore < 70;
      return loc.healthScore < 40;
    });
  }, [positioned, filter]);

  // ── Virtualization: only render nodes within viewBox + 20% buffer ──
  const visibleNodes = useMemo(() => {
    if (filteredNodes.length <= 50) return filteredNodes;
    const bufX = viewBox.w * 0.2;
    const bufY = viewBox.h * 0.2;
    return filteredNodes.filter(
      ({ cx, cy }) =>
        cx >= viewBox.x - bufX &&
        cx <= viewBox.x + viewBox.w + bufX &&
        cy >= viewBox.y - bufY &&
        cy <= viewBox.y + viewBox.h + bufY
    );
  }, [filteredNodes, viewBox]);

  // ── Zoom via wheel ──
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      setViewBox((vb) => {
        const newW = Math.max(200, Math.min(SVG_W * 3, vb.w * factor));
        const newH = Math.max(133, Math.min(SVG_H * 3, vb.h * factor));
        const cx = vb.x + vb.w / 2;
        const cy = vb.y + vb.h / 2;
        return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
      });
    },
    []
  );

  // ── Pan via pointer ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest("[data-node]")) return;
      panState.current = { active: true, startX: e.clientX, startY: e.clientY, startVB: { ...viewBox } };
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [viewBox]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panState.current?.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = panState.current.startVB.w / rect.width;
    const scaleY = panState.current.startVB.h / rect.height;
    const dx = (e.clientX - panState.current.startX) * scaleX;
    const dy = (e.clientY - panState.current.startY) * scaleY;
    setViewBox({
      ...panState.current.startVB,
      x: panState.current.startVB.x - dx,
      y: panState.current.startVB.y - dy,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    panState.current = null;
  }, []);

  // ── Zoom level detection for expanded overlays ──
  const isZoomedIn = viewBox.w < SVG_W * 0.6;

  const tooltipTarget = pinnedId ?? hoveredId;
  const tooltipNode = tooltipTarget ? positioned.find((n) => n.loc.id === tooltipTarget) : null;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Filter pills */}
      <div className="absolute top-4 left-4 z-10 flex gap-2" role="group" aria-label="Filter locations by health status">
        {(["all", "healthy", "warning", "critical"] as HealthFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-label={`Filter: ${f === "all" ? "Show all locations" : f === "healthy" ? "Show healthy locations" : f === "warning" ? "Show warning locations" : "Show critical locations"}`}
            aria-pressed={filter === f}
            className={`rounded-full min-h-[44px] px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-foreground text-background shadow"
                : "bg-card/80 text-muted-foreground border border-border hover:bg-muted backdrop-blur-sm"
            }`}
          >
            {f === "all" && "All"}
            {f === "healthy" && "🟢 Healthy"}
            {f === "warning" && "🟡 Warning"}
            {f === "critical" && "🔴 Critical"}
          </button>
        ))}
      </div>

      {/* SVG Map */}
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <defs>
          {/* Glow filter for nodes */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid background */}
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
          </pattern>
        </defs>
        <rect x={viewBox.x - 500} y={viewBox.y - 500} width={viewBox.w + 1000} height={viewBox.h + 1000} fill="url(#grid)" />

        {/* Location nodes */}
        {visibleNodes.map(({ loc, cx, cy }) => {
          const color = healthColor(loc.healthScore);
          const speed = pulseSpeed(loc.healthScore);
          const isTransitioning = transitioning.has(loc.id);

          return (
            <g
              key={loc.id}
              data-node
              role="button"
              aria-label={`${loc.name} (Store #${loc.storeNumber}): health ${loc.healthScore}%, ${loc.isOnline ? "online" : "offline"}`}
              tabIndex={0}
              transform={`translate(${cx}, ${cy})`}
              onPointerEnter={() => setHoveredId(loc.id)}
              onPointerLeave={() => { if (pinnedId !== loc.id) setHoveredId(null); }}
              onClick={() => setPinnedId((prev) => (prev === loc.id ? null : loc.id))}
              className="cursor-pointer"
              style={{ outline: "none" }}
            >
              {/* Pulsing ring */}
              <circle r={NODE_R + 8} fill="none" stroke={color} strokeWidth="2" opacity="0.4">
                {!prefersReducedMotion && (
                  <>
                    <animate
                      attributeName="r"
                      values={`${NODE_R + 4};${NODE_R + 14};${NODE_R + 4}`}
                      dur={`${speed}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0.1;0.5"
                      dur={`${speed}s`}
                      repeatCount="indefinite"
                    />
                  </>
                )}
              </circle>

              {/* Critical alert pulsing ring for health < 40 */}
              {loc.healthScore < 40 && (
                <circle r={NODE_R + 20} fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.5">
                  {!prefersReducedMotion && (
                    <>
                      <animate
                        attributeName="r"
                        values={`${NODE_R + 16};${NODE_R + 26};${NODE_R + 16}`}
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.5;0.15;0.5"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </>
                  )}
                </circle>
              )}

              {/* Filled circle */}
              <circle
                r={NODE_R}
                fill={color}
                opacity={0.9}
                filter="url(#node-glow)"
                style={{
                  transition: isTransitioning ? "fill 500ms ease" : undefined,
                }}
              />

              {/* Inner highlight */}
              <circle r={NODE_R - 5} fill="white" opacity={0.2} />

              {/* Online indicator */}
              {loc.isOnline && (
                <circle cx={NODE_R - 3} cy={-(NODE_R - 3)} r={4} fill="#10b981" stroke="white" strokeWidth="1.5" />
              )}

              {/* Label */}
              <text
                y={NODE_R + 16}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
                style={{ pointerEvents: "none" }}
              >
                {loc.storeNumber}
              </text>

              {/* Expanded detail overlay when zoomed in */}
              {isZoomedIn && (
                <foreignObject
                  x={NODE_R + 6}
                  y={-16}
                  width={110}
                  height={48}
                  style={{ pointerEvents: "none", overflow: "visible" }}
                >
                  <div
                    style={{
                      background: "rgba(0,0,0,0.75)",
                      borderRadius: 6,
                      padding: "3px 6px",
                      fontSize: 9,
                      color: "#fff",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {/* Task completion bar + percentage */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div
                        style={{
                          width: 48,
                          height: 5,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.2)",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, loc.taskCompletionPct))}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: healthColor(loc.healthScore),
                          }}
                        />
                      </div>
                      <span>{loc.taskCompletionPct}%</span>
                    </div>
                    {/* Mood emoji + alert badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{moodEmoji(loc.moodScore)}</span>
                      {loc.alertCount > 0 && (
                        <span
                          style={{
                            background: "#ef4444",
                            borderRadius: 6,
                            padding: "0 4px",
                            fontSize: 8,
                            fontWeight: 700,
                            lineHeight: "14px",
                            minWidth: 14,
                            textAlign: "center",
                          }}
                        >
                          {loc.alertCount}
                        </span>
                      )}
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipNode && (
          <motion.div
            key={tooltipNode.loc.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 w-64 rounded-2xl border border-border bg-card p-4 shadow-xl"
            style={{
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-3">
              <h3 className="text-sm font-bold text-foreground">{tooltipNode.loc.name}</h3>
              <p className="text-xs text-muted-foreground">Store #{tooltipNode.loc.storeNumber}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Health</span>
                <p className="font-bold" style={{ color: healthColor(tooltipNode.loc.healthScore) }}>
                  {tooltipNode.loc.healthScore}%
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Completion</span>
                <p className="font-bold text-foreground">{tooltipNode.loc.taskCompletionPct}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mood</span>
                <p className="font-bold text-foreground">{moodEmoji(tooltipNode.loc.moodScore)} {tooltipNode.loc.moodScore ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Alerts</span>
                <p className={`font-bold ${tooltipNode.loc.alertCount > 0 ? "text-red-500" : "text-foreground"}`}>
                  {tooltipNode.loc.alertCount}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const sessionId = Date.now().toString(36);
                router.push(`/dashboard?mirror=${tooltipNode.loc.id}&session=${sessionId}`);
              }}
              aria-label={`Mirror ${tooltipNode.loc.name} dashboard`}
              className="mt-3 w-full rounded-xl bg-[var(--hub-red)] min-h-[44px] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              Mirror
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
