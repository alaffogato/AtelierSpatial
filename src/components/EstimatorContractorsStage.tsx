import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, Star } from 'lucide-react';
import { CONTRACTORS_DIRECTORY } from '../data/contractors';
import {
  ColorScheme,
  ContractorProfile,
  CostEstimate,
  RenovationScopeItem,
  RoomConfig,
  StyleDefinition,
} from '../types/design';

interface EstimatorContractorsStageProps {
  room: RoomConfig;
  selectedStyle: StyleDefinition;
  selectedScheme: ColorScheme;
  scopeItems: RenovationScopeItem[];
  estimate: CostEstimate;
  shortlistedContractorIds: string[];
  onToggleScopeItem: (id: string) => void;
  onToggleShortlist: (id: string) => void;
}

const SPECIALTY_FILTERS: Array<'All' | ContractorProfile['specialty']> = [
  'All',
  'Design-Build',
  'Flooring & Millwork',
  'Painting & Plaster',
  'Electrical & Lighting',
];

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

export const EstimatorContractorsStage: React.FC<EstimatorContractorsStageProps> = ({
  room,
  selectedStyle,
  selectedScheme,
  scopeItems,
  estimate,
  shortlistedContractorIds,
  onToggleScopeItem,
  onToggleShortlist,
}) => {
  const [specialtyFilter, setSpecialtyFilter] = useState<'All' | ContractorProfile['specialty']>('All');

  const filteredContractors = useMemo(() => {
    const base =
      specialtyFilter === 'All'
        ? CONTRACTORS_DIRECTORY
        : CONTRACTORS_DIRECTORY.filter((c) => c.specialty === specialtyFilter);

    // Sort style-matched contractors first
    return [...base].sort((a, b) => {
      const aMatch = a.recommendedFor.includes(selectedStyle.id) ? 1 : 0;
      const bMatch = b.recommendedFor.includes(selectedStyle.id) ? 1 : 0;
      return bMatch - aMatch || b.rating - a.rating;
    });
  }, [specialtyFilter, selectedStyle.id]);

  return (
    <section id="estimate" className="py-14">
      <div className="max-w-[1360px] mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#64615B] mb-2">
              04. Renovation Cost Estimate &amp; Recommended Contractors
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1A1917] [text-wrap:balance]">
              Itemized renovation budget for {estimate.areaSqFt} sq ft in {selectedStyle.name}.
            </h2>
          </div>

          <div className="bg-white border border-[#E6E3DC] rounded-xl px-5 py-3.5 shrink-0">
            <p className="text-xs text-[#64615B] mb-0.5">
              Estimated Project Range (incl. 10% contingency)
            </p>
            <p className="font-display text-2xl font-bold font-mono tabular-nums text-[#1A1917]">
              {formatCurrency(estimate.estimatedLow)} – {formatCurrency(estimate.estimatedHigh)}
            </p>
          </div>
        </div>

        {/* Cost Scope + Ledger Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-14 items-start">
          {/* Scope Selector (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-[#1A1917] mb-1">
              Renovation Scope
            </h3>
            <p className="text-xs text-[#64615B] mb-4">
              Toggle work packages to recalculate materials and trade labor for {room.widthFt}′ × {room.lengthFt}′.
            </p>

            <div className="divide-y divide-[#EFECE6]">
              {scopeItems.map((item) => (
                <label
                  key={item.id}
                  className="py-3.5 flex items-start gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => onToggleScopeItem(item.id)}
                    className="mt-1 rounded border-[#DCD8CF] accent-[#1B4D3E] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1917]">{item.label}</p>
                    <p className="text-xs text-[#64615B] mt-0.5">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Itemized Tabular Ledger (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E6E3DC] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6E3DC] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#1A1917]">
                  Itemized Budget Breakdown
                </h3>
                <p className="text-xs text-[#64615B]">
                  {selectedStyle.name} · {selectedScheme.name} ·{' '}
                  <span className="font-mono tabular-nums">
                    ~{formatCurrency(estimate.costPerSqFt)}/sq ft
                  </span>
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#64615B]">
                Material tier factor: {selectedStyle.costMultiplier.toFixed(2)}×
              </span>
            </div>

            {estimate.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64615B]">
                Select at least one renovation scope package on the left to view itemized pricing.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E3DC] text-xs font-medium text-[#64615B] bg-[#FAF9F6]">
                      <th className="py-3 px-6">Scope Item</th>
                      <th className="py-3 px-3 text-right">Qty</th>
                      <th className="py-3 px-3 text-right">Materials</th>
                      <th className="py-3 px-3 text-right">Labor</th>
                      <th className="py-3 px-6 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6] text-sm">
                    {estimate.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#FAF9F6]">
                        <td className="py-3.5 px-6">
                          <p className="font-medium text-[#1A1917]">{row.label}</p>
                          <p className="text-xs text-[#64615B]">{row.category}</p>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-[#64615B] whitespace-nowrap">
                          {row.quantityLabel}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#1A1917]">
                          {formatCurrency(row.materialCost)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#1A1917]">
                          {formatCurrency(row.laborCost)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-[#1A1917]">
                          {formatCurrency(row.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[#DCD8CF] bg-[#FAF9F6] text-sm">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-6 text-[#64615B]">
                        Subtotal (Materials + Labor)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1A1917]">
                        {formatCurrency(estimate.materialsTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1A1917]">
                        {formatCurrency(estimate.laborTotal)}
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono tabular-nums font-medium text-[#1A1917]">
                        {formatCurrency(estimate.subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-2 px-6 text-xs text-[#64615B]">
                        Recommended 10% Renovation Contingency
                      </td>
                      <td className="py-2 px-6 text-right font-mono tabular-nums text-xs text-[#64615B]">
                        {formatCurrency(estimate.contingency)}
                      </td>
                    </tr>
                    <tr className="border-t border-[#DCD8CF]">
                      <td colSpan={4} className="py-3.5 px-6 font-display font-semibold text-[#1A1917]">
                        Total Estimated Budget
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums font-bold text-base text-[#1B4D3E]">
                        {formatCurrency(estimate.subtotal + estimate.contingency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recommended Renovation Contractors */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#1A1917]">
                Recommended Renovation Contractors
              </h3>
              <p className="text-sm text-[#64615B]">
                Vetted trade specialists &amp; verified directories matched to {selectedStyle.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1EFE9] rounded-lg w-fit">
              {SPECIALTY_FILTERS.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSpecialtyFilter(spec)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    specialtyFilter === spec
                      ? 'bg-white text-[#1A1917] shadow-xs'
                      : 'text-[#64615B] hover:text-[#1A1917]'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContractors.map((contractor) => {
              const isMatched = contractor.recommendedFor.includes(selectedStyle.id);
              const isShortlisted = shortlistedContractorIds.includes(contractor.id);

              return (
                <article
                  key={contractor.id}
                  className={`bg-white border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                    isShortlisted ? 'border-[#1B4D3E]' : 'border-[#E6E3DC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#64615B] mb-2">
                      <span>
                        {contractor.specialty} · {contractor.rateTier}
                        {isMatched ? ` · ${selectedStyle.name} Match` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#1A1917] font-medium shrink-0">
                        <Star className="w-3.5 h-3.5 fill-[#C89B3C] text-[#C89B3C]" />
                        {contractor.rating.toFixed(1)}
                      </span>
                    </div>

                    <h4 className="font-display text-base font-semibold text-[#1A1917] mb-1">
                      {contractor.name}
                    </h4>
                    <p className="text-xs text-[#64615B] mb-3">
                      {contractor.location} · Lead time: {contractor.leadTime}
                    </p>
                    <p className="text-sm text-[#3F3D39] leading-relaxed mb-5">
                      {contractor.summary}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#EFECE6] flex items-center justify-between gap-3">
                    <a
                      href={contractor.directoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1A1917] hover:underline whitespace-nowrap shrink-0"
                    >
                      {contractor.directoryLabel}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onToggleShortlist(contractor.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isShortlisted
                          ? 'bg-[#1B4D3E] text-white'
                          : 'bg-[#F1EFE9] text-[#1A1917] hover:bg-[#E6E3DC]'
                      }`}
                    >
                      {isShortlisted && <Check className="w-3.5 h-3.5" />}
                      {isShortlisted ? 'Shortlisted' : 'Shortlist Pro'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
