/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { SpaceUploadStage } from './components/SpaceUploadStage';
import { MoodBoardStage } from './components/MoodBoardStage';
import { Studio3DViewport } from './components/Studio3DViewport';
import { EstimatorContractorsStage } from './components/EstimatorContractorsStage';
import { ExportBriefModal } from './components/ExportBriefModal';
import { DESIGN_STYLES, getStyleById } from './data/styles';
import {
  DesignStyleId,
  MoodBoardPhoto,
  RenovationScopeItem,
  RoomConfig,
} from './types/design';
import {
  calculateRenovationEstimate,
  DEFAULT_RENOVATION_SCOPE,
} from './utils/costCalculator';

const INITIAL_ROOM: RoomConfig = {
  roomName: 'Living & Dining Room',
  widthFt: 16,
  lengthFt: 26,
  heightFt: 9.5,
  layoutPreset: 'open-living-dining',
  windowWall: 'north',
  doorWall: 'south',
  includePartitionWall: false,
  includeDiningZone: true,
  floorPlanName: null,
  floorPlanUrl: null,
  floorPlanAnalysis: null,
  photos: [],
};

export default function App() {
  const [activeSection, setActiveSection] = useState<string>('space');
  const [room, setRoom] = useState<RoomConfig>(INITIAL_ROOM);
  const [selectedStyleId, setSelectedStyleId] = useState<DesignStyleId>('japandi');
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>(
    DESIGN_STYLES[0].colorSchemes[0].id,
  );
  const [pinnedPhotos, setPinnedPhotos] = useState<MoodBoardPhoto[]>([
    DESIGN_STYLES[0].moodBoardPhotos[0],
  ]);
  const [scopeItems, setScopeItems] = useState<RenovationScopeItem[]>(
    DEFAULT_RENOVATION_SCOPE,
  );
  const [shortlistedContractorIds, setShortlistedContractorIds] = useState<string[]>([
    'nordic-craft',
  ]);
  const [exportOpen, setExportOpen] = useState(false);

  const selectedStyle = useMemo(
    () => getStyleById(selectedStyleId),
    [selectedStyleId],
  );

  const selectedScheme = useMemo(
    () =>
      selectedStyle.colorSchemes.find((c) => c.id === selectedSchemeId) ??
      selectedStyle.colorSchemes[0],
    [selectedStyle, selectedSchemeId],
  );

  const estimate = useMemo(
    () => calculateRenovationEstimate(room, selectedStyle, scopeItems),
    [room, selectedStyle, scopeItems],
  );

  const handleSelectStyle = (styleId: DesignStyleId) => {
    const nextStyle = getStyleById(styleId);
    setSelectedStyleId(styleId);
    setSelectedSchemeId(nextStyle.colorSchemes[0].id);
  };

  const handleTogglePinPhoto = (photo: MoodBoardPhoto) => {
    setPinnedPhotos((prev) => {
      const exists = prev.some((p) => p.id === photo.id);
      if (exists) return prev.filter((p) => p.id !== photo.id);
      return [...prev, photo];
    });
  };

  const handleToggleScopeItem = (id: string) => {
    setScopeItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };

  const handleToggleShortlist = (id: string) => {
    setShortlistedContractorIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const navigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Track visible section on scroll for clean top-bar active underline
  useEffect(() => {
    const ids = ['space', 'moodboard', 'studio3d', 'estimate'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1917] flex flex-col">
      <TopBar
        activeSection={activeSection}
        onNavigate={navigateToSection}
        onOpenExport={() => setExportOpen(true)}
      />

      <main className="flex-1">
        <SpaceUploadStage
          room={room}
          onChangeRoom={setRoom}
          onContinueToMoodBoard={() => navigateToSection('moodboard')}
        />

        <MoodBoardStage
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          pinnedPhotoIds={pinnedPhotos.map((p) => p.id)}
          onSelectStyle={handleSelectStyle}
          onSelectScheme={setSelectedSchemeId}
          onTogglePinPhoto={handleTogglePinPhoto}
          onApplyTo3D={() => navigateToSection('studio3d')}
        />

        <Studio3DViewport
          room={room}
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          onSelectStyle={handleSelectStyle}
        />

        <EstimatorContractorsStage
          room={room}
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          scopeItems={scopeItems}
          estimate={estimate}
          shortlistedContractorIds={shortlistedContractorIds}
          onToggleScopeItem={handleToggleScopeItem}
          onToggleShortlist={handleToggleShortlist}
        />
      </main>

      <footer className="border-t border-[#E6E3DC] bg-white py-8">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64615B]">
          <p>
            Atelier Spatial · Client-side DIY interior planning studio (ready for serverless API integration)
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigateToSection('space')}
              className="hover:text-[#1A1917] cursor-pointer"
            >
              Back to Top
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="font-medium text-[#1A1917] hover:underline cursor-pointer"
            >
              Export Project Brief
            </button>
          </div>
        </div>
      </footer>

      <ExportBriefModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        room={room}
        style={selectedStyle}
        scheme={selectedScheme}
        pinnedPhotos={pinnedPhotos}
        estimate={estimate}
        shortlistedContractorIds={shortlistedContractorIds}
      />
    </div>
  );
}
