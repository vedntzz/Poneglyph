"use client";

import { DocumentCard, type DocumentStatus, type DocumentType } from "./document-card";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DemoDocument {
  id: string;
  filename: string;
  type: DocumentType;
  status: DocumentStatus;
  evidenceCount: number;
  thumbnailUrl: string | null;
}

interface DocumentsPanelProps {
  documents: DemoDocument[];
  selectedDocumentId: string | null;
  onDocumentClick: (doc: DemoDocument) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Documents panel — replaces MemoryFeed.
 *
 * Shows uploaded documents as cards with thumbnails and status pills.
 * Pre-populated in demo mode with the 3 form images and 2 transcripts.
 * Bottom drag-drop zone is visual-only (non-functional in demo mode).
 */
export function DocumentsPanel({
  documents,
  selectedDocumentId,
  onDocumentClick,
}: DocumentsPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Documents
        </h2>
        <p className="mt-0.5 font-mono text-2xs text-zinc-600">
          {documents.length} file{documents.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Document list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            id={doc.id}
            filename={doc.filename}
            type={doc.type}
            status={doc.status}
            evidenceCount={doc.evidenceCount}
            thumbnailUrl={doc.thumbnailUrl}
            isSelected={doc.id === selectedDocumentId}
            onClick={() => onDocumentClick(doc)}
          />
        ))}
      </div>

      {/* Drag-drop zone — visual affordance only in demo mode */}
      <div className="shrink-0 border-t border-zinc-800 px-3 py-3">
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 px-4 py-3">
          <div className="text-center">
            <p className="text-2xs text-zinc-500">+ Add document</p>
            <p className="mt-0.5 font-mono text-2xs text-zinc-700">
              Upload disabled in demo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
