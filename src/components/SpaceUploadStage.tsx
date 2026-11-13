import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Box,
  Check,
  ImagePlus,
  Layers,
  Ruler,
  Trash2,
  Upload,
} from 'lucide-react';
import { SAMPLE_FLOOR_PLAN_IMAGE, SAMPLE_ROOM_PHOTO_IMAGE } from '../data/styles';
import {
  RoomConfig,
  RoomLayoutPreset,
  UnitSystem,
  UploadedSpacePhoto,
} from '../types/design';
import { analyzeFloorPlanImage, extractDominantColors } from '../utils/imageAnalysis';
import {
  FT_TO_M,
  M_TO_FT,
  formatArea,
  formatLength,
} from '../utils/units';

interface SpaceUploadStageProps {
  room: RoomConfig;
  unitSystem: UnitSystem;
  onChangeUnitSystem: (unit: UnitSystem) => void;
  onChangeRoom: (updater: (prev: RoomConfig) => RoomConfig) => void;
  onContinueToMoodBoard: () => void;
  onJumpTo3D: () => void;
}

const LAYOUT_PRESETS: { id: RoomLayoutPreset; label: string }[] = [
  { id: 'open-living-dining', label: 'Living & Dining' },
  { id: 'studio-loft', label: 'Studio Loft' },
  { id: 'l-shaped-suite', label: 'L-Shaped Suite' },
  { id: 'primary-living', label: 'Primary Lounge' },
];

export const SpaceUploadStage: React.FC<SpaceUploadStageProps> = ({
  room,
  unitSystem,
  onChangeUnitSystem,
  onChangeRoom,
  onContinueToMoodBoard,
  onJumpTo3D,
}) => {
  const floorPlanInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [showZoneOverlay, setShowZoneOverlay] = useState(true);
  const [scaleReferenceMeters, setScaleReferenceMeters] = useState<number>(3.0);
  const [planError, setPlanError] = useState<string | null>(null);
  const [regeneratedBanner, setRegeneratedBanner] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<'plan' | 'photo' | null>(null);

  const areaSqFt = room.widthFt * room.lengthFt;

  const processFloorPlanDataUrl = async (
    dataUrl: string,
    fileName: string,
    refMeters = scaleReferenceMeters,
  ) => {
    setAnalyzingPlan(true);
    setPlanError(null);
    try {
      const analysis = await analyzeFloorPlanImage(dataUrl, refMeters);
      onChangeRoom((prev) => ({
        ...prev,
        floorPlanUrl: dataUrl,
        floorPlanName: fileName,
        floorPlanAnalysis: analysis,
        widthFt: analysis.suggestedWidthFt,
        lengthFt: analysis.suggestedLengthFt,
        planVersion: prev.planVersion + 1,
        includePartitionWall: analysis.hasPartition,
        includeDiningZone: analysis.suggestedLengthM >= 6.0,
      }));
      setRegeneratedBanner(
        `Scanned ${analysis.detectedWalls.length} interior wall${analysis.detectedWalls.length === 1 ? '' : 's'} & regenerated 3D model`,
      );
    } catch {
      setPlanError('Could not read that floor plan image. Try a PNG or JPG file.');
    } finally {
      setAnalyzingPlan(false);
    }
  };

  const handleFloorPlanFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPlanError('Please upload an image file (PNG, JPG, WEBP, or SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void processFloorPlanDataUrl(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const processed: UploadedSpacePhoto[] = [];
    for (const file of fileArray.slice(0, 6)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) continue;
      const { colors, width, height } = await extractDominantColors(dataUrl);
      processed.push({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        dataUrl,
        extractedColors: colors,
        width,
        height,
      });
    }

    onChangeRoom((prev) => ({
      ...prev,
      photos: [...prev.photos, ...processed].slice(0, 6),
    }));
  };

  const loadSampleFloorPlan = async () => {
    await processFloorPlanDataUrl(
      SAMPLE_FLOOR_PLAN_IMAGE,
      'Residence_Living_Dining_Plan.jpg',
      3.0,
    );
    onChangeRoom((prev) => ({
      ...prev,
      widthFt: 16,
      lengthFt: 26,
      heightFt: 9.5,
      includeDiningZone: true,
    }));
  };

  const loadSampleRoomPhoto = async () => {
    const { colors, width, height } = await extractDominantColors(SAMPLE_ROOM_PHOTO_IMAGE);
    const samplePhoto: UploadedSpacePhoto = {
      id: `sample-room-${Date.now()}`,
      name: 'Existing_Living_Space.jpg',
      dataUrl: SAMPLE_ROOM_PHOTO_IMAGE,
      extractedColors: colors,
      width,
      height,
    };
    onChangeRoom((prev) => ({
      ...prev,
      photos: [samplePhoto, ...prev.photos.filter((p) => !p.id.startsWith('sample-room'))].slice(0, 6),
    }));
  };

  // Helpers to display and edit dimensions in either Metric (m) or Imperial (ft)
  const displayLength = unitSystem === 'metric' ? Number((room.lengthFt * FT_TO_M).toFixed(1)) : Number(room.lengthFt.toFixed(1));
  const displayWidth = unitSystem === 'metric' ? Number((room.widthFt * FT_TO_M).toFixed(1)) : Number(room.widthFt.toFixed(1));
  const displayHeight = unitSystem === 'metric' ? Number((room.heightFt * FT_TO_M).toFixed(1)) : Number(room.heightFt.toFixed(1));

  const updateDimension = (field: 'lengthFt' | 'widthFt' | 'heightFt', rawValue: number) => {
    if (!Number.isFinite(rawValue)) return;
    const ftVal = unitSystem === 'metric' ? rawValue * M_TO_FT : rawValue;
    const clamped =
      field === 'heightFt'
        ? Math.min(14, Math.max(7.8, ftVal))
        : field === 'lengthFt'
          ? Math.min(36, Math.max(13, ftVal))
          : Math.min(28, Math.max(11, ftVal));
    onChangeRoom((prev) => ({
      ...prev,
      [field]: Number(clamped.toFixed(2)),
    }));
  };

  const handleRecalibrateScaleBar = async (newRefMeters: number) => {
    setScaleReferenceMeters(newRefMeters);
    if (room.floorPlanUrl && room.floorPlanName) {
      await processFloorPlanDataUrl(room.floorPlanUrl, room.floorPlanName, newRefMeters);
    }
  };

  return (
    <section id="space" className="py-14 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6">
        {/* Editorial Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#64615B] mb-2">
              01. Floor Plan Scanner &amp; Spatial Calibration
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1A1917] leading-tight [text-wrap:balance]">
              Upload your floor plan and photos to scan walls, detect scale, and generate the 3D room.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Metric vs Imperial Toggle (Metric default) */}
            <div
              role="group"
              aria-label="Measurement unit system"
              className="flex items-center gap-1 p-1 bg-[#F1EFE9] border border-[#E6E3DC] rounded-lg"
            >
              <button
                type="button"
                onClick={() => onChangeUnitSystem('metric')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  unitSystem === 'metric'
                    ? 'bg-white text-[#1A1917] shadow-xs'
                    : 'text-[#64615B] hover:text-[#1A1917]'
                }`}
              >
                Metric (m / m²)
              </button>
              <button
                type="button"
                onClick={() => onChangeUnitSystem('imperial')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  unitSystem === 'imperial'
                    ? 'bg-white text-[#1A1917] shadow-xs'
                    : 'text-[#64615B] hover:text-[#1A1917]'
                }`}
              >
                Imperial (ft / sq ft)
              </button>
            </div>

            <button
              type="button"
              onClick={loadSampleFloorPlan}
              className="px-4 py-2 text-sm font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample Plan
            </button>
            <button
              type="button"
              onClick={loadSampleRoomPhoto}
              className="px-4 py-2 text-sm font-medium text-[#1A1917] bg-white border border-[#DCD8CF] hover:bg-[#F1EFE9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample Photo
            </button>
            <button
              type="button"
              onClick={onContinueToMoodBoard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1B4D3E] hover:bg-[#153D31] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Choose Style
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Two-Column Balanced Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Floor Plan Wall & Scale Bar Scanner */}
          <div className="lg:col-span-7 bg-white border border-[#E6E3DC] rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1A1917]">
                  Architectural Floor Plan &amp; Wall Scan
                </h3>
                <p className="text-sm text-[#64615B]">
                  {formatLength(room.widthFt, unitSystem)} × {formatLength(room.lengthFt, unitSystem)} ·{' '}
                  <span className="font-mono tabular-nums text-[#1A1917]">
                    {formatArea(areaSqFt, unitSystem)}
                  </span>{' '}
                  · {formatLength(room.heightFt, unitSystem)} ceiling
                </p>
              </div>
              <div className="flex items-center gap-2">
                {room.floorPlanUrl && room.floorPlanAnalysis && (
                  <button
                    type="button"
                    onClick={() => setShowZoneOverlay((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showZoneOverlay
                        ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                        : 'bg-[#F8F7F4] text-[#1A1917] border-[#DCD8CF]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {showZoneOverlay ? 'Hide Scan Overlay' : 'Show Scan Overlay'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A1917] bg-[#F1EFE9] hover:bg-[#E6E3DC] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {room.floorPlanUrl ? 'Upload New Plan' : 'Upload Plan'}
                </button>
              </div>
            </div>

            <input
              ref={floorPlanInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFloorPlanFile(file);
                e.target.value = '';
              }}
            />

            {/* Floor Plan Canvas Preview / Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragTarget('plan');
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragTarget(null);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFloorPlanFile(file);
              }}
              className={`relative rounded-lg border overflow-hidden transition-colors ${
                dragTarget === 'plan'
                  ? 'border-[#1B4D3E] bg-[#1B4D3E]/5'
                  : 'border-[#E6E3DC] bg-[#F8F7F4]'
              }`}
            >
              {room.floorPlanUrl ? (
                <div className="relative aspect-[4/3] w-full bg-white">
                  <img
                    src={room.floorPlanUrl}
                    alt={room.floorPlanName ?? 'Uploaded floor plan'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />

                  {/* Scanned Enclosure, Interior Walls & Graphic Scale Bar SVG Overlay */}
                  {showZoneOverlay && room.floorPlanAnalysis && (
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {/* Detected room perimeter enclosure */}
                      <rect
                        x={room.floorPlanAnalysis.wallBounds.x * 100}
                        y={room.floorPlanAnalysis.wallBounds.y * 100}
                        width={room.floorPlanAnalysis.wallBounds.w * 100}
                        height={room.floorPlanAnalysis.wallBounds.h * 100}
                        fill="rgba(27, 77, 62, 0.06)"
                        stroke="#1B4D3E"
                        strokeWidth="0.6"
                        strokeDasharray="2 1"
                      />

                      {/* Detected interior structural wall segments */}
                      {room.floorPlanAnalysis.detectedWalls.map((seg, idx) => {
                        const wb = room.floorPlanAnalysis!.wallBounds;
                        const x1 = (wb.x + seg.x1 * wb.w) * 100;
                        const y1 = (wb.y + seg.y1 * wb.h) * 100;
                        const x2 = (wb.x + seg.x2 * wb.w) * 100;
                        const y2 = (wb.y + seg.y2 * wb.h) * 100;
                        return (
                          <line
                            key={idx}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#1B4D3E"
                            strokeWidth="1.2"
                          />
                        );
                      })}

                      {/* Detected graphic scale bar highlight */}
                      {room.floorPlanAnalysis.scaleBarBounds && (
                        <rect
                          x={room.floorPlanAnalysis.scaleBarBounds.x * 100}
                          y={room.floorPlanAnalysis.scaleBarBounds.y * 100}
                          width={room.floorPlanAnalysis.scaleBarBounds.w * 100}
                          height={room.floorPlanAnalysis.scaleBarBounds.h * 100}
                          fill="rgba(217, 119, 6, 0.18)"
                          stroke="#D97706"
                          strokeWidth="0.6"
                        />
                      )}
                    </svg>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#1A1917]/92 text-white text-xs rounded-lg">
                    <span className="truncate font-medium">
                      {room.floorPlanName ?? 'Floor Plan Loaded'}
                    </span>
                    <span className="font-mono tabular-nums text-[#D4CFC4] shrink-0">
                      {analyzingPlan
                        ? 'Scanning walls & scale bar...'
                        : room.floorPlanAnalysis
                          ? `${room.floorPlanAnalysis.scaleLabel} · ${room.floorPlanAnalysis.openingsDetected} openings`
                          : 'Calibrated'}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="w-full aspect-[16/10] flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-[#F1EFE9]/60 transition-colors"
                >
                  <Upload className="w-7 h-7 text-[#64615B] mb-3" />
                  <p className="text-sm font-medium text-[#1A1917] mb-1">
                    Drop a 2D floor plan image or click to browse
                  </p>
                  <p className="text-xs text-[#64615B]">
                    Automatically scans walls, graphic scale bars &amp; openings and regenerates the 3D model
                  </p>
                </button>
              )}
            </div>

            {planError && (
              <p className="mt-2 text-xs text-[#B91C1C] font-medium">{planError}</p>
            )}

            {regeneratedBanner && (
              <div className="mt-3 px-3.5 py-2 rounded-lg bg-[#1B4D3E]/8 border border-[#1B4D3E]/25 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#1B4D3E]">
                  <Check className="w-3.5 h-3.5" />
                  {regeneratedBanner}
                </span>
                <button
                  type="button"
                  onClick={onJumpTo3D}
                  className="inline-flex items-center gap-1 font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5" />
                  Inspect 3D Model
                </button>
              </div>
            )}

            {/* Scale Bar Calibration Control (shown when scale bar detected) */}
            {room.floorPlanAnalysis?.scaleBarDetected && (
              <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-[#FAF9F6] border border-[#E6E3DC] flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#1A1917] font-medium">
                  <Ruler className="w-3.5 h-3.5 text-[#D97706]" />
                  Scale Bar Reference Length
                </span>
                <div className="flex items-center gap-2">
                  {[2.0, 3.0, 4.0, 5.0].map((mVal) => (
                    <button
                      key={mVal}
                      type="button"
                      onClick={() => void handleRecalibrateScaleBar(mVal)}
                      className={`px-2.5 py-1 rounded border text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                        scaleReferenceMeters === mVal
                          ? 'bg-[#1A1917] text-white border-[#1A1917]'
                          : 'bg-white text-[#1A1917] border-[#DCD8CF] hover:bg-[#F1EFE9]'
                      }`}
                    >
                      {unitSystem === 'metric'
                        ? `${mVal.toFixed(1)} m`
                        : `${(mVal * M_TO_FT).toFixed(0)} ft`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Spatial Dimension & Explicit Ceiling Height Inputs */}
            <div className="mt-6 pt-5 border-t border-[#E6E3DC]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#64615B] mb-1.5">
                    <span>Room Length ({unitSystem === 'metric' ? 'm' : 'ft'})</span>
                    <span className="font-mono tabular-nums text-[#1A1917]">
                      {displayLength} {unitSystem === 'metric' ? 'm' : 'ft'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={unitSystem === 'metric' ? 4.0 : 13}
                      max={unitSystem === 'metric' ? 11.0 : 36}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayLength}
                      onChange={(e) => updateDimension('lengthFt', Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#DCD8CF] rounded-md text-[#1A1917] focus:outline-none focus:border-[#1B4D3E]"
                    />
                    <input
                      type="range"
                      min={unitSystem === 'metric' ? 4.0 : 13}
                      max={unitSystem === 'metric' ? 11.0 : 36}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayLength}
                      onChange={(e) => updateDimension('lengthFt', Number(e.target.value))}
                      className="flex-1 accent-[#1B4D3E] cursor-pointer"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#64615B] mb-1.5">
                    <span>Room Width ({unitSystem === 'metric' ? 'm' : 'ft'})</span>
                    <span className="font-mono tabular-nums text-[#1A1917]">
                      {displayWidth} {unitSystem === 'metric' ? 'm' : 'ft'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={unitSystem === 'metric' ? 3.4 : 11}
                      max={unitSystem === 'metric' ? 8.5 : 28}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayWidth}
                      onChange={(e) => updateDimension('widthFt', Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#DCD8CF] rounded-md text-[#1A1917] focus:outline-none focus:border-[#1B4D3E]"
                    />
                    <input
                      type="range"
                      min={unitSystem === 'metric' ? 3.4 : 11}
                      max={unitSystem === 'metric' ? 8.5 : 28}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayWidth}
                      onChange={(e) => updateDimension('widthFt', Number(e.target.value))}
                      className="flex-1 accent-[#1B4D3E] cursor-pointer"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#1A1917] mb-1.5">
                    <span>Ceiling Height ({unitSystem === 'metric' ? 'm' : 'ft'})</span>
                    <span className="font-mono tabular-nums text-[#1B4D3E] font-semibold">
                      {displayHeight} {unitSystem === 'metric' ? 'm' : 'ft'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      aria-label="Ceiling height"
                      min={unitSystem === 'metric' ? 2.4 : 8.0}
                      max={unitSystem === 'metric' ? 4.2 : 14.0}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayHeight}
                      onChange={(e) => updateDimension('heightFt', Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#1B4D3E]/50 rounded-md text-[#1A1917] focus:outline-none focus:border-[#1B4D3E]"
                    />
                    <input
                      type="range"
                      min={unitSystem === 'metric' ? 2.4 : 8.0}
                      max={unitSystem === 'metric' ? 4.2 : 14.0}
                      step={unitSystem === 'metric' ? 0.1 : 0.5}
                      value={displayHeight}
                      onChange={(e) => updateDimension('heightFt', Number(e.target.value))}
                      className="flex-1 accent-[#1B4D3E] cursor-pointer"
                    />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1EFE9] rounded-lg">
                  {LAYOUT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onChangeRoom((prev) => ({
                          ...prev,
                          layoutPreset: preset.id,
                          includeDiningZone:
                            preset.id === 'open-living-dining' || preset.id === 'studio-loft',
                          includePartitionWall: preset.id === 'l-shaped-suite',
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        room.layoutPreset === preset.id
                          ? 'bg-white text-[#1A1917] shadow-xs'
                          : 'text-[#64615B] hover:text-[#1A1917]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-[#1A1917]">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={room.includeDiningZone}
                      onChange={(e) =>
                        onChangeRoom((prev) => ({
                          ...prev,
                          includeDiningZone: e.target.checked,
                        }))
                      }
                      className="rounded border-[#DCD8CF] accent-[#1B4D3E]"
                    />
                    <span>Include Dining Zone</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={room.includePartitionWall}
                      onChange={(e) =>
                        onChangeRoom((prev) => ({
                          ...prev,
                          includePartitionWall: e.target.checked,
                        }))
                      }
                      className="rounded border-[#DCD8CF] accent-[#1B4D3E]"
                    />
                    <span>Scanned Partition Walls</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Existing Space Photos & Color Extraction */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1A1917]">
                  Existing Space Photos
                </h3>
                <p className="text-sm text-[#64615B]">
                  {room.photos.length} {room.photos.length === 1 ? 'photo' : 'photos'} uploaded · Auto-extracts palette
                </p>
              </div>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A1917] bg-[#F1EFE9] hover:bg-[#E6E3DC] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Add Photos
              </button>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handlePhotoFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragTarget('photo');
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragTarget(null);
                if (e.dataTransfer.files) void handlePhotoFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border transition-colors ${
                dragTarget === 'photo'
                  ? 'border-[#1B4D3E] bg-[#1B4D3E]/5'
                  : 'border-[#E6E3DC] bg-[#F8F7F4]'
              }`}
            >
              {room.photos.length === 0 ? (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full aspect-[4/3] flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-[#F1EFE9]/60 transition-colors"
                >
                  <ImagePlus className="w-7 h-7 text-[#64615B] mb-3" />
                  <p className="text-sm font-medium text-[#1A1917] mb-1">
                    Drop photos of your current room
                  </p>
                  <p className="text-xs text-[#64615B]">
                    Up to 6 reference angles for existing tone &amp; daylight analysis
                  </p>
                </button>
              ) : (
                <div className="p-3 space-y-3">
                  {room.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="bg-white border border-[#E6E3DC] rounded-lg overflow-hidden"
                    >
                      <div className="relative aspect-[16/10] bg-[#EFECE6]">
                        <img
                          src={photo.dataUrl}
                          alt={photo.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${photo.name}`}
                          onClick={() =>
                            onChangeRoom((prev) => ({
                              ...prev,
                              photos: prev.photos.filter((p) => p.id !== photo.id),
                            }))
                          }
                          className="absolute top-2.5 right-2.5 p-1.5 bg-[#1A1917]/80 hover:bg-[#1A1917] text-white rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#1A1917] truncate">
                            {photo.name}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-[#64615B]">
                            {photo.width} × {photo.height} px · Existing palette
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {photo.extractedColors.map((hex) => (
                            <span
                              key={hex}
                              title={hex}
                              className="w-5 h-5 rounded-sm border border-black/15"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calibration Summary */}
            <div className="mt-5 pt-4 border-t border-[#E6E3DC] flex items-center justify-between text-xs text-[#64615B]">
              <span className="inline-flex items-center gap-1.5 text-[#1B4D3E] font-medium">
                <Check className="w-3.5 h-3.5" />
                Synced to 3D Studio &amp; Estimator
              </span>
              <span className="font-mono tabular-nums">
                {formatArea(areaSqFt, unitSystem)} · {formatLength(2 * (room.widthFt + room.lengthFt), unitSystem)} perim
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
