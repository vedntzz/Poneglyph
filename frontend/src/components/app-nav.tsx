"use client";

import { useEffect, useState } from "react";

/** Tabs shown in the top nav. All scroll to anchors on /app. */
const TABS = [
  { id: "overview", label: "Overview", href: "#overview" },
  { id: "briefings", label: "Briefings", href: "#briefings" },
  { id: "drift", label: "Drift", href: "#drift" },
  { id: "logframe", label: "Logframe", href: "#logframe" },
  { id: "documents", label: "Documents", href: "#documents" },
  { id: "engine", label: "Engine", href: "#engine" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AppNavProps {
  /** Currently active section, driven by IntersectionObserver in the parent. */
  activeSection?: string;
  /** Callback when user clicks Cmd+K affordance. */
  onCommandPalette: () => void;
}

/**
 * Sticky top navigation bar for the Poneglyph homepage.
 *
 * 56px height, white surface, hairline bottom border. Three zones:
 * - Left: green logo square + "Poneglyph" wordmark + project pill
 * - Center: 6 tabs (Overview through Engine)
 * - Right: Cmd+K search affordance
 */
export function AppNav({ activeSection, onCommandPalette }: AppNavProps) {
  const [active, setActive] = useState<TabId>("overview");

  /* Sync active tab from parent's IntersectionObserver signal. */
  useEffect(() => {
    if (activeSection && TABS.some((t) => t.id === activeSection)) {
      setActive(activeSection as TabId);
    }
  }, [activeSection]);

  /* Global Cmd+K / Ctrl+K listener. */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onCommandPalette();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCommandPalette]);

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-hairline bg-surface px-5">
      {/* ── Left: logo + wordmark + project pill ── */}
      <div className="flex items-center gap-3">
        {/* Green square logo with white P */}
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-accent-forest">
          <span className="text-[12px] font-bold leading-none text-white">
            P
          </span>
        </div>
        <span className="text-sm font-semibold text-text-primary">
          Poneglyph
        </span>
        <span className="rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-2xs text-text-secondary">
          MP-FPC
        </span>
      </div>

      {/* ── Center: tabs ── */}
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <a
              key={tab.id}
              href={tab.href}
              onClick={(e) => {
                e.preventDefault();
                setActive(tab.id);
                document
                  .getElementById(tab.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-md px-3 py-1.5 text-2xs font-medium transition-colors ${
                isActive
                  ? "bg-hover-warm text-text-primary"
                  : "text-text-tertiary hover:bg-hover-warm hover:text-text-primary"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* ── Right: Cmd+K affordance ── */}
      <button
        onClick={onCommandPalette}
        className="flex h-8 w-60 items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 text-2xs text-text-tertiary transition-colors hover:border-text-tertiary"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="flex-1 text-left">Search or jump to...</span>
        <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
          ⌘K
        </kbd>
      </button>
    </nav>
  );
}
