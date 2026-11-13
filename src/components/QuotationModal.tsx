import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileDown, Send, X } from 'lucide-react';
import { CONTRACTORS_DIRECTORY } from '../data/contractors';
import {
  ColorScheme,
  CostEstimate,
  MoodBoardPhoto,
  RoomConfig,
  StyleDefinition,
  UnitSystem,
} from '../types/design';
import { formatArea, formatLength } from '../utils/units';

interface QuotationModalProps {
  open: boolean;
  onClose: () => void;
  room: RoomConfig;
  unitSystem: UnitSystem;
  style: StyleDefinition;
  scheme: ColorScheme;
  pinnedPhotos: MoodBoardPhoto[];
  estimate: CostEstimate;
  shortlistedContractorIds: string[];
  onExportPdf: (opts?: { propertyType?: string; postalDistrict?: string }) => Promise<void>;
  exportingPdf?: boolean;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  open,
  onClose,
  room,
  unitSystem,
  style,
  scheme,
  pinnedPhotos,
  estimate,
  shortlistedContractorIds,
  onExportPdf,
  exportingPdf = false,
}) => {
  const [propertyType, setPropertyType] = useState<'HDB BTO / Resale' | 'Condominium' | 'Landed'>('HDB BTO / Resale');
  const [contactEmail, setContactEmail] = useState('');
  const [postalDistrict, setPostalDistrict] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If user hasn't manually shortlisted pros yet, auto-match top 3 Singapore contractors for their selected style
  const targetContractors = useMemo(() => {
    const manual = CONTRACTORS_DIRECTORY.filter((c) =>
      shortlistedContractorIds.includes(c.id),
    );
    if (manual.length > 0) return manual;
    return CONTRACTORS_DIRECTORY.filter((c) =>
      c.recommendedFor.includes(style.id),
    ).slice(0, 3);
  }, [shortlistedContractorIds, style.id]);

  if (!open) return null;

  const briefPayload = {
    project: 'Atelier Spatial Singapore Renovation Quotation Packet',
    generatedAt: new Date().toISOString(),
    propertyType,
    postalCode: postalDistrict || 'Singapore',
    space: {
      dimensionsFt: { width: room.widthFt, length: room.lengthFt, height: room.heightFt },
      areaSqFt: estimate.areaSqFt,
      layoutPreset: room.layoutPreset,
      floorPlanFile: room.floorPlanName ?? 'Calibrated Spatial Layout',
      photosCount: room.photos.length,
    },
    designSelection: {
      style: style.name,
      colorScheme: scheme.name,
      swatches: scheme.swatches,
      materialSpecs: style.materialSpecs,
      pinnedInspiration: pinnedPhotos.map((p) => ({
        title: p.title,
        category: p.category,
        photographer: p.photographer,
        url: p.photographerUrl,
      })),
    },
    budgetEstimateSGD: {
      materialsTotal: estimate.materialsTotal,
      laborTotal: estimate.laborTotal,
      contingency: estimate.contingency,
      rangeLow: estimate.estimatedLow,
      rangeHigh: estimate.estimatedHigh,
      lineItems: estimate.rows,
    },
    targetSingaporeContractors: targetContractors.map((c) => ({
      name: c.name,
      specialty: c.specialty,
      location: c.location,
      directoryUrl: c.directoryUrl,
    })),
  };

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = contactEmail.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter a valid email address to receive your contractor quotations.');
      return;
    }
    setFormError(null);
    const refId = `SG-${style.id.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmittedRef(refId);
  };

  const handleCopySummary = async () => {
    const summaryText = [
      `ATELIER SPATIAL SG — RENOVATION QUOTATION BRIEF`,
      `Property Type: ${propertyType}${postalDistrict ? ` (${postalDistrict})` : ''}`,
      `Space: ${formatLength(room.widthFt, unitSystem)} × ${formatLength(room.lengthFt, unitSystem)} (${formatArea(estimate.areaSqFt, unitSystem)}, ${formatLength(room.heightFt, unitSystem)} ceiling)`,
      `Style & Palette: ${style.name} — ${scheme.name}`,
      `Materials: ${style.materialSpecs.flooring} | ${style.materialSpecs.walls}`,
      `Estimated SGD Budget: S$${estimate.estimatedLow.toLocaleString()} – S$${estimate.estimatedHigh.toLocaleString()}`,
      `Singapore Contractors (${targetContractors.length}): ${targetContractors.map((c) => c.name).join(', ')}`,
    ].join('\n');

    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(briefPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atelier-sg-quote-brief-${style.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1917]/65"
    >
      <div className="bg-white border border-[#E6E3DC] rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6E3DC] flex items-center justify-between gap-4">
          <div>
            <h2 id="quote-modal-title" className="font-display text-lg font-semibold text-[#1A1917]">
              1-Click Singapore Renovation Quotation
            </h2>
            <p className="text-xs text-[#64615B]">
              Bundles your floor plan, 3D screenshots, {style.name} mood board, and SGD scope
            </p>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => {
              setSubmittedRef(null);
              onClose();
            }}
            className="p-1.5 text-[#64615B] hover:text-[#1A1917] rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-sm">
          {submittedRef ? (
            <div className="p-5 rounded-xl bg-[#1B4D3E]/8 border border-[#1B4D3E]/25">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#1B4D3E] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-base font-semibold text-[#1A1917] mb-1">
                    Quotation Packet Prepared · Ref {submittedRef}
                  </h3>
                  <p className="text-xs text-[#4B4842] leading-relaxed mb-3">
                    Your {estimate.areaSqFt} sq ft {propertyType} floor plan and {style.name} ({scheme.name}) brief has been compiled for {targetContractors.length} Singapore contractors and queued for {contactEmail}. You can also download the JSON packet or copy the summary below.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmittedRef(null)}
                    className="text-xs font-medium text-[#1B4D3E] hover:underline cursor-pointer"
                  >
                    Edit quotation details
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Auto-Bundled Floor Plan & Style Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[#EFECE6]">
            <div>
              <p className="text-xs text-[#64615B]">Floor Plan Dimensions</p>
              <p className="font-medium text-[#1A1917] font-mono tabular-nums">
                {formatLength(room.widthFt, unitSystem)} × {formatLength(room.lengthFt, unitSystem)} ({formatArea(estimate.areaSqFt, unitSystem)})
              </p>
              <p className="text-[11px] text-[#64615B] truncate">
                {room.floorPlanName ?? 'Custom Calibrated Plan'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64615B]">Selected Style &amp; Scheme</p>
              <p className="font-medium text-[#1A1917]">
                {style.name} · {scheme.name}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {scheme.swatches.map((hex, i) => (
                  <span
                    key={`${hex}-${i}`}
                    className="w-3.5 h-3.5 rounded-xs border border-black/15"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#64615B]">Estimated Budget (SGD)</p>
              <p className="font-display font-bold font-mono tabular-nums text-[#1B4D3E]">
                S${estimate.estimatedLow.toLocaleString()} – S${estimate.estimatedHigh.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#64615B]">
                {estimate.rows.length} work packages · {pinnedPhotos.length} mood looks
              </p>
            </div>
          </div>

          {/* Target Singapore Contractors */}
          <div className="pb-4 border-b border-[#EFECE6]">
            <p className="text-xs font-medium text-[#64615B] mb-2">
              Matched Singapore Renovation Contractors ({targetContractors.length})
            </p>
            <ul className="divide-y divide-[#F1EFE9] border border-[#E6E3DC] rounded-lg">
              {targetContractors.map((c) => (
                <li key={c.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-medium text-[#1A1917]">{c.name}</p>
                    <p className="text-[#64615B]">{c.specialty} · {c.location}</p>
                  </div>
                  <span className="font-mono text-[#1B4D3E] font-medium shrink-0">
                    {c.rateTier} · {c.rating.toFixed(1)}★
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 1-Click Quotation Form */}
          <form id="one-click-quote-form" onSubmit={handleSubmitQuote} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-[#64615B] mb-1">
                  SG Property Type
                </span>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#DCD8CF] rounded-lg text-[#1A1917] focus:outline-none focus:border-[#1B4D3E]"
                >
                  <option value="HDB BTO / Resale">HDB BTO / Resale</option>
                  <option value="Condominium">Condominium</option>
                  <option value="Landed">Landed</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-[#64615B] mb-1">
                  Postal / Estate (Optional)
                </span>
                <input
                  type="text"
                  value={postalDistrict}
                  onChange={(e) => setPostalDistrict(e.target.value)}
                  placeholder="e.g. Tampines / D15"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#DCD8CF] rounded-lg text-[#1A1917] placeholder:text-[#8E8A82] focus:outline-none focus:border-[#1B4D3E]"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-[#64615B] mb-1">
                  Email for Quotations
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => {
                    setContactEmail(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#DCD8CF] rounded-lg text-[#1A1917] placeholder:text-[#8E8A82] focus:outline-none focus:border-[#1B4D3E]"
                />
              </label>
            </div>
            {formError && <p className="text-xs text-[#B91C1C] font-medium">{formError}</p>}
          </form>
        </div>

        <div className="px-6 py-4 bg-[#FAF9F6] border-t border-[#E6E3DC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() =>
                void onExportPdf({
                  propertyType,
                  postalDistrict: postalDistrict.trim() || undefined,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1B4D3E] bg-[#1B4D3E]/10 border border-[#1B4D3E]/30 hover:bg-[#1B4D3E]/15 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              {exportingPdf ? 'Generating PDF...' : 'Export PDF Brief'}
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#1B4D3E]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Brief'}
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>

          <button
            type="submit"
            form="one-click-quote-form"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send 1-Click Quote Request
          </button>
        </div>
      </div>
    </div>
  );
};
