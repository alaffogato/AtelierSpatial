import React, { useEffect, useState } from 'react';
import { Bookmark, Check, ExternalLink, Search, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { DESIGN_STYLES } from '../data/styles';
import { fetchMoodBoardForStyle } from '../services/unsplashService';
import {
  ColorScheme,
  DesignStyleId,
  MoodBoardPhoto,
  StyleDefinition,
} from '../types/design';

interface MoodBoardStageProps {
  selectedStyle: StyleDefinition;
  selectedScheme: ColorScheme;
  pinnedPhotoIds: string[];
  onSelectStyle: (styleId: DesignStyleId) => void;
  onSelectScheme: (schemeId: string) => void;
  onTogglePinPhoto: (photo: MoodBoardPhoto) => void;
  onApplyTo3D: () => void;
}

export const MoodBoardStage: React.FC<MoodBoardStageProps> = ({
  selectedStyle,
  selectedScheme,
  pinnedPhotoIds,
  onSelectStyle,
  onSelectScheme,
  onTogglePinPhoto,
  onApplyTo3D,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [photos, setPhotos] = useState<MoodBoardPhoto[]>(selectedStyle.moodBoardPhotos);
  const [sourceMode, setSourceMode] = useState<'unsplash-api' | 'curated-studio'>('curated-studio');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMoodBoardForStyle(selectedStyle, selectedScheme, debouncedQuery).then((res) => {
      if (!active) return;
      setPhotos(res.photos);
      setSourceMode(res.source);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedStyle, selectedScheme, debouncedQuery]);

  return (
    <section id="moodboard" className="py-14 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#64615B] mb-2">
              02. Mood Board Generator · Powered by Unsplash
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1A1917] [text-wrap:balance]">
              Select an architectural direction and color scheme to style your 3D room.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#64615B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter mood board (e.g. linen, brick)..."
                aria-label="Filter mood board inspiration"
                className="pl-9 pr-4 py-2 w-64 text-sm bg-white border border-[#DCD8CF] rounded-lg text-[#1A1917] placeholder:text-[#8E8A82] focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
            <button
              type="button"
              onClick={onApplyTo3D}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Inspect in 3D Studio
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Style Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F1EFE9] rounded-xl mb-8 w-fit max-w-full">
          {DESIGN_STYLES.map((style) => {
            const active = style.id === selectedStyle.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onSelectStyle(style.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#1A1917] shadow-xs'
                    : 'text-[#64615B] hover:text-[#1A1917]'
                }`}
              >
                {style.name}
              </button>
            );
          })}
        </div>

        {/* Color Scheme Selector + Style Specification */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Color Schemes (7 cols) */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1917] inline-flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#64615B]" />
                Color Scheme Options for {selectedStyle.name}
              </h3>
              <span className="text-xs text-[#64615B]">
                Live-syncs walls, flooring &amp; textiles
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {selectedStyle.colorSchemes.map((scheme) => {
                const isSelected = scheme.id === selectedScheme.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => onSelectScheme(scheme.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#1B4D3E] ring-1 ring-[#1B4D3E]'
                        : 'bg-white border-[#E6E3DC] hover:border-[#C8C3B8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-display text-sm font-semibold text-[#1A1917] truncate">
                        {scheme.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#1B4D3E] shrink-0" />}
                    </div>
                    <div className="grid grid-cols-5 gap-1 h-7 rounded-md overflow-hidden border border-black/10 mb-2.5">
                      {scheme.swatches.map((hex, i) => (
                        <div key={`${scheme.id}-${i}`} style={{ backgroundColor: hex }} title={hex} />
                      ))}
                    </div>
                    <p className="text-xs text-[#64615B] leading-relaxed">
                      {scheme.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Material Spec Ledger (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-[#1A1917] mb-1">
              {selectedStyle.name} · {selectedScheme.name}
            </h3>
            <p className="text-xs text-[#64615B] leading-relaxed mb-4">
              {selectedStyle.description}
            </p>
            <dl className="divide-y divide-[#EFECE6] text-xs">
              <div className="py-2 flex items-start justify-between gap-4">
                <dt className="text-[#64615B] shrink-0">Flooring</dt>
                <dd className="text-right font-medium text-[#1A1917]">
                  {selectedStyle.materialSpecs.flooring}
                </dd>
              </div>
              <div className="py-2 flex items-start justify-between gap-4">
                <dt className="text-[#64615B] shrink-0">Walls</dt>
                <dd className="text-right font-medium text-[#1A1917]">
                  {selectedStyle.materialSpecs.walls}
                </dd>
              </div>
              <div className="py-2 flex items-start justify-between gap-4">
                <dt className="text-[#64615B] shrink-0">Textiles</dt>
                <dd className="text-right font-medium text-[#1A1917]">
                  {selectedStyle.materialSpecs.textiles}
                </dd>
              </div>
              <div className="py-2 flex items-start justify-between gap-4">
                <dt className="text-[#64615B] shrink-0">Hardware</dt>
                <dd className="text-right font-medium text-[#1A1917]">
                  {selectedStyle.materialSpecs.hardware}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Mood Board Grid */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="text-xs text-[#64615B]">
            <span>Showing {photos.length} curated references</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>{sourceMode === 'unsplash-api' ? 'Live Unsplash Feed' : 'Curated Unsplash Studio Collection'}</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="font-medium text-[#1A1917]">
              {pinnedPhotoIds.length} pinned to project brief
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E6E3DC] rounded-xl overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#EAE6DD]" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-[#EAE6DD] rounded w-2/3" />
                  <div className="h-3 bg-[#F1EFE9] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {photos.map((photo) => {
              const isPinned = pinnedPhotoIds.includes(photo.id);
              return (
                <article
                  key={photo.id}
                  className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                    isPinned ? 'border-[#1B4D3E]' : 'border-[#E6E3DC]'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-[#EAE6DD]">
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onTogglePinPhoto(photo)}
                      className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        isPinned
                          ? 'bg-[#1B4D3E] text-white'
                          : 'bg-[#1A1917]/85 text-white hover:bg-[#1A1917]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      {isPinned ? 'Pinned' : 'Pin Look'}
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs text-[#64615B]">
                        {photo.category} · {selectedScheme.name}
                      </span>
                      <span
                        className="w-4 h-4 rounded-sm border border-black/15 shrink-0"
                        style={{ backgroundColor: photo.dominantHex }}
                        title={`Accent tone ${photo.dominantHex}`}
                      />
                    </div>
                    <h3 className="font-display text-base font-semibold text-[#1A1917] mb-1">
                      {photo.title}
                    </h3>
                    <p className="text-xs text-[#64615B] mb-3">{photo.finishNote}</p>
                    <div className="pt-2.5 border-t border-[#F1EFE9] flex items-center justify-between text-xs text-[#64615B]">
                      <span>Photo by {photo.photographer}</span>
                      <a
                        href={photo.photographerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#1A1917] hover:underline font-medium"
                      >
                        Unsplash
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
