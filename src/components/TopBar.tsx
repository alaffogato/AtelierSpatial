import React from 'react';

interface TopBarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  onOpenQuotation: () => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'space', label: 'Space & Plan' },
  { id: 'moodboard', label: 'Mood Board' },
  { id: 'studio3d', label: '3D Studio' },
  { id: 'estimate', label: 'Cost & Pros' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  onOpenQuotation,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#F8F7F4]/95 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('overview');
          }}
          className="font-display text-lg font-bold tracking-tight text-[#1A1917] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B4D3E]"
        >
          Atelier Spatial
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary studio workflow"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B4D3E] ${
                  isActive
                    ? 'text-[#1A1917] border-[#1B4D3E]'
                    : 'text-[#64615B] border-transparent hover:text-[#1A1917] hover:border-[#D4CFC4]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenQuotation}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4D3E]"
          >
            1-Click Quote
          </button>
        </div>
      </div>
    </header>
  );
};
