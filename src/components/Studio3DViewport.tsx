import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  FileDown,
  Footprints,
  RotateCcw,
  Sun,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { DESIGN_STYLES } from '../data/styles';
import { RoomSceneEngine, StudioBriefSnapshots } from '../three/RoomSceneEngine';
import {
  CameraMode,
  CameraPreset,
  ColorScheme,
  DesignStyleId,
  LightingMood,
  RoomConfig,
  StyleDefinition,
  UnitSystem,
} from '../types/design';
import { formatLength } from '../utils/units';

export interface Studio3DViewportHandle {
  captureBriefSnapshots: () => StudioBriefSnapshots | null;
}

interface Studio3DViewportProps {
  room: RoomConfig;
  unitSystem: UnitSystem;
  selectedStyle: StyleDefinition;
  selectedScheme: ColorScheme;
  onSelectStyle: (styleId: DesignStyleId) => void;
  onExportPdf?: () => Promise<void>;
  exportingPdf?: boolean;
}

export const Studio3DViewport = forwardRef<Studio3DViewportHandle, Studio3DViewportProps>(({
  room,
  unitSystem,
  selectedStyle,
  selectedScheme,
  onSelectStyle,
  onExportPdf,
  exportingPdf = false,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RoomSceneEngine | null>(null);

  useImperativeHandle(ref, () => ({
    captureBriefSnapshots: () => engineRef.current?.captureBriefSnapshots() ?? null,
  }), []);

  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [lightingMood, setLightingMood] = useState<LightingMood>('daylight');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  // Initialize Three.js engine once inside isolated ref mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new RoomSceneEngine(container, {
      onContextLost: (lost) => setContextLost(lost),
      onModeChange: (mode) => setCameraMode(mode),
    });
    engineRef.current = engine;
    engine.updateRoomAndStyle(room, selectedStyle, selectedScheme, lightingMood);

    const handleKeyShortcut = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', handleKeyShortcut);

    return () => {
      window.removeEventListener('keydown', handleKeyShortcut);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update 3D room geometry & PBR style finishes whenever room/style/scheme changes
  useEffect(() => {
    engineRef.current?.updateRoomAndStyle(room, selectedStyle, selectedScheme, lightingMood);
  }, [room, selectedStyle, selectedScheme, lightingMood]);

  // Update lighting mood cleanly
  useEffect(() => {
    engineRef.current?.applyLightingMood(lightingMood);
  }, [lightingMood]);

  const handleModeSwitch = (mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  };

  const handlePreset = (preset: CameraPreset) => {
    engineRef.current?.setCameraPreset(preset);
  };

  const handleCapture = () => {
    if (!engineRef.current) return;
    const dataUrl = engineRef.current.captureSnapshot();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `atelier-${selectedStyle.id}-${selectedScheme.id}.png`;
    link.click();
    setSnapshotNotice('3D view exported');
    window.setTimeout(() => setSnapshotNotice(null), 2200);
  };

  return (
    <section id="studio3d" className="py-14 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#64615B] mb-2">
              03. Interactive 3D Spatial Studio
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1A1917] [text-wrap:balance]">
              Pan, zoom, rotate, or walk through your redesigned space at eye level.
            </h2>
          </div>
          <p className="text-xs text-[#64615B] font-mono tabular-nums">
            {formatLength(room.widthFt, unitSystem)} × {formatLength(room.lengthFt, unitSystem)} × {formatLength(room.heightFt, unitSystem)} · {selectedStyle.name}
          </p>
        </div>

        {/* Full-Bleed Architectural 3D Canvas Container */}
        <div className="relative w-full h-[580px] lg:h-[680px] rounded-2xl overflow-hidden border border-[#2C2A26] bg-[#191816]">
          {/* Dedicated isolated WebGL canvas mount */}
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* WebGL Context Lost Fallback */}
          {contextLost && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#191816] text-white p-6 text-center">
              <p className="font-display text-lg font-semibold mb-2">
                3D Viewport Suspended
              </p>
              <p className="text-sm text-[#B8B2A6] max-w-md">
                WebGL graphics context was interrupted by the browser. Reload or resize the viewport to restore rendering.
              </p>
            </div>
          )}

          {/* Top-Left Minimal Spec Overlay (no backdrop-filter over WebGL) */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none px-3.5 py-2 rounded-lg bg-[#1A1917]/90 border border-white/10 text-white">
            <p className="text-xs font-medium">
              {selectedStyle.name} · {selectedScheme.name}
            </p>
            <p className="text-[11px] text-[#C8C3B8]">
              {cameraMode === 'walkthrough'
                ? 'Walkthrough: WASD or Arrow keys to move · Drag to look'
                : 'Orbit: Drag to rotate · Right-drag to pan · Scroll to zoom'}
            </p>
          </div>

          {/* Top-Right Snapshot & Export PDF Actions */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {snapshotNotice && (
              <span className="px-3 py-1.5 text-xs font-medium text-white bg-[#1B4D3E] rounded-lg">
                {snapshotNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleCapture}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1A1917]/90 hover:bg-[#1A1917] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              Snapshot
            </button>
            {onExportPdf && (
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void onExportPdf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1B4D3E]/95 hover:bg-[#153D31] disabled:opacity-60 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </button>
            )}
          </div>

          {/* Walkthrough Touch / Click Navigation Pad (only in Walkthrough mode) */}
          {cameraMode === 'walkthrough' && (
            <div className="absolute bottom-28 right-4 z-10 p-2 rounded-xl bg-[#1A1917]/90 border border-white/10 text-white grid grid-cols-3 gap-1 w-28">
              <div />
              <button
                type="button"
                aria-label="Walk forward"
                onClick={() => engineRef.current?.nudgeWalkthrough(0, 0.55)}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Turn left"
                onClick={() => engineRef.current?.nudgeWalkthrough(0, 0, 0.22)}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Walk backward"
                onClick={() => engineRef.current?.nudgeWalkthrough(0, -0.55)}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Turn right"
                onClick={() => engineRef.current?.nudgeWalkthrough(0, 0, -0.22)}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-20 transition-transform duration-200 w-[min(940px,94%)] ${
              dockCollapsed ? 'bottom-3 translate-y-[calc(100%-34px)]' : 'bottom-4 translate-y-0'
            }`}
          >
            <div className="flex justify-center mb-1.5">
              <button
                type="button"
                onClick={() => setDockCollapsed((c) => !c)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-white bg-[#1A1917]/95 hover:bg-[#2A2825] border border-white/15 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show Controls (H)
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Hide Controls (H)
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#1A1917]/95 border border-white/15 rounded-xl px-4 py-3 text-white flex flex-wrap items-center justify-between gap-3">
              {/* Navigation Mode Switch */}
              <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('orbit')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraMode === 'orbit'
                      ? 'bg-white text-[#1A1917]'
                      : 'text-[#D4CFC4] hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Orbit
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('walkthrough')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraMode === 'walkthrough'
                      ? 'bg-white text-[#1A1917]'
                      : 'text-[#D4CFC4] hover:text-white'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  Walkthrough
                </button>
              </div>

              {/* Camera Presets + Zoom */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('isometric')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#E8E4DC] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Corner
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('top')}
                  className="px-2.5 py-1.5 text-xs text-[#E8E4DC] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Plan View
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('eye-level')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#E8E4DC] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  Eye-Level
                </button>
                {cameraMode === 'orbit' && (
                  <>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      onClick={() => engineRef.current?.zoomStep('in')}
                      className="p-1.5 text-[#E8E4DC] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Zoom out"
                      onClick={() => engineRef.current?.zoomStep('out')}
                      className="p-1.5 text-[#E8E4DC] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Lighting Mood Switch */}
              <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg">
                {(
                  [
                    { id: 'daylight', label: 'Daylight' },
                    { id: 'golden', label: 'Golden' },
                    { id: 'evening', label: 'Evening' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLightingMood(m.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      lightingMood === m.id
                        ? 'bg-[#1B4D3E] text-white'
                        : 'text-[#D4CFC4] hover:text-white'
                    }`}
                  >
                    {m.id === 'daylight' && <Sun className="w-3 h-3" />}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Quick Style Selector */}
              <select
                aria-label="Switch 3D design style"
                value={selectedStyle.id}
                onChange={(e) => onSelectStyle(e.target.value as DesignStyleId)}
                className="px-2.5 py-1.5 text-xs font-medium bg-white/10 text-white border border-white/15 rounded-lg focus:outline-none cursor-pointer"
              >
                {DESIGN_STYLES.map((s) => (
                  <option key={s.id} value={s.id} className="text-[#1A1917] bg-white">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

Studio3DViewport.displayName = 'Studio3DViewport';
