import React, { useRef, useState } from 'react';
import { Upload, ImagePlus, Trash2, Layers, Check, ArrowRight } from 'lucide-react';
import { RoomConfig, RoomLayoutPreset, UploadedSpacePhoto } from '../types/design';
import { SAMPLE_FLOOR_PLAN_IMAGE, SAMPLE_ROOM_PHOTO_IMAGE } from '../data/styles';
import { analyzeFloorPlanImage, extractDominantColors } from '../utils/imageAnalysis';

interface SpaceUploadStageProps {
  room: RoomConfig;
  onChangeRoom: (updater: (prev: RoomConfig) => RoomConfig) => void;
  onContinueToMoodBoard: () => void;
}

const LAYOUT_PRESETS: { id: RoomLayoutPreset; label: string }[] = [
  { id: 'open-living-dining', label: 'Living & Dining' },
  { id: 'studio-loft', label: 'Studio Loft' },
  { id: 'l-shaped-suite', label: 'L-Shaped Suite' },
  { id: 'primary-living', label: 'Primary Lounge' },
];

export const SpaceUploadStage: React.FC<SpaceUploadStageProps> = ({
  room,
  onChangeRoom,
  onContinueToMoodBoard,
}) => {
  const floorPlanInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [showZoneOverlay, setShowZoneOverlay] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<'plan' | 'photo' | null>(null);

  const areaSqFt = Math.round(room.widthFt * room.lengthFt);

  const processFloorPlanDataUrl = async (dataUrl: string, fileName: string) => {
    setAnalyzingPlan(true);
    setPlanError(null);
    try {
      const analysis = await analyzeFloorPlanImage(dataUrl);
      onChangeRoom((prev) => ({
        ...prev,
        floorPlanUrl: dataUrl,
        floorPlanName: fileName,
        floorPlanAnalysis: analysis,
        widthFt: analysis.suggestedWidthFt,
        lengthFt: analysis.suggestedLengthFt,
        includePartitionWall: analysis.hasPartition,
        includeDiningZone: analysis.suggestedLengthFt >= 20,
      }));
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
    await processFloorPlanDataUrl(SAMPLE_FLOOR_PLAN_IMAGE, 'Residence_Living_Dining_26x16.jpg');
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

  return (
    <section id="space" className="pt-10 pb-14 border-b border-[#E6E3DC]">
      <div className="max-w-[1360px] mx-auto px-6">
        {/* Editorial Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#64615B] mb-2">
              01. Space Capture & Spatial Calibration
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1A1917] leading-tight [text-wrap:balance]">
              Upload your floor plan and space photos to generate an editable 3D room.
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
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
          {/* Left Column (7 cols): Floor Plan Upload & Dimension Calibration */}
          <div className="lg:col-span-7 bg-white border border-[#E6E3DC] rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#1A1917]">
                  Architectural Floor Plan
                </h2>
                <p className="text-sm text-[#64615B]">
                  {room.widthFt} ft × {room.lengthFt} ft ·{' '}
                  <span className="font-mono tabular-nums text-[#1A1917]">{areaSqFt} sq ft</span> ·{' '}
                  {room.heightFt} ft ceiling
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
                    {showZoneOverlay ? 'Hide Wall Scan' : 'Show Wall Scan'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A1917] bg-[#F1EFE9] hover:bg-[#E6E3DC] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {room.floorPlanUrl ? 'Replace Plan' : 'Upload Plan'}
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
                  {/* Canvas-analyzed structural zone grid overlay */}
                  {showZoneOverlay && room.floorPlanAnalysis && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 grid grid-cols-8 grid-rows-6 pointer-events-none"
                    >
                      {room.floorPlanAnalysis.zoneGrid.flatMap((row, rIdx) =>
                        row.map((density, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className="border border-[#1B4D3E]/15"
                            style={{
                              backgroundColor:
                                density > 0.25
                                  ? `rgba(27, 77, 62, ${Math.min(0.28, density * 0.45)})`
                                  : 'transparent',
                            }}
                          />
                        )),
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-4 px-3 py-2 bg-[#1A1917]/90 text-white text-xs rounded-lg">
                    <span className="truncate font-medium">
                      {room.floorPlanName ?? 'Floor Plan Loaded'}
                    </span>
                    <span className="font-mono tabular-nums text-[#D4CFC4] shrink-0">
                      {analyzingPlan
                        ? 'Scanning walls...'
                        : room.floorPlanAnalysis
                          ? `Ratio ${room.floorPlanAnalysis.aspectRatio}:1 · ${room.floorPlanAnalysis.openingsDetected} openings`
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
                    Supports PNG, JPG, WEBP, or blueprint sketches — or click Load Sample Plan above
                  </p>
                </button>
              )}
            </div>

            {planError && (
              <p className="mt-2 text-xs text-[#B91C1C] font-medium">{planError}</p>
            )}

            {/* Spatial Dimension & Layout Controls */}
            <div className="mt-6 pt-5 border-t border-[#E6E3DC]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#64615B] mb-1.5">
                    <span>Room Length</span>
                    <span className="font-mono tabular-nums text-[#1A1917]">{room.lengthFt} ft</span>
                  </span>
                  <input
                    type="range"
                    min={14}
                    max={34}
                    step={1}
                    value={room.lengthFt}
                    onChange={(e) =>
                      onChangeRoom((prev) => ({
                        ...prev,
                        lengthFt: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#1B4D3E] cursor-pointer"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#64615B] mb-1.5">
                    <span>Room Width</span>
                    <span className="font-mono tabular-nums text-[#1A1917]">{room.widthFt} ft</span>
                  </span>
                  <input
                    type="range"
                    min={12}
                    max={26}
                    step={1}
                    value={room.widthFt}
                    onChange={(e) =>
                      onChangeRoom((prev) => ({
                        ...prev,
                        widthFt: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#1B4D3E] cursor-pointer"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-[#64615B] mb-1.5">
                    <span>Ceiling Height</span>
                    <span className="font-mono tabular-nums text-[#1A1917]">{room.heightFt} ft</span>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={13}
                    step={0.5}
                    value={room.heightFt}
                    onChange={(e) =>
                      onChangeRoom((prev) => ({
                        ...prev,
                        heightFt: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#1B4D3E] cursor-pointer"
                  />
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
                    <span>Partition Wall</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Existing Space Photos & Color Extraction */}
          <div className="lg:col-span-5 bg-white border border-[#E6E3DC] rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#1A1917]">
                  Existing Space Photos
                </h2>
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
                    Up to 6 reference angles for existing tone & daylight analysis
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
                Synced to 3D Studio & Estimator
              </span>
              <span className="font-mono tabular-nums">
                {Math.round(room.widthFt * room.lengthFt)} SF · {2 * (room.widthFt + room.lengthFt)} LF
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
