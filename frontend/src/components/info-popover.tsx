"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface InfoPopoverProps {
  /** Content shown inside the popover. */
  content: string;
}

/**
 * Notion-style "?" tooltip popover.
 *
 * Click the "?" icon → 320px white popover appears below with an arrow.
 * Closes on click-outside, Esc, or the X button.
 */
export function InfoPopover({ content }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Close on click-outside. */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* Close on Esc. */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Trigger: "?" circle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-hairline text-[10px] font-medium text-text-tertiary transition-colors hover:border-text-tertiary hover:text-text-secondary"
        aria-label="More information"
      >
        ?
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-hairline bg-surface p-4"
            style={{
              boxShadow: "0 8px 24px rgba(20, 30, 20, 0.08)",
            }}
          >
            {/* Arrow */}
            <div className="absolute -top-1.5 left-3 h-3 w-3 rotate-45 border-l border-t border-hairline bg-surface" />

            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <p className="pr-4 text-2xs leading-[1.6] text-text-secondary">
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
