export type UnitSystem = 'metric' | 'imperial';

export type DesignStyleId =
  | 'japandi'
  | 'midcentury'
  | 'scandinavian'
  | 'industrial'
  | 'coastal';

export type RoomLayoutPreset =
  | 'hdb-5-room'
  | 'open-living-dining'
  | 'studio-loft'
  | 'l-shaped-suite'
  | 'primary-living';

export type WallDirection = 'north' | 'east' | 'west';

export type FloorMaterialType =
  | 'oak-plank'
  | 'walnut-plank'
  | 'birch-plank'
  | 'honed-concrete'
  | 'bleached-ash';

export type WallFinishType = 'limewash' | 'painted-matte' | 'brick-accent' | 'plaster';

export type RugPatternType = 'woven-sisal' | 'geometric-wool' | 'boucle-plain' | 'distressed-kilim';

export type LightingMood = 'daylight' | 'golden' | 'evening';

export type CameraMode = 'orbit' | 'walkthrough';

export type CameraPreset = 'isometric' | 'top' | 'eye-level' | 'window-nook' | 'entry';

export interface UploadedSpacePhoto {
  id: string;
  name: string;
  dataUrl: string;
  extractedColors: string[];
  width: number;
  height: number;
}

export interface DetectedWallSegment {
  /** Normalized coordinates (0..1) inside the detected room perimeter */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessNorm: number;
}

export interface NormalizedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorPlanAnalysis {
  aspectRatio: number;
  wallDensity: number;
  suggestedWidthFt: number;
  suggestedLengthFt: number;
  suggestedWidthM: number;
  suggestedLengthM: number;
  scaleBarDetected: boolean;
  scaleBarBounds: NormalizedBox | null;
  scaleBarPx: number | null;
  scaleReferenceMeters: number;
  pixelsPerMeter: number;
  scaleLabel: string;
  wallBounds: NormalizedBox;
  detectedWalls: DetectedWallSegment[];
  hasPartition: boolean;
  openingsDetected: number;
  zoneGrid: number[][]; // 12x9 normalized wall ink occupancy map
}

export interface RoomConfig {
  roomName: string;
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  planVersion: number;
  layoutPreset: RoomLayoutPreset;
  windowWall: WallDirection;
  doorWall: 'south' | 'west' | 'east';
  includePartitionWall: boolean;
  includeDiningZone: boolean;
  floorPlanName: string | null;
  floorPlanUrl: string | null;
  floorPlanAnalysis: FloorPlanAnalysis | null;
  photos: UploadedSpacePhoto[];
}

export interface ColorScheme {
  id: string;
  name: string;
  subtitle: string;
  wallHex: string;
  wallAccentHex: string;
  floorHex: string;
  woodHex: string;
  sofaHex: string;
  accentHex: string;
  rugHex: string;
  metalHex: string;
  trimHex: string;
  swatches: [string, string, string, string, string];
}

export interface MoodBoardPhoto {
  id: string;
  title: string;
  category: 'Architecture' | 'Seating' | 'Materiality' | 'Lighting' | 'Styling';
  imageUrl: string;
  unsplashQuery: string;
  photographer: string;
  photographerUrl: string;
  dominantHex: string;
  finishNote: string;
}

export interface StyleDefinition {
  id: DesignStyleId;
  name: string;
  tagline: string;
  description: string;
  heroImage: string;
  floorType: FloorMaterialType;
  wallFinish: WallFinishType;
  rugPattern: RugPatternType;
  metalness: number;
  metalRoughness: number;
  woodRoughness: number;
  costMultiplier: number;
  materialSpecs: {
    flooring: string;
    walls: string;
    textiles: string;
    hardware: string;
  };
  colorSchemes: ColorScheme[];
  moodBoardPhotos: MoodBoardPhoto[];
}

export interface RenovationScopeItem {
  id: string;
  label: string;
  category: 'Surfaces' | 'Systems' | 'Furnishings' | 'Millwork';
  description: string;
  enabled: boolean;
  unitType: 'sqft' | 'perimeter-ft' | 'fixed';
  materialRate: number;
  laborRate: number;
}

export interface CostBreakdownRow {
  id: string;
  label: string;
  category: string;
  quantityLabel: string;
  materialCost: number;
  laborCost: number;
  totalCost: number;
}

export interface CostEstimate {
  areaSqFt: number;
  rows: CostBreakdownRow[];
  materialsTotal: number;
  laborTotal: number;
  subtotal: number;
  contingency: number;
  estimatedLow: number;
  estimatedHigh: number;
  costPerSqFt: number;
}

export interface ContractorProfile {
  id: string;
  name: string;
  specialty: 'Design-Build' | 'Flooring & Millwork' | 'Painting & Plaster' | 'Electrical & Lighting';
  location: string;
  leadTime: string;
  rateTier: '$$' | '$$$' | '$$$$';
  rating: number;
  completedProjects: number;
  recommendedFor: DesignStyleId[];
  summary: string;
  websiteUrl: string;
  directoryUrl: string;
  directoryLabel: string;
}
