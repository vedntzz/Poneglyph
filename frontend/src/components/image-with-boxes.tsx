"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface BoundingBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface ImageWithBoxesProps {
  /** URL or data-URI for the source image. */
  imageUrl: string;
  /** Bounding boxes in the image's native pixel space. */
  boxes: BoundingBox[];
  /** Currently selected box (highlighted with fill). */
  selectedBoxId: string | null;
  /** Fires when a box is clicked. */
  onBoxClick: (box: BoundingBox) => void;
  /** Native width of the image in pixels (for SVG viewBox). */
  imageWidth: number;
  /** Native height of the image in pixels (for SVG viewBox). */
  imageHeight: number;
}

// ─────────────────────────────────────────────────────────────
// Confidence → color mapping
// ─────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<
  BoundingBox["confidence"],
  { stroke: string; fill: string; text: string }
> = {
  HIGH: {
    stroke: "rgba(16, 185, 129, 0.8)",   // emerald-500
    fill: "rgba(16, 185, 129, 0.12)",
    text: "text-emerald-400",
  },
  MEDIUM: {
    stroke: "rgba(245, 158, 11, 0.8)",   // amber-500
    fill: "rgba(245, 158, 11, 0.12)",
    text: "text-amber-400",
  },
  LOW: {
    stroke: "rgba(239, 68, 68, 0.8)",    // red-500
    fill: "rgba(239, 68, 68, 0.12)",
    text: "text-red-400",
  },
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Renders an image with SVG bounding box overlays.
 *
 * Boxes are in the image's native pixel coordinate space —
 * Scout returns these directly from Opus 4.7's pixel-coordinate
 * vision (see CAPABILITIES.md#pixel-vision).
 */
export function ImageWithBoxes({
  imageUrl,
  boxes,
  selectedBoxId,
  onBoxClick,
  imageWidth,
  imageHeight,
}: ImageWithBoxesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBoxClick = useCallback(
    (box: BoundingBox) => {
      onBoxClick(box);
    },
    [onBoxClick],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Base image — scaled to fit container width */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Scanned document"
        className="block w-full rounded-md"
      />

      {/* SVG overlay — same aspect ratio as the image */}
      <svg
        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMinYMin meet"
      >
        <AnimatePresence>
          {boxes.map((box, index) => {
            const colors = CONFIDENCE_COLORS[box.confidence];
            const isSelected = box.id === selectedBoxId;
            const isHovered = box.id === hoveredId;
            const width = box.x2 - box.x1;
            const height = box.y2 - box.y1;

            return (
              <motion.g
                key={box.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.08,
                  ease: "easeOut",
                }}
              >
                {/* Fill rect — visible on select or hover */}
                <rect
                  x={box.x1}
                  y={box.y1}
                  width={width}
                  height={height}
                  fill={isSelected || isHovered ? colors.fill : "transparent"}
                  rx={4}
                />
                {/* Border rect */}
                <rect
                  x={box.x1}
                  y={box.y1}
                  width={width}
                  height={height}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={isSelected ? 4 : 2}
                  rx={4}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredId(box.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleBoxClick(box)}
                />
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* Tooltip for hovered box */}
        {hoveredId && (() => {
          const box = boxes.find((b) => b.id === hoveredId);
          if (!box) return null;
          const colors = CONFIDENCE_COLORS[box.confidence];

          return (
            <g>
              <rect
                x={box.x1}
                y={Math.max(0, box.y1 - 40)}
                width={Math.min(box.label.length * 11 + 16, 400)}
                height={32}
                fill="#18181b"
                stroke={colors.stroke}
                strokeWidth={1}
                rx={4}
              />
              <text
                x={box.x1 + 8}
                y={Math.max(0, box.y1 - 40) + 21}
                fontSize={14}
                fontFamily="var(--font-geist-mono)"
                fill="#a1a1aa"
              >
                {box.label.slice(0, 36)}
                {box.confidence !== "HIGH" && ` (${box.confidence})`}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
