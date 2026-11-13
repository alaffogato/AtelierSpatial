import React, { useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { CONTRACTORS_DIRECTORY } from '../data/contractors';
import {
  ColorScheme,
  CostEstimate,
  MoodBoardPhoto,
  RoomConfig,
  StyleDefinition,
} from '../types/design';

interface ExportBriefModalProps {
  open: boolean;
  onClose: () => void;
  room: RoomConfig;
  style: StyleDefinition;
  scheme: ColorScheme;
  pinnedPhotos: MoodBoardPhoto[];
  estimate: CostEstimate;
  shortlistedContractorIds: string[];
}

export const ExportBriefModal: React.FC<ExportBriefModalProps> = ({
  open,
  onClose,
  room,
  style,
  scheme,
  pinnedPhotos,
  estimate,
  shortlistedContractorIds,
}) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const shortlisted = CONTRACTORS_DIRECTORY.filter((c) =>
    shortlistedContractorIds.includes(c.id),
  );

  const briefPayload = {
    project: 'Atelier Spatial DIY Renovation Brief',
    generatedAt: new Date().toISOString(),
    space: {
      dimensionsFt: { width: room.widthFt, length: room.lengthFt, height: room.heightFt },
      areaSqFt: estimate.areaSqFt,
      layoutPreset: room.layoutPreset,
      floorPlanFile: room.floorPlanName,
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
    budgetEstimate: {
      materialsTotal: estimate.materialsTotal,
      laborTotal: estimate.laborTotal,
      contingency: estimate.contingency,
      rangeLow: estimate.estimatedLow,
      rangeHigh: estimate.estimatedHigh,
      lineItems: estimate.rows,
    },
    shortlistedContractors: shortlisted.map((c) => ({
      name: c.name,
      specialty: c.specialty,
      directoryUrl: c.directoryUrl,
    })),
  };

  const handleCopySummary = async () => {
    const summaryText = [
      `ATELIER SPATIAL — PROJECT BRIEF`,
      `Space: ${room.widthFt} ft × ${room.lengthFt} ft (${estimate.areaSqFt} sq ft, ${room.heightFt} ft ceiling)`,
      `Style & Palette: ${style.name} — ${scheme.name}`,
      `Materials: ${style.materialSpecs.flooring} | ${style.materialSpecs.walls}`,
      `Estimated Budget: $${estimate.estimatedLow.toLocaleString()} – $${estimate.estimatedHigh.toLocaleString()}`,
      `Shortlisted Contractors: ${
        shortlisted.length > 0 ? shortlisted.map((c) => c.name).join(', ') : 'None selected yet'
      }`,
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
    a.download = `atelier-spatial-brief-${style.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-brief-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1917]/60"
    >
      <div className="bg-white border border-[#E6E3DC] rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6E3DC] flex items-center justify-between gap-4">
          <h2 id="export-brief-title" className="font-display text-lg font-semibold text-[#1A1917]">
            Renovation Project Brief
          </h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1.5 text-[#64615B] hover:text-[#1A1917] rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-sm">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#EFECE6]">
            <div>
              <p className="text-xs text-[#64615B]">Space Dimensions</p>
              <p className="font-medium text-[#1A1917] font-mono tabular-nums">
                {room.widthFt}′ × {room.lengthFt}′ ({estimate.areaSqFt} sq ft)
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64615B]">Selected Style &amp; Scheme</p>
              <p className="font-medium text-[#1A1917]">
                {style.name} · {scheme.name}
              </p>
            </div>
          </div>

          <div className="pb-4 border-b border-[#EFECE6]">
            <p className="text-xs text-[#64615B] mb-2">Color Palette Swatches</p>
            <div className="flex items-center gap-2">
              {scheme.swatches.map((hex) => (
                <div key={hex} className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded-sm border border-black/15"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-xs font-mono text-[#64615B]">{hex}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-4 border-b border-[#EFECE6]">
            <p className="text-xs text-[#64615B] mb-1">Estimated Budget Range</p>
            <p className="font-display text-xl font-bold font-mono tabular-nums text-[#1B4D3E]">
              ${estimate.estimatedLow.toLocaleString()} – ${estimate.estimatedHigh.toLocaleString()}
            </p>
            <p className="text-xs text-[#64615B] mt-1">
              {estimate.rows.length} scope packages active · {pinnedPhotos.length} mood board looks pinned
            </p>
          </div>

          <div>
            <p className="text-xs text-[#64615B] mb-1.5">Shortlisted Contractors</p>
            {shortlisted.length === 0 ? (
              <p className="text-xs text-[#64615B]">
                No contractors shortlisted yet. Select pros in Section 04 to include them here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {shortlisted.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1A1917]">{c.name}</span>
                    <span className="text-[#64615B]">{c.specialty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-[#FAF9F6] border-t border-[#E6E3DC] flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#1B4D3E]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Summary' : 'Copy Summary'}
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON Brief
          </button>
        </div>
      </div>
    </div>
  );
};
