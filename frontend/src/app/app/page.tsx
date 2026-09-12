"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { AppNav } from "@/components/app-nav";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ProjectData {
  id: string;
  name: string;
  donor_type: string;
  contract_code: string;
  contract_value_inr: number;
  currency: string;
  description: string;
}

interface MilestoneData {
  id: string;
  title: string;
  logframe_code: string;
  target_quantity: number;
  target_unit: string;
  verified_quantity: number;
  partial_quantity: number;
  missing_quantity: number;
  invoice_amount_inr: number;
  status: string;
  deadline: string;
}

interface Metrics {
  target_quantity: number;
  verified_quantity: number;
  partial_quantity: number;
  missing_quantity: number;
  readiness_percentage: number;
  invoice_amount_inr: number;
  at_risk_amount_inr: number;
  open_gaps_count: number;
  total_evidence_count: number;
}

interface GapAlert {
  id: string;
  milestone_id: string;
  issue_type: string;
  severity: string;
  title: string;
  description: string;
  recommended_action: string;
  dispatch_prompt_hindi: string;
  dispatch_prompt_english: string;
  target_recipient_phone: string;
  target_recipient_name: string;
  status: string;
}

interface DossierClaim {
  claim_id: string;
  text: string;
  evidence_id: string;
  verification_status: string;
  confidence: string;
  evidence_snippet: string;
  image_url: string;
  bounding_box: [number, number, number, number];
}

interface DossierData {
  id: string;
  donor_format: string;
  title: string;
  invoice_ref: string;
  total_claimed_inr: number;
  status: string;
  claims: DossierClaim[];
}

export default function PoneglyphV2App() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [milestone, setMilestone] = useState<MilestoneData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [gaps, setGaps] = useState<GapAlert[]>([]);
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<DossierClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, gapsRes, dosRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v2/project`),
        fetch(`${BACKEND_URL}/api/v2/gaps`),
        fetch(`${BACKEND_URL}/api/v2/dossier`),
      ]);

      if (projRes.ok) {
        const pData = await projRes.json();
        setProject(pData.project);
        setMilestone(pData.primary_milestone);
        setMetrics(pData.metrics);
      }

      if (gapsRes.ok) {
        const gData = await gapsRes.json();
        setGaps(gData);
      }

      if (dosRes.ok) {
        const dData = await dosRes.json();
        setDossier(dData);
        if (dData.claims && dData.claims.length > 0) {
          setSelectedClaim(dData.claims[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load V2 data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleDispatchPrompt = async (gapId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v2/gaps/${gapId}/dispatch`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        showToast(
          `⚡ WhatsApp prompt dispatched to ${data.dispatch_details.recipient}`
        );
        fetchData();
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateWhatsAppIngest = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v2/ingest/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_name: "Mahesh Sharma",
          sender_role: "Block Coordinator, Raisen",
          district: "Raisen",
          village: "Gairatganj",
          sample_image: "/static/synthetic/form_hindi.png",
          message_text:
            "नमस्ते, रायसेन के 8 नवीन एग्रीमार्ट केंद्रों के उद्घाटन रजिस्टर व साइनबोर्ड फोटो संलग्न हैं।",
          milestone_id: "ms-003",
          gap_id: "gap-001",
        }),
      });

      if (res.ok) {
        showToast(
          "📥 Received Raisen field register via WhatsApp! Pixel bounding box extracted. Milestone updated to 36/50 verified."
        );
        await fetchData();
      }
    } catch (err) {
      console.error("WhatsApp ingest error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v2/reset`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("🔄 Reset demo state to 8 open gaps.");
        await fetchData();
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#0A0D0E] text-slate-100 font-sans selection:bg-emerald-500/30">
      <AppNav />

      {loading && !project && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Milestone & Invoice Data...
          </div>
        </div>
      )}

      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 right-6 z-50 max-w-md rounded-xl border border-emerald-500/40 bg-emerald-950/90 p-4 text-xs text-emerald-200 shadow-2xl backdrop-blur-md flex items-center gap-3"
          >
            <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
            <p>{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* ── 1. Top Executive Banner ── */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-2xs font-semibold text-emerald-400">
                <Shield className="h-3.5 w-3.5" />
                PONEGLYPH V2 · MILESTONE & INVOICE DEFENSE SHIELD
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {project?.name ?? "Madhya Pradesh Farmer Producer Company Program"}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Donor: <span className="text-slate-200 font-medium">{project?.donor_type}</span> · Contract:{" "}
                <span className="text-slate-200 font-mono">{project?.contract_code}</span> · Value:{" "}
                <span className="text-emerald-400 font-bold">{formatINR(project?.contract_value_inr ?? 52000000)}</span>
              </p>
            </div>

            {/* Invoice Status Pill & Reset */}
            <div className="flex flex-col items-start md:items-end gap-3">
              <div className="flex items-center gap-2">
                {metrics && metrics.missing_quantity > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                    ⚠️ {metrics.missing_quantity} Gaps Blocking Billing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ✓ 100% Audit-Ready for Submission
                  </span>
                )}

                <button
                  onClick={handleReset}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                  title="Reset demo data"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                  Reset Demo
                </button>
              </div>

              <p className="text-2xs text-slate-400">
                Next Submission Deadline: <span className="text-slate-200 font-mono">{milestone?.deadline}</span>
              </p>
            </div>
          </div>

          {/* ── 2. Milestone 3 Financial & Proof Readiness Meter ── */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Metric 1: Active Invoice */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-2xs text-slate-400 uppercase tracking-wider font-semibold">
                Active Invoice Payment
              </span>
              <p className="mt-1 text-2xl font-bold text-white font-mono">
                {formatINR(metrics?.invoice_amount_inr ?? 4500000)}
              </p>
              <p className="mt-1 text-2xs text-slate-400">Milestone 3 Deliverables</p>
            </div>

            {/* Metric 2: At Risk Deduction */}
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4">
              <span className="text-2xs text-rose-400 uppercase tracking-wider font-semibold">
                At-Risk Deduction
              </span>
              <p className="mt-1 text-2xl font-bold text-rose-400 font-mono">
                {formatINR(metrics?.at_risk_amount_inr ?? 1200000)}
              </p>
              <p className="mt-1 text-2xs text-rose-400/80">
                {metrics?.missing_quantity ?? 8} centers missing field proof
              </p>
            </div>

            {/* Metric 3 & 4: Readiness Meter (Spans 2 cols) */}
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">
                  Proof Readiness: {metrics?.verified_quantity} of {metrics?.target_quantity} Centers Certified
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {metrics?.readiness_percentage}%
                </span>
              </div>

              {/* Progress Bar with 3 segments */}
              <div className="my-2 h-3.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                <div
                  style={{
                    width: `${((metrics?.verified_quantity ?? 28) / (metrics?.target_quantity ?? 50)) * 100}%`,
                  }}
                  className="bg-emerald-500 transition-all duration-500"
                  title="Verified with Stamped Registers"
                />
                <div
                  style={{
                    width: `${((metrics?.partial_quantity ?? 14) / (metrics?.target_quantity ?? 50)) * 100}%`,
                  }}
                  className="bg-amber-500 transition-all duration-500"
                  title="MoU Signed, Missing Site Photo"
                />
                <div
                  style={{
                    width: `${((metrics?.missing_quantity ?? 8) / (metrics?.target_quantity ?? 50)) * 100}%`,
                  }}
                  className="bg-rose-500 transition-all duration-500"
                  title="Zero Field Evidence"
                />
              </div>

              <div className="flex items-center justify-between text-2xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Verified: {metrics?.verified_quantity}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Partial (MoU only): {metrics?.partial_quantity}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Missing Proof: {metrics?.missing_quantity}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Pre-Billing Gap Radar & WhatsApp Field Siphon ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Pre-Billing Gap Radar & WhatsApp Field Siphon
              </h2>
            </div>
            <span className="text-2xs text-slate-400">
              Auto-detects missing evidence BEFORE the World Bank IEG review
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {gaps.map((gap) => (
              <motion.div
                key={gap.id}
                layout
                className={`rounded-xl border p-5 transition-all ${
                  gap.status === "RESOLVED"
                    ? "border-emerald-500/30 bg-emerald-950/10 opacity-75"
                    : gap.severity === "CRITICAL"
                    ? "border-rose-500/40 bg-rose-950/10 shadow-lg"
                    : "border-amber-500/40 bg-amber-950/10 shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-3xs font-bold uppercase ${
                          gap.severity === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {gap.severity} RISK
                      </span>
                      <span className="text-3xs font-mono text-slate-400">
                        {gap.issue_type}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{gap.title}</h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                      gap.status === "RESOLVED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : gap.status === "DISPATCHED"
                        ? "bg-sky-500/20 text-sky-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {gap.status}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {gap.description}
                </p>

                {/* WhatsApp Prompt Preview */}
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="flex items-center gap-1 font-semibold text-emerald-400">
                      <MessageSquare className="h-3 w-3" />
                      WhatsApp Prompt for: {gap.target_recipient_name}
                    </span>
                    <span className="font-mono">{gap.target_recipient_phone}</span>
                  </div>
                  <p className="text-slate-300 font-sans italic bg-slate-950/60 p-2 rounded border border-slate-800/80">
                    &ldquo;{gap.dispatch_prompt_hindi}&rdquo;
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {gap.status !== "RESOLVED" && (
                    <>
                      <button
                        onClick={() => handleDispatchPrompt(gap.id)}
                        disabled={actionLoading || gap.status === "DISPATCHED"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 transition disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {gap.status === "DISPATCHED"
                          ? "✓ Prompt Sent via WhatsApp"
                          : "⚡ Dispatch WhatsApp Prompt"}
                      </button>

                      {gap.id === "gap-001" && (
                        <button
                          onClick={handleSimulateWhatsAppIngest}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          📥 Simulate Inbound Proof from Raisen (WhatsApp)
                        </button>
                      )}
                    </>
                  )}

                  {gap.status === "RESOLVED" && (
                    <span className="inline-flex items-center gap-1 text-2xs text-emerald-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Resolved with WhatsApp register ev-wa-001 (Raisen KVK Certified)
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 4. Split-Screen Interactive Audit Dossier Inspector ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Official World Bank ISR Dossier & Pixel Evidence Inspector
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => showToast("📄 Downloading Audit Dossier PDF with verified proof links...")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Export Audit PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            {/* Left Column (5 Cols): Claim List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-3xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  {dossier?.donor_format} · {dossier?.invoice_ref}
                </span>
                <h3 className="text-sm font-bold text-white mt-1">
                  {dossier?.title}
                </h3>
                <p className="text-2xs text-slate-400">
                  Click any claim to inspect the stamped, pixel-coordinate paper proof on the right.
                </p>
              </div>

              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {dossier?.claims.map((claim) => {
                  const isSelected = selectedClaim?.claim_id === claim.claim_id;
                  return (
                    <div
                      key={claim.claim_id}
                      onClick={() => setSelectedClaim(claim)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/50"
                          : "border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between text-2xs mb-2">
                        <span className="font-mono text-slate-400 font-semibold">
                          Claim #{claim.claim_id}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-3xs font-bold ${
                            claim.verification_status === "VERIFIED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {claim.verification_status} ✓
                        </span>
                      </div>

                      <p className="text-xs text-white font-medium leading-relaxed">
                        &ldquo;{claim.text}&rdquo;
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-3xs text-slate-400 border-t border-slate-800/60 pt-2">
                        <span>Source: <strong className="text-slate-300">{claim.evidence_id}</strong></span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          Confidence: {claim.confidence}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (7 Cols): High-Res Document Proof Viewer */}
            <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-2xs text-slate-400 font-medium">
                    Evidence Document:
                  </span>
                  <p className="text-xs font-bold text-white font-mono">
                    {selectedClaim?.evidence_id} (Scanned Paper Register / KVK Stamp)
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-3xs font-bold text-emerald-400 font-mono">
                  <Shield className="h-3 w-3" />
                  PIXEL-GROUNDED PROOF
                </span>
              </div>

              {/* Document Scan with SVG Coordinate Highlight Box */}
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                {selectedClaim && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedClaim.image_url}
                      alt="Verified Document Scan"
                      className="absolute inset-0 h-full w-full object-contain filter contrast-125"
                    />

                    {/* Glowing coordinate box */}
                    <svg
                      viewBox="0 0 1000 1000"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                    >
                      <rect
                        x={selectedClaim.bounding_box[1]}
                        y={selectedClaim.bounding_box[0]}
                        width={
                          selectedClaim.bounding_box[3] -
                          selectedClaim.bounding_box[1]
                        }
                        height={
                          selectedClaim.bounding_box[2] -
                          selectedClaim.bounding_box[0]
                        }
                        fill="rgba(16, 185, 129, 0.2)"
                        stroke="rgba(16, 185, 129, 0.9)"
                        strokeWidth="8"
                        strokeDasharray="12 6"
                        className="animate-pulse"
                      />
                    </svg>
                  </>
                )}
              </div>

              {/* Extracted Text Snippet */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-2xs space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-3xs">
                  OCR Text Extracted by Scout Agent (Native Devanagari & English):
                </span>
                <p className="text-emerald-300 font-mono text-xs">
                  &ldquo;{selectedClaim?.evidence_snippet}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
