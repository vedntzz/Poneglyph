"use client";

import {
  ArrowRight,
  Shield,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const GITHUB_URL = "https://github.com/vedntzz/Poneglyph";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07090A] text-slate-100 selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-white text-base">PONEGLYPH</span>
              <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-3xs font-semibold text-emerald-400 font-mono">
                V2 · INVOICE DEFENSE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-white transition"
            >
              GitHub
            </a>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
            >
              Launch Defense Center
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            Audit-Grade Proof for Development & Infrastructure Projects
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Stop losing millions to{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              delayed milestone invoices.
            </span>
          </h1>

          <p className="mx-auto max-w-3xl text-base sm:text-lg text-slate-400 leading-relaxed">
            In donor-funded projects (World Bank, GIZ, Govt), contractors lose 15–20% of their billing when field evidence has gaps. Poneglyph collects proof over WhatsApp, detects missing documents *before* submission, and auto-generates tamper-proof billing dossiers in one click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition shadow-xl shadow-emerald-500/25"
            >
              Open Live Milestone Demo (₹45L Invoice)
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              How It Works
            </a>
          </div>

          {/* Stat Callouts */}
          <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-2xl font-bold text-emerald-400 font-mono">60 Days</p>
              <p className="text-xs text-slate-300 mt-1 font-semibold">Faster Invoice Clearance</p>
              <p className="text-2xs text-slate-400 mt-0.5">Eliminates the 3-month back-and-forth audit cycle with donors.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-2xl font-bold text-emerald-400 font-mono">100%</p>
              <p className="text-xs text-slate-300 mt-1 font-semibold">Pixel-Coordinate Verified</p>
              <p className="text-2xs text-slate-400 mt-0.5">Every claimed number hyperlinks directly to the stamped paper register.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-2xl font-bold text-emerald-400 font-mono">₹0</p>
              <p className="text-xs text-slate-300 mt-1 font-semibold">Field Staff Training Needed</p>
              <p className="text-2xs text-slate-400 mt-0.5">Block officers just send photos over WhatsApp in Hindi or English.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Pillars */}
      <section id="how-it-works" className="py-16 px-6 border-t border-slate-800/80 bg-slate-950/40">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              The 3-Step Milestone Defense System
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              How consulting firms and contractors guarantee zero payment deductions on donor deliverables.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold font-mono">
                1
              </div>
              <h3 className="text-base font-bold text-white">The WhatsApp Field Siphon</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Field officers snap photos of paper attendance sheets, inauguration registers, and cold storage inspection forms over WhatsApp. AI reads Devanagari and English handwriting with official stamps.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono">
                2
              </div>
              <h3 className="text-base font-bold text-white">Pre-Billing Gap Radar</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Before sending the invoice to the donor, Poneglyph flags missing proofs: <em>&ldquo;Target is 50 centers. You have proof for 28. Missing 8 from Raisen.&rdquo;</em> Auto-dispatches WhatsApp collection prompts in one click.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
                3
              </div>
              <h3 className="text-base font-bold text-white">1-Click Audited Dossier</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generates the official World Bank ISR or GIZ Progress Report where every claim is deep-linked to a high-res scanned register with coordinate bounding boxes. Passed on first submission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="border-t border-slate-800 py-12 px-6 text-center text-xs text-slate-500 space-y-4">
        <p>Poneglyph V2 · Built for Multilateral Development Projects & Public Infrastructure.</p>
        <div className="flex justify-center gap-4">
          <Link href="/app" className="text-emerald-400 hover:underline">
            Launch Application
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-slate-400 hover:underline">
            Source Code (MIT)
          </a>
        </div>
      </footer>
    </div>
  );
}
