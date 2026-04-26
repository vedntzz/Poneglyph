"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const GITHUB_URL = "https://github.com/vedntzz/Poneglyph";

const AGENT_CARDS = [
  {
    name: "Scout",
    role: "VISION",
    description:
      "Reads scanned forms in Hindi and English. Extracts structured evidence with pixel-coordinate bounding boxes mapped to logframe indicators.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    name: "Scribe",
    role: "TRANSCRIPTS",
    description:
      "Processes meeting transcripts into structured minutes \u2014 decisions, commitments with owner+deadline, open questions, disagreements.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    name: "Archivist",
    role: "MEMORY",
    description:
      "Reads project files on demand using Opus 4.7\u2019s file-system memory. Answers cross-document queries. Detects silent drift across stakeholder meetings.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    name: "Drafter",
    role: "REPORTS",
    description:
      "Composes donor-format report sections (World Bank ISR, GIZ format) with atomic claims. Every claim references specific source IDs.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    name: "Auditor",
    role: "VERIFICATION",
    description:
      "Independently re-reads source images via Opus 4.7\u2019s vision. Refuses to verify any claim it cannot ground. Tags \u2713 verified / \u26A0 contested / \u2717 unsupported.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    name: "Briefing",
    role: "ACTION",
    description:
      "Generates pre-meeting briefings \u2014 push-for, push-back, don\u2019t-bring-up \u2014 with citation chips. Replaces a partner\u2019s Sunday-night prep.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
  },
];

const EVAL_STATS = [
  { value: "12 / 12", label: "Scout extraction success on synthetic forms" },
  { value: "3 / 3", label: "Silent drift detection across variance runs" },
  { value: "89%", label: "Aggregate eval pass rate across 28 test cases" },
] as const;

const DOCUMENT_CARDS = [
  { name: "field_form.pdf", detail: "Hindi \u00b7 18 Apr 2026", rotation: -8 },
  { name: "WhatsApp.txt", detail: "14 messages \u00b7 3 stakeholders", rotation: 6 },
  { name: "kickoff_minutes.docx", detail: "Jan 15", rotation: -3 },
  { name: "farmtrac_export.csv", detail: "312 rows", rotation: 5 },
  { name: "donor_email.eml", detail: "World Bank \u00b7 April mission", rotation: -2 },
] as const;

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
    title: "Reads scanned forms in Hindi and English",
    description:
      "Field officers send phone photos of beneficiary registers and PHM training attendance sheets \u2014 including handwritten Devanagari script, government stamps, and bilingual fields. Scout uses Opus 4.7\u2019s pixel-coordinate vision to extract structured evidence with bounding boxes and map every fact to the project\u2019s logframe indicators.",
    stat: "12 / 12 evidence extracted  \u00b7  100% bounding-box validity",
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
    title: "Catches silent commitment drift",
    description:
      "A \u201c50 AgriMarts by Q3\u201d commitment in the January kickoff quietly becomes \u201c42 in pipeline\u201d by the March review. No one acknowledged it. No one corrected the logframe. The Archivist agent reads across meeting transcripts using Opus 4.7\u2019s file-system memory and on-demand tool reads \u2014 the consultant who never forgets what was promised.",
    stat: "3 / 3 walk-back detection  \u00b7  Variance-tested across runs",
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
    title: "Drafts what a senior partner would draft",
    description:
      "Before the next World Bank or GIZ stakeholder meeting, the Briefing agent generates a one-page brief: what to push for, what they\u2019ll push back on, what not to bring up. Every claim cites a specific evidence file or commitment ID. The Auditor independently re-reads source images to verify each fact and refuses to confirm any claim it cannot ground.",
    stat: "A full Sunday of partner work  \u2192  30-second briefing",
    preview: <BriefingPreview />,
  },
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
      <AgentsSection />
      <WhyNowSection />
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
          Institutional Memory &middot; Built on Opus 4.7
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="max-w-[720px] text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary"
        >
          $200B in donor-funded development still runs on Excel and
          WhatsApp. The system of record it deserves, in 30&nbsp;seconds.
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
          className="mt-6 max-w-[640px] text-base leading-[1.5] text-text-secondary"
        >
          The World Bank, GIZ, USAID, and UN agencies disburse $200B+
          annually to consulting firms running rural development,
          agriculture, and livelihoods programs (OECD DAC).
          Today&apos;s evidence lives in scanned Hindi forms, fragmented
          WhatsApp groups, and Word-doc meeting minutes. Senior
          consultants spend a full Sunday &mdash; 6 to 10 hours &mdash;
          before every donor meeting reconstructing what was committed,
          what shifted, and what&apos;s missing. Poneglyph replaces that
          with a 30-second briefing &mdash; every claim cited, every fact
          independently audited.
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

        {/* Small line below CTAs */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
          className="mt-4 font-mono text-[11px] text-text-tertiary"
        >
          Built in 5 days &middot; 6 agents on Opus 4.7 &middot; 100%
          extraction on synthetic forms
        </motion.p>
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
            Why This Exists
          </p>
          <h2 className="max-w-[480px] text-xl font-medium leading-[1.2] text-text-primary">
            Five systems. Two languages. Zero source of truth.
          </h2>
          <p className="mt-5 max-w-[520px] text-sm leading-[1.7] text-text-secondary">
            A typical $40M, five-year farmer producer program in central
            India is run by a 12-person consulting team for the World Bank
            or GIZ. Field officers fill paper registration forms in Hindi.
            Block coordinators send WhatsApp updates with phone-camera
            photos. State managers log meetings in Word docs. Donors
            receive quarterly reports compiled by hand. Nothing links to
            the logframe. Nothing cross-checks itself.
          </p>
          <p className="mt-4 max-w-[520px] text-sm leading-[1.7] text-text-secondary">
            When the World Bank Independent Evaluation Group review lands
            and asks &ldquo;you committed to 50 AgriMarts by Q3 &mdash;
            what happened to the other 8?&rdquo; &mdash; the answer takes
            a senior partner three days of frantic searching. By the time
            they reconstruct the decisions from memory, follow-on funding
            for the next $50M facility is already at risk. The IEG flags
            &ldquo;weak evidence trails between commitments and reported
            deliverables&rdquo; as a top-three reason for project rating
            downgrades. One downgrade can cost more than the entire MIS
            budget for the program&apos;s lifetime.
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
                <p className="truncate font-mono text-[8px] text-text-tertiary/60">
                  {doc.detail}
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
              5 sources &middot; 3 formats &middot; 2 languages &middot; 0
              single source of truth
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
          A senior consultant&apos;s Sunday night, compressed to
          30&nbsp;seconds.
        </h2>
        <p className="mx-auto mt-4 max-w-[640px] text-center text-sm leading-[1.5] text-text-secondary">
          Three Opus 4.7-specific capabilities, exercised at production
          quality. Every metric below is a real measurement from the build.
        </p>

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
              className="flex flex-col rounded-xl border border-hairline bg-canvas p-7"
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
              {/* Stat row */}
              <p className="mt-3 font-mono text-[10px] leading-[1.4] text-text-tertiary">
                {cap.stat}
              </p>
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
            Six agents. Real reasoning. Honest evals.
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-center text-sm leading-[1.5] text-text-secondary">
            A multi-agent system using Anthropic&apos;s Claude Opus 4.7.
            Three model-specific capabilities exercised at production
            quality: pixel-coordinate vision, file-system memory via
            on-demand tool use, and independent self-verification. Five
            days from blank repo to deployed product. Submitted to the
            Built with Opus 4.7 Hackathon.
          </p>
        </motion.div>

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

        {/* Caveat */}
        <p className="mx-auto mt-6 max-w-[640px] text-center text-[11px] leading-[1.5] text-text-tertiary">
          Honest accuracy: see{" "}
          <a
            href={`${GITHUB_URL}/blob/main/EVALS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-text-secondary"
          >
            EVALS.md
          </a>{" "}
          for per-agent breakdown and{" "}
          <a
            href={`${GITHUB_URL}/blob/main/FAILURE_MODES.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-text-secondary"
          >
            FAILURE_MODES.md
          </a>{" "}
          for 7 documented limitations.
        </p>

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
// Section 5.5: The six agents
// ─────────────────────────────────────────────────────────────

function AgentsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section ref={ref} className="bg-surface px-12 py-20">
      <div className="mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="mb-4 text-center font-mono text-2xs uppercase tracking-[0.15em] text-text-tertiary">
            The System
          </p>
          <h2 className="mx-auto max-w-[600px] text-center text-xl font-medium leading-[1.2] text-text-primary">
            Six specialized agents on Opus 4.7.
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-center text-sm text-text-tertiary">
            Each agent is a focused tool. Coordinated by a deterministic
            Python orchestrator &mdash; not a meta-agent.
          </p>
        </motion.div>

        {/* 6 agent cards */}
        <div className="mt-10 grid grid-cols-3 gap-3 lg:grid-cols-6">
          {AGENT_CARDS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: 0.2 + i * 0.08,
              }}
              className="rounded-xl border border-hairline bg-canvas p-4"
            >
              <div className="mb-2">{agent.icon}</div>
              <p className="text-xs font-medium text-text-primary">
                {agent.name}
              </p>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-accent-forest">
                {agent.role}
              </p>
              <p className="text-[10px] leading-[1.4] text-text-secondary">
                {agent.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-5 text-center font-mono text-[11px] text-text-tertiary"
        >
          Plus a deterministic Python orchestrator (not an LLM) sequencing
          the pipeline with real-time SSE streaming.
        </motion.p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 6: Why now (three columns)
// ─────────────────────────────────────────────────────────────

function WhyNowSection() {
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
            Why Now
          </p>
          <h2 className="mx-auto max-w-[600px] text-center text-xl font-medium leading-[1.2] text-text-primary">
            Three things changed at once.
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-3 gap-8">
          {/* Column 1 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
            className="rounded-xl border border-hairline bg-surface p-7"
          >
            <h3 className="mb-3 text-sm font-medium text-text-primary">
              AI got good enough
            </h3>
            <p className="text-xs leading-[1.6] text-text-secondary">
              Opus 4.7 reads handwritten Devanagari, reasons across
              multi-meeting archives, and refuses to fabricate citations.
              The capability gap that kept this from being a real product
              closed in late 2024.
            </p>
          </motion.div>

          {/* Column 2 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
            className="rounded-xl border border-hairline bg-surface p-7"
          >
            <h3 className="mb-3 text-sm font-medium text-text-primary">
              Donor reporting got stricter
            </h3>
            <p className="text-xs leading-[1.6] text-text-secondary">
              World Bank, GIZ, and FCDO all tightened evidence-traceability
              requirements after 2023. &ldquo;Show the source for every
              claim&rdquo; is no longer a polite request &mdash; it&apos;s
              a contractual condition for follow-on funding.
            </p>
          </motion.div>

          {/* Column 3 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.45 }}
            className="rounded-xl border border-hairline bg-surface p-7"
          >
            <h3 className="mb-3 text-sm font-medium text-text-primary">
              Senior consultant time is the bottleneck
            </h3>
            <p className="text-xs leading-[1.6] text-text-secondary">
              Indian development consulting grew double-digit YoY through
              2023 (KPMG India). Mid-market firms running &#x20B9;50&ndash;500
              crore programs are scaling fast &mdash; but partner-level
              reconciliation work doesn&apos;t scale. Poneglyph removes the
              bottleneck.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 7: Final CTA
// ─────────────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="bg-surface px-12 py-32">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="text-xl font-medium text-text-primary">
          See it work end-to-end.
        </h2>
        <p className="mx-auto mt-4 max-w-[520px] text-sm leading-[1.5] text-text-secondary">
          Run the canonical demo on synthetic Madhya Pradesh Farmer
          Producer Company project data. Watch Scout extract evidence from
          a Hindi PHM training attendance form, Archivist catch the seeded
          AgriMart walk-back across two stakeholder meetings, and the
          Briefing agent draft a World Bank Q2 prep &mdash; in about
          8&nbsp;minutes, on real Opus 4.7 calls.
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="inline-block rounded-lg bg-accent-forest px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Try the live demo &rarr;
          </Link>
        </div>
        <p className="mt-4 font-mono text-[11px] text-text-tertiary">
          Synthetic data only &middot; 100% open source &middot; MIT
          license
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 8: Footer
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
            @vedntzz
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
