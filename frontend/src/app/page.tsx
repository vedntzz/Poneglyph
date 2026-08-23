"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const GITHUB_URL = "https://github.com/vedantx/poneglyph";

const AGENTS = [
  { name: "Scout", desc: "Vision extraction" },
  { name: "Scribe", desc: "Meeting processing" },
  { name: "Archivist", desc: "File-system memory" },
  { name: "Drafter", desc: "Report generation" },
  { name: "Auditor", desc: "Self-verification" },
  { name: "Orchestrator", desc: "Agent coordination" },
] as const;

const EVAL_STATS = [
  { value: "12/12", label: "Scout extraction success rate" },
  { value: "3/3", label: "Silent drift detection runs" },
  { value: "55K tokens", label: "Per briefing on Opus 4.7" },
] as const;

const DOCUMENT_CARDS = [
  { name: "field_form.pdf", rotation: -8 },
  { name: "WhatsApp.txt", rotation: 6 },
  { name: "kickoff_minutes.docx", rotation: -3 },
  { name: "farmtrac_export.csv", rotation: 5 },
  { name: "donor_email.eml", rotation: -2 },
] as const;

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <CapabilitiesSection />
      <TechnicalProofSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 1: Sticky nav (transparent → white on scroll)
// ─────────────────────────────────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 flex h-16 w-full items-center justify-between px-12 transition-all duration-300 ${
        scrolled
          ? "border-b border-hairline bg-surface"
          : "bg-transparent"
      }`}
    >
      {/* Left: logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-accent-forest">
          <span className="text-[12px] font-bold leading-none text-white">
            P
          </span>
        </div>
        <span className="text-sm font-semibold text-text-primary">
          Poneglyph
        </span>
      </Link>

      {/* Right: GitHub + CTA */}
      <div className="flex items-center gap-3">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-3 py-1.5 text-2xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
        >
          GitHub
        </a>
        <Link
          href="/app"
          className="rounded-md bg-accent-forest px-4 py-2 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
        >
          Try the demo &rarr;
        </Link>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 2: Hero
// ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center px-12"
      style={{
        background:
          "linear-gradient(180deg, #FAFAF7 0%, #F4F2EC 100%)",
      }}
    >
      <div className="mx-auto max-w-[1100px]">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0 }}
          className="mb-5 font-mono text-2xs uppercase tracking-[0.15em] text-text-tertiary"
        >
          Institutional Memory &middot; Opus 4.7
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="max-w-[720px] text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary"
        >
          Your project&apos;s truth, audited and ready before every meeting.
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
          className="mt-6 max-w-[640px] text-base leading-[1.5] text-text-secondary"
        >
          Field staff send updates in Excel, WhatsApp, scanned forms, and
          emails. Stakeholder commitments drift silently across meetings.
          Quarterly reports take a week to write. Poneglyph reads everything,
          catches what shifted, and drafts the briefing your senior consultant
          would write Sunday night.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          className="mt-6 flex items-center gap-4"
        >
          <Link
            href="/app"
            className="rounded-lg bg-accent-forest px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Try the live demo &rarr;
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-hairline px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-hover-warm"
          >
            View on GitHub
          </a>
        </motion.div>
      </div>

      {/* Scroll affordance — subtle bobbing chevron */}
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8B8E89"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 3: The problem
// ─────────────────────────────────────────────────────────────

function ProblemSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section ref={ref} className="px-12 py-24">
      <div className="mx-auto grid max-w-[1100px] grid-cols-5 gap-16">
        {/* Left column (60%) */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="col-span-3"
        >
          <p className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-tertiary">
            The Problem
          </p>
          <h2 className="max-w-[480px] text-xl font-medium leading-[1.2] text-text-primary">
            Project memory is scattered across systems that don&apos;t talk.
          </h2>
          <p className="mt-5 max-w-[520px] text-sm leading-[1.7] text-text-secondary">
            A typical World Bank project generates evidence in Excel rosters,
            WhatsApp updates, scanned field forms in Hindi, email threads with
            donors, and meeting transcripts. None of it links to the logframe.
            None of it auto-detects when a 50-AgriMart commitment quietly
            becomes 42. The work of synthesis falls on a senior consultant
            burning Sunday nights.
          </p>
        </motion.div>

        {/* Right column (40%): scattered document cards */}
        <div className="col-span-2 flex items-center justify-center">
          <div className="relative h-[280px] w-[240px]">
            {DOCUMENT_CARDS.map((doc, i) => (
              <motion.div
                key={doc.name}
                initial={{ opacity: 0, rotate: 0, y: 20 }}
                animate={
                  isInView
                    ? { opacity: 1, rotate: doc.rotation, y: 0 }
                    : {}
                }
                transition={{
                  duration: 0.4,
                  ease: "easeOut",
                  delay: 0.2 + i * 0.08,
                }}
                className="absolute rounded-lg border border-hairline bg-surface p-3 shadow-sm"
                style={{
                  width: 120,
                  height: 80,
                  top: `${8 + i * 40}px`,
                  left: `${20 + (i % 3) * 30}px`,
                }}
              >
                {/* File icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8B8E89"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-1"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="truncate font-mono text-[10px] text-text-tertiary">
                  {doc.name}
                </p>
              </motion.div>
            ))}

            {/* Caption below cards */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="absolute -bottom-2 left-0 w-full text-center font-mono text-[11px] text-accent-amber"
            >
              5 sources &middot; 3 formats &middot; 0 single source of truth
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 4: What it does (three capabilities)
// ─────────────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle
          cx="16"
          cy="16"
          r="6"
          stroke="#15803D"
          strokeWidth="2"
        />
        <path
          d="M16 6C10 6 4 11 2 16c2 5 8 10 14 10s12-5 14-10c-2-5-8-10-14-10Z"
          stroke="#15803D"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Reads everything",
    description:
      "Scanned forms in Hindi, English meeting transcripts, FarmTrac CSV exports, WhatsApp updates. The Scout agent uses Opus 4.7\u2019s pixel-coordinate vision to extract structured evidence with bounding boxes \u2014 even from handwritten registers.",
    preview: <ScoutPreview />,
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M8 16h16M16 8v16"
          stroke="#15803D"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M6 6l4 4M22 22l4 4M6 26l4-4M22 6l4 4"
          stroke="#15803D"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Catches silent drift",
    description:
      "When a 50-AgriMart commitment becomes 42 across two stakeholder meetings without acknowledgment, the Archivist agent detects it. File-system memory and on-demand tool reads \u2014 the consultant who never forgets what was promised.",
    preview: <DriftPreview />,
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M10 6H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"
          stroke="#15803D"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="10" y="4" width="12" height="4" rx="1" stroke="#15803D" strokeWidth="2" />
        <path d="M10 15h12M10 19h8" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Drafts grounded briefings",
    description:
      "Before your next World Bank meeting, the Briefing agent generates a one-page brief: what to push for, what they\u2019ll push back on, what not to bring up. Every claim cites a specific evidence file. The Auditor independently re-reads sources to catch any fabrication.",
    preview: <BriefingPreview />,
  },
] as const;

function CapabilitiesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section ref={ref} className="bg-surface px-12 py-24">
      <div className="mx-auto max-w-[1100px]">
        <p className="mb-4 text-center font-mono text-2xs uppercase tracking-[0.15em] text-text-tertiary">
          What It Does
        </p>
        <h2 className="mx-auto max-w-[600px] text-center text-xl font-medium leading-[1.2] text-text-primary">
          Three capabilities, one coherent project memory.
        </h2>

        <div className="mt-12 grid grid-cols-3 gap-6">
          {CAPABILITIES.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                duration: 0.4,
                ease: "easeOut",
                delay: i * 0.12,
              }}
              className="rounded-xl border border-hairline bg-canvas p-7"
            >
              <div className="mb-4">{cap.icon}</div>
              <h3 className="mb-2 text-sm font-medium text-text-primary">
                {cap.title}
              </h3>
              <p className="text-xs leading-[1.5] text-text-secondary">
                {cap.description}
              </p>
              <div className="mt-5 overflow-hidden rounded-lg border border-hairline">
                {cap.preview}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Capability card preview SVGs ──

function ScoutPreview() {
  return (
    <div className="relative h-[160px] bg-canvas p-4">
      {/* Simulated form with bounding boxes */}
      <div className="space-y-2">
        <div className="h-3 w-3/4 rounded bg-hairline" />
        <div className="h-3 w-1/2 rounded bg-hairline" />
        <div className="relative h-8 w-2/3 rounded border-2 border-dashed border-accent-forest/40 bg-highlight-mint/30 p-1">
          <span className="text-[9px] font-mono text-accent-forest">
            ev-658c37a1
          </span>
        </div>
        <div className="h-3 w-5/6 rounded bg-hairline" />
        <div className="relative h-8 w-3/5 rounded border-2 border-dashed border-accent-forest/40 bg-highlight-mint/30 p-1">
          <span className="text-[9px] font-mono text-accent-forest">
            ev-b56113fc
          </span>
        </div>
        <div className="h-3 w-2/3 rounded bg-hairline" />
      </div>
    </div>
  );
}

function DriftPreview() {
  return (
    <div className="h-[160px] bg-canvas p-4">
      <p className="mb-3 text-[10px] font-medium text-text-tertiary">
        AgriMarts target
      </p>
      <svg width="100%" height="60" viewBox="0 0 240 60">
        <line
          x1="20"
          y1="30"
          x2="220"
          y2="30"
          stroke="#991B1B"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        {/* Node 1 */}
        <circle cx="20" cy="30" r="4" fill="white" stroke="#991B1B" strokeWidth="2" />
        <text x="20" y="16" textAnchor="middle" className="fill-text-tertiary text-[8px]">
          Oct
        </text>
        <text x="20" y="50" textAnchor="middle" className="fill-text-primary text-[9px] font-medium">
          50
        </text>
        {/* Node 2 */}
        <circle cx="120" cy="30" r="4" fill="white" stroke="#991B1B" strokeWidth="2" />
        <text x="120" y="16" textAnchor="middle" className="fill-text-tertiary text-[8px]">
          Dec
        </text>
        <text x="120" y="50" textAnchor="middle" className="fill-text-primary text-[9px] font-medium">
          50
        </text>
        {/* Node 3 */}
        <circle cx="220" cy="30" r="4" fill="white" stroke="#991B1B" strokeWidth="2" />
        <text x="220" y="16" textAnchor="middle" className="fill-text-tertiary text-[8px]">
          Mar
        </text>
        <text x="220" y="50" textAnchor="middle" className="fill-accent-critical text-[9px] font-bold">
          42
        </text>
      </svg>
      <p className="mt-1 font-mono text-[9px] text-accent-critical">
        Silent walk-back: 50 &rarr; 42
      </p>
    </div>
  );
}

function BriefingPreview() {
  return (
    <div className="h-[160px] space-y-2 bg-canvas p-4">
      {/* Push for */}
      <div className="rounded border-l-2 border-accent-forest bg-highlight-mint/30 px-2 py-1.5">
        <p className="text-[9px] font-medium text-accent-forest">Push for</p>
        <p className="text-[8px] text-text-secondary">
          Rehli cold storage verified...
        </p>
      </div>
      {/* Push back */}
      <div className="rounded border-l-2 border-accent-amber bg-amber-50 px-2 py-1.5">
        <p className="text-[9px] font-medium text-accent-amber">
          They&apos;ll push back
        </p>
        <p className="text-[8px] text-text-secondary">
          AgriMart 50→42 gap...
        </p>
      </div>
      {/* Don't bring up */}
      <div className="rounded border-l-2 border-hairline bg-canvas px-2 py-1.5">
        <p className="text-[9px] font-medium text-text-tertiary">
          Don&apos;t bring up
        </p>
        <p className="text-[8px] text-text-secondary">
          Processing unit delays...
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 5: How it works (technical proof)
// ─────────────────────────────────────────────────────────────

function TechnicalProofSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section ref={ref} className="px-12 py-24">
      <div className="mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="mb-4 text-center font-mono text-2xs uppercase tracking-[0.15em] text-text-tertiary">
            Built on Opus 4.7
          </p>
          <h2 className="mx-auto max-w-[600px] text-center text-xl font-medium leading-[1.2] text-text-primary">
            Six agents, real reasoning, honest evals.
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-center text-sm leading-[1.5] text-text-secondary">
            Multi-agent system using Anthropic&apos;s Claude Opus 4.7. Three
            Opus 4.7-specific capabilities: pixel-coordinate vision,
            file-system memory via on-demand tool use, and independent
            self-verification.
          </p>
        </motion.div>

        {/* Agent badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 8 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: 0.3 + i * 0.06,
              }}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2"
            >
              <span className="h-2 w-2 rounded-full bg-accent-forest" />
              <span className="text-2xs font-medium text-text-primary">
                {agent.name}
              </span>
              <span className="font-mono text-[10px] text-text-tertiary">
                {agent.desc}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Eval stats */}
        <div className="mt-10 grid grid-cols-3 gap-6">
          {EVAL_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-hairline bg-surface p-6 text-center"
            >
              <p className="font-mono text-lg font-semibold text-text-primary">
                {stat.value}
              </p>
              <p className="mt-1 text-2xs text-text-tertiary">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* EVALS link */}
        <div className="mt-6 text-right">
          <a
            href={`${GITHUB_URL}/blob/main/EVALS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs font-medium text-accent-forest transition-colors hover:text-accent-forest-hover"
          >
            Read EVALS.md &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 6: Final CTA
// ─────────────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="bg-surface px-12 py-32">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="text-xl font-medium text-text-primary">
          See it work end-to-end.
        </h2>
        <p className="mx-auto mt-4 max-w-[520px] text-sm leading-[1.5] text-text-secondary">
          Run the canonical demo on synthetic World Bank project data. Watch the
          agents read documents, catch drift, and draft a briefing &mdash; in
          about 8 minutes.
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="inline-block rounded-lg bg-accent-forest px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Try the live demo &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 7: Footer
// ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-hairline px-12 pb-8 pt-16">
      <div className="mx-auto grid max-w-[1100px] grid-cols-3 gap-12">
        {/* Left: branding */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-accent-forest">
              <span className="text-[10px] font-bold leading-none text-white">
                P
              </span>
            </div>
            <span className="text-xs font-semibold text-text-primary">
              Poneglyph
            </span>
          </div>
          <p className="text-2xs leading-[1.5] text-text-tertiary">
            Institutional memory for multi-stakeholder development projects.
          </p>
          <p className="mt-3 text-[10px] text-text-tertiary">
            Built for the Built with Opus 4.7 Hackathon &middot; April 2026
          </p>
        </div>

        {/* Middle: links */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Links
          </p>
          <div className="space-y-2">
            <FooterLink href="/app">Demo</FooterLink>
            <FooterLink href={GITHUB_URL} external>
              GitHub
            </FooterLink>
            <FooterLink href={`${GITHUB_URL}/blob/main/EVALS.md`} external>
              Evals
            </FooterLink>
            <FooterLink
              href={`${GITHUB_URL}/blob/main/ARCHITECTURE.md`}
              external
            >
              Architecture
            </FooterLink>
          </div>
        </div>

        {/* Right: Made by */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Made by
          </p>
          <p className="text-2xs text-text-secondary">Vedant Srivastava</p>
          <a
            href="https://github.com/vedantx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs text-accent-forest transition-colors hover:text-accent-forest-hover"
          >
            @vedantx
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-2xs text-text-secondary transition-colors hover:text-text-primary"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="block text-2xs text-text-secondary transition-colors hover:text-text-primary"
    >
      {children}
    </Link>
  );
}
