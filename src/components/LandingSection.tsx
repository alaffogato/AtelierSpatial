import React from 'react';
import { ArrowRight, Box, Calculator, FileCheck2, Palette, ShieldCheck } from 'lucide-react';
import { SAMPLE_FLOOR_PLAN_IMAGE } from '../data/styles';
import { ColorScheme, CostEstimate, RoomConfig, StyleDefinition, UnitSystem } from '../types/design';
import { formatArea, formatLength } from '../utils/units';

interface LandingSectionProps {
  room: RoomConfig;
  unitSystem: UnitSystem;
  selectedStyle: StyleDefinition;
  selectedScheme: ColorScheme;
  estimate: CostEstimate;
  onNavigate: (sectionId: string) => void;
  onOneClickQuote: () => void;
}

export const LandingSection: React.FC<LandingSectionProps> = ({
  room,
  unitSystem,
  selectedStyle,
  selectedScheme,
  estimate,
  onNavigate,
  onOneClickQuote,
}) => {
  return (
    <section id="overview" className="pt-10 pb-16 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6">
        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch mb-14">
          {/* Left Proposition */}
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-medium tracking-wide text-[#64615B] mb-3">
                Singapore Home Renovation Studio · HDB, Condo &amp; Landed
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-[#1A1917] leading-[1.08] [text-wrap:balance] mb-5">
                Turn your floor plan into a 3D space and instant Singapore contractor quotes.
              </h1>
              <p className="text-base text-[#4B4842] leading-relaxed max-w-xl mb-8">
                Upload your 2D layout and existing room photos, explore curated style mood boards, walk through your redesigned space in interactive 3D, calculate itemized SGD renovation costs, and send your project brief to vetted Singapore contractors in one click.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => onNavigate('space')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Upload Floor Plan
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOneClickQuote}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4 text-[#1B4D3E]" />
                  1-Click Get Quotations
                </button>
              </div>
            </div>

            {/* Quiet Trust Markers below Hero Copy */}
            <div className="pt-5 border-t border-[#E6E3DC] grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-mono tabular-nums text-base font-semibold text-[#1A1917]">
                  5 Styles · 15 Palettes
                </p>
                <p className="text-[#64615B]">Live-mapped onto 3D PBR finishes</p>
              </div>
              <div>
                <p className="font-mono tabular-nums text-base font-semibold text-[#1A1917]">
                  Orbit + Eye-Level
                </p>
                <p className="text-[#64615B]">Pan, zoom, rotate &amp; walk through</p>
              </div>
              <div>
                <p className="font-mono tabular-nums text-base font-semibold text-[#1A1917]">
                  HDB &amp; BCA Pros
                </p>
                <p className="text-[#64615B]">Matched Singapore contractors</p>
              </div>
            </div>
          </div>

          {/* Right Editorial Visual */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-[#E6E3DC] bg-[#EAE6DD] min-h-[340px]">
            <img
              src={selectedStyle.heroImage}
              alt={`${selectedStyle.name} interior visualisation`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-white/80 mb-0.5">
                  Active Workspace Preview · {formatLength(room.widthFt, unitSystem)} × {formatLength(room.lengthFt, unitSystem)} ({formatArea(estimate.areaSqFt, unitSystem)})
                </p>
                <p className="font-display text-lg font-semibold">
                  {selectedStyle.name} — {selectedScheme.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('studio3d')}
                className="px-3.5 py-2 text-xs font-medium text-[#1A1917] bg-white hover:bg-[#F1EFE9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open 3D Walkthrough
              </button>
            </div>
          </div>
        </div>

        {/* Asymmetric Bento Capabilities Grid (01 - 04) */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-[#1A1917]">
            Four integrated steps from empty plan to contractor quote
          </h2>
          <span className="text-xs text-[#64615B] hidden sm:inline">
            Changes in any step update the entire studio live
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 01. Floor Plan Visualisation (Wide 7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E6E3DC] rounded-xl p-6 flex flex-col sm:flex-row gap-6 items-stretch justify-between">
            <div className="flex flex-col justify-between flex-1">
              <div>
                <p className="text-xs font-medium text-[#64615B] mb-1.5">
                  01. Floor Plan Visualisation &amp; 3D Walkthrough
                </p>
                <h3 className="font-display text-lg font-semibold text-[#1A1917] mb-2">
                  Convert 2D HDB or condo plans into an interactive 3D room.
                </h3>
                <p className="text-sm text-[#4B4842] leading-relaxed mb-4">
                  Upload any floor plan image and photos of your current space. Dimensions, openings, and partition walls translate directly into a 3D model you can orbit, zoom, pan, and walk through at eye level.
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#EFECE6]">
                <span className="text-xs font-mono tabular-nums text-[#64615B]">
                  Current: {formatLength(room.widthFt, unitSystem)} × {formatLength(room.lengthFt, unitSystem)} · {formatArea(estimate.areaSqFt, unitSystem)}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('studio3d')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B4D3E] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5" />
                  Launch 3D View
                </button>
              </div>
            </div>
            <div className="sm:w-52 shrink-0 rounded-lg overflow-hidden border border-[#E6E3DC] bg-[#F8F7F4]">
              <img
                src={room.floorPlanUrl ?? SAMPLE_FLOOR_PLAN_IMAGE}
                alt="2D architectural floor plan preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* 02. Style Inspiration (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[#64615B] mb-1.5">
                02. Renovation Style Inspiration
              </p>
              <h3 className="font-display text-lg font-semibold text-[#1A1917] mb-2">
                Unsplash-powered mood boards &amp; live material palettes.
              </h3>
              <p className="text-sm text-[#4B4842] leading-relaxed mb-4">
                Compare Japandi, Mid-Century, Scandinavian, Industrial, and Coastal looks. Pick a palette and immediately preview timber floors, limewash walls, rugs, and upholstery in 3D.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#EFECE6]">
              <div className="flex items-center gap-1.5">
                {selectedScheme.swatches.map((hex, i) => (
                  <span
                    key={`${hex}-${i}`}
                    className="w-4 h-4 rounded-sm border border-black/15"
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <span className="text-xs text-[#64615B] ml-1">{selectedScheme.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('moodboard')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B4D3E] hover:underline whitespace-nowrap cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                Style Board
              </button>
            </div>
          </div>

          {/* 03. SGD Renovation Budget Estimate (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[#64615B] mb-1.5">
                03. Renovation Budget Estimate
              </p>
              <h3 className="font-display text-lg font-semibold text-[#1A1917] mb-2">
                Itemized SGD material &amp; trade labor breakdown.
              </h3>
              <p className="text-sm text-[#4B4842] leading-relaxed mb-4">
                Toggle flooring, plaster painting, EMA electrical rewiring, custom carpentry, and loose furnishings to calculate costs per square foot with a 10% contingency buffer.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#EFECE6]">
              <span className="text-xs font-mono tabular-nums font-semibold text-[#1A1917]">
                S${estimate.estimatedLow.toLocaleString()} – S${estimate.estimatedHigh.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('estimate')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B4D3E] hover:underline whitespace-nowrap cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                View Ledger
              </button>
            </div>
          </div>

          {/* 04. Singapore Contractor Recommendations + 1-Click Quotation (Wide 7 cols) */}
          <div className="lg:col-span-7 bg-[#1A1917] text-white border border-[#2C2A26] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[#C8C3B8] mb-1.5">
                04. Singapore Contractor Recommendations &amp; 1-Click Quotations
              </p>
              <h3 className="font-display text-lg font-semibold text-white mb-2">
                Match with HDB-registered &amp; CaseTrust Singapore pros and request quotes in one click.
              </h3>
              <p className="text-sm text-[#D4CFC4] leading-relaxed mb-5">
                Skip repetitive site briefs. Your floor plan dimensions, selected {selectedStyle.name} ({selectedScheme.name}) palette, and renovation scope are packaged automatically so you can obtain comparable quotations from vetted Singapore contractors with one click.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/15">
              <div className="inline-flex items-center gap-2 text-xs text-[#D4CFC4]">
                <ShieldCheck className="w-4 h-4 text-[#6EE7B7]" />
                <span>Includes Qanvast, Renonation, HDB DRC &amp; BCA verified firms</span>
              </div>
              <button
                type="button"
                onClick={onOneClickQuote}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1A1917] bg-white hover:bg-[#F1EFE9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-[#1B4D3E]" />
                1-Click Get Quotations
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
