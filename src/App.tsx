/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LandingSection } from './components/LandingSection';
import { SpaceUploadStage } from './components/SpaceUploadStage';
import { MoodBoardStage } from './components/MoodBoardStage';
import { Studio3DViewport } from './components/Studio3DViewport';
import { EstimatorContractorsStage } from './components/EstimatorContractorsStage';
import { QuotationModal } from './components/QuotationModal';
import { DESIGN_STYLES, SAMPLE_FLOOR_PLAN_IMAGE, getStyleById } from './data/styles';
import {
  DesignStyleId,
  MoodBoardPhoto,
  RenovationScopeItem,
  RoomConfig,
  UnitSystem,
} from './types/design';
import {
  calculateRenovationEstimate,
  DEFAULT_RENOVATION_SCOPE,
} from './utils/costCalculator';
import { analyzeFloorPlanImage } from './utils/imageAnalysis';

const INITIAL_ROOM: RoomConfig = {
  roomName: 'HDB 5-Room Flat (110 m²)',
  widthFt: 32.15, // 9.8 m
  lengthFt: 36.75, // 11.2 m
  heightFt: 8.53, // 2.6 m HDB standard ceiling height
  planVersion: 1,
  layoutPreset: 'hdb-5-room',
  windowWall: 'north',
  doorWall: 'south',
  includePartitionWall: true,
  includeDiningZone: true,
  floorPlanName: 'HDB_5Room_BTO_Floor_Plan.jpg',
  floorPlanUrl: SAMPLE_FLOOR_PLAN_IMAGE,
  floorPlanAnalysis: null,
  photos: [],
};

export default function App() {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
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
    'kobo-sg',
  ]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

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
    () => calculateRenovationEstimate(room, selectedStyle, scopeItems, unitSystem),
    [room, selectedStyle, scopeItems, unitSystem],
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

  useEffect(() => {
    const ids = ['overview', 'space', 'moodboard', 'studio3d', 'estimate'];
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

  // Automatically scan the pre-loaded HDB 5-Room sample floor plan on first mount
  useEffect(() => {
    let active = true;
    if (room.floorPlanUrl && !room.floorPlanAnalysis) {
      analyzeFloorPlanImage(room.floorPlanUrl, 5.0)
        .then((analysis) => {
          if (!active) return;
          setRoom((prev) =>
            prev.floorPlanUrl === room.floorPlanUrl && !prev.floorPlanAnalysis
              ? { ...prev, floorPlanAnalysis: analysis }
              : prev,
          );
        })
        .catch(() => {
          // Non-fatal if image canvas read is unavailable
        });
    }
    return () => {
      active = false;
    };
  }, [room.floorPlanUrl, room.floorPlanAnalysis]);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1917] flex flex-col">
      <TopBar
        activeSection={activeSection}
        onNavigate={navigateToSection}
        onOpenQuotation={() => setQuoteModalOpen(true)}
      />

      <main className="flex-1">
        <LandingSection
          room={room}
          unitSystem={unitSystem}
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          estimate={estimate}
          onNavigate={navigateToSection}
          onOneClickQuote={() => setQuoteModalOpen(true)}
        />

        <SpaceUploadStage
          room={room}
          unitSystem={unitSystem}
          onChangeUnitSystem={setUnitSystem}
          onChangeRoom={setRoom}
          onContinueToMoodBoard={() => navigateToSection('moodboard')}
          onJumpTo3D={() => navigateToSection('studio3d')}
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
          unitSystem={unitSystem}
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          onSelectStyle={handleSelectStyle}
        />

        <EstimatorContractorsStage
          room={room}
          unitSystem={unitSystem}
          selectedStyle={selectedStyle}
          selectedScheme={selectedScheme}
          scopeItems={scopeItems}
          estimate={estimate}
          shortlistedContractorIds={shortlistedContractorIds}
          onToggleScopeItem={handleToggleScopeItem}
          onToggleShortlist={handleToggleShortlist}
          onOneClickQuote={() => setQuoteModalOpen(true)}
        />
      </main>

      <footer className="border-t border-[#E6E3DC] bg-white py-8">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64615B]">
          <p>
            Atelier Spatial · Singapore DIY Interior Design &amp; Renovation Planning Studio
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigateToSection('overview')}
              className="hover:text-[#1A1917] cursor-pointer"
            >
              Back to Top
            </button>
            <button
              type="button"
              onClick={() => setQuoteModalOpen(true)}
              className="font-medium text-[#1A1917] hover:underline cursor-pointer"
            >
              1-Click Get Quotations
            </button>
          </div>
        </div>
      </footer>

      <QuotationModal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        room={room}
        unitSystem={unitSystem}
        style={selectedStyle}
        scheme={selectedScheme}
        pinnedPhotos={pinnedPhotos}
        estimate={estimate}
        shortlistedContractorIds={shortlistedContractorIds}
      />
    </div>
  );
}
