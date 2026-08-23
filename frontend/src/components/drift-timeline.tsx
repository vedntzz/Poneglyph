"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DriftNode {
  /** Meeting label (e.g. "Meeting 1"). */
  meetingLabel: string;
  /** Value at this point (e.g. "50 AgriMarts"). */
  value: string;
}

export interface DriftBend {
  /** Index in the nodes array where the bend occurs (between node[i] and node[i+1]). */
  afterNodeIndex: number;
  /** Delta label (e.g. "50 → 42"). */
  delta: string;
  /** Severity of the contradiction. */
  severity: "low" | "medium" | "high";
  /** Brief explanation shown in tooltip. */
  description: string;
}

export interface DriftRow {
  /** Topic label (e.g. "AgriMarts target"). */
  topic: string;
  /** Nodes along the timeline. */
  nodes: DriftNode[];
  /** Bends (contradictions) between nodes. */
  bends: DriftBend[];
}

interface DriftTimelineProps {
  rows: DriftRow[];
  /** Whether to animate the draw-in (completion choreography). */
  animate: boolean;
}

// ─────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────

const LEFT_LABEL_WIDTH = 140;
const NODE_SPACING = 120;
const ROW_HEIGHT = 64;
const TOP_PADDING = 24;
const NODE_RADIUS = 4;
const BEND_OFFSET = 12;

// ─────────────────────────────────────────────────────────────
// Severity colors
// ─────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { stroke: string; fill: string }> = {
  low: { stroke: "#a1a1aa", fill: "#a1a1aa" },       // zinc-400
  medium: { stroke: "#f59e0b", fill: "#f59e0b" },     // amber-500
  high: { stroke: "#ef4444", fill: "#ef4444" },        // red-500
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Drift Timeline — SVG visualization of commitment drift.
 *
 * One row per topic. Nodes are meetings where the topic is mentioned.
 * Lines connect nodes. Bends with markers indicate contradictions.
 * Draws left-to-right on render when animate=true.
 */
export function DriftTimeline({ rows, animate }: DriftTimelineProps) {
  const [hoveredBend, setHoveredBend] = useState<{
    row: number;
    bend: number;
  } | null>(null);

  if (rows.length === 0) return null;

  const maxNodes = Math.max(...rows.map((r) => r.nodes.length));
  const svgWidth = LEFT_LABEL_WIDTH + maxNodes * NODE_SPACING + 40;
  const svgHeight = TOP_PADDING + rows.length * ROW_HEIGHT + 20;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ minWidth: `${svgWidth}px` }}
      >
        {/* Meeting column headers */}
        {rows[0]?.nodes.map((node, i) => (
          <text
            key={`header-${i}`}
            x={LEFT_LABEL_WIDTH + i * NODE_SPACING + NODE_SPACING / 2}
            y={14}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-geist-mono)"
            fill="#71717a" // zinc-500
          >
            {node.meetingLabel}
          </text>
        ))}

        {rows.map((row, rowIdx) => {
          const y = TOP_PADDING + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

          return (
            <g key={`row-${rowIdx}`}>
              {/* Row label */}
              <text
                x={8}
                y={y + 4}
                fontSize={11}
                fontFamily="var(--font-geist-sans)"
                fill="#a1a1aa" // zinc-400
              >
                {row.topic}
              </text>

              {/* Connecting lines between nodes */}
              {row.nodes.map((_, nodeIdx) => {
                if (nodeIdx === 0) return null;

                const x1 =
                  LEFT_LABEL_WIDTH +
                  (nodeIdx - 1) * NODE_SPACING +
                  NODE_SPACING / 2;
                const x2 =
                  LEFT_LABEL_WIDTH + nodeIdx * NODE_SPACING + NODE_SPACING / 2;

                // Check if there's a bend between these nodes
                const bend = row.bends.find(
                  (b) => b.afterNodeIndex === nodeIdx - 1,
                );

                if (bend) {
                  const midX = (x1 + x2) / 2;
                  const colors =
                    SEVERITY_COLORS[bend.severity] ?? SEVERITY_COLORS.medium;

                  // Bent line — goes down to show drift
                  const pathD = `M ${x1} ${y} L ${midX} ${y + BEND_OFFSET} L ${x2} ${y}`;

                  return (
                    <g key={`line-${nodeIdx}`}>
                      <motion.path
                        d={pathD}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={1.5}
                        strokeDasharray={animate ? "1000" : "none"}
                        strokeDashoffset={animate ? "1000" : "0"}
                        initial={
                          animate
                            ? { strokeDashoffset: 1000 }
                            : { strokeDashoffset: 0 }
                        }
                        animate={{ strokeDashoffset: 0 }}
                        transition={{
                          duration: 0.8,
                          delay: animate ? 0.6 + rowIdx * 0.15 : 0,
                          ease: "easeOut",
                        }}
                      />

                      {/* Bend marker ✗ */}
                      <motion.g
                        initial={animate ? { opacity: 0 } : { opacity: 1 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: animate
                            ? 0.6 + rowIdx * 0.15 + 0.8
                            : 0,
                          ease: "easeOut",
                        }}
                        onMouseEnter={() =>
                          setHoveredBend({
                            row: rowIdx,
                            bend: row.bends.indexOf(bend),
                          })
                        }
                        onMouseLeave={() => setHoveredBend(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={midX}
                          cy={y + BEND_OFFSET}
                          r={8}
                          fill="#18181b"
                          stroke={colors.stroke}
                          strokeWidth={1}
                        />
                        <text
                          x={midX}
                          y={y + BEND_OFFSET + 3.5}
                          textAnchor="middle"
                          fontSize={10}
                          fontFamily="var(--font-geist-mono)"
                          fill={colors.fill}
                        >
                          ✗
                        </text>
                      </motion.g>

                      {/* Delta label below the bend */}
                      <motion.text
                        x={midX}
                        y={y + BEND_OFFSET + 20}
                        textAnchor="middle"
                        fontSize={9}
                        fontFamily="var(--font-geist-mono)"
                        fill="#71717a"
                        initial={animate ? { opacity: 0 } : { opacity: 1 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: animate
                            ? 0.6 + rowIdx * 0.15 + 0.8
                            : 0,
                        }}
                      >
                        {bend.delta}
                      </motion.text>

                      {/* Tooltip on hover */}
                      {hoveredBend?.row === rowIdx &&
                        hoveredBend?.bend === row.bends.indexOf(bend) && (
                          <g>
                            <rect
                              x={midX - 100}
                              y={y + BEND_OFFSET + 28}
                              width={200}
                              height={24}
                              rx={4}
                              fill="#18181b"
                              stroke="#3f3f46"
                              strokeWidth={1}
                            />
                            <text
                              x={midX}
                              y={y + BEND_OFFSET + 44}
                              textAnchor="middle"
                              fontSize={9}
                              fontFamily="var(--font-geist-mono)"
                              fill="#a1a1aa"
                            >
                              {bend.description.slice(0, 40)}
                            </text>
                          </g>
                        )}
                    </g>
                  );
                }

                // Straight line — no contradiction
                return (
                  <motion.line
                    key={`line-${nodeIdx}`}
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#3f3f46" // zinc-700
                    strokeWidth={1}
                    initial={animate ? { pathLength: 0 } : { pathLength: 1 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.8,
                      delay: animate ? 0.6 + rowIdx * 0.15 : 0,
                      ease: "easeOut",
                    }}
                  />
                );
              })}

              {/* Nodes */}
              {row.nodes.map((node, nodeIdx) => {
                const x =
                  LEFT_LABEL_WIDTH + nodeIdx * NODE_SPACING + NODE_SPACING / 2;

                return (
                  <g key={`node-${nodeIdx}`}>
                    <motion.circle
                      cx={x}
                      cy={y}
                      r={NODE_RADIUS}
                      fill="#d4d4d8" // zinc-300
                      initial={animate ? { opacity: 0 } : { opacity: 1 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.15,
                        delay: animate
                          ? 0.6 + rowIdx * 0.15 + nodeIdx * 0.1
                          : 0,
                      }}
                    />
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fontSize={9}
                      fontFamily="var(--font-geist-mono)"
                      fill="#71717a" // zinc-500
                    >
                      {node.value}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
