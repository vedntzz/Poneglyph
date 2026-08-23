"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ── Command definitions ── */

interface CommandItem {
  id: string;
  group: "actions" | "navigate";
  label: string;
  description?: string;
  icon: React.ReactNode;
  /** Action to run when selected. */
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user picks "Brief me..." to trigger the briefing modal. */
  onBriefMe: () => void;
  /** Scroll to a section by id. */
  onNavigate: (sectionId: string) => void;
}

/** Search icon (magnifying glass), 16px. */
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/**
 * Command palette modal (Cmd+K).
 *
 * 600px wide, max 480px tall, white surface, 12px radius.
 * Two groups: Actions (brief me, show drift, run pipeline) and Navigate (6 sections).
 * Type-to-filter with fuzzy match. Keyboard nav: up/down highlights, enter activates, esc closes.
 */
export function CommandPalette({
  isOpen,
  onClose,
  onBriefMe,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Build the command list. Stable across renders since callbacks are from props. */
  const commands: CommandItem[] = [
    {
      id: "brief-me",
      group: "actions",
      label: "Brief me...",
      description: "Generate a stakeholder briefing",
      icon: <ActionIcon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6" />,
      onSelect: () => {
        onClose();
        onBriefMe();
      },
    },
    {
      id: "show-drift",
      group: "actions",
      label: "Show me what's drifting",
      description: "Jump to the drift timeline",
      icon: <ActionIcon d="M13 17l5-5-5-5M6 17l5-5-5-5" />,
      onSelect: () => {
        onClose();
        onNavigate("drift");
      },
    },
    {
      id: "run-pipeline",
      group: "actions",
      label: "Run pipeline",
      description: "Jump to the Engine section",
      icon: <ActionIcon d="M4 4v16h16M4 14l4-4 4 4 8-8" />,
      onSelect: () => {
        onClose();
        onNavigate("engine");
      },
    },
    ...["overview", "briefings", "drift", "logframe", "documents", "engine"].map(
      (id) => ({
        id: `nav-${id}`,
        group: "navigate" as const,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        icon: <ActionIcon d="M5 12h14M12 5l7 7-7 7" />,
        onSelect: () => {
          onClose();
          onNavigate(id);
        },
      })
    ),
  ];

  /* Filter commands by query (case-insensitive substring match). */
  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : commands;

  /* Reset highlight when query or open state changes. */
  useEffect(() => {
    setHighlightIndex(0);
  }, [query, isOpen]);

  /* Focus input when palette opens; clear query when it closes. */
  useEffect(() => {
    if (isOpen) {
      /* Small delay to allow the animation to start before focusing. */
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  /* Scroll highlighted item into view. */
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector("[data-highlighted]");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[highlightIndex]) {
        e.preventDefault();
        filtered[highlightIndex].onSelect();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, highlightIndex, onClose]
  );

  /* Group the filtered items. */
  const actionItems = filtered.filter((c) => c.group === "actions");
  const navItems = filtered.filter((c) => c.group === "navigate");

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] z-[101] w-[600px] -translate-x-1/2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
              />
              <kbd className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
                esc
              </kbd>
            </div>

            {/* Results list */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-2xs text-text-tertiary">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}

              {actionItems.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Actions
                  </p>
                  {actionItems.map((item) => {
                    const idx = flatIndex++;
                    return (
                      <CommandRow
                        key={item.id}
                        item={item}
                        isHighlighted={idx === highlightIndex}
                        onSelect={item.onSelect}
                        onHover={() => setHighlightIndex(idx)}
                      />
                    );
                  })}
                </div>
              )}

              {navItems.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Navigate
                  </p>
                  {navItems.map((item) => {
                    const idx = flatIndex++;
                    return (
                      <CommandRow
                        key={item.id}
                        item={item}
                        isHighlighted={idx === highlightIndex}
                        onSelect={item.onSelect}
                        onHover={() => setHighlightIndex(idx)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Helpers ── */

/** Minimal SVG icon wrapper for command items. Single path, 16px. */
function ActionIcon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-text-tertiary"
    >
      <path d={d} />
    </svg>
  );
}

function CommandRow({
  item,
  isHighlighted,
  onSelect,
  onHover,
}: {
  item: CommandItem;
  isHighlighted: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      data-highlighted={isHighlighted ? "" : undefined}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
        isHighlighted
          ? "bg-hover-warm text-text-primary"
          : "text-text-secondary hover:bg-hover-warm"
      }`}
    >
      {item.icon}
      <div className="flex-1 min-w-0">
        <p className="truncate text-2xs font-medium">{item.label}</p>
        {item.description && (
          <p className="truncate text-[10px] text-text-tertiary">
            {item.description}
          </p>
        )}
      </div>
    </button>
  );
}
